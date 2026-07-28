import { NextResponse } from "next/server";

import { markStaleNetopiaOrdersFailed } from "@/lib/actions/orders";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await markStaleNetopiaOrdersFailed();

  return NextResponse.json({
    markedFailed: result.count,
    staleCutoff: result.staleCutoff.toISOString(),
    timeoutMinutes: result.timeoutMinutes,
    checkedAt: new Date().toISOString(),
  });
}
