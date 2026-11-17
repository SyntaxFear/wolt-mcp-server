import type { Coordinates } from "../api/endpoints/discovery.js";

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number): number => (degrees * Math.PI) / 180;

export function distanceMetres(from: Coordinates, to: Coordinates): number {
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}
