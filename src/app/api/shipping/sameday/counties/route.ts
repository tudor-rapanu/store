import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCachedOrSyncSamedayCounties } from "@/lib/shipping/sameday";

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:sameday:counties",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const counties = await getCachedOrSyncSamedayCounties();
    return NextResponse.json({ counties });
  } catch {
    return NextResponse.json(
      { error: "Could not load counties." },
      { status: 500 },
    );
  }
}
