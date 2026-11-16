import { fetchAssortment, fetchItemsByIds } from "./api/endpoints/assortment.js";
import { fetchVenues, searchDishes, searchVenues } from "./api/endpoints/discovery.js";
import { autocompleteAddress, geocodePlace } from "./api/endpoints/geo.js";
import { fetchVenueDynamic, fetchVenueStatic } from "./api/endpoints/venue.js";
import { attachPictures, THUMBNAIL_WIDTH } from "./media/images.js";
import type { ToolContext } from "./tools/defineTool.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const SAMPLE_POINT = { lat: 41.7151, lon: 44.8271 };
const LANGUAGE = "en";

function some<T>(list: T[], what: string): T[] {
  if (list.length === 0) throw new Error(`no ${what} returned`);
  return list;
}

const count = (what: string) => (list: unknown[]) => `${list.length} ${what}`;

export async function runChecks({
  http,
  fetchImage,
}: Pick<ToolContext, "http" | "fetchImage">): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const check = async <T>(
    name: string,
    action: () => Promise<T>,
    describe: (value: T) => string,
  ): Promise<T | undefined> => {
    try {
      const value = await action();
      results.push({ name, ok: true, detail: describe(value) });
      return value;
    } catch (error) {
      results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  };

  const restaurants = await check(
    "restaurant list",
    async () => some((await fetchVenues(http, "restaurants", SAMPLE_POINT, LANGUAGE)).cards, "venues"),
    count("venues"),
  );
  await check(
    "shop list",
    async () => some((await fetchVenues(http, "retail", SAMPLE_POINT, LANGUAGE)).cards, "shops"),
    count("shops"),
  );
  await check(
    "venue search",
    async () => some(await searchVenues(http, "pizza", SAMPLE_POINT, LANGUAGE), "venues"),
    count("venues"),
  );
  await check(
    "dish search",
    async () => some(await searchDishes(http, "pizza", SAMPLE_POINT, LANGUAGE), "dishes"),
    count("dishes"),
  );

  const slug = restaurants?.find((card) => card.venue.online)?.venue.slug;
  if (slug) {
    await check(
      "venue details",
      () => fetchVenueStatic(http, slug, LANGUAGE),
      (page) => page.venue.name,
    );
    await check(
      "venue live status",
      () => fetchVenueDynamic(http, slug, SAMPLE_POINT),
      (page) => page.venue.delivery_open_status?.value ?? "no status",
    );
    const menu = await check(
      "menu",
      async () => some((await fetchAssortment(http, slug, LANGUAGE)).items, "dishes"),
      count("dishes"),
    );
    const first = menu?.[0];
    if (first) {
      await check(
        "items by id",
        async () => some((await fetchItemsByIds(http, slug, [first.id], LANGUAGE)).items, "items"),
        count("items"),
      );
    }
    const image = menu?.find((item) => item.images[0])?.images[0].url;
    if (image) {
      await check(
        "small pictures",
        async () => some((await attachPictures([{ image }], THUMBNAIL_WIDTH, true, fetchImage)).images, "pictures"),
        (pictures) => `${Math.round((pictures[0].data.length * 3) / 4 / 1024)} KB`,
      );
    }
  }

  const matches = await check(
    "address search",
    async () => some(await autocompleteAddress(http, "Rustaveli 12 Tbilisi", LANGUAGE), "matches"),
    count("matches"),
  );
  const placeId = matches?.[0]?.place_id;
  if (placeId) {
    await check(
      "address lookup",
      () => geocodePlace(http, placeId, LANGUAGE),
      (place) => place.label,
    );
  }

  return results;
}
