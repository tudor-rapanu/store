import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { searchSamedayCities } from "@/lib/shipping/sameday";

export async function GET(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Sameday cities.",
      },
      { status: 500 },
    );
  }
}
