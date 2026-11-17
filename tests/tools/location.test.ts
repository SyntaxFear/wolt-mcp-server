import { expect, it } from "vitest";
import { run } from "../../src/tools/registry.js";
import { searchAddress } from "../../src/tools/searchAddress.js";
import { setLocation } from "../../src/tools/setLocation.js";
import { fixture, testContext } from "../helpers.js";

const routes = {
  "/v2/google/places/autocomplete/json": fixture("places-autocomplete"),
  "/v1/google/geocode-address": fixture("geocode-address"),
};

it("returns address matches for the user to pick", async () => {
  const result = await run(searchAddress, { query: "Rustaveli 12 Tbilisi" }, testContext(routes));
  const { matches } = result.structuredContent as { matches: { place_id: string; text: string }[] };
  expect(matches).toHaveLength(5);
  expect(matches[0].text).toBe("12 Shota Rustaveli Avenue, Tbilisi, Georgia");
});

it("saves a picked match as the location", async () => {
  const context = testContext(routes, {});
  const result = await run(setLocation, { place_id: "ChIJZ11mw-cMREARcwoyAUe3qKg" }, context);
  expect(result.structuredContent).toMatchObject({ location: { lat: 41.698556, lon: 44.797171 }, precise: true });
  expect(context.config.read().location?.label).toBe("12 Shota Rustaveli Ave, T'bilisi, Georgia");
});

it("saves raw coordinates", async () => {
  const context = testContext({}, {});
  await run(setLocation, { lat: 41.7, lon: 44.8, label: "Office" }, context);
  expect(context.config.read().location).toEqual({ lat: 41.7, lon: 44.8, label: "Office" });
});

it("rejects half a coordinate pair", async () => {
  const result = await run(setLocation, { lat: 41.7 }, testContext({}, {}));
  expect((result.content[0] as { text: string }).text).toContain("INVALID_INPUT");
});

it("reports the current location and saved places when called with nothing", async () => {
  const result = await run(setLocation, {}, testContext({}));
  expect(result.structuredContent).toEqual({
    location: { lat: 41.7151, lon: 44.8271, label: "Tbilisi" },
    saved_places: [],
  });
});

it("reads the pin from a short map link, following it only across map hosts", async () => {
  const full =
    "https://www.google.com/maps/place/41%C2%B041'51.7%22N+44%C2%B048'05.4%22E/@41.697701,44.8015003,296m/data=!3m2!1e3!4b1!4m4!3m3!8m2!3d41.697700!4d44.801500?entry=tts";
  const context = testContext({}, {});
  context.fetchLink = (async () => new Response(null, { status: 302, headers: { location: full } })) as typeof fetch;
  const result = await run(
    setLocation,
    { map_link: "https://maps.app.goo.gl/DZjoAezs22FhwNmy8", save_as: "Home" },
    context,
  );
  expect(result.structuredContent).toMatchObject({
    location: { lat: 41.697700, lon: 44.801500, label: "Home" },
    precise: true,
    saved_places: [{ name: "Home", label: "Home" }],
  });
});

it("refuses a link that is not a map", async () => {
  const context = testContext({}, {});
  let requested = false;
  context.fetchLink = (async () => {
    requested = true;
    return new Response(null);
  }) as typeof fetch;
  const result = await run(setLocation, { map_link: "https://example.com/?q=41.7,44.8" }, context);
  expect((result.content[0] as { text: string }).text).toContain("INVALID_INPUT");
  expect(requested).toBe(false);
});

it("refuses a map link that redirects off the map hosts", async () => {
  const context = testContext({}, {});
  context.fetchLink = (async () =>
    new Response(null, { status: 302, headers: { location: "https://evil.example/@41.7,44.8" } })) as typeof fetch;
  const result = await run(setLocation, { map_link: "https://maps.app.goo.gl/abc" }, context);
  expect((result.content[0] as { text: string }).text).toContain("INVALID_INPUT");
});

it("switches to a saved place by name, whatever the letter case, and forgets one", async () => {
  const context = testContext({}, { places: { Office: { lat: 41.7, lon: 44.8, label: "Ioseliani 8" } } });
  const result = await run(setLocation, { saved_place: "office" }, context);
  expect(result.structuredContent).toMatchObject({ location: { label: "Ioseliani 8" } });
  const after = await run(setLocation, { forget_place: "OFFICE" }, context);
  expect(after.structuredContent).toMatchObject({ saved_places: [] });
  const missing = await run(setLocation, { saved_place: "Office" }, context);
  expect((missing.content[0] as { text: string }).text).toContain("NOT_FOUND");
});
