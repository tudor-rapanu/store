import { headers } from "next/headers";

import { normalizeCheckoutCountry } from "@/lib/geo/checkout-countries";

export async function detectCheckoutCountry() {
  const requestHeaders = await headers();
  const country =
    requestHeaders.get("cf-ipcountry") ??
    requestHeaders.get("x-vercel-ip-country") ??
    requestHeaders.get("x-country-code");

  return normalizeCheckoutCountry(country);
}
