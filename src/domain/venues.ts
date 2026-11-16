import type { VenueCard } from "../api/endpoints/discovery.js";
import type { VenueSummary } from "../format/views.js";

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

const sortValue = (card: VenueCard, id: string): number | undefined =>
  card.sorting?.sortables.find((sortable) => sortable.id === id)?.value;

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
    (!filter.openNow || venue.online === true) &&
    (filter.minRating === undefined || (venue.rating?.score ?? 0) >= filter.minRating) &&
    (filter.maxPriceLevel === undefined || (venue.price_range ?? 0) <= filter.maxPriceLevel) &&
    (!filter.dealsOnly || hasDeal(card))
  );
}

export function selectVenues(cards: VenueCard[], filter: VenueFilter, sort: VenueSort): VenueCard[] {
  const kept = cards.filter((card) => matches(card, filter));
  if (sort === "recommended") return kept;
  const direction = sort === "rating" ? -1 : 1;
  const rank = (card: VenueCard): number => {
    const value = sortValue(card, SORT_KEYS[sort]);
    return value === undefined ? Number.POSITIVE_INFINITY : direction * value;
  };
  return [...kept].sort((a, b) => rank(a) - rank(b));
}

export function toVenueSummary(card: VenueCard): VenueSummary {
  const { venue } = card;
  const distance = sortValue(card, SORT_KEYS.distance);
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
  };
}
