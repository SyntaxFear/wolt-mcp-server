import { z } from "zod";
import { geocodePlace } from "../api/endpoints/geo.js";
import type { Config, ConfigStore } from "../config.js";
import type { Location } from "../domain/location.js";
import { resolveMapLink } from "../domain/mapLink.js";
import { WoltError } from "../errors.js";
import { defineTool, WRITE_LOCAL } from "./defineTool.js";

const findSaved = (places: Config["places"], name: string): [string, Location] | undefined =>
  Object.entries(places).find(([saved]) => saved.toLowerCase() === name.trim().toLowerCase());

function forget(config: ConfigStore, name: string): void {
  const { places } = config.read();
  const found = findSaved(places, name);
  if (!found) throw unknownPlace(name, places);
  const { [found[0]]: _removed, ...rest } = places;
  config.update({ places: rest });
}

const unknownPlace = (name: string, places: Config["places"]): WoltError =>
  new WoltError(
    "NOT_FOUND",
    `No saved place is called "${name}".`,
    Object.keys(places).length > 0
      ? `Saved places: ${Object.keys(places).join(", ")}.`
      : "Nothing is saved yet. Set a location with save_as to save one.",
  );

export const setLocation = defineTool({
  name: "wolt_set_location",
  title: "Set delivery location",
  description:
    "Set where food should be delivered. Venues, fees and delivery times all depend on it, so call this before searching. Give exactly one of: map_link (a Google Maps, Apple Maps or OpenStreetMap link the user pasted; the most exact way), saved_place (a name the user saved before, such as Home), place_id (the match the user picked from wolt_search_address), or lat and lon. Add save_as to remember the place under a name. forget_place removes a saved name. Call with no arguments to see the current location and the saved places.",
  input: {
    map_link: z.string().optional().describe("Map link pasted by the user; short links are fine"),
    saved_place: z.string().optional().describe("Name of a saved place to switch to, for example Home"),
    place_id: z.string().optional().describe("place_id of the match the user picked"),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    label: z.string().optional().describe("How to show this location, for example the street address"),
    save_as: z.string().min(1).max(40).optional().describe("Remember this location under a name, for example Home"),
    forget_place: z.string().optional().describe("Remove a saved place by name"),
  },
  output: {
    location: z.object({ lat: z.number(), lon: z.number(), label: z.string() }).optional(),
    precise: z.boolean().optional().describe("False when Wolt only found the street or area, not the building"),
    saved_places: z.array(z.object({ name: z.string(), label: z.string() })),
  },
  annotations: WRITE_LOCAL,
  async handler({ map_link, saved_place, place_id, lat, lon, label, save_as, forget_place }, context) {
    const { http, config } = context;
    if (forget_place) forget(config, forget_place);

    let chosen: { location: Location; precise: boolean } | undefined;
    if (map_link) {
      const point = await resolveMapLink(map_link, context.fetchLink);
      chosen = { location: { ...point, label: label ?? save_as ?? `${point.lat}, ${point.lon}` }, precise: true };
    } else if (saved_place) {
      const found = findSaved(config.read().places, saved_place);
      if (!found) throw unknownPlace(saved_place, config.read().places);
      chosen = { location: found[1], precise: true };
    } else if (place_id) {
      const { precise, ...location } = await geocodePlace(http, place_id, config.read().language);
      chosen = { location, precise };
    } else if (lat !== undefined && lon !== undefined) {
      chosen = { location: { lat, lon, label: label ?? save_as ?? `${lat}, ${lon}` }, precise: true };
    } else if (lat !== undefined || lon !== undefined || save_as) {
      throw new WoltError(
        "INVALID_INPUT",
        "A location needs a map_link, a saved_place, a place_id, or both lat and lon.",
        "Ask the user for a map link of the building, or call wolt_search_address.",
      );
    }

    if (chosen) {
      config.update({
        location: chosen.location,
        ...(save_as && { places: { ...config.read().places, [save_as.trim()]: chosen.location } }),
      });
    }
    const current = config.read();
    return {
      data: {
        ...(current.location && { location: current.location }),
        ...(chosen && { precise: chosen.precise }),
        saved_places: Object.entries(current.places).map(([name, place]) => ({ name, label: place.label })),
      },
    };
  },
});
