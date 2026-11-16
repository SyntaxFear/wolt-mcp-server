import type { Money } from "../format/views.js";

export function money(amount: number, currency: string): Money {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return { amount, currency, text: `${(amount / 10 ** digits).toFixed(digits)} ${currency}` };
}
