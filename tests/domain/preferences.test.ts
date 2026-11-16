import { expect, it } from "vitest";
import { warningsFor } from "../../src/domain/preferences.js";

const preferences = { allergies: ["peanut"], diets: ["vegetarian"], dislikes: ["onion"] };

it("warns when a dish mentions an allergy or a dislike", () => {
  expect(warningsFor("Pad Thai with Peanuts and red onion", preferences)).toEqual([
    'Mentions "peanut" (allergy)',
    'Mentions "onion" (dislike)',
  ]);
});

it("returns nothing for a clean dish", () => {
  expect(warningsFor("Margherita", preferences)).toEqual([]);
});
