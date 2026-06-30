import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "orders:cancel",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return errorResponse("Order was not found.", 404);
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
  };
  const accessToken =
    typeof body.token === "string" && ACCESS_TOKEN_PATTERN.test(body.token)
      ? body.token
      : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  const canAccess =
    Boolean(user?.id && order.userId === user.id) ||
    Boolean(accessToken && order.accessToken === accessToken);

  if (!canAccess) {
    return errorResponse("You are not allowed to cancel this order.", 403);
  }

  if (
    ["shipped", "delivered", "cancelled", "refunded"].includes(
      order.fulfillmentStatus,
    )
  ) {
    return errorResponse("This order can no longer be cancelled.", 409);
  }

  await db
    .update(orders)
    .set({
      fulfillmentStatus: "cancelled",
      cancelRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
