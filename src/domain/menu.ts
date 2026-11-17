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
import { type Page, paginate } from "./pagination.js";

export interface MenuFilter {
  category?: string;
  query?: string;
}

export type ItemsPage = Items & Omit<Page<Item>, "items">;

export interface CategoryOutline {
  slug: string;
  name: string;
  dishes?: number;
  subcategories: { slug: string; name: string; dishes?: number }[];
}

const TEXT_KEYS = new Set(["title", "text", "label", "value", "description", "body", "name"]);

export const WHOLE_MENU_MAX = 40;

const isFull = (assortment: Assortment): boolean => assortment.loading_strategy === "full";

/** A menu small enough to send in one answer: every dish, in menu order, with its section name. */
export function wholeMenu(assortment: Assortment): { item: Item; category: string }[] | undefined {
  if (!isFull(assortment) || assortment.items.length === 0 || assortment.items.length > WHOLE_MENU_MAX) {
    return undefined;
  }
  const byId = new Map(assortment.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: { item: Item; category: string }[] = [];
  const take = (itemIds: string[], category: string): void => {
    for (const id of itemIds) {
      const item = byId.get(id);
      if (!item || seen.has(id)) continue;
      seen.add(id);
      ordered.push({ item, category });
    }
  };
  for (const category of assortment.categories) {
    take(category.item_ids, category.name);
    for (const sub of category.subcategories) take(sub.item_ids, sub.name);
  }
  return ordered.length > 0 ? ordered : undefined;
}

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

function filterLocally(assortment: Assortment, filter: MenuFilter): Items {
  let items = assortment.items;
  if (filter.category) {
    const inCategory = new Set(categoryItemIds(assortment, filter.category));
    items = items.filter((item) => inCategory.has(item.id));
  }
  if (filter.query) {
    const needle = filter.query.toLowerCase();
    items = items.filter((item) => `${item.name} ${item.description ?? ""}`.toLowerCase().includes(needle));
  }
  return { items, options: assortment.options };
}

function pageOf(found: Items, cursor: string | undefined, limit: number | undefined): ItemsPage {
  const { items, ...paging } = paginate(found.items, cursor, limit);
  return { items, options: found.options, ...paging };
}

async function categoryItems(
  http: WoltHttp,
  slug: string,
  assortment: Assortment,
  category: string,
  language: string,
): Promise<Items> {
  const found = await fetchCategoryItems(http, slug, category, language);
  const children = assortment.categories.find((entry) => entry.slug === category)?.subcategories ?? [];
  if (found.items.length > 0 || children.length === 0) return found;
  throw new WoltError(
    "INVALID_INPUT",
    `"${category}" only groups other categories and has no products of its own.`,
    `Call wolt_get_menu with one of its subcategories: ${children.map((child) => child.slug).join(", ")}.`,
  );
}

export async function listItems(
  http: WoltHttp,
  slug: string,
  assortment: Assortment,
  filter: MenuFilter,
  language: string,
  cursor?: string,
  limit?: number,
): Promise<ItemsPage> {
  if (isFull(assortment)) return pageOf(filterLocally(assortment, filter), cursor, limit);
  if (filter.query) return pageOf(await searchAssortment(http, slug, filter.query, language), cursor, limit);
  if (filter.category) {
    return pageOf(await categoryItems(http, slug, assortment, filter.category, language), cursor, limit);
  }
  throw new WoltError(
    "INVALID_INPUT",
    "This venue's catalogue is too large to list at once.",
    "Pass a category or a query.",
  );
}

export async function findItemsByIds(
  http: WoltHttp,
  slug: string,
  assortment: Assortment,
  itemIds: string[],
  language: string,
): Promise<Items> {
  if (!isFull(assortment)) return fetchItemsByIds(http, slug, itemIds, language);
  const wanted = new Set(itemIds);
  return { items: assortment.items.filter((item) => wanted.has(item.id)), options: assortment.options };
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
