import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { updateLocalShippingProfiles } from "@/lib/shipping/profiles";

function parseAmount(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a positive amount.`);
  }

  return Math.round(parsed);
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      easyboxPrice?: unknown;
      addressPrice?: unknown;
      freeShippingThreshold?: unknown;
    };
    const profiles = await updateLocalShippingProfiles({
      easyboxPrice: parseAmount(body.easyboxPrice, "Easybox shipping"),
      addressPrice: parseAmount(body.addressPrice, "Address shipping"),
      freeShippingThreshold: parseAmount(
        body.freeShippingThreshold,
        "Free shipping threshold",
      ),
    });

    return NextResponse.json({ ok: true, profiles });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update shipping profiles.",
      },
      { status: 400 },
    );
  }
}
