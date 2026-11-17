import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageContent } from "./images.js";

export interface SheetEntry {
  title: string;
  detail: string;
  /** Position among the images, starting at 1, as in a dish's "picture" field. */
  picture?: number;
}

const COLUMNS = 4;
const CELL = { width: 256, picture: 144, text: 62, gap: 12 };
const HEADER = 54;
const MAX_TITLE = 30;

const escapeXml = (text: string): string =>
  text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`).replace(/\p{Cc}/gu, " ");

const clip = (text: string, length: number): string =>
  text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;

/** The SVG behind a sheet: one titled grid of pictures, each with a name and a detail line. */
export function sheetSvg(title: string, entries: SheetEntry[], images: ImageContent[]): string {
  const rows = Math.ceil(entries.length / COLUMNS);
  const cellHeight = CELL.picture + CELL.text;
  const width = COLUMNS * CELL.width + (COLUMNS + 1) * CELL.gap;
  const height = HEADER + rows * (cellHeight + CELL.gap) + CELL.gap;
  const cells = entries.map((entry, index) => {
    const x = CELL.gap + (index % COLUMNS) * (CELL.width + CELL.gap);
    const y = HEADER + Math.floor(index / COLUMNS) * (cellHeight + CELL.gap);
    const image = entry.picture === undefined ? undefined : images[entry.picture - 1];
    const picture = image
      ? `<image x="${x}" y="${y}" width="${CELL.width}" height="${CELL.picture}" preserveAspectRatio="xMidYMid slice" href="data:${image.mimeType};base64,${image.data}"/>`
      : `<rect x="${x}" y="${y}" width="${CELL.width}" height="${CELL.picture}" fill="#e8e4dc"/>`;
    return `${picture}
<text x="${x + 2}" y="${y + CELL.picture + 24}" font-size="15" font-weight="600" fill="#1f1d1a">${escapeXml(clip(entry.title, MAX_TITLE))}</text>
<text x="${x + 2}" y="${y + CELL.picture + 46}" font-size="15" fill="#b4501f">${escapeXml(clip(entry.detail, MAX_TITLE))}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Helvetica Neue, Arial, Noto Sans, Noto Sans Georgian, sans-serif">
<rect width="100%" height="100%" fill="#faf7f2"/>
<text x="${CELL.gap + 2}" y="35" font-size="22" font-weight="700" fill="#1f1d1a">${escapeXml(clip(title, 80))}</text>
${cells.join("\n")}
</svg>`;
}

/**
 * Draws the pictures of one answer into a single image file and returns its path, for apps that cannot
 * show menu cards. Returns nothing when there is nothing to draw or the image library is missing.
 */
export async function writeSheet(
  title: string,
  entries: SheetEntry[],
  images: ImageContent[],
  dir: string = join(tmpdir(), "wolt-mcp"),
): Promise<string | undefined> {
  if (images.length === 0 || entries.length === 0) return undefined;
  const svg = sheetSvg(title, entries, images);
  try {
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `wolt-${createHash("sha1").update(svg).digest("hex").slice(0, 12)}.jpg`);
    writeFileSync(file, jpeg);
    return file;
  } catch {
    return undefined;
  }
}
