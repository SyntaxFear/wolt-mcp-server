import { expect, it } from "vitest";
import { fetchVenues, searchDishes, searchVenues } from "../../../src/api/endpoints/discovery.js";
import { createHttp } from "../../../src/api/http.js";
import { fakeFetch, fixture } from "../../helpers.js";

const at = { lat: 41.7151, lon: 44.8271 };

it("reads the restaurant page", async () => {
  const fetch = fakeFetch({ "/v1/pages/restaurants": fixture("pages-restaurants") });
  const { cards, categories } = await fetchVenues(createHttp({ fetch }), "restaurants", at, "en");
  expect(cards).toHaveLength(30);
  expect(cards[0].venue).toMatchObject({ slug: "marge-dadiani-1", currency: "GEL", online: true });
  expect(categories).toContainEqual({ id: "pizza", name: "Pizza" });
  expect(fetch.calls[0].url).toContain("lat=41.7151&lon=44.8271");
});

it("reads the shop page", async () => {
  const fetch = fakeFetch({ "/v1/pages/retail": fixture("pages-retail") });
  const { cards } = await fetchVenues(createHttp({ fetch }), "retail", at, "en");
  expect(cards[0].venue.slug).toBe("spar-chitaia");
});

it("searches venues and dishes with the right target", async () => {
  const venueFetch = fakeFetch({ "/v1/pages/search": fixture("pages-search-venues") });
  const venues = await searchVenues(createHttp({ fetch: venueFetch }), "pizza", at, "en");
  expect(venues).toHaveLength(10);
  expect(JSON.parse(String(venueFetch.calls[0].init?.body))).toEqual({ q: "pizza", target: "venues", ...at });

  const dishFetch = fakeFetch({ "/v1/pages/search": fixture("pages-search-items") });
  const dishes = await searchDishes(createHttp({ fetch: dishFetch }), "pizza", at, "en");
  expect(dishes).toHaveLength(10);
  expect(dishes[0]).toMatchObject({ currency: "GEL" });
  expect(typeof dishes[0].venue_slug).toBe("string");
});
