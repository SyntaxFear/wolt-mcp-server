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

it("rejects a call with neither a match nor coordinates", async () => {
  const result = await run(setLocation, {}, testContext({}, {}));
  expect((result.content[0] as { text: string }).text).toContain("INVALID_INPUT");
});
