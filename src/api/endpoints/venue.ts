import { z } from "zod";
import type { WoltHttp } from "../http.js";
import type { Coordinates } from "./discovery.js";

const text = z.string().nullish();

const VenueStaticSchema = z.object({
  order_minimum: z.number().nullish(),
  venue: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    currency: z.string(),
    address: text,
    description: text,
    phone: text,
    image_url: text,
    share_url: text,
    product_line: text,
    delivery_methods: z.array(z.string()).default([]),
    rating: z.object({ score_raw: z.number().nullish(), volume: z.number().nullish() }).nullish(),
    opening_times_schedule: z.array(z.object({ day: z.string(), formatted_times: z.string() })).nullish(),
    info: z
      .object({
        venue_info_order_minimum: text,
        venue_info_base_delivery_price: text,
        venue_info_service_fee_description: text,
      })
      .nullish(),
  }),
});
export type VenueStatic = z.infer<typeof VenueStaticSchema>;

const VenueDynamicSchema = z.object({
  venue: z.object({
    delivery_open_status: z
      .object({ value: z.string(), is_open: z.boolean(), next_open: text, next_close: text })
      .nullish(),
    delivery_configs: z
      .array(z.object({ method: z.string(), estimate: z.object({ label: z.string() }).nullish() }))
      .nullish(),
  }),
});
export type VenueDynamic = z.infer<typeof VenueDynamicSchema>;

export function fetchVenueStatic(http: WoltHttp, slug: string, language: string): Promise<VenueStatic> {
  return http.get(`/order-xp/web/v1/pages/venue/slug/${encodeURIComponent(slug)}/static`, {
    schema: VenueStaticSchema,
    language,
  });
}

export function fetchVenueDynamic(http: WoltHttp, slug: string, at: Coordinates): Promise<VenueDynamic> {
  return http.get(`/order-xp/web/v1/venue/slug/${encodeURIComponent(slug)}/dynamic/`, {
    schema: VenueDynamicSchema,
    query: { lat: at.lat, lon: at.lon, selected_delivery_method: "homedelivery" },
  });
}
