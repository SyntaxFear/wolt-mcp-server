import { expect, it } from "vitest";
import { money } from "../../src/domain/money.js";

it("formats minor units with the currency's own decimals", () => {
  expect(money(2600, "GEL")).toEqual({ amount: 2600, currency: "GEL", text: "26.00 GEL" });
  expect(money(500, "JPY").text).toBe("500 JPY");
});
