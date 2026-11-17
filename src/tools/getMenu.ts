import { z } from "zod";
import { listItems, outline, WHOLE_MENU_MAX, wholeMenu } from "../domain/menu.js";
import { DishView, PreferencesView, pageShape, pagingInput } from "../format/views.js";
import { attachPictures, THUMBNAIL_WIDTH } from "../media/images.js";
import { defineTool, READ_WOLT } from "./defineTool.js";
import { loadMenu, toDishes, venueHeader } from "./menuContext.js";

const subcategory = z.object({ slug: z.string(), name: z.string(), dishes: z.number().optional() });

export const menuHeaderShape = {
  venue: z.object({ slug: z.string(), name: z.string(), currency: z.string() }),
  language: z.string(),
  machine_translated: z.boolean().describe("True when names and descriptions are Wolt's automatic translation"),
};

export const getMenu = defineTool({
  name: "wolt_get_menu",
  title: "Venue menu",
  description: `Read a venue's menu. Call with only venue: a menu of up to ${WHOLE_MENU_MAX} dishes comes back whole, every dish with its section, picture and link. A larger menu comes back as a list of categories; then call with category (a category slug) or query (text search inside this venue, the way to browse large shops) to get dishes: at most 20 per answer, each with a small picture, and a count of how many more exist. Fetch the next page only when the user asks for more. For one dish's sizes, extras and other choices, call wolt_get_item.`,
  input: {
    venue: z.string().describe("Venue slug"),
    category: z.string().optional().describe("Category slug from the category list"),
    query: z
      .string()
      .min(2)
      .optional()
      .describe("Search inside this venue. In large shops it searches the whole catalogue and category is ignored."),
    ...pagingInput,
  },
  output: {
    ...menuHeaderShape,
    categories: z.array(subcategory.extend({ subcategories: z.array(subcategory) })).optional(),
    dishes: z.array(DishView).optional(),
    total: pageShape.total.optional(),
    shown: pageShape.shown.optional(),
    next_cursor: pageShape.next_cursor,
    preferences: PreferencesView.describe("The user's saved food preferences. Respect them when suggesting dishes."),
  },
  annotations: READ_WOLT,
  async handler({ venue: slug, category, query, cursor, limit }, context) {
    const menu = await loadMenu(context, slug);
    const { preferences, images: imageMode } = context.config.read();
    const header = { ...venueHeader(menu), preferences };
    if (!category && !query) {
      const categories = outline(menu.assortment);
      const whole = wholeMenu(menu.assortment);
      if (!whole) return { data: { ...header, categories } };
      const dishes = await toDishes(
        context,
        slug,
        menu,
        whole.map((entry) => entry.item),
        menu.assortment.options,
        false,
      );
      const sectioned = dishes.map((dish, index) => ({ ...dish, category: whole[index].category }));
      const pictured = await attachPictures(sectioned, THUMBNAIL_WIDTH, imageMode === "always", context.fetchImage);
      const total = sectioned.length;
      return {
        data: { ...header, categories, dishes: pictured.views, total, shown: `1-${total} of ${total}` },
        images: pictured.images,
      };
    }

    const filter = { category, query };
    const { items, options, ...paging } = await listItems(
      context.http,
      slug,
      menu.assortment,
      filter,
      menu.language,
      cursor,
      limit,
    );
    const dishes = await toDishes(context, slug, menu, items, options, false);
    const pictured = await attachPictures(dishes, THUMBNAIL_WIDTH, imageMode === "always", context.fetchImage);
    return { data: { ...header, dishes: pictured.views, ...paging }, images: pictured.images };
  },
});
