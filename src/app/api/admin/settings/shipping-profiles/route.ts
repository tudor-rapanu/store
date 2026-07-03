import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { updateCurrencySettings } from "@/lib/currency/settings";
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
      internationalPrice?: unknown;
      freeShippingThreshold?: unknown;
      ronToEurRate?: unknown;
    };
    const profiles = await updateLocalShippingProfiles({
      easyboxPrice: parseAmount(body.easyboxPrice, "Easybox shipping"),
      addressPrice: parseAmount(body.addressPrice, "Address shipping"),
      internationalPrice: parseAmount(
        body.internationalPrice,
        "International shipping",
      ),
      freeShippingThreshold: parseAmount(
        body.freeShippingThreshold,
        "Free shipping threshold",
      ),
    });
    const currencySettings = await updateCurrencySettings({
      ronToEurRate: Number(body.ronToEurRate),
    });

    return NextResponse.json({ ok: true, profiles, currencySettings });
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
