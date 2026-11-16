import { describe, expect, it } from "vitest";
import { paginate } from "../../src/domain/pagination.js";

const numbers = Array.from({ length: 45 }, (_, index) => index + 1);

describe("paginate", () => {
  it("returns 20 by default and says how many exist", () => {
    const page = paginate(numbers);
    expect(page.items).toHaveLength(20);
    expect(page).toMatchObject({ total: 45, shown: "1-20 of 45", next_cursor: "20" });
  });

  it("continues from a cursor and omits next_cursor on the last page", () => {
    const page = paginate(numbers, "40");
    expect(page.items).toEqual([41, 42, 43, 44, 45]);
    expect(page.shown).toBe("41-45 of 45");
    expect(page.next_cursor).toBeUndefined();
  });

  it("describes an empty list", () => {
    expect(paginate([])).toEqual({ items: [], total: 0, shown: "0 of 0" });
  });

  it("rejects a bad cursor", () => {
    expect(() => paginate(numbers, "abc")).toThrowError(/cursor/);
  });
});
