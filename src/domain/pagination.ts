import { WoltError } from "../errors.js";

export const PAGE_SIZE = 20;

export interface Page<T> {
  items: T[];
  total: number;
  shown: string;
  next_cursor?: string;
}

export function paginate<T>(all: T[], cursor?: string, limit: number = PAGE_SIZE): Page<T> {
  const start = offsetOf(cursor);
  const items = all.slice(start, start + limit);
  const end = start + items.length;
  const shown = items.length === 0 ? `0 of ${all.length}` : `${start + 1}-${end} of ${all.length}`;
  return { items, total: all.length, shown, ...(end < all.length && { next_cursor: String(end) }) };
}

function offsetOf(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const offset = Number(cursor);
  if (Number.isInteger(offset) && offset >= 0) return offset;
  throw new WoltError(
    "INVALID_INPUT",
    `"${cursor}" is not a valid cursor.`,
    "Pass next_cursor exactly as the previous answer gave it.",
  );
}
