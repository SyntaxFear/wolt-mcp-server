import { expect, it } from "vitest";
import { getVenue } from "../../src/tools/getVenue.js";
import { listVenues } from "../../src/tools/listVenues.js";
import { run } from "../../src/tools/registry.js";
import { search } from "../../src/tools/search.js";
import { fixture, testContext } from "../helpers.js";

// biome-ignore lint/suspicious/noExplicitAny: tool output is asserted field by field
type Data = Record<string, any>;
const data = (result: { structuredContent?: unknown }) => result.structuredContent as Data;
const images = (result: { content: { type: string }[] }) => result.content.filter((block) => block.type === "image");

it("lists nearby restaurants with paging and the category list", async () => {
  const context = testContext({ "/v1/pages/restaurants": fixture("pages-restaurants") });
  const first = data(await run(listVenues, { limit: 5 }, context));
  expect(first.venues).toHaveLength(5);
  expect(first.venues[0]).toMatchObject({ slug: "marge-dadiani-1", open: true, rating: 8.8 });
  expect(first).toMatchObject({ total: 30, shown: "1-5 of 30", next_cursor: "5" });
  expect(first.available_categories).toContainEqual({ id: "pizza", name: "Pizza" });

  const second = data(await run(listVenues, { limit: 5, cursor: "5" }, context));
  expect(second.shown).toBe("6-10 of 30");
  expect(second.available_categories).toBeUndefined();
});

it("lists shops from the retail page", async () => {
  const context = testContext({ "/v1/pages/retail": fixture("pages-retail") });
  expect(data(await run(listVenues, { kind: "shops" }, context)).venues[0].slug).toBe("spar-chitaia");
});

it("needs a location", async () => {
  const result = await run(listVenues, {}, testContext({}, {}));
  expect((result.content[0] as { text: string }).text).toContain("LOCATION_REQUIRED");
});

it("searches venues", async () => {
  const context = testContext({ "/v1/pages/search": fixture("pages-search-venues") });
  const found = data(await run(search, { query: "pizza", target: "venues" }, context));
  expect(found.venues).toHaveLength(10);
  expect(found.dishes).toBeUndefined();
});

it("searches dishes, sorted by price, with pictures", async () => {
  const context = testContext({ "/v1/pages/search": fixture("pages-search-items") });
  const result = await run(search, { query: "pizza", target: "dishes", sort: "price" }, context);
  const prices = data(result).dishes.map((dish: Data) => dish.price.amount);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
  expect(data(result).dishes[0].picture).toBe(1);
  expect(images(result).length).toBeGreaterThan(0);
});

it("sends no pictures when images are set to links", async () => {
  const context = testContext(
    { "/v1/pages/search": fixture("pages-search-items") },
    { location: { lat: 1, lon: 1, label: "x" }, images: "links" },
  );
  expect(images(await run(search, { query: "pizza", target: "dishes" }, context))).toHaveLength(0);
});

it("describes one venue with live status", async () => {
  const context = testContext({ "/static": fixture("venue-static"), "/dynamic/": fixture("venue-dynamic") });
  const venue = data(await run(getVenue, { venue: "marge-dadiani-1" }, context));
  expect(venue).toMatchObject({
    slug: "marge-dadiani-1",
    is_open: true,
    order_minimum: { amount: 1200, currency: "GEL", text: "12.00 GEL" },
    delivery: [{ method: "homedelivery", estimate: "40-50 min" }],
  });
  expect(venue.opening_hours[0]).toEqual({ day: "Monday", hours: "10:00–02:45" });
});
