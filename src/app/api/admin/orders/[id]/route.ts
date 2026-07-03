import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  type FulfillmentStatus,
  type InvoiceStatus,
  orders,
  type PaymentStatus,
  type ShippingMethod,
} from "@/lib/db/schema";

const paymentStatuses = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
]);
const fulfillmentStatuses = new Set<FulfillmentStatus>([
  "new",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
const shippingMethods = new Set<ShippingMethod>([
  "address",
  "easybox",
  "international",
]);
const invoiceStatuses = new Set<InvoiceStatus>([
  "not_generated",
  "generated",
  "failed",
]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update orders.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    paymentStatus?: PaymentStatus;
    fulfillmentStatus?: FulfillmentStatus;
    shippingMethod?: ShippingMethod;
    awbNumber?: string;
    trackingUrl?: string;
    adminNotes?: string;
    customerNotes?: string;
    invoiceStatus?: InvoiceStatus;
    invoiceNumber?: string;
    invoiceUrl?: string;
    fgoInvoiceId?: string;
  };

  if (body.paymentStatus && !paymentStatuses.has(body.paymentStatus)) {
    return errorResponse("Invalid payment status.");
  }

  if (
    body.fulfillmentStatus &&
    !fulfillmentStatuses.has(body.fulfillmentStatus)
  ) {
    return errorResponse("Invalid order status.");
  }

  if (body.shippingMethod && !shippingMethods.has(body.shippingMethod)) {
    return errorResponse("Invalid shipping method.");
  }

  if (body.invoiceStatus && !invoiceStatuses.has(body.invoiceStatus)) {
    return errorResponse("Invalid invoice status.");
  }

  const [updatedOrder] = await db
    .update(orders)
    .set({
      paymentStatus: body.paymentStatus,
      fulfillmentStatus: body.fulfillmentStatus,
      shippingMethod: body.shippingMethod,
      awbNumber: body.awbNumber?.trim() || null,
      trackingUrl: body.trackingUrl?.trim() || null,
      adminNotes: body.adminNotes?.trim() || null,
      customerNotes: body.customerNotes?.trim() || null,
      invoiceStatus: body.invoiceStatus,
      invoiceNumber: body.invoiceNumber?.trim() || null,
      invoiceUrl: body.invoiceUrl?.trim() || null,
      fgoInvoiceId: body.fgoInvoiceId?.trim() || null,
      status:
        body.paymentStatus === "paid"
          ? "paid"
          : body.paymentStatus === "failed"
            ? "failed"
            : body.paymentStatus === "pending"
              ? "pending"
              : undefined,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();

  if (!updatedOrder) {
    return errorResponse("Order was not found.", 404);
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
