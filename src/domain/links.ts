const SITE = "https://wolt.com";

/** Wolt redirects this short form to the venue's page. It cannot take a dish suffix; a path with the city can. */
export function venueUrl(
  slug: string,
  country: string | null | undefined,
  language: string,
  city?: string | null,
): string | undefined {
  if (!country) return undefined;
  const place = city ? `${country.toLowerCase()}/${encodeURIComponent(city)}` : country.toLowerCase();
  return `${SITE}/${language}/${place}/venue/${encodeURIComponent(slug)}`;
}

export function itemUrl(venuePage: string | null | undefined, itemId: string): string | undefined {
  if (!venuePage) return undefined;
  return `${venuePage.replace(/\/$/, "")}/itemid-${encodeURIComponent(itemId)}`;
}
