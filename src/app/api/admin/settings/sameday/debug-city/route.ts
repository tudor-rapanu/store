import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { debugSamedayCityQueries } from "@/lib/shipping/sameday";

export async function GET(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const url = new URL(request.url);
  const countyId = Number(url.searchParams.get("countyId") ?? "1");

  if (!Number.isFinite(countyId)) {
    return NextResponse.json(
      { error: "A valid countyId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await debugSamedayCityQueries(countyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Sameday city debug failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not debug Sameday city queries.",
      },
      { status: 500 },
    );
  }
}
