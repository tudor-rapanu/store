export type DisplayCurrency = "RON" | "EUR";

export const CURRENCY_COOKIE_NAME = "tt_currency";

export function normalizeDisplayCurrency(value: unknown): DisplayCurrency | null {
  return value === "RON" || value === "EUR" ? value : null;
}

export function getDefaultCurrencyForCountry(countryCode: string): DisplayCurrency {
  return countryCode === "RO" ? "RON" : "EUR";
}
