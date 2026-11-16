export const THUMBNAIL_WIDTH = 256;
export const FULL_WIDTH = 1024;

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export function sized(url: string, width: number): string {
  const target = new URL(url);
  target.searchParams.set("w", String(width));
  return target.toString();
}

async function loadImage(url: string, width: number, fetchImage: typeof fetch): Promise<ImageContent | undefined> {
  const response = await fetchImage(sized(url, width)).catch(() => undefined);
  const mimeType = response?.headers.get("content-type")?.split(";")[0];
  if (!response?.ok || !mimeType?.startsWith("image/")) return undefined;
  return { type: "image", data: Buffer.from(await response.arrayBuffer()).toString("base64"), mimeType };
}

export async function attachPictures<T extends { image?: string }>(
  views: T[],
  width: number,
  enabled: boolean,
  fetchImage: typeof fetch,
): Promise<{ views: (T & { picture?: number })[]; images: ImageContent[] }> {
  if (!enabled) return { views, images: [] };
  const loaded = await Promise.all(
    views.map((view) => (view.image ? loadImage(view.image, width, fetchImage) : undefined)),
  );
  const images: ImageContent[] = [];
  const numbered = views.map((view, index) => {
    const image = loaded[index];
    if (!image) return view;
    images.push(image);
    return { ...view, picture: images.length };
  });
  return { views: numbered, images };
}
