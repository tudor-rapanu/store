import { NextResponse } from "next/server";

import { getCachedOrSyncSamedayCounties } from "@/lib/shipping/sameday";

export async function GET() {
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
