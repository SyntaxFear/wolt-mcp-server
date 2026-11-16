import { expect, it } from "vitest";
import {
  fetchAssortment,
  fetchCategoryItems,
  fetchItemExtraInfo,
  fetchItemsByIds,
  searchAssortment,
} from "../../../src/api/endpoints/assortment.js";
import { createHttp } from "../../../src/api/http.js";
import { fakeFetch, fixture } from "../../helpers.js";

const item = (id: string) => ({ id, name: id, price: 100 });

it("reads a full restaurant menu", async () => {
  const fetch = fakeFetch({ "/assortment": fixture("assortment") });
  const menu = await fetchAssortment(createHttp({ fetch }), "marge-dadiani-1", "en");
  expect(menu.loading_strategy).toBe("full");
  expect(menu.categories[0]).toMatchObject({ slug: "menucategory-1" });
  expect(menu.categories[0].item_ids).toHaveLength(5);
  expect(menu.items[0]).toMatchObject({ id: "036605f1fc74700e16f378e5", price: 2600 });
  expect(menu.items[0].options).toHaveLength(3);
  expect(fetch.calls[0].url).toContain("language=en");
});

it("reads a partial shop menu (categories only)", async () => {
  const fetch = fakeFetch({ "/assortment": fixture("assortment-retail") });
  const menu = await fetchAssortment(createHttp({ fetch }), "spar-chitaia", "en");
  expect(menu.loading_strategy).toBe("partial");
  expect(menu.categories.length).toBeGreaterThan(5);
});

it("follows page tokens for category items", async () => {
  let page = 0;
  const pages = [
    { items: [item("a")], options: [], metadata: { next_page_token: "t2" } },
    { items: [item("b")], options: [], metadata: { next_page_token: null } },
  ];
  const urls: string[] = [];
  const fetch = (async (input: URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(pages[page++]));
  }) as unknown as typeof globalThis.fetch;
  const found = await fetchCategoryItems(createHttp({ fetch }), "shop", "dairy", "en");
  expect(found.items.map((entry) => entry.id)).toEqual(["a", "b"]);
  expect(urls[0]).not.toContain("page_token");
  expect(urls[1]).toContain("page_token=t2");
});

it("searches inside a venue and loads items by id", async () => {
  const fetch = fakeFetch({
    "/assortment/items/search": fixture("assortment-search-retail"),
    "/assortment/items": { items: [item("x")], options: [] },
  });
  const http = createHttp({ fetch });
  expect((await searchAssortment(http, "spar-chitaia", "milk", "en")).items).toHaveLength(10);
  expect((await fetchItemsByIds(http, "spar-chitaia", ["x"], "en")).items[0].id).toBe("x");
  expect(JSON.parse(String(fetch.calls[1].init?.body))).toEqual({ item_ids: ["x"] });
});

it("reads the item extra-info page", async () => {
  const fetch = fakeFetch({ "/item/": fixture("item-page") });
  expect(await fetchItemExtraInfo(createHttp({ fetch }), "venue-id", "item-id", "en")).toEqual([]);
});
