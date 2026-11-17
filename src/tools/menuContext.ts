import { type Assortment, fetchAssortment, type Item, type Option } from "../api/endpoints/assortment.js";
import { fetchVenueStatic, type VenueStatic } from "../api/endpoints/venue.js";
import { itemUrl } from "../domain/links.js";
import { findItemsByIds, isTranslated, toDish } from "../domain/menu.js";
import { warningsFor } from "../domain/preferences.js";
import type { Dish } from "../format/views.js";
import type { ToolContext } from "./defineTool.js";

export interface LoadedMenu {
  venue: VenueStatic["venue"];
  assortment: Assortment;
  language: string;
  translated: boolean;
}

export async function loadMenu({ http, config }: ToolContext, slug: string): Promise<LoadedMenu> {
  const { language, menuLanguage } = config.read();
  const [{ venue }, shown] = await Promise.all([
    fetchVenueStatic(http, slug, language),
    fetchAssortment(http, slug, language),
  ]);
  const own = shown.primary_language;
  const wantsOwn = menuLanguage === "original" && own && own !== (shown.selected_language ?? language);
  const assortment = wantsOwn ? await fetchAssortment(http, slug, own) : shown;
  return { venue, assortment, language: wantsOwn ? own : language, translated: isTranslated(assortment) };
}

async function originalNames(
  { http }: ToolContext,
  slug: string,
  menu: LoadedMenu,
  itemIds: string[],
): Promise<Map<string, string>> {
  const primary = menu.assortment.primary_language;
  if (!menu.translated || !primary || itemIds.length === 0) return new Map();
  const source = await fetchAssortment(http, slug, primary);
  const { items } = await findItemsByIds(http, slug, source, itemIds, primary);
  return new Map(items.map((item) => [item.id, item.name]));
}

export async function toDishes(
  context: ToolContext,
  slug: string,
  menu: LoadedMenu,
  items: Item[],
  options: Option[],
  detail: boolean,
): Promise<Dish[]> {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const originals = await originalNames(
    context,
    slug,
    menu,
    items.map((item) => item.id),
  );
  const { preferences } = context.config.read();
  return items.map((item) => {
    const dish = toDish(item, optionsById, menu.venue.currency, detail);
    const original = originals.get(item.id);
    const url = itemUrl(menu.venue.share_url, item.id);
    return {
      ...dish,
      ...(url && { url }),
      ...(original && original !== dish.name && { original_name: original }),
      warnings: warningsFor(`${dish.name} ${dish.description ?? ""} ${dish.tags.join(" ")}`, preferences),
    };
  });
}

export function venueHeader(menu: LoadedMenu) {
  return {
    venue: { slug: menu.venue.slug, name: menu.venue.name, currency: menu.venue.currency },
    language: menu.assortment.selected_language ?? menu.language,
    machine_translated: menu.translated,
  };
}
