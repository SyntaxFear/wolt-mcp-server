import { expect, it } from "vitest";
import { sheetSvg, writeSheet } from "../../src/media/sheet.js";

const picture = { type: "image" as const, mimeType: "image/jpeg", data: "AAAA" };

it("lays out one cell per entry and keeps venue text from becoming markup", () => {
  const svg = sheetSvg(
    'Bakery <script>alert("x")</script>',
    [
      { title: "ხაჭაპური & <b>bold</b>", detail: "7.50 GEL", picture: 1 },
      { title: "No picture", detail: "1.00 GEL" },
    ],
    [picture],
  );
  expect(svg).not.toContain("<script>");
  expect(svg).not.toContain("<b>");
  expect(svg).toContain("ხაჭაპური &#38; &#60;b&#62;bold&#60;/b&#62;");
  expect(svg.match(/<image /g)).toHaveLength(1);
  expect(svg).toContain("data:image/jpeg;base64,AAAA");
});

it("shortens long names", () => {
  const svg = sheetSvg("Menu", [{ title: "x".repeat(80), detail: "1 GEL" }], []);
  expect(svg).toContain(`${"x".repeat(29)}…`);
});

it("writes nothing when there are no pictures", async () => {
  expect(await writeSheet("Menu", [{ title: "Dish", detail: "1 GEL" }], [])).toBeUndefined();
});
