import {
  type Assortment,
  fetchCategoryItems,
  fetchItemsByIds,
  type Item,
  type Items,
  type Option,
  searchAssortment,
} from "../api/endpoints/assortment.js";
import type { WoltHttp } from "../api/http.js";
import { WoltError } from "../errors.js";
import type { Dish } from "../format/views.js";
import { money } from "./money.js";

export interface MenuQuery {
  category?: string;
  query?: string;
  itemIds?: string[];
}

export interface CategoryOutline {
  slug: string;
  name: string;
  dishes?: number;
  subcategories: { slug: string; name: string; dishes?: number }[];
}

const TEXT_KEYS = new Set(["title", "text", "label", "value", "description", "body", "name"]);

const isFull = (assortment: Assortment): boolean => assortment.loading_strategy === "full";

export function isTranslated(assortment: Assortment): boolean {
  const shown = assortment.available_languages.find((entry) => entry.language === assortment.selected_language);
  return shown?.autotranslated === true;
}

export function outline(assortment: Assortment): CategoryOutline[] {
  const count = (itemIds: string[]) => (isFull(assortment) ? { dishes: itemIds.length } : {});
  return assortment.categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    ...count([...category.item_ids, ...category.subcategories.flatMap((sub) => sub.item_ids)]),
    subcategories: category.subcategories.map((sub) => ({ slug: sub.slug, name: sub.name, ...count(sub.item_ids) })),
  }));
}

function categoryItemIds(assortment: Assortment, slug: string): string[] {
  for (const category of assortment.categories) {
    if (category.slug === slug) return [...category.item_ids, ...category.subcategories.flatMap((sub) => sub.item_ids)];
    const sub = category.subcategories.find((entry) => entry.slug === slug);
    if (sub) return sub.item_ids;
  }
  throw new WoltError(
    "NOT_FOUND",
    `This menu has no category "${slug}".`,
    "Call wolt_get_menu without category to list the categories.",
  );
}

function findLocally(assortment: Assortment, query: MenuQuery): Items {
  let items = assortment.items;
  if (query.itemIds) {
    const wanted = new Set(query.itemIds);
    items = items.filter((item) => wanted.has(item.id));
  }
  if (query.category) {
    const inCategory = new Set(categoryItemIds(assortment, query.category));
    items = items.filter((item) => inCategory.has(item.id));
  }
  if (query.query) {
    const needle = query.query.toLowerCase();
    items = items.filter((item) => `${item.name} ${item.description ?? ""}`.toLowerCase().includes(needle));
  }
  return { items, options: assortment.options };
}

export async function findItems(
  http: WoltHttp,
  slug: string,
  assortment: Assortment,
  query: MenuQuery,
  language: string,
): Promise<Items> {
  if (isFull(assortment)) return findLocally(assortment, query);
  if (query.itemIds) return fetchItemsByIds(http, slug, query.itemIds, language);
  if (query.query) return searchAssortment(http, slug, query.query, language);
  if (query.category) return fetchCategoryItems(http, slug, query.category, language);
  throw new WoltError(
    "INVALID_INPUT",
    "This venue's catalogue is too large to list at once.",
    "Pass a category or a query.",
  );
}

function labelOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  const { label, name, id } = value as Record<string, unknown>;
  const found = [label, name, id].find((candidate) => typeof candidate === "string");
  return typeof found === "string" ? [found] : [];
}

export function toDish(item: Item, options: Map<string, Option>, currency: string, detail: boolean): Dish {
  const groups = item.options.flatMap((ref) => {
    const option = options.get(ref.option_id);
    if (!option) return [];
    const min = ref.multi_choice_config?.total_range.min ?? 0;
    const max = ref.multi_choice_config?.total_range.max ?? option.values.length;
    const choices = option.values.map((value) => ({
      id: value.id,
      name: value.name,
      price: money(value.price, currency),
    }));
    return [{ id: option.id, name: ref.name, min, max, required: min > 0, choices }];
  });
  return {
    id: item.id,
    name: item.name,
    ...(item.description && { description: item.description }),
    price: money(item.price, currency),
    ...(item.original_price != null && { original_price: money(item.original_price, currency) }),
    available: !item.disabled_info,
    ...(item.disabled_info?.disable_text && { unavailable_reason: item.disabled_info.disable_text }),
    tags: item.tags.flatMap(labelOf),
    dietary: item.dietary_preferences.flatMap(labelOf),
    alcohol: (item.alcohol_permille ?? 0) > 0,
    required_choices: groups.filter((group) => group.required).map((group) => group.name),
    ...(detail && { option_groups: groups }),
    warnings: [],
    ...(item.images[0] && { image: item.images[0].url }),
  };
}

export function textLines(node: unknown, key?: string): string[] {
  if (typeof node === "string") return key !== undefined && TEXT_KEYS.has(key) && node.trim() ? [node.trim()] : [];
  if (Array.isArray(node)) return node.flatMap((child) => textLines(child, key));
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([childKey, child]) => textLines(child, childKey));
  }
  return [];
}
