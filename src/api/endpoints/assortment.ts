import { z } from "zod";
import type { WoltHttp } from "../http.js";

const MAX_CATEGORY_PAGES = 40;

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  price: z.number(),
  original_price: z.number().nullish(),
  images: z.array(z.object({ url: z.string() })).default([]),
  options: z
    .array(
      z.object({
        option_id: z.string(),
        name: z.string(),
        multi_choice_config: z.object({ total_range: z.object({ min: z.number(), max: z.number() }) }).nullish(),
      }),
    )
    .default([]),
  tags: z.array(z.unknown()).default([]),
  dietary_preferences: z.array(z.unknown()).default([]),
  disabled_info: z.object({ disable_text: z.string().nullish() }).nullish(),
  alcohol_permille: z.number().nullish(),
});
export type Item = z.infer<typeof ItemSchema>;

const OptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.object({ id: z.string(), name: z.string(), price: z.number() })),
});
export type Option = z.infer<typeof OptionSchema>;

const Subcategory = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  item_ids: z.array(z.string()).default([]),
});
const Category = Subcategory.extend({ subcategories: z.array(Subcategory).default([]) });

const AssortmentSchema = z.object({
  loading_strategy: z.string(),
  categories: z.array(Category),
  items: z.array(ItemSchema).default([]),
  options: z.array(OptionSchema).default([]),
  selected_language: z.string().nullish(),
  primary_language: z.string().nullish(),
  available_languages: z.array(z.object({ language: z.string(), autotranslated: z.boolean() })).default([]),
});
export type Assortment = z.infer<typeof AssortmentSchema>;

const ItemsSchema = z.object({
  items: z.array(ItemSchema).default([]),
  options: z.array(OptionSchema).default([]),
});
export type Items = z.infer<typeof ItemsSchema>;

const CategoryPageSchema = ItemsSchema.extend({
  metadata: z.object({ next_page_token: z.string().nullish() }).nullish(),
});

const ItemPageSchema = z.object({ sections: z.array(z.unknown()).default([]) });

const base = (slug: string) =>
  `/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`;

export function fetchAssortment(http: WoltHttp, slug: string, language: string): Promise<Assortment> {
  return http.get(base(slug), { schema: AssortmentSchema, query: { language }, language });
}

export async function fetchCategoryItems(
  http: WoltHttp,
  slug: string,
  category: string,
  language: string,
): Promise<Items> {
  const items = new Map<string, Item>();
  const options = new Map<string, Option>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_CATEGORY_PAGES; page++) {
    const result = await http.get(`${base(slug)}/categories/slug/${encodeURIComponent(category)}`, {
      schema: CategoryPageSchema,
      query: { language, page_token: pageToken },
      language,
    });
    for (const item of result.items) items.set(item.id, item);
    for (const option of result.options) options.set(option.id, option);
    pageToken = result.metadata?.next_page_token ?? undefined;
    if (!pageToken) break;
  }
  return { items: [...items.values()], options: [...options.values()] };
}

export function searchAssortment(http: WoltHttp, slug: string, q: string, language: string): Promise<Items> {
  return http.post(`${base(slug)}/items/search`, { schema: ItemsSchema, query: { language }, body: { q }, language });
}

export function fetchItemsByIds(http: WoltHttp, slug: string, itemIds: string[], language: string): Promise<Items> {
  return http.post(`${base(slug)}/items`, {
    schema: ItemsSchema,
    query: { language },
    body: { item_ids: itemIds },
    language,
  });
}

export async function fetchItemExtraInfo(
  http: WoltHttp,
  venueId: string,
  itemId: string,
  language: string,
): Promise<unknown[]> {
  const page = await http.get(`/order-xp/web/v1/pages/venue/${venueId}/item/${itemId}`, {
    schema: ItemPageSchema,
    query: { language },
    language,
  });
  return page.sections;
}
