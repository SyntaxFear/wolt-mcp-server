import type { Preferences } from "../format/views.js";

export function warningsFor(dishText: string, preferences: Preferences): string[] {
  const haystack = dishText.toLowerCase();
  const mentions = (terms: string[], kind: string): string[] =>
    terms.filter((term) => haystack.includes(term.toLowerCase())).map((term) => `Mentions "${term}" (${kind})`);
  return [...mentions(preferences.allergies, "allergy"), ...mentions(preferences.dislikes, "dislike")];
}
