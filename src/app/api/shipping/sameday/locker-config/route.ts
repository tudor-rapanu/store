import { NextResponse } from "next/server";

import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function readValue(value: string | undefined) {
  return value?.trim() || undefined;
}

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "shipping:sameday:locker-config",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const clientId = readValue(process.env.NEXT_PUBLIC_SAMEDAY_LOCKER_CLIENT_ID);
  const apiUsername =
    readValue(process.env.NEXT_PUBLIC_SAMEDAY_LOCKER_API_USERNAME) ??
    readValue(process.env.SAMEDAY_USERNAME);

  if (!clientId || !apiUsername) {
    return NextResponse.json(
      { error: "Sameday locker plugin configuration is missing." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    clientId,
    apiUsername,
  });
}
