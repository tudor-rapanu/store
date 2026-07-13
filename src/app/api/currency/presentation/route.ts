import { NextResponse } from "next/server";

import { getCurrencyPresentation } from "@/lib/currency/display";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const PUBLIC_SETTINGS_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60",
};

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "currency:presentation",
    limit: 300,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const presentation = await getCurrencyPresentation();

  return NextResponse.json(presentation, {
    headers: PUBLIC_SETTINGS_CACHE_HEADERS,
  });
}
