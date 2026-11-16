import { z } from "zod";
import { geocodePlace } from "../api/endpoints/geo.js";
import { WoltError } from "../errors.js";
import { defineTool, WRITE_LOCAL } from "./defineTool.js";

export const setLocation = defineTool({
  name: "wolt_set_location",
  title: "Set delivery location",
  description:
    "Set where food should be delivered. Venues, fees and delivery times all depend on it, so call this before searching. Pass the place_id the user picked from wolt_search_address, or lat and lon (for example taken from a map link the user gave).",
  input: {
    place_id: z.string().optional().describe("place_id of the match the user picked"),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    label: z.string().optional().describe("Name for coordinates, for example Home"),
  },
  output: {
    location: z.object({ lat: z.number(), lon: z.number(), label: z.string() }),
    precise: z.boolean().describe("False when Wolt only found the street or area, not the building"),
  },
  annotations: WRITE_LOCAL,
  async handler({ place_id, lat, lon, label }, { http, config }) {
    if (place_id) {
      const { precise, ...location } = await geocodePlace(http, place_id, config.read().language);
      config.update({ location });
      return { data: { location, precise } };
    }
    if (lat === undefined || lon === undefined) {
      throw new WoltError(
        "INVALID_INPUT",
        "A location needs a place_id, or both lat and lon.",
        "Call wolt_search_address first.",
      );
    }
    const location = { lat, lon, label: label ?? `${lat}, ${lon}` };
    config.update({ location });
    return { data: { location, precise: true } };
  },
});
