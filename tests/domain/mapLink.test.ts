import { expect, it } from "vitest";
import { coordinatesIn } from "../../src/domain/mapLink.js";

it.each([
  [
    "https://www.google.com/maps/place/X/@41.70,44.80,17z/data=!3m1!4b1!4m6!3m5!8m2!3d41.697700!4d44.801500",
    41.697700,
    44.801500,
  ],
  ["https://www.google.com/maps/@41.7151,44.8271,15z", 41.7151, 44.8271],
  ["https://www.google.com/maps?q=41.7151,44.8271", 41.7151, 44.8271],
  ["https://maps.google.com/?ll=-33.8688,151.2093", -33.8688, 151.2093],
  ["https://maps.apple.com/?ll=41.7151,44.8271&q=Home", 41.7151, 44.8271],
  ["https://www.openstreetmap.org/?mlat=41.7151&mlon=44.8271#map=17/41.7/44.8", 41.7151, 44.8271],
  ["https://www.openstreetmap.org/#map=17/41.7151/44.8271", 41.7151, 44.8271],
  ["https://www.google.com/maps/place/41.7151,44.8271", 41.7151, 44.8271],
])("reads the point from %s", (link, lat, lon) => {
  expect(coordinatesIn(link)).toEqual({ lat, lon });
});

it("finds nothing in a link without a point, or with an impossible one", () => {
  expect(coordinatesIn("https://www.google.com/maps/search/pizza")).toBeUndefined();
  expect(coordinatesIn("https://www.google.com/maps?q=141.7,44.8")).toBeUndefined();
});
