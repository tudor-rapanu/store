import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import {
  normalizeBlackFridaySettings,
  validateBlackFridaySettings,
} from "@/lib/black-friday/campaign";
import { updateBlackFridaySettings } from "@/lib/black-friday/settings";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";

type BlackFridayPayload = {
  enabled?: unknown;
  teaserStartsAt?: unknown;
  saleStartsAt?: unknown;
  saleEndsAt?: unknown;
  ctaHref?: unknown;
  copy?: unknown;
};

// The admin form sends datetime-local values entered in Romania time.
function parseRomaniaInput(value: unknown) {
  return typeof value === "string" && value.trim()
    ? (parseRomaniaDateTimeLocal(value.trim())?.toISOString() ?? null)
    : null;
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as BlackFridayPayload;
  const settings = normalizeBlackFridaySettings({
    enabled: body.enabled === true,
    teaserStartsAt: parseRomaniaInput(body.teaserStartsAt),
    saleStartsAt: parseRomaniaInput(body.saleStartsAt),
    saleEndsAt: parseRomaniaInput(body.saleEndsAt),
    ctaHref: body.ctaHref,
    copy: body.copy,
  });
  const validationError = validateBlackFridaySettings(settings);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const savedSettings = await updateBlackFridaySettings(settings);

  return NextResponse.json({ ok: true, settings: savedSettings });
}
