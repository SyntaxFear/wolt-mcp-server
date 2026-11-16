import { z } from "zod";
import { fetchVenues } from "../api/endpoints/discovery.js";
import { requireLocation } from "../domain/location.js";
import { paginate } from "../domain/pagination.js";
import { selectVenues, toVenueSummary } from "../domain/venues.js";
import { pageShape, pagingInput, VenueView } from "../format/views.js";
import { defineTool, READ_WOLT } from "./defineTool.js";

const PAGE_OF = { restaurants: "restaurants", shops: "retail" } as const;

export const listVenues = defineTool({
  name: "wolt_list_venues",
  title: "List nearby venues",
  description:
    "List restaurants or shops (supermarkets, pharmacies and other stores) that deliver to the current location, with filters and sorting. Use wolt_search instead when the user names a dish or a venue. Needs a location (wolt_set_location).",
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
  },
  annotations: READ_WOLT,
  async handler(args, { http, config }) {
    const location = requireLocation(config);
    const page = PAGE_OF[args.kind ?? "restaurants"];
    const { cards, categories } = await fetchVenues(http, page, location, config.read().language);
    const selected = selectVenues(
      cards,
      {
        category: args.category,
        openNow: args.open_now,
        minRating: args.min_rating,
        maxPriceLevel: args.max_price_level,
        dealsOnly: args.deals_only,
      },
      args.sort ?? "recommended",
    );
    const { items, ...paging } = paginate(selected, args.cursor, args.limit);
    return {
      data: {
        venues: items.map(toVenueSummary),
        ...paging,
        ...(args.cursor === undefined && { available_categories: categories }),
      },
    };
  },
});
