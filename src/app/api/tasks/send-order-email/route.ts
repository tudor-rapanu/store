import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  sendAdminOrderEmail,
  sendInvoiceEmail,
  sendOrderEmail,
  sendTrackingEmail,
} from "@/lib/email";
import type { FulfillmentEstimate } from "@/lib/fulfillment/estimate";
import { isAuthorizedTaskRequest } from "@/lib/tasks/auth";
import type { OrderEmailTaskPayload } from "@/lib/tasks/order-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function getOrderAccessUrl(order: typeof orders.$inferSelect, locale: "en" | "ro") {
  const siteUrl = getSiteUrl();
  const path = `/${locale}/orders/${order.orderNumber}?token=${order.accessToken}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

function getAdminOrderUrl(orderId: string, locale: "en" | "ro") {
  const siteUrl = getSiteUrl();
  const path = `/${locale}/admin/orders/${orderId}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

function getFulfillmentEstimate(
  order: typeof orders.$inferSelect,
): FulfillmentEstimate | null {
  if (!order.estimatedShippingStart || !order.estimatedShippingEnd) {
    return null;
  }

  return {
    start: order.estimatedShippingStart,
    end: order.estimatedShippingEnd,
  };
}

function isOrderEmailTaskType(value: unknown): value is OrderEmailTaskPayload["type"] {
  return (
    value === "admin" ||
    value === "customer" ||
    value === "tracking" ||
    value === "invoice"
  );
}

function parsePayload(value: unknown): OrderEmailTaskPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<OrderEmailTaskPayload>;

  if (typeof payload.orderId !== "string" || !isOrderEmailTaskType(payload.type)) {
    return null;
  }

  return {
    orderId: payload.orderId,
    type: payload.type,
    locale: payload.locale === "ro" ? "ro" : "en",
  };
}

async function sendQueuedOrderEmail(payload: OrderEmailTaskPayload) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, payload.orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const locale = payload.locale ?? "en";
  const orderId = `TT-${order.orderNumber}`;
  const customerName = `${order.customerFirstName} ${order.customerLastName}`;

  if (payload.type === "admin") {
    await sendAdminOrderEmail({
      orderId,
      customerName,
      customerEmail: order.customerEmail,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      adminOrderUrl: getAdminOrderUrl(order.id, locale),
    });
  } else if (payload.type === "customer") {
    await sendOrderEmail(
      order.customerEmail,
      order.customerFirstName,
      orderId,
      order.totalAmount,
      order.paymentMethod === "bank_transfer",
      getOrderAccessUrl(order, locale),
      getFulfillmentEstimate(order),
      locale,
    );
  } else if (payload.type === "tracking") {
    if (!order.trackingUrl) {
      return NextResponse.json(
        { error: "Order does not have a tracking URL" },
        { status: 409 },
      );
    }

    await sendTrackingEmail({
      email: order.customerEmail,
      customerName: order.customerFirstName,
      orderId,
      trackingUrl: order.trackingUrl,
    });
  } else {
    if (!order.invoiceUrl) {
      return NextResponse.json(
        { error: "Order does not have an invoice URL" },
        { status: 409 },
      );
    }

    await sendInvoiceEmail({
      email: order.customerEmail,
      customerName: order.customerFirstName,
      orderId,
      invoiceUrl: order.invoiceUrl,
    });
  }

  return NextResponse.json({ ok: true, orderId, type: payload.type });
}

export async function POST(request: Request) {
  if (!isAuthorizedTaskRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  }

  return sendQueuedOrderEmail(payload);
}
