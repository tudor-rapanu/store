import { cookies } from "next/headers";

import { getCurrencySettings } from "@/lib/currency/settings";
import {
  CURRENCY_COOKIE_NAME,
  getDefaultCurrencyForCountry,
  normalizeDisplayCurrency,
} from "@/lib/currency/preference";
import { detectCheckoutCountry } from "@/lib/geo/detect-country";

export async function getCurrencyPresentation() {
  const [countryCode, currencySettings, cookieStore] = await Promise.all([
    detectCheckoutCountry(),
    getCurrencySettings(),
    cookies(),
  ]);
  const preferredCurrency = normalizeDisplayCurrency(
    cookieStore.get(CURRENCY_COOKIE_NAME)?.value,
  );

  return {
    countryCode,
    displayCurrency: preferredCurrency ?? getDefaultCurrencyForCountry(countryCode),
    ronToEurRate: currencySettings.ronToEurRate,
  } as const;
}
