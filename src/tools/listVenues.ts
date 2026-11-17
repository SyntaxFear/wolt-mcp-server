import { z } from "zod";
import { fetchVenues } from "../api/endpoints/discovery.js";
import { liveInfoFor } from "../domain/live.js";
import { requireLocation } from "../domain/location.js";
import { paginate } from "../domain/pagination.js";
import { isOpen, selectVenues, toVenueSummary } from "../domain/venues.js";
import { pageShape, pagingInput, VenueView } from "../format/views.js";
import { defineTool, READ_WOLT } from "./defineTool.js";

const PAGE_OF = { restaurants: "restaurants", shops: "retail" } as const;
const OPENING_NEXT = 5;

export const listVenues = defineTool({
  name: "wolt_list_venues",
  title: "List nearby venues",
  description:
    "List restaurants or shops (supermarkets, pharmacies and other stores) that deliver to the current location, with delivery fee, minimum order, distance and a link for each. Open venues come first. With open_now, the answer also says how many venues are closed and which open next; tell the user. Use wolt_search instead when the user names a dish or a venue. Needs a location (wolt_set_location).",
  input: {
    kind: z.enum(["restaurants", "shops"]).optional().describe("Default restaurants"),
    category: z.string().optional().describe("Category id from available_categories, for example pizza"),
    open_now: z.boolean().optional().describe("Only venues taking orders now"),
    min_rating: z.number().min(0).max(10).optional(),
    max_price_level: z.number().int().min(1).max(4).optional(),
    deals_only: z.boolean().optional().describe("Only venues with a promotion or discounted delivery"),
    sort: z
      .enum(["recommended", "delivery_time", "delivery_price", "rating", "distance"])
      .optional()
      .describe("Default recommended (Wolt's own order)"),
    ...pagingInput,
  },
  output: {
    venues: z.array(VenueView),
    ...pageShape,
    available_categories: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .optional()
      .describe("Category ids usable as the category filter. Only on the first page."),
    closed: z
      .object({
        count: z.number().describe("Venues left out because they are closed now"),
        opening_next: z.array(z.object({ slug: z.string(), name: z.string(), opens: z.string() })),
      })
      .optional()
      .describe("Only with open_now, on the first page"),
  },
  annotations: READ_WOLT,
  async handler(args, { http, config }) {
    const location = requireLocation(config);
    const page = PAGE_OF[args.kind ?? "restaurants"];
    const { language } = config.read();
    const { cards, categories } = await fetchVenues(http, page, location, language);
    const filter = {
      category: args.category,
      minRating: args.min_rating,
      maxPriceLevel: args.max_price_level,
      dealsOnly: args.deals_only,
    };
    const matching = selectVenues(cards, filter, args.sort ?? "recommended");
    const selected = args.open_now ? matching.filter(isOpen) : matching;
    const { items, ...paging } = paginate(selected, args.cursor, args.limit);
    const firstPage = args.cursor === undefined;
    const closedCards = args.open_now && firstPage ? matching.filter((card) => !isOpen(card)) : [];
    const soonest = closedCards.slice(0, OPENING_NEXT);
    const live = await liveInfoFor(
      http,
      [...items, ...soonest].map((card) => card.venue.slug),
      location,
    );
    const openingNext = soonest
      .flatMap(({ venue }) => {
        const opens = live.get(venue.slug)?.next_open;
        return opens ? [{ slug: venue.slug, name: venue.name, opens }] : [];
      })
      .sort((a, b) => a.opens.localeCompare(b.opens));
    return {
      data: {
        venues: items.map((card) => toVenueSummary(card, location, language, live.get(card.venue.slug))),
        ...paging,
        ...(firstPage && { available_categories: categories }),
        ...(closedCards.length > 0 && { closed: { count: closedCards.length, opening_next: openingNext } }),
      },
    };
  },
});
