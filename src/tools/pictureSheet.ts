import { z } from "zod";
import type { ImageContent } from "../media/images.js";
import { type SheetEntry, writeSheet } from "../media/sheet.js";
import type { ToolContext } from "./defineTool.js";

export const pictureSheetShape = {
  picture_sheet: z
    .string()
    .optional()
    .describe(
      "Path of one image file with every picture, name and price in this answer. Present when the app cannot draw cards: show or send this file to the user.",
    ),
};

/** For apps without card support: draws the answer's pictures into one file the agent can show the user. */
export async function pictureSheet(
  context: ToolContext,
  title: string,
  entries: SheetEntry[],
  images: ImageContent[],
): Promise<{ picture_sheet?: string }> {
  if (context.showsCards?.()) return {};
  const file = await writeSheet(title, entries, images);
  return file ? { picture_sheet: file } : {};
}
