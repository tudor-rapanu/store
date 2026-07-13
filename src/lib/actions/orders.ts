"use server";

import { and, eq, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";

export async function getOrderPaymentStatus(orderId: string) {
  const [order] = await db
    .select({ status: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return order?.status ?? null;
}

export async function markStaleNetopiaOrdersFailed() {
  const staleAfterMinutes = Number.parseInt(
    process.env.NETOPIA_PENDING_TIMEOUT_MINUTES ?? "60",
    10,
  );
  const timeoutMinutes = Number.isFinite(staleAfterMinutes) ? staleAfterMinutes : 60;
  const staleCutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  await db
    .update(orders)
    .set({
      status: "failed",
      paymentStatus: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.paymentMethod, "card"),
        eq(orders.paymentStatus, "pending"),
        lt(orders.createdAt, staleCutoff),
      ),
    );
}
