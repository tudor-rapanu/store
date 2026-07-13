import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getShippingProfiles } from "@/lib/shipping/profiles";

const PUBLIC_SETTINGS_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
};

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:profiles",
    limit: 300,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const profiles = await getShippingProfiles();
    return NextResponse.json({ profiles }, { headers: PUBLIC_SETTINGS_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Could not load shipping profiles." },
      { status: 500 },
    );
  }
}
