import { describe, expect, it } from "vitest";
import type { VenueCard } from "../../src/api/endpoints/discovery.js";
import { selectVenues, toVenueSummary } from "../../src/domain/venues.js";

const card = (
  slug: string,
  extra: Partial<VenueCard["venue"]> = {},
  sort: Record<string, number> = {},
  primary: string[] = [],
): VenueCard => ({
  venue: { slug, name: slug, currency: "GEL", online: true, ...extra },
  filtering: { filters: [{ id: "primary", values: primary }] },
  sorting: { sortables: Object.entries(sort).map(([id, value]) => ({ id, value })) },
});

const cards = [
  card("far-good", { rating: { score: 9.4 } }, { distance: 900, "delivery-estimate": 40 }, ["pizza"]),
  card("near-ok", { rating: { score: 8.1 }, price_range: 3 }, { distance: 100, "delivery-estimate": 20 }, ["sushi"]),
  card("closed", { online: false, rating: { score: 9.9 } }, { distance: 50 }, ["pizza"]),
  card("deal", { promotions: [{ text: "-20% on all" }] }, {}, ["pizza"]),
];

describe("selectVenues", () => {
  const slugs = (
    filter: Parameters<typeof selectVenues>[1],
    sort: Parameters<typeof selectVenues>[2] = "recommended",
  ) => selectVenues(cards, filter, sort).map((entry) => entry.venue.slug);

  it("keeps Wolt's order by default, open venues first", () => {
    expect(slugs({})).toEqual(["far-good", "near-ok", "deal", "closed"]);
  });

  it("filters by category, open state, rating, price and deals", () => {
    expect(slugs({ category: "pizza", openNow: true })).toEqual(["far-good", "deal"]);
    expect(slugs({ minRating: 9 })).toEqual(["far-good", "closed"]);
    expect(slugs({ maxPriceLevel: 2 })).not.toContain("near-ok");
    expect(slugs({ dealsOnly: true })).toEqual(["deal"]);
  });

  it("sorts open venues first, then by rank, putting venues without one last", () => {
    expect(slugs({}, "distance")).toEqual(["near-ok", "far-good", "deal", "closed"]);
    expect(slugs({}, "delivery_time").slice(0, 2)).toEqual(["near-ok", "far-good"]);
  });

  it("treats Wolt's sort values as ranks: the lowest rating rank is the best rated", () => {
    const rated = [card("worse", {}, { rating: 500 }), card("best", {}, { rating: 19 }), card("none")];
    expect(selectVenues(rated, {}, "rating").map((entry) => entry.venue.slug)).toEqual(["best", "worse", "none"]);
  });
});

describe("toVenueSummary", () => {
  it("builds a compact view", () => {
    const from = { lat: 41.7151, lon: 44.8271 };
    const card174 = {
      ...card(
        "x",
        {
          country: "GEO",
          location: [44.8271, 41.7241],
          rating: { score: 8.8, volume: 12 },
          estimate_range: "30-40",
          promotions: [{ text: "Free delivery" }],
          badges: [{ text: "New" }],
        },
        { distance: 174 },
        ["kebab"],
      ),
      image: { url: "https://imageproxy.wolt.com/assets/1" },
    };
    const live = { delivery_fee: "GEL0.00", order_minimum: "Min. order 12.00 GEL" };
    expect(toVenueSummary(card174, from, "en", live)).toEqual({
      slug: "x",
      name: "x",
      open: true,
      rating: 8.8,
      rating_count: 12,
      delivery_minutes: "30-40",
      distance_m: 1001,
      categories: ["kebab"],
      promotions: ["Free delivery"],
      badges: ["New"],
      image: "https://imageproxy.wolt.com/assets/1",
      url: "https://wolt.com/en/geo/venue/x",
      delivery_fee: "GEL0.00",
      order_minimum: "Min. order 12.00 GEL",
    });
  });
});
