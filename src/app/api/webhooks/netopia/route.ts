import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendOrderEmail } from "@/lib/email";
import { getPostHogClient } from "@/lib/posthog-server";

type NetopiaWebhookBody = {
  order?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  [key: string]: unknown;
};

function getNetopiaStatusCode(status: unknown) {
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function parseWebhookBody(request: Request): Promise<NetopiaWebhookBody> {
  const rawBody = await request.text();

  try {
    return JSON.parse(rawBody) as NetopiaWebhookBody;
  } catch {
    const params = new URLSearchParams(rawBody);
    const order = params.get("order");
    const payment = params.get("payment");

    return {
      order: order ? (JSON.parse(order) as Record<string, unknown>) : undefined,
      payment: payment
        ? (JSON.parse(payment) as Record<string, unknown>)
        : undefined,
    };
  }
}

function getOrderId(order: Record<string, unknown>) {
  const value =
    order.id ?? order.orderID ?? order.orderId ?? order.order_id ?? order.ntpID;

  return typeof value === "string" ? value : null;
}

function getTransactionId(payment: Record<string, unknown>) {
  const value =
    payment.transactionId ??
    payment.transactionID ??
    payment.ntpID ??
    payment.id;

  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  try {
    const body = await parseWebhookBody(request);
    const { order, payment } = body;

    if (!order || !payment) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    // You can verify the payment status via the SDK if needed,
    // or trust the payload if you implement IPN signature validation

    const orderId = getOrderId(order);
    const status = getNetopiaStatusCode(
      payment.status ?? payment.statusCode ?? payment.code,
    ); // V2 statuses e.g., 3 = paid, 5 = confirmed, 12 = rejected
    const netopiaTxId = getTransactionId(payment);

    if (!orderId) {
      console.warn("Netopia webhook missing order id.", {
        orderKeys: Object.keys(order),
        paymentKeys: Object.keys(payment),
      });
      return NextResponse.json(
        { error: "Missing order id" },
        { status: 400 },
      );
    }

    if (status === null) {
      console.warn("Netopia webhook missing payment status.", {
        orderId,
        paymentKeys: Object.keys(payment),
      });
      return NextResponse.json(
        { error: "Missing payment status" },
        { status: 400 },
      );
    }

    if (status === 3 || status === 5) {
      // Paid or Confirmed
      // 1. Update the database
      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: "paid",
          paymentStatus: "paid",
          fulfillmentStatus: "processing",
          netopiaTxId: netopiaTxId,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning(); // Ensure you return the updated row

      if (!updatedOrder) {
        console.warn("Netopia webhook order was not found.", { orderId });
        return NextResponse.json(
          { error: "Order was not found" },
          { status: 404 },
        );
      }

      // 2. Fire the receipt email
      sendOrderEmail(
        updatedOrder.customerEmail,
        updatedOrder.customerFirstName,
        `TT-${updatedOrder.orderNumber}`,
        updatedOrder.totalAmount,
        false, // isBankTransfer = false
        undefined,
      );

      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: updatedOrder.customerEmail,
        event: "payment_confirmed",
        properties: {
          order_id: updatedOrder.id,
          order_number: updatedOrder.orderNumber,
          netopia_transaction_id: netopiaTxId,
          amount: updatedOrder.totalAmount,
          currency: "RON",
          payment_status: status,
        },
      });
    } else if (status === 12) {
      // Rejected
      const [failedOrder] = await db
        .update(orders)
        .set({
          status: "failed",
          paymentStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!failedOrder) {
        console.warn("Netopia webhook order was not found.", { orderId });
        return NextResponse.json(
          { error: "Order was not found" },
          { status: 404 },
        );
      }

      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: failedOrder.customerEmail,
        event: "payment_failed",
        properties: {
          order_id: failedOrder.id,
          order_number: failedOrder.orderNumber,
          netopia_transaction_id: netopiaTxId,
          amount: failedOrder.totalAmount,
          currency: "RON",
          payment_status: status,
        },
      });
    }

    // V2 requires a simple JSON 200 response with errorCode: 0 to acknowledge receipt
    return NextResponse.json({ errorCode: 0 });
  } catch (error) {
    console.error("Netopia Webhook Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
