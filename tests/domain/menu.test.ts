import { describe, expect, it } from "vitest";
import type { Assortment, Item } from "../../src/api/endpoints/assortment.js";
import { fetchAssortment } from "../../src/api/endpoints/assortment.js";
import { createHttp } from "../../src/api/http.js";
import { findItems, isTranslated, outline, textLines, toDish } from "../../src/domain/menu.js";
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

describe("findItems on a full menu", () => {
  it("filters by category", async () => {
    expect((await findItems(noHttp, "x", full, { category: "menucategory-1" }, "en")).items).toHaveLength(5);
  });

  it("filters by ids and by text", async () => {
    const first = full.items[0];
    expect((await findItems(noHttp, "x", full, { itemIds: [first.id] }, "en")).items).toEqual([first]);
    const hits = await findItems(noHttp, "x", full, { query: first.name.slice(0, 4).toUpperCase() }, "en");
    expect(hits.items).toContainEqual(first);
  });

  it("rejects an unknown category", async () => {
    await expect(findItems(noHttp, "x", full, { category: "nope" }, "en")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("findItems on a partial menu", () => {
  const entry = { id: "a", name: "Milk", price: 595 };
  const fetch = fakeFetch({
    "/assortment/categories/slug/dairy": { items: [entry], options: [] },
    "/assortment/items/search": { items: [entry], options: [] },
    "/assortment/items": { items: [entry], options: [] },
  });
  const http = createHttp({ fetch });

  it("uses the category, search and items endpoints", async () => {
    await findItems(http, "shop", partial, { category: "dairy" }, "en");
    await findItems(http, "shop", partial, { query: "milk" }, "en");
    await findItems(http, "shop", partial, { itemIds: ["a"] }, "en");
    expect(fetch.calls.map((call) => new URL(call.url).pathname.split("/assortment")[1])).toEqual([
      "/categories/slug/dairy",
      "/items/search",
      "/items",
    ]);
  });

  it("refuses to list a whole catalogue", async () => {
    await expect(findItems(http, "shop", partial, {}, "en")).rejects.toMatchObject({ code: "INVALID_INPUT" });
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
