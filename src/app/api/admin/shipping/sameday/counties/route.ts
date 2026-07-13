import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { getCachedOrSyncSamedayCounties } from "@/lib/shipping/sameday";

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const counties = await getCachedOrSyncSamedayCounties();
    return NextResponse.json({ counties });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load Sameday counties.",
      },
      { status: 500 },
    );
  }
}
