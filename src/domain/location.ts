import type { Config, ConfigStore } from "../config.js";
import { WoltError } from "../errors.js";

export type Location = NonNullable<Config["location"]>;

export function requireLocation(config: ConfigStore): Location {
  const { location } = config.read();
  if (location) return location;
  throw new WoltError(
    "LOCATION_REQUIRED",
    "No delivery location is set.",
    "Ask the user for their address, call wolt_search_address, let them pick a match, then call wolt_set_location.",
  );
}
