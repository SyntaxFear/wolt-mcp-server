import { expect, it } from "vitest";
import { fetchVenueDynamic, fetchVenueStatic } from "../../../src/api/endpoints/venue.js";
import { createHttp } from "../../../src/api/http.js";
import { fakeFetch, fixture } from "../../helpers.js";

const fetch = fakeFetch({
  "/static": fixture("venue-static"),
  "/dynamic/": fixture("venue-dynamic"),
});
const http = createHttp({ fetch });

it("reads static venue details", async () => {
  const { venue, order_minimum } = await fetchVenueStatic(http, "marge-dadiani-1", "en");
  expect(venue).toMatchObject({ slug: "marge-dadiani-1", currency: "GEL", delivery_methods: ["homedelivery"] });
  expect(venue.id).toMatch(/^[0-9a-f]{24}$/);
  expect(order_minimum).toBe(1200);
});

it("reads live venue status for a location", async () => {
  const { venue } = await fetchVenueDynamic(http, "marge-dadiani-1", { lat: 41.7151, lon: 44.8271 });
  expect(venue.delivery_open_status?.is_open).toBe(true);
  expect(venue.delivery_configs?.[0]).toMatchObject({ method: "homedelivery", estimate: { label: "40-50 min" } });
  expect(fetch.calls.at(-1)?.url).toContain("selected_delivery_method=homedelivery");
});
