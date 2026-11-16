import { expect, it } from "vitest";
import { getItem } from "../../src/tools/getItem.js";
import { getMenu } from "../../src/tools/getMenu.js";
import { preferences } from "../../src/tools/preferences.js";
import { run } from "../../src/tools/registry.js";
import { fixture, testContext } from "../helpers.js";

// biome-ignore lint/suspicious/noExplicitAny: tool output is asserted field by field
type Data = Record<string, any>;
const data = (result: { structuredContent?: unknown }) => result.structuredContent as Data;
const images = (result: { content: { type: string }[] }) => result.content.filter((block) => block.type === "image");

const restaurant = {
  "/static": fixture("venue-static"),
  "/assortment": fixture("assortment"),
  "/item/": fixture("item-page"),
};
const FIRST_ITEM = "036605f1fc74700e16f378e5";

it("returns the category outline when no filter is given", async () => {
  const menu = data(await run(getMenu, { venue: "marge-dadiani-1" }, testContext(restaurant)));
  expect(menu.venue).toMatchObject({ slug: "marge-dadiani-1", currency: "GEL" });
  expect(menu.categories[0]).toMatchObject({ slug: "menucategory-1", dishes: 5 });
  expect(menu.dishes).toBeUndefined();
});

it("returns the dishes of a category with pictures and paging", async () => {
  const args = { venue: "marge-dadiani-1", category: "menucategory-1", limit: 3 };
  const result = await run(getMenu, args, testContext(restaurant));
  const menu = data(result);
  expect(menu.dishes).toHaveLength(3);
  expect(menu).toMatchObject({ total: 5, shown: "1-3 of 5", next_cursor: "3" });
  expect(menu.dishes[0].price.currency).toBe("GEL");
  expect(menu.dishes[0].option_groups).toBeUndefined();
  expect(images(result)).toHaveLength(menu.dishes.filter((dish: Data) => dish.picture).length);
  expect(images(result).length).toBeGreaterThan(0);
});

it("flags dishes that clash with saved preferences and echoes the preferences", async () => {
  const assortment = fixture("assortment") as { items: { name: string }[] };
  const word = assortment.items[0].name.split(" ")[0];
  const context = testContext(restaurant, {
    location: { lat: 1, lon: 1, label: "x" },
    preferences: { allergies: [word], diets: [], dislikes: [] },
  });
  const menu = data(await run(getMenu, { venue: "marge-dadiani-1", query: word }, context));
  expect(menu.dishes[0].warnings).toEqual([`Mentions "${word}" (allergy)`]);
  expect(menu.preferences.allergies).toEqual([word]);
});

it("returns one dish in full with its option groups and a large picture", async () => {
  const result = await run(getItem, { venue: "marge-dadiani-1", item_id: FIRST_ITEM }, testContext(restaurant));
  const { dish, extra_info } = data(result);
  expect(dish.id).toBe(FIRST_ITEM);
  expect(dish.option_groups).toHaveLength(3);
  expect(extra_info).toEqual([]);
  expect(images(result)).toHaveLength(1);
});

it("reports an unknown dish", async () => {
  const result = await run(getItem, { venue: "marge-dadiani-1", item_id: "0".repeat(24) }, testContext(restaurant));
  expect((result.content[0] as { text: string }).text).toContain("NOT_FOUND");
});

it("adds original names when the menu is machine-translated", async () => {
  const translated = structuredClone(fixture("assortment")) as Data;
  translated.selected_language = "en";
  translated.primary_language = "ka";
  translated.available_languages = [
    { language: "en", autotranslated: true },
    { language: "ka", autotranslated: false },
  ];
  const original = structuredClone(translated);
  original.items[0].name = "ORIGINAL";
  const routes = { "/static": fixture("venue-static"), "language=en": translated, "language=ka": original };
  const menu = data(await run(getMenu, { venue: "x", query: translated.items[0].name }, testContext(routes)));
  expect(menu.machine_translated).toBe(true);
  expect(menu.dishes[0].original_name).toBe("ORIGINAL");
});

it("reads and updates food preferences", async () => {
  const context = testContext({});
  const saved = data(await run(preferences, { allergies: ["peanut"] }, context));
  expect(saved.preferences).toEqual({ allergies: ["peanut"], diets: [], dislikes: [] });
  expect(data(await run(preferences, {}, context)).preferences.allergies).toEqual(["peanut"]);
});
