import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sendCustomerNoteEmail } from "@/lib/email";

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Loads the order and emails the customer its current customer note.
 * Returns false when there is nothing to send (missing order or empty note).
 */
export async function sendCustomerNoteEmailForOrder(
  orderId: string,
  locale: "en" | "ro" = "ro",
) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const note = order?.customerNotes?.trim();

  if (!order || !note) {
    return false;
  }

  const siteUrl = getSiteUrl();
  const path = `/${locale}/orders/${order.orderNumber}?token=${order.accessToken}`;

  await sendCustomerNoteEmail({
    email: order.customerEmail,
    customerName: order.customerFirstName,
    orderId: `TT-${order.orderNumber}`,
    note,
    orderUrl: siteUrl ? `${siteUrl}${path}` : path,
  });

  return true;
}
