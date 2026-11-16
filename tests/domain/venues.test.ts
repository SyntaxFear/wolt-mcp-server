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

  it("keeps Wolt's order by default", () => {
    expect(slugs({})).toEqual(["far-good", "near-ok", "closed", "deal"]);
  });

  it("filters by category, open state, rating, price and deals", () => {
    expect(slugs({ category: "pizza", openNow: true })).toEqual(["far-good", "deal"]);
    expect(slugs({ minRating: 9 })).toEqual(["far-good", "closed"]);
    expect(slugs({ maxPriceLevel: 2 })).not.toContain("near-ok");
    expect(slugs({ dealsOnly: true })).toEqual(["deal"]);
  });

  it("sorts, putting venues without a value last", () => {
    expect(slugs({}, "distance")).toEqual(["closed", "near-ok", "far-good", "deal"]);
    expect(slugs({}, "delivery_time").slice(0, 2)).toEqual(["near-ok", "far-good"]);
  });

  it("sorts by Wolt's rating key, highest first", () => {
    const rated = [card("low", {}, { rating: 100 }), card("high", {}, { rating: 500 }), card("none")];
    expect(selectVenues(rated, {}, "rating").map((entry) => entry.venue.slug)).toEqual(["high", "low", "none"]);
  });
});

describe("toVenueSummary", () => {
  it("builds a compact view", () => {
    const summary = toVenueSummary({
      ...card(
        "x",
        {
          rating: { score: 8.8, volume: 12 },
          estimate_range: "30-40",
          promotions: [{ text: "Free delivery" }],
          badges: [{ text: "New" }],
        },
        { distance: 174 },
        ["kebab"],
      ),
      image: { url: "https://imageproxy.wolt.com/assets/1" },
    });
    expect(summary).toEqual({
      slug: "x",
      name: "x",
      open: true,
      rating: 8.8,
      rating_count: 12,
      delivery_minutes: "30-40",
      distance_m: 174,
      categories: ["kebab"],
      promotions: ["Free delivery"],
      badges: ["New"],
      image: "https://imageproxy.wolt.com/assets/1",
    });
  });
});
