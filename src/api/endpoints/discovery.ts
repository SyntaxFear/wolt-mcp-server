import { z } from "zod";
import type { WoltHttp } from "../http.js";
import { validate } from "../validate.js";

export interface Coordinates {
  lat: number;
  lon: number;
}

export type VenueKind = "restaurants" | "retail";

const Image = z.object({ url: z.string() });
const Rating = z.object({ score: z.number(), volume: z.number().nullish() });
const Label = z.object({ text: z.string().nullish() });

const VenueCardSchema = z.object({
  image: Image.nullish(),
  filtering: z.object({ filters: z.array(z.object({ id: z.string(), values: z.array(z.string()) })) }).nullish(),
  sorting: z.object({ sortables: z.array(z.object({ id: z.string(), value: z.number() })) }).nullish(),
  venue: z.object({
    slug: z.string(),
    name: z.string(),
    currency: z.string(),
    country: z.string().nullish(),
    location: z.array(z.number()).nullish(),
    address: z.string().nullish(),
    short_description: z.string().nullish(),
    online: z.boolean().nullish(),
    estimate_range: z.string().nullish(),
    price_range: z.number().nullish(),
    rating: Rating.nullish(),
    badges: z.array(Label).nullish(),
    promotions: z.array(Label).nullish(),
    delivery_price_highlight: z.boolean().nullish(),
  }),
});
export type VenueCard = z.infer<typeof VenueCardSchema>;

const DishHitSchema = z.object({
  link: z.object({
    menu_item_details: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullish(),
      price: z.number(),
      currency: z.string(),
      country: z.string().nullish(),
      image: Image.nullish(),
      venue_slug: z.string(),
      venue_name: z.string(),
      venue_rating: Rating.nullish(),
      estimate_range: z.string().nullish(),
    }),
  }),
});
export type DishHit = z.infer<typeof DishHitSchema>["link"]["menu_item_details"];

const CategoryOptionSchema = z.object({ id: z.string(), name: z.string() });
export type CategoryOption = z.infer<typeof CategoryOptionSchema>;

const PageSchema = z.object({
  filtering: z
    .object({ filters: z.array(z.object({ id: z.string(), values: z.array(z.unknown()).default([]) })) })
    .nullish(),
  sections: z.array(z.object({ name: z.string(), items: z.array(z.unknown()).default([]) })),
});
type Page = z.infer<typeof PageSchema>;

const SEARCH = "/v1/pages/search";

const hasVenue = (item: unknown): boolean => typeof item === "object" && item !== null && "venue" in item;

function venueCards(endpoint: string, page: Page): VenueCard[] {
  return page.sections
    .flatMap((section) => section.items)
    .filter(hasVenue)
    .map((item) => validate(endpoint, VenueCardSchema, item));
}

function categoriesOf(page: Page): CategoryOption[] {
  const primary = page.filtering?.filters.find((filter) => filter.id === "primary");
  return (primary?.values ?? []).flatMap((value) => {
    const parsed = CategoryOptionSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function fetchVenues(
  http: WoltHttp,
  kind: VenueKind,
  at: Coordinates,
  language: string,
): Promise<{ cards: VenueCard[]; categories: CategoryOption[] }> {
  const endpoint = `/v1/pages/${kind}`;
  const page = await http.get(endpoint, { schema: PageSchema, query: { lat: at.lat, lon: at.lon }, language });
  return { cards: venueCards(endpoint, page), categories: categoriesOf(page) };
}

function searchPage(
  http: WoltHttp,
  q: string,
  target: "venues" | "items",
  at: Coordinates,
  language: string,
): Promise<Page> {
  return http.post(SEARCH, { schema: PageSchema, body: { q, target, lat: at.lat, lon: at.lon }, language });
}

export async function searchVenues(http: WoltHttp, q: string, at: Coordinates, language: string): Promise<VenueCard[]> {
  return venueCards(SEARCH, await searchPage(http, q, "venues", at, language));
}

export async function searchDishes(http: WoltHttp, q: string, at: Coordinates, language: string): Promise<DishHit[]> {
  const page = await searchPage(http, q, "items", at, language);
  return page.sections
    .filter((section) => section.name === "items")
    .flatMap((section) => section.items)
    .map((item) => validate(SEARCH, DishHitSchema, item).link.menu_item_details);
}
