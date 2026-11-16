import { z } from "zod";
import { fetchVenueDynamic, fetchVenueStatic } from "../api/endpoints/venue.js";
import { requireLocation } from "../domain/location.js";
import { money } from "../domain/money.js";
import { MoneyView } from "../format/views.js";
import { defineTool, READ_WOLT } from "./defineTool.js";

const text = z.string().optional();
const optional = (value: string | null | undefined): string | undefined => value ?? undefined;

export const getVenue = defineTool({
  name: "wolt_get_venue",
  title: "Venue details",
  description:
    "Details of one venue for the current location: whether it is open now, opening hours, delivery time, minimum order and fees. Call before ordering from a venue, or when the user asks about one. Needs a location (wolt_set_location).",
  input: {
    venue: z.string().describe("Venue slug from wolt_list_venues or wolt_search"),
  },
  output: {
    slug: z.string(),
    name: z.string(),
    kind: text,
    description: text,
    address: text,
    phone: text,
    rating: z.number().optional(),
    is_open: z.boolean(),
    status: text.describe('Wolt\'s own wording, for example "Open until 02:45"'),
    next_open: text,
    next_close: text,
    opening_hours: z.array(z.object({ day: z.string(), hours: z.string() })),
    delivery: z.array(z.object({ method: z.string(), estimate: text })),
    delivery_methods: z.array(z.string()),
    order_minimum: MoneyView.optional(),
    base_delivery_fee: text.describe("As Wolt words it. The exact fee for an order comes at checkout."),
    service_fee: text,
    image: text,
    share_url: text,
  },
  annotations: READ_WOLT,
  async handler({ venue: slug }, { http, config }) {
    const location = requireLocation(config);
    const [{ venue, order_minimum }, live] = await Promise.all([
      fetchVenueStatic(http, slug, config.read().language),
      fetchVenueDynamic(http, slug, location),
    ]);
    const status = live.venue.delivery_open_status;
    return {
      data: {
        slug: venue.slug,
        name: venue.name,
        kind: optional(venue.product_line),
        description: optional(venue.description),
        address: optional(venue.address)?.trim(),
        phone: optional(venue.phone),
        rating: venue.rating?.score_raw ?? undefined,
        is_open: status?.is_open === true,
        status: status?.value,
        next_open: optional(status?.next_open),
        next_close: optional(status?.next_close),
        opening_hours: (venue.opening_times_schedule ?? []).map(({ day, formatted_times }) => ({
          day,
          hours: formatted_times,
        })),
        delivery: (live.venue.delivery_configs ?? []).map(({ method, estimate }) => ({
          method,
          estimate: estimate?.label,
        })),
        delivery_methods: venue.delivery_methods,
        order_minimum: order_minimum != null ? money(order_minimum, venue.currency) : undefined,
        base_delivery_fee: optional(venue.info?.venue_info_base_delivery_price),
        service_fee: optional(venue.info?.venue_info_service_fee_description),
        image: optional(venue.image_url),
        share_url: optional(venue.share_url),
      },
    };
  },
});
