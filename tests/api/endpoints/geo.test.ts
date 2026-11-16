import { expect, it } from "vitest";
import { autocompleteAddress, geocodePlace } from "../../../src/api/endpoints/geo.js";
import { createHttp } from "../../../src/api/http.js";
import { fakeFetch, fixture } from "../../helpers.js";

const fetch = fakeFetch({
  "/v2/google/places/autocomplete/json": fixture("places-autocomplete"),
  "/v1/google/geocode-address": fixture("geocode-address"),
});
const http = createHttp({ fetch });

it("returns address matches", async () => {
  const matches = await autocompleteAddress(http, "Rustaveli 12 Tbilisi", "en", "GEO");
  expect(matches[0]).toEqual({
    place_id: "ChIJZ11mw-cMREARcwoyAUe3qKg",
    text: "12 Shota Rustaveli Avenue, Tbilisi, Georgia",
  });
  expect(fetch.calls[0].url).toContain("components=country%3Ageo");
});

it("geocodes a place id", async () => {
  expect(await geocodePlace(http, "ChIJZ11mw-cMREARcwoyAUe3qKg", "en")).toEqual({
    lat: 41.698556,
    lon: 44.797171,
    label: "12 Shota Rustaveli Ave, T'bilisi, Georgia",
    precise: true,
  });
});
