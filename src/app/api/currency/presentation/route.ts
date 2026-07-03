import { NextResponse } from "next/server";

import { getCurrencyPresentation } from "@/lib/currency/display";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "currency:presentation",
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const presentation = await getCurrencyPresentation();

  return NextResponse.json(presentation);
}
