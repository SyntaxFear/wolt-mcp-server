import { z } from "zod";
import { type DishHit, searchDishes, searchVenues } from "../api/endpoints/discovery.js";
import { itemUrl, venueUrl } from "../domain/links.js";
import { liveInfoFor } from "../domain/live.js";
import { requireLocation } from "../domain/location.js";
import { money } from "../domain/money.js";
import { paginate } from "../domain/pagination.js";
import { toVenueSummary } from "../domain/venues.js";
import { type DishHitSummary, DishHitView, pageShape, pagingInput, VenueView } from "../format/views.js";
import { attachPictures, THUMBNAIL_WIDTH } from "../media/images.js";
import { defineTool, READ_WOLT } from "./defineTool.js";
import { pictureSheet, pictureSheetShape } from "./pictureSheet.js";
import { picturedVenues } from "./venuePictures.js";

type DishSort = "relevance" | "price" | "rating" | "delivery_time";

const minutes = (hit: DishHit): number => Number.parseInt(hit.estimate_range ?? "", 10) || Number.POSITIVE_INFINITY;

const ORDER: Record<Exclude<DishSort, "relevance">, (a: DishHit, b: DishHit) => number> = {
  price: (a, b) => a.price - b.price,
  rating: (a, b) => (b.venue_rating?.score ?? 0) - (a.venue_rating?.score ?? 0),
  delivery_time: (a, b) => minutes(a) - minutes(b),
};

function toDishHit(hit: DishHit, language: string): DishHitSummary {
  const url = itemUrl(venueUrl(hit.venue_slug, hit.country, language), hit.id);
  return {
    item_id: hit.id,
    name: hit.name,
    ...(hit.description && { description: hit.description }),
    price: money(hit.price, hit.currency),
    venue_slug: hit.venue_slug,
    venue_name: hit.venue_name,
    ...(hit.venue_rating && { venue_rating: hit.venue_rating.score }),
    ...(hit.estimate_range && { delivery_minutes: hit.estimate_range }),
    ...(url && { url }),
    ...(hit.image && { image: hit.image.url }),
  };
}

export const search = defineTool({
  name: "wolt_search",
  title: "Search Wolt",
  description:
    'Search near the current location. target "venues" finds restaurants and shops by name or cuisine. target "dishes" finds one dish across many venues; sort it by price, rating or delivery_time to compare where to order it. Results come with pictures. Needs a location (wolt_set_location).',
  input: {
    query: z.string().min(2).describe("What the user is looking for, for example khinkali"),
    target: z.enum(["venues", "dishes"]),
    sort: z
      .enum(["relevance", "price", "rating", "delivery_time"])
      .optional()
      .describe("Dishes only. Default relevance"),
    ...pagingInput,
  },
  output: {
    venues: z.array(VenueView).optional(),
    dishes: z.array(DishHitView).optional(),
    ...pageShape,
    ...pictureSheetShape,
  },
  annotations: READ_WOLT,
  cards: true,
  async handler({ query, target, sort = "relevance", cursor, limit }, context) {
    const { http, config, fetchImage } = context;
    const location = requireLocation(config);
    const { language, images: imageMode } = config.read();
    if (target === "venues") {
      const { items, ...paging } = paginate(await searchVenues(http, query, location, language), cursor, limit);
      const live = await liveInfoFor(
        http,
        items.map((card) => card.venue.slug),
        location,
      );
      const summaries = items.map((card) => toVenueSummary(card, location, language, live.get(card.venue.slug)));
      const pictured = await picturedVenues(context, `Wolt: ${query}`, summaries);
      return { data: { venues: pictured.venues, ...paging, ...pictured.sheet }, images: pictured.images };
    }
    const hits = await searchDishes(http, query, location, language);
    const ordered = sort === "relevance" ? hits : [...hits].sort(ORDER[sort]);
    const { items, ...paging } = paginate(ordered, cursor, limit);
    const pictured = await attachPictures(
      items.map((hit) => toDishHit(hit, language)),
      THUMBNAIL_WIDTH,
      imageMode === "always",
      fetchImage,
    );
    const entries = pictured.views.map((dish) => ({
      title: dish.name,
      detail: `${dish.price.text} · ${dish.venue_name}`,
      picture: dish.picture,
    }));
    const sheet = await pictureSheet(context, `Wolt: ${query}`, entries, pictured.images);
    return { data: { dishes: pictured.views, ...paging, ...sheet }, images: pictured.images };
  },
});
