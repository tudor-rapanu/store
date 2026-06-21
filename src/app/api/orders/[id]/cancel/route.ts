import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
  };
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
    Boolean(body.token && order.accessToken === body.token);

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
