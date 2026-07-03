import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, type PaymentCurrency } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendOrderEmail } from "@/lib/email";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type NetopiaWebhookBody = {
  order?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  [key: string]: unknown;
};

type ParsedWebhookBody = {
  body: NetopiaWebhookBody;
  rawBodyLength: number;
  parseMode: "json" | "form" | "invalid" | "too_large";
};

const MAX_WEBHOOK_BODY_LENGTH = 64 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getNetopiaStatusCode(status: unknown) {
  if (typeof status === "number") {
    return Number.isInteger(status) && status >= 0 && status <= 999
      ? status
      : null;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);

    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999
      ? parsed
      : null;
  }

  return null;
}

async function parseWebhookBody(request: Request): Promise<ParsedWebhookBody> {
  const rawBody = await request.text();

  if (rawBody.length > MAX_WEBHOOK_BODY_LENGTH) {
    return { body: {}, rawBodyLength: rawBody.length, parseMode: "too_large" };
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;

    return {
      body: isRecord(parsed) ? parsed : {},
      rawBodyLength: rawBody.length,
      parseMode: isRecord(parsed) ? "json" : "invalid",
    };
  } catch {
    const params = new URLSearchParams(rawBody);
    const order = params.get("order");
    const payment = params.get("payment");

    try {
      const parsedOrder = order ? (JSON.parse(order) as unknown) : undefined;
      const parsedPayment = payment ? (JSON.parse(payment) as unknown) : undefined;

      return {
        body: {
          order: isRecord(parsedOrder) ? parsedOrder : undefined,
          payment: isRecord(parsedPayment) ? parsedPayment : undefined,
        },
        rawBodyLength: rawBody.length,
        parseMode: "form",
      };
    } catch {
      return { body: {}, rawBodyLength: rawBody.length, parseMode: "invalid" };
    }
  }
}

function shouldLogNetopiaWebhookShape() {
  return process.env.NETOPIA_DEBUG_WEBHOOK?.trim().toLowerCase() === "true";
}

function getConfiguredWebhookSecret() {
  return process.env.NETOPIA_WEBHOOK_SECRET?.trim();
}

function hasValidWebhookSecret(request: Request) {
  const configuredSecret = getConfiguredWebhookSecret();

  if (!configuredSecret) {
    return true;
  }

  const receivedSecret = new URL(request.url).searchParams.get("token")?.trim();

  if (!receivedSecret) {
    return false;
  }

  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(receivedSecret);

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

function getDebugHeaders(headers: Headers) {
  const interestingHeaders = [
    "content-type",
    "user-agent",
    "x-forwarded-for",
    "cf-connecting-ip",
    "x-real-ip",
  ];

  return Object.fromEntries(
    interestingHeaders
      .map((header) => [header, headers.get(header)])
      .filter(([, value]) => Boolean(value)),
  );
}

function getValueShape(value: unknown) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function logNetopiaWebhookShape(
  request: Request,
  parsed: ParsedWebhookBody,
) {
  if (!shouldLogNetopiaWebhookShape()) {
    return;
  }

  const { body } = parsed;

  console.info("Netopia webhook debug shape:", {
    headers: getDebugHeaders(request.headers),
    parseMode: parsed.parseMode,
    rawBodyLength: parsed.rawBodyLength,
    topLevelKeys: Object.keys(body),
    orderKeys: isRecord(body.order) ? Object.keys(body.order) : [],
    paymentKeys: isRecord(body.payment) ? Object.keys(body.payment) : [],
    topLevelShapes: Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, getValueShape(value)]),
    ),
    orderShapes: isRecord(body.order)
      ? Object.fromEntries(
          Object.entries(body.order).map(([key, value]) => [
            key,
            getValueShape(value),
          ]),
        )
      : {},
    paymentShapes: isRecord(body.payment)
      ? Object.fromEntries(
          Object.entries(body.payment).map(([key, value]) => [
            key,
            getValueShape(value),
          ]),
        )
      : {},
  });
}

function getOrderId(order: Record<string, unknown>) {
  const value =
    order.id ?? order.orderID ?? order.orderId ?? order.order_id ?? order.ntpID;

  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function getTransactionId(payment: Record<string, unknown>) {
  const value =
    payment.transactionId ??
    payment.transactionID ??
    payment.ntpID ??
    payment.id;

  return typeof value === "string" ? value : null;
}

function getPaymentAmountInCents(payment: Record<string, unknown>) {
  const value = payment.amount;

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const centsFromMajorUnits = Math.round(parsed * 100);
  const centsFromMinorUnits = Math.round(parsed);

  return { centsFromMajorUnits, centsFromMinorUnits };
}

function getPaymentCurrency(payment: Record<string, unknown>) {
  const value = payment.currency;

  return typeof value === "string" ? value.trim().toUpperCase() : null;
}

function paymentAmountMatchesOrder(
  payment: Record<string, unknown>,
  expectedPaymentAmount: number,
) {
  const amount = getPaymentAmountInCents(payment);

  if (!amount) {
    return true;
  }

  return (
    amount.centsFromMajorUnits === expectedPaymentAmount ||
    amount.centsFromMinorUnits === expectedPaymentAmount
  );
}

function resolveAcceptedPayment({
  payment,
  paymentCurrency,
  expectedPaymentCurrency,
  expectedPaymentAmount,
  orderTotalAmount,
  orderId,
}: {
  payment: Record<string, unknown>;
  paymentCurrency: string | null;
  expectedPaymentCurrency: PaymentCurrency;
  expectedPaymentAmount: number;
  orderTotalAmount: number;
  orderId: string;
}): {
  accepted: boolean;
  paymentAmount: number;
  paymentCurrency: PaymentCurrency;
} {
  if (!paymentCurrency || paymentCurrency === expectedPaymentCurrency) {
    return {
      accepted: true,
      paymentAmount: expectedPaymentAmount,
      paymentCurrency: expectedPaymentCurrency,
    };
  }

  if (
    expectedPaymentCurrency === "EUR" &&
    paymentCurrency === "RON" &&
    paymentAmountMatchesOrder(payment, orderTotalAmount)
  ) {
    console.warn(
      "Netopia returned RON for an EUR order; accepting exact RON match.",
      {
        orderId,
        expectedPaymentCurrency,
        paymentCurrency,
        expectedPaymentAmount,
        orderTotalAmount,
        receivedAmount: payment.amount,
      },
    );

    return {
      accepted: true,
      paymentAmount: orderTotalAmount,
      paymentCurrency: "RON",
    };
  }

  return {
    accepted: false,
    paymentAmount: expectedPaymentAmount,
    paymentCurrency: expectedPaymentCurrency,
  };
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "webhook:netopia",
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    if (!hasValidWebhookSecret(request)) {
      console.warn("Netopia webhook rejected because the secret is invalid.");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = await parseWebhookBody(request);
    logNetopiaWebhookShape(request, parsedBody);

    const body = parsedBody.body;
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
      const [existingOrder] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!existingOrder) {
        console.warn("Netopia webhook order was not found.", { orderId });
        return NextResponse.json(
          { error: "Order was not found" },
          { status: 404 },
        );
      }

      const paymentCurrency = getPaymentCurrency(payment);

      const expectedPaymentCurrency: PaymentCurrency =
        existingOrder.paymentCurrency ?? "RON";
      const expectedPaymentAmount =
        existingOrder.paymentAmount ?? existingOrder.totalAmount;
      const acceptedPayment = resolveAcceptedPayment({
        payment,
        paymentCurrency,
        expectedPaymentCurrency,
        expectedPaymentAmount,
        orderTotalAmount: existingOrder.totalAmount,
        orderId,
      });

      if (!acceptedPayment.accepted) {
        console.warn("Netopia webhook currency mismatch.", {
          orderId,
          paymentCurrency,
          expectedPaymentCurrency,
        });
        return NextResponse.json(
          { error: "Payment currency mismatch" },
          { status: 400 },
        );
      }

      if (!paymentAmountMatchesOrder(payment, acceptedPayment.paymentAmount)) {
        console.warn("Netopia webhook amount mismatch.", {
          orderId,
          expectedAmount: acceptedPayment.paymentAmount,
          receivedAmount: payment.amount,
        });
        return NextResponse.json(
          { error: "Payment amount mismatch" },
          { status: 400 },
        );
      }

      const wasAlreadyPaid = existingOrder.paymentStatus === "paid";

      // 1. Update the database
      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: "paid",
          paymentStatus: "paid",
          fulfillmentStatus:
            existingOrder.fulfillmentStatus === "new"
              ? "processing"
              : existingOrder.fulfillmentStatus,
          netopiaTxId: netopiaTxId ?? existingOrder.netopiaTxId,
          paymentAmount: acceptedPayment.paymentAmount,
          paymentCurrency: acceptedPayment.paymentCurrency,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning(); // Ensure you return the updated row

      if (!wasAlreadyPaid) {
        // 2. Fire the receipt email only on the first paid notification.
        sendOrderEmail(
          updatedOrder.customerEmail,
          updatedOrder.customerFirstName,
          `TT-${updatedOrder.orderNumber}`,
          updatedOrder.totalAmount,
          false, // isBankTransfer = false
          undefined,
        );
      }

      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: updatedOrder.customerEmail,
        event: "payment_confirmed",
        properties: {
          order_id: updatedOrder.id,
          order_number: updatedOrder.orderNumber,
          netopia_transaction_id: netopiaTxId,
          amount: updatedOrder.paymentAmount ?? updatedOrder.totalAmount,
          currency: updatedOrder.paymentCurrency,
          order_total_ron: updatedOrder.totalAmount,
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
          amount: failedOrder.paymentAmount ?? failedOrder.totalAmount,
          currency: failedOrder.paymentCurrency,
          order_total_ron: failedOrder.totalAmount,
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
