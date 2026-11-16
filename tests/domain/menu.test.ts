import { describe, expect, it } from "vitest";
import type { Assortment, Item } from "../../src/api/endpoints/assortment.js";
import { fetchAssortment } from "../../src/api/endpoints/assortment.js";
import { createHttp } from "../../src/api/http.js";
import { findItemsByIds, isTranslated, listItems, outline, textLines, toDish } from "../../src/domain/menu.js";
import { fakeFetch, fixture } from "../helpers.js";

const full = await fetchAssortment(
  createHttp({ fetch: fakeFetch({ "/assortment": fixture("assortment") }) }),
  "x",
  "en",
);
const noHttp = createHttp({ fetch: fakeFetch({}) });

const partial: Assortment = {
  loading_strategy: "partial",
  categories: [{ id: "1", name: "Dairy", slug: "dairy", item_ids: [], subcategories: [] }],
  items: [],
  options: [],
  available_languages: [],
};

describe("a full menu", () => {
  it("lists a category page by page", async () => {
    const page = await listItems(noHttp, "x", full, { category: "menucategory-1" }, "en", undefined, 3);
    expect(page.items).toHaveLength(3);
    expect(page).toMatchObject({ total: 5, shown: "1-3 of 5", next_cursor: "3" });
  });

  it("searches by text and finds by id", async () => {
    const first = full.items[0];
    expect((await findItemsByIds(noHttp, "x", full, [first.id], "en")).items).toEqual([first]);
    const hits = await listItems(noHttp, "x", full, { query: first.name.slice(0, 4).toUpperCase() }, "en");
    expect(hits.items).toContainEqual(first);
  });

  it("rejects an unknown category", async () => {
    await expect(listItems(noHttp, "x", full, { category: "nope" }, "en")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("a partial menu (large shop)", () => {
  const product = (id: string) => ({ id, name: id, price: 595 });
  const routes = {
    "/assortment/categories/slug/dairy": { items: [product("a"), product("b"), product("c")], options: [] },
    "/assortment/categories/slug/groceries": { items: [], options: [] },
    "/assortment/items/search": { items: [product("a")], options: [] },
    "/assortment/items": { items: [product("b"), product("a")], options: [] },
  };
  const shop: Assortment = {
    ...partial,
    categories: [
      ...partial.categories,
      {
        id: "2",
        name: "Groceries",
        slug: "groceries",
        item_ids: [],
        subcategories: [{ id: "3", name: "Dairy", slug: "dairy", item_ids: [] }],
      },
    ],
  };

  it("pages the products of a category", async () => {
    const http = createHttp({ fetch: fakeFetch(routes) });
    const page = await listItems(http, "shop", shop, { category: "dairy" }, "en", undefined, 2);
    expect(page).toMatchObject({ total: 3, shown: "1-2 of 3", next_cursor: "2" });
    expect(page.items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("points to subcategories when a category only groups others", async () => {
    const run = listItems(createHttp({ fetch: fakeFetch(routes) }), "shop", shop, { category: "groceries" }, "en");
    await expect(run).rejects.toMatchObject({ code: "INVALID_INPUT", nextStep: expect.stringContaining("dairy") });
  });

  it("searches the whole catalogue and loads items by id", async () => {
    const fetch = fakeFetch(routes);
    const http = createHttp({ fetch });
    expect((await listItems(http, "shop", shop, { query: "milk" }, "en")).items).toHaveLength(1);
    expect((await findItemsByIds(http, "shop", shop, ["a"], "en")).items).toHaveLength(2);
    expect(fetch.calls.map((call) => new URL(call.url).pathname.split("/assortment")[1])).toEqual([
      "/items/search",
      "/items",
    ]);
  });

  it("refuses to list a whole catalogue", async () => {
    await expect(listItems(noHttp, "shop", shop, {}, "en")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("toDish", () => {
  const item = full.items[0];
  const options = new Map(full.options.map((option) => [option.id, option]));

  it("builds a list view without choices", () => {
    const dish = toDish(item, options, "GEL", false);
    expect(dish.price).toEqual({ amount: 2600, currency: "GEL", text: "26.00 GEL" });
    expect(dish.available).toBe(true);
    expect(dish.required_choices.length).toBeGreaterThan(0);
    expect(dish.option_groups).toBeUndefined();
    expect(dish.image).toMatch(/^https:\/\//);
  });

  it("builds a detail view with every option group", () => {
    const dish = toDish(item, options, "GEL", true);
    expect(dish.option_groups).toHaveLength(3);
    expect(dish.option_groups?.[0]).toMatchObject({ min: 1, max: 1, required: true });
    expect(dish.option_groups?.[0].choices[0].price.currency).toBe("GEL");
  });

  it("marks sold-out items and alcohol", () => {
    const soldOut: Item = {
      ...item,
      disabled_info: { disable_text: "Sold out" },
      alcohol_permille: 120,
      tags: [{ label: "Popular" }, "Spicy"],
    };
    expect(toDish(soldOut, options, "GEL", false)).toMatchObject({
      available: false,
      unavailable_reason: "Sold out",
      alcohol: true,
      tags: ["Popular", "Spicy"],
    });
  });
});

describe("outline", () => {
  it("lists categories with counts for full menus", () => {
    expect(outline(full)[0]).toMatchObject({ slug: "menucategory-1", dishes: 5 });
  });

  it("omits counts for partial menus", () => {
    expect(outline(partial)[0]).toEqual({ slug: "dairy", name: "Dairy", subcategories: [] });
  });
});

it("detects machine translation", () => {
  const english = {
    ...partial,
    selected_language: "en",
    available_languages: [{ language: "en", autotranslated: true }],
  };
  const georgian = {
    ...partial,
    selected_language: "ka",
    available_languages: [{ language: "ka", autotranslated: false }],
  };
  expect(isTranslated(english)).toBe(true);
  expect(isTranslated(georgian)).toBe(false);
});

it("collects readable lines from an extra-info page", () => {
  const sections = [{ title: "Allergens", items: [{ text: "Milk" }, { text: " Nuts " }], template: "list", id: "abc" }];
  expect(textLines(sections)).toEqual(["Allergens", "Milk", "Nuts"]);
});
