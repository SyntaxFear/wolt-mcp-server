import type { VenueSummary } from "../format/views.js";
import { attachPictures, type ImageContent, THUMBNAIL_WIDTH } from "../media/images.js";
import type { ToolContext } from "./defineTool.js";
import { pictureSheet } from "./pictureSheet.js";

const detail = (venue: VenueSummary): string =>
  [venue.rating !== undefined && `★ ${venue.rating}`, venue.delivery_minutes && `${venue.delivery_minutes} min`]
    .filter(Boolean)
    .join(" · ");

/** Attaches each venue's picture and, for apps without cards, the one-file sheet of them all. */
export async function picturedVenues(
  context: ToolContext,
  title: string,
  venues: VenueSummary[],
): Promise<{ venues: VenueSummary[]; images: ImageContent[]; sheet: { picture_sheet?: string } }> {
  const enabled = context.config.read().images === "always";
  const pictured = await attachPictures(venues, THUMBNAIL_WIDTH, enabled, context.fetchImage);
  const entries = pictured.views.map((venue) => ({ title: venue.name, detail: detail(venue), picture: venue.picture }));
  return {
    venues: pictured.views,
    images: pictured.images,
    sheet: await pictureSheet(context, title, entries, pictured.images),
  };
}
