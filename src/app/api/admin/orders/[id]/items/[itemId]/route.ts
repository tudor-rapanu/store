import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update orders.", 403);
  }

  const { id, itemId } = await params;
  const [deletedItem] = await db
    .delete(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, id)))
    .returning({ id: orderItems.id });

  if (!deletedItem) {
    return errorResponse("Order item was not found.", 404);
  }

  await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, id));

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
