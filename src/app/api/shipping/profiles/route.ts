import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getShippingProfiles } from "@/lib/shipping/profiles";

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:profiles",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const profiles = await getShippingProfiles();
    return NextResponse.json({ profiles });
  } catch {
    return NextResponse.json(
      { error: "Could not load shipping profiles." },
      { status: 500 },
    );
  }
}
