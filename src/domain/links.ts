const SITE = "https://wolt.com";

export function venueUrl(slug: string, country: string | null | undefined, language: string): string | undefined {
  if (!country) return undefined;
  return `${SITE}/${language}/${country.toLowerCase()}/venue/${encodeURIComponent(slug)}`;
}

export function itemUrl(venuePage: string | null | undefined, itemId: string): string | undefined {
  if (!venuePage) return undefined;
  return `${venuePage.replace(/\/$/, "")}/itemid-${encodeURIComponent(itemId)}`;
}
