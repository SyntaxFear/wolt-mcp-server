import { z } from "zod";
import { WoltError } from "../../errors.js";
import type { WoltHttp } from "../http.js";

const AutocompleteSchema = z.object({
  predictions: z
    .array(
      z.object({
        place_id: z.string(),
        address: z.object({ main_text: z.string(), secondary_text: z.string().nullish() }),
      }),
    )
    .default([]),
});

const GeocodeSchema = z.object({
  result: z
    .object({
      formatted_address: z.string(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }),
      precise: z.boolean().nullish(),
    })
    .nullish(),
});

export interface AddressMatch {
  place_id: string;
  text: string;
}

export interface GeocodedPlace {
  lat: number;
  lon: number;
  label: string;
  precise: boolean;
}

export async function autocompleteAddress(
  http: WoltHttp,
  input: string,
  language: string,
  country?: string,
): Promise<AddressMatch[]> {
  const { predictions } = await http.get("/v2/google/places/autocomplete/json", {
    schema: AutocompleteSchema,
    query: {
      input,
      language,
      radius: 100000,
      types: "geocode",
      components: country && `country:${country.toLowerCase()}`,
    },
  });
  return predictions.map(({ place_id, address }) => ({
    place_id,
    text: [address.main_text, address.secondary_text].filter(Boolean).join(", "),
  }));
}

export async function geocodePlace(http: WoltHttp, placeId: string, language: string): Promise<GeocodedPlace> {
  const { result } = await http.get("/v1/google/geocode-address", {
    schema: GeocodeSchema,
    query: { place_id: placeId, language },
  });
  if (!result) {
    throw new WoltError(
      "NOT_FOUND",
      "Wolt could not locate that address.",
      "Call wolt_search_address again and pick another match.",
    );
  }
  return {
    lat: result.coordinates.lat,
    lon: result.coordinates.lng,
    label: result.formatted_address,
    precise: result.precise === true,
  };
}
