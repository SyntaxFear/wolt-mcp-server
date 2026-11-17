import type { Coordinates } from "../api/endpoints/discovery.js";
import { WoltError } from "../errors.js";

const MAX_REDIRECTS = 5;
const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

// Most exact first: a dropped pin, then a named point, then the map's centre.
const PATTERNS = [
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`[?&](?:q|query|ll|sll|daddr|destination|center|loc:)=(?:loc:)?${NUMBER},\\s*${NUMBER}`),
  new RegExp(`[?&]mlat=${NUMBER}&mlon=${NUMBER}`),
  new RegExp(`/place/${NUMBER},\\s*${NUMBER}`),
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(`#map=\\d+/${NUMBER}/${NUMBER}`),
];

const MAP_HOSTS = [
  /^maps\.app\.goo\.gl$/,
  /^goo\.gl$/,
  /^(?:www\.|maps\.)?google\.[a-z.]{2,6}$/,
  /^maps\.apple\.com$/,
  /^(?:www\.)?openstreetmap\.org$/,
  /^osm\.org$/,
];

const isMapHost = (host: string): boolean => MAP_HOSTS.some((pattern) => pattern.test(host));

const notAMapLink = (): WoltError =>
  new WoltError(
    "INVALID_INPUT",
    "That is not a Google Maps, Apple Maps or OpenStreetMap link.",
    "Ask the user for a map link of the building, or for coordinates.",
  );

export function coordinatesIn(link: string): Coordinates | undefined {
  const text = decodeURIComponent(link.replace(/\+/g, " "));
  for (const pattern of PATTERNS) {
    const [, lat, lon] = pattern.exec(text) ?? [];
    const point = { lat: Number(lat), lon: Number(lon) };
    if (lat !== undefined && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180) return point;
  }
  return undefined;
}

/** Reads the pin out of a map link, following a short link to the full one. Only map hosts are ever requested. */
export async function resolveMapLink(link: string, fetchLink: typeof fetch): Promise<Coordinates> {
  let current = link.trim();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = URL.canParse(current) ? new URL(current) : undefined;
    if (url?.protocol !== "https:" || !isMapHost(url.hostname)) throw notAMapLink();
    const found = coordinatesIn(current);
    if (found) return found;
    const response = await fetchLink(url, { method: "GET", redirect: "manual" }).catch(() => undefined);
    const next = response?.headers.get("location");
    if (!next) break;
    current = new URL(next, url).toString();
  }
  throw new WoltError(
    "INVALID_INPUT",
    "That map link does not point at one place.",
    "Ask the user to drop a pin on the building and share that link, or to give coordinates.",
  );
}
