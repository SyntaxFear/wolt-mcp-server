import type { Coordinates, VenueCard } from "../api/endpoints/discovery.js";
import type { VenueSummary } from "../format/views.js";
import { distanceMetres } from "./distance.js";
import { venueUrl } from "./links.js";
import type { LiveInfo } from "./live.js";

const SORT_KEYS = {
  delivery_price: "delivery-price",
  delivery_time: "delivery-estimate",
  distance: "distance",
  rating: "rating",
} as const;

export type VenueSort = "recommended" | keyof typeof SORT_KEYS;

export interface VenueFilter {
  category?: string;
  openNow?: boolean;
  minRating?: number;
  maxPriceLevel?: number;
  dealsOnly?: boolean;
}

// Wolt's sortables hold a rank within the list, not a measurement.
const sortRank = (card: VenueCard, id: string): number | undefined =>
  card.sorting?.sortables.find((sortable) => sortable.id === id)?.value;

export const isOpen = (card: VenueCard): boolean => card.venue.online === true;

const categoriesOf = (card: VenueCard): string[] =>
  card.filtering?.filters.find((filter) => filter.id === "primary")?.values ?? [];

const texts = (labels: { text?: string | null }[] | null | undefined): string[] =>
  (labels ?? []).flatMap((label) => (label.text ? [label.text] : []));

const hasDeal = ({ venue }: VenueCard): boolean =>
  texts(venue.promotions).length > 0 || venue.delivery_price_highlight === true;

function matches(card: VenueCard, filter: VenueFilter): boolean {
  const { venue } = card;
  return (
    (!filter.category || categoriesOf(card).includes(filter.category)) &&
    (!filter.openNow || isOpen(card)) &&
    (filter.minRating === undefined || (venue.rating?.score ?? 0) >= filter.minRating) &&
    (filter.maxPriceLevel === undefined || (venue.price_range ?? 0) <= filter.maxPriceLevel) &&
    (!filter.dealsOnly || hasDeal(card))
  );
}

export function selectVenues(cards: VenueCard[], filter: VenueFilter, sort: VenueSort): VenueCard[] {
  const kept = cards.filter((card) => matches(card, filter));
  const openFirst = (a: VenueCard, b: VenueCard): number => Number(isOpen(b)) - Number(isOpen(a));
  if (sort === "recommended") return [...kept].sort(openFirst);
  const rank = (card: VenueCard): number => sortRank(card, SORT_KEYS[sort]) ?? Number.POSITIVE_INFINITY;
  return [...kept].sort((a, b) => openFirst(a, b) || rank(a) - rank(b));
}

function distanceTo(card: VenueCard, from: Coordinates): number | undefined {
  const [lon, lat] = card.venue.location ?? [];
  return lon === undefined || lat === undefined ? undefined : distanceMetres(from, { lat, lon });
}

export function toVenueSummary(card: VenueCard, from: Coordinates, language: string, live?: LiveInfo): VenueSummary {
  const { venue } = card;
  const distance = distanceTo(card, from);
  const url = venueUrl(venue.slug, venue.country, language);
  return {
    slug: venue.slug,
    name: venue.name,
    ...(venue.short_description && { description: venue.short_description }),
    ...(venue.address && { address: venue.address.trim() }),
    open: venue.online === true,
    ...(venue.rating && { rating: venue.rating.score }),
    ...(venue.rating?.volume != null && { rating_count: venue.rating.volume }),
    ...(venue.estimate_range && { delivery_minutes: venue.estimate_range }),
    ...(venue.price_range != null && { price_level: venue.price_range }),
    ...(distance !== undefined && { distance_m: distance }),
    categories: categoriesOf(card),
    promotions: texts(venue.promotions),
    badges: texts(venue.badges),
    ...(card.image && { image: card.image.url }),
    ...(url && { url }),
    ...live,
  };
}
