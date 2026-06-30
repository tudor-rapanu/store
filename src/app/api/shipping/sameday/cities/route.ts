import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { searchSamedayCities } from "@/lib/shipping/sameday";

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:sameday:cities",
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const url = new URL(request.url);
  const countyId = Number(url.searchParams.get("countyId"));
  const name = url.searchParams.get("name")?.trim() || undefined;

  if (!Number.isInteger(countyId) || countyId <= 0) {
    return NextResponse.json(
      { error: "A valid countyId is required." },
      { status: 400 },
    );
  }

  if (name && name.length > 80) {
    return NextResponse.json(
      { error: "City search is too long." },
      { status: 400 },
    );
  }

  try {
    const cities = await searchSamedayCities(countyId, name);
    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json(
      { error: "Could not load cities." },
      { status: 500 },
    );
  }
}
