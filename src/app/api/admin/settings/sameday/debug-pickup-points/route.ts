import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { debugSamedayPickupPoints } from "@/lib/shipping/sameday";

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const result = await debugSamedayPickupPoints();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Sameday pickup point debug failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not debug Sameday pickup points.",
      },
      { status: 500 },
    );
  }
}
