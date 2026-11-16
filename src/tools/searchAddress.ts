import { z } from "zod";
import { autocompleteAddress } from "../api/endpoints/geo.js";
import { defineTool, READ_WOLT } from "./defineTool.js";

export const searchAddress = defineTool({
  name: "wolt_search_address",
  title: "Search address",
  description:
    "Find real addresses matching what the user typed. Show the matches to the user and let them pick one; never pick for them. Then call wolt_set_location with the chosen place_id. If nothing fits, ask the user for a map link or coordinates.",
  input: {
    query: z.string().min(3).describe("Address as the user wrote it, including the city"),
    country: z.string().length(3).optional().describe("3-letter country code to narrow results, for example GEO"),
  },
  output: {
    matches: z.array(z.object({ place_id: z.string(), text: z.string() })),
  },
  annotations: READ_WOLT,
  async handler({ query, country }, { http, config }) {
    return { data: { matches: await autocompleteAddress(http, query, config.read().language, country) } };
  },
});
