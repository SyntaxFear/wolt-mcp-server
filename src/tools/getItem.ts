import { z } from "zod";
import { fetchItemExtraInfo } from "../api/endpoints/assortment.js";
import { findItems, textLines } from "../domain/menu.js";
import { WoltError } from "../errors.js";
import { DishView } from "../format/views.js";
import { attachPictures, FULL_WIDTH } from "../media/images.js";
import { defineTool, READ_WOLT } from "./defineTool.js";
import { menuHeaderShape } from "./getMenu.js";
import { loadMenu, toDishes, venueHeader } from "./menuContext.js";

export const getItem = defineTool({
  name: "wolt_get_item",
  title: "Dish details",
  description:
    "Everything about one dish or product: full description, price, every option group with its choices, prices and how many must be picked, availability, tags, any allergen or nutrition text Wolt lists, and a large picture. Call before adding a dish that has required_choices, or when the user wants to see a dish.",
  input: {
    venue: z.string().describe("Venue slug"),
    item_id: z.string().describe("Dish id from wolt_get_menu or wolt_search"),
  },
  output: {
    ...menuHeaderShape,
    dish: DishView,
    extra_info: z
      .array(z.string())
      .describe("Allergen, nutrition and product text as Wolt lists it. Empty when Wolt has none."),
  },
  annotations: READ_WOLT,
  async handler({ venue: slug, item_id }, context) {
    const menu = await loadMenu(context, slug);
    const [found, sections] = await Promise.all([
      findItems(context.http, slug, menu.assortment, { itemIds: [item_id] }, menu.language),
      fetchItemExtraInfo(context.http, menu.venue.id, item_id, menu.language),
    ]);
    if (found.items.length === 0) {
      throw new WoltError("NOT_FOUND", `This venue has no item ${item_id}.`, "Get a current id from wolt_get_menu.");
    }
    const dishes = await toDishes(context, slug, menu, found.items.slice(0, 1), found.options, true);
    const showPicture = context.config.read().images !== "links";
    const pictured = await attachPictures(dishes, FULL_WIDTH, showPicture, context.fetchImage);
    return {
      data: { ...venueHeader(menu), dish: pictured.views[0], extra_info: textLines(sections) },
      images: pictured.images,
    };
  },
});
