import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { getSamedayPickupPoints } from "@/lib/shipping/sameday";

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const pickupPoints = await getSamedayPickupPoints();
    return NextResponse.json({ pickupPoints });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Sameday pickup points.",
      },
      { status: 500 },
    );
  }
}
