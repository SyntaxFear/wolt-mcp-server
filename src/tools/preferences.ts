import { z } from "zod";
import { PreferencesView } from "../format/views.js";
import { defineTool, WRITE_LOCAL } from "./defineTool.js";

const terms = z.array(z.string().min(1)).optional();

export const preferences = defineTool({
  name: "wolt_preferences",
  title: "Food preferences",
  description:
    "Read or update the user's food preferences, stored on this computer only. Call with no arguments to read. Pass a list to replace that list (pass [] to clear it). Change them only when the user asks. Menus flag dishes whose text mentions an allergy or a dislike; that check is a text match, not a guarantee, so tell the user to confirm allergens with the venue.",
  input: {
    allergies: terms.describe("For example peanut, shellfish"),
    diets: terms.describe("For example vegetarian, halal"),
    dislikes: terms.describe("For example onion, coriander"),
  },
  output: { preferences: PreferencesView },
  annotations: WRITE_LOCAL,
  async handler(changes, { config }) {
    const current = config.read().preferences;
    const next = {
      allergies: changes.allergies ?? current.allergies,
      diets: changes.diets ?? current.diets,
      dislikes: changes.dislikes ?? current.dislikes,
    };
    return { data: { preferences: config.update({ preferences: next }).preferences } };
  },
});
