import type { Config, ConfigStore } from "../config.js";
import { WoltError } from "../errors.js";

export type Location = NonNullable<Config["location"]>;

export function requireLocation(config: ConfigStore): Location {
  const { location } = config.read();
  if (location) return location;
  throw new WoltError(
    "LOCATION_REQUIRED",
    "No delivery location is set.",
    "Ask the user for a map link of their building or for their address. Pass a map link straight to wolt_set_location; for an address call wolt_search_address, let them pick a match, then call wolt_set_location.",
  );
}
