import { z } from "zod";

export const MoneyView = z.object({
  amount: z.number().describe("Minor units, for example 2600 for 26.00 GEL"),
  currency: z.string(),
  text: z.string(),
});
export type Money = z.infer<typeof MoneyView>;

export const pageShape = {
  total: z.number().describe("How many results exist in total"),
  shown: z.string().describe('Which results this answer holds, for example "1-20 of 104"'),
  next_cursor: z.string().optional().describe("Pass as cursor to get the next page. Absent on the last page."),
};

export const pagingInput = {
  cursor: z.string().optional().describe("next_cursor from the previous answer"),
  limit: z.number().int().min(1).max(20).optional().describe("Results per page, at most 20 (default 20)"),
};

export const VenueView = z.object({
  slug: z.string().describe("Pass to wolt_get_venue and wolt_get_menu"),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  open: z.boolean(),
  rating: z.number().optional().describe("0-10"),
  rating_count: z.number().optional(),
  delivery_minutes: z.string().optional(),
  price_level: z.number().optional().describe("1 (cheap) to 4 (expensive)"),
  distance_m: z.number().optional().describe("Straight-line metres from the delivery location"),
  delivery_fee: z.string().optional().describe("As Wolt words it. The exact fee for an order comes at checkout."),
  order_minimum: z.string().optional().describe("Smallest order the venue delivers, as Wolt words it"),
  status: z.string().optional().describe('Wolt\'s own wording, for example "Open until 02:45"'),
  next_open: z.string().optional().describe("When a closed venue next takes orders"),
  categories: z.array(z.string()),
  promotions: z.array(z.string()),
  badges: z.array(z.string()),
  image: z.string().optional(),
  picture: z.number().optional().describe("Position of this venue's picture among the attached images, starting at 1"),
  url: z.string().optional().describe("Opens this venue in Wolt. Give it to the user as a link."),
});
export type VenueSummary = z.infer<typeof VenueView>;

export const OptionGroupView = z.object({
  id: z.string(),
  name: z.string(),
  min: z.number(),
  max: z.number(),
  required: z.boolean(),
  choices: z.array(z.object({ id: z.string(), name: z.string(), price: MoneyView })),
});

export const DishView = z.object({
  id: z.string().describe("Pass to wolt_get_item"),
  name: z.string(),
  original_name: z
    .string()
    .optional()
    .describe("Name in the venue's own language when the shown name is machine-translated"),
  description: z.string().optional(),
  price: MoneyView,
  original_price: MoneyView.optional().describe("Price before discount"),
  available: z.boolean(),
  unavailable_reason: z.string().optional(),
  tags: z.array(z.string()),
  dietary: z.array(z.string()),
  alcohol: z.boolean(),
  required_choices: z.array(z.string()).describe("Option groups the user must choose from before this can be ordered"),
  option_groups: z.array(OptionGroupView).optional().describe("Only in wolt_get_item"),
  warnings: z.array(z.string()).describe("Clashes with the user's saved food preferences"),
  category: z.string().optional().describe("Menu section, when a whole menu is returned at once"),
  url: z.string().optional().describe("Opens this dish in Wolt. Give it to the user as a link."),
  image: z.string().optional(),
  picture: z.number().optional().describe("Position of this dish's picture among the attached images, starting at 1"),
});
export type Dish = z.infer<typeof DishView>;

export const PreferencesView = z.object({
  allergies: z.array(z.string()),
  diets: z.array(z.string()),
  dislikes: z.array(z.string()),
});
export type Preferences = z.infer<typeof PreferencesView>;

export const DishHitView = z.object({
  item_id: z.string().describe("Pass with venue_slug to wolt_get_item"),
  name: z.string(),
  description: z.string().optional(),
  price: MoneyView,
  venue_slug: z.string(),
  venue_name: z.string(),
  venue_rating: z.number().optional(),
  delivery_minutes: z.string().optional(),
  url: z.string().optional().describe("Opens this dish in Wolt. Give it to the user as a link."),
  image: z.string().optional(),
  picture: z.number().optional().describe("Position of this dish's picture among the attached images, starting at 1"),
});
export type DishHitSummary = z.infer<typeof DishHitView>;
