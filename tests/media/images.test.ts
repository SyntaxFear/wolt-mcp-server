import { describe, expect, it } from "vitest";
import { attachPictures, sized } from "../../src/media/images.js";

const jpeg = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });

describe("sized", () => {
  it("adds the width parameter", () => {
    expect(sized("https://imageproxy.wolt.com/assets/1", 256)).toBe("https://imageproxy.wolt.com/assets/1?w=256");
  });
});

describe("attachPictures", () => {
  const views = [
    { id: "a", image: "https://img/a" },
    { id: "b" },
    { id: "c", image: "https://img/c" },
    { id: "d", image: "https://img/broken" },
  ];
  const fetchImage = (async (input: string | URL) =>
    String(input).includes("broken") ? new Response("", { status: 500 }) : jpeg()) as typeof fetch;

  it("loads pictures and numbers the views that got one", async () => {
    const result = await attachPictures(views, 256, true, fetchImage);
    expect(result.images).toEqual([
      { type: "image", data: "AQID", mimeType: "image/jpeg" },
      { type: "image", data: "AQID", mimeType: "image/jpeg" },
    ]);
    expect(result.views.map((view) => view.picture)).toEqual([1, undefined, 2, undefined]);
  });

  it("does nothing when disabled", async () => {
    const result = await attachPictures(views, 256, false, fetchImage);
    expect(result).toEqual({ views, images: [] });
  });
});
