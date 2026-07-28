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
import {
  reduceTrackedStockForPaidOrder,
  releaseTrackedStockForOrder,
} from "@/lib/inventory";

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

type OrderUpdateBody = {
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

type OrderStatus = "pending" | "paid" | "failed";

function validateOrderUpdateBody(body: OrderUpdateBody) {
  if (body.paymentStatus && !paymentStatuses.has(body.paymentStatus)) {
    return "Invalid payment status.";
  }

  if (body.fulfillmentStatus && !fulfillmentStatuses.has(body.fulfillmentStatus)) {
    return "Invalid order status.";
  }

  if (body.shippingMethod && !shippingMethods.has(body.shippingMethod)) {
    return "Invalid shipping method.";
  }

  if (body.invoiceStatus && !invoiceStatuses.has(body.invoiceStatus)) {
    return "Invalid invoice status.";
  }

  return null;
}

function getOrderStatusFromPayment(
  paymentStatus?: PaymentStatus,
): OrderStatus | undefined {
  if (paymentStatus === "paid") {
    return "paid";
  }

  if (paymentStatus === "failed") {
    return "failed";
  }

  return paymentStatus === "pending" ? "pending" : undefined;
}

async function reduceStockForNewPaidStatus(
  orderId: string,
  previousPaymentStatus: PaymentStatus,
  nextPaymentStatus?: PaymentStatus,
) {
  if (nextPaymentStatus !== "paid" || previousPaymentStatus === "paid") {
    return null;
  }

  try {
    await reduceTrackedStockForPaidOrder(orderId);
    return null;
  } catch {
    return "This order cannot be marked as paid because one or more tracked-stock items are no longer available.";
  }
}

async function releaseStockForNewFailedStatus(
  orderId: string,
  previousPaymentStatus: PaymentStatus,
  nextPaymentStatus?: PaymentStatus,
) {
  if (nextPaymentStatus !== "failed" || previousPaymentStatus !== "pending") {
    return;
  }

  await releaseTrackedStockForOrder(orderId);
}

function getOrderUpdateValues(body: OrderUpdateBody) {
  return {
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
    status: getOrderStatusFromPayment(body.paymentStatus),
    updatedAt: new Date(),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update orders.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as OrderUpdateBody;
  const validationError = validateOrderUpdateBody(body);

  if (validationError) {
    return errorResponse(validationError);
  }

  const [existingOrder] = await db
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!existingOrder) {
    return errorResponse("Order was not found.", 404);
  }

  const stockError = await reduceStockForNewPaidStatus(
    existingOrder.id,
    existingOrder.paymentStatus,
    body.paymentStatus,
  );

  if (stockError) {
    return errorResponse(stockError, 409);
  }

  await db
    .update(orders)
    .set(getOrderUpdateValues(body))
    .where(eq(orders.id, id))
    .returning();

  await releaseStockForNewFailedStatus(
    existingOrder.id,
    existingOrder.paymentStatus,
    body.paymentStatus,
  );

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
