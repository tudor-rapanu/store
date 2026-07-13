import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCachedOrSyncSamedayCounties } from "@/lib/shipping/sameday";

const PUBLIC_LOOKUP_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:sameday:counties",
    limit: 600,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const counties = await getCachedOrSyncSamedayCounties();
    return NextResponse.json({ counties }, { headers: PUBLIC_LOOKUP_CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not load counties." }, { status: 500 });
  }
}
