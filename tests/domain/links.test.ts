import { expect, it } from "vitest";
import { itemUrl, venueUrl } from "../../src/domain/links.js";

it("builds the short venue link Wolt redirects, and the city form a dish link needs", () => {
  expect(venueUrl("bakery-7", "GEO", "en")).toBe("https://wolt.com/en/geo/venue/bakery-7");
  expect(venueUrl("bakery-7", "GEO", "en", "tbilisi")).toBe("https://wolt.com/en/geo/tbilisi/venue/bakery-7");
  expect(venueUrl("bakery-7", undefined, "en")).toBeUndefined();
});

it("adds the dish to a venue page", () => {
  expect(itemUrl("https://wolt.com/ka/geo/tbilisi/restaurant/bakery-7/", "abc")).toBe(
    "https://wolt.com/ka/geo/tbilisi/restaurant/bakery-7/itemid-abc",
  );
  expect(itemUrl(undefined, "abc")).toBeUndefined();
});
