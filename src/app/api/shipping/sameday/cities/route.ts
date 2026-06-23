import { NextResponse } from "next/server";

import { searchSamedayCities } from "@/lib/shipping/sameday";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countyId = Number(url.searchParams.get("countyId"));
  const name = url.searchParams.get("name")?.trim() || undefined;

  if (!Number.isFinite(countyId)) {
    return NextResponse.json(
      { error: "A valid countyId is required." },
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
