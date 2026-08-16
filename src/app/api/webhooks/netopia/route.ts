import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, type PaymentCurrency } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { sendOrderEmail } from "@/lib/email";
import {
  reduceTrackedStockForPaidOrder,
  releaseTrackedStockForOrder,
} from "@/lib/inventory";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { enqueueInvoiceGenerationTask } from "@/lib/tasks/invoice-generation";
import { enqueueOrderEmailTask } from "@/lib/tasks/order-email";

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

type WebhookPaymentContext = {
  orderId: string;
  payment: Record<string, unknown>;
  status: number;
  netopiaTxId: string | null;
};

type WebhookContextResult =
  | {
      response: NextResponse;
    }
  | WebhookPaymentContext;

const MAX_WEBHOOK_BODY_LENGTH = 64 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getNetopiaStatusCode(status: unknown) {
  if (typeof status === "number") {
    return Number.isInteger(status) && status >= 0 && status <= 999 ? status : null;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);

    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999 ? parsed : null;
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
    expected.length === received.length && crypto.timingSafeEqual(expected, received)
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

function logNetopiaWebhookShape(request: Request, parsed: ParsedWebhookBody) {
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
          Object.entries(body.order).map(([key, value]) => [key, getValueShape(value)]),
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
    payment.transactionId ?? payment.transactionID ?? payment.ntpID ?? payment.id;

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
    console.warn("Netopia returned RON for an EUR order; accepting exact RON match.", {
      orderId,
      expectedPaymentCurrency,
      paymentCurrency,
      expectedPaymentAmount,
      orderTotalAmount,
      receivedAmount: payment.amount,
    });

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

async function validateNetopiaRequest(request: Request) {
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

  return null;
}

async function getWebhookPaymentContext(
  request: Request,
): Promise<WebhookContextResult> {
  const parsedBody = await parseWebhookBody(request);
  logNetopiaWebhookShape(request, parsedBody);

  const { order, payment } = parsedBody.body;

  if (!order || !payment) {
    return {
      response: NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      ),
    };
  }

  const orderId = getOrderId(order);
  const status = getNetopiaStatusCode(
    payment.status ?? payment.statusCode ?? payment.code,
  );
  const netopiaTxId = getTransactionId(payment);

  if (!orderId) {
    console.warn("Netopia webhook missing order id.", {
      orderKeys: Object.keys(order),
      paymentKeys: Object.keys(payment),
    });
    return {
      response: NextResponse.json({ error: "Missing order id" }, { status: 400 }),
    };
  }

  if (status === null) {
    console.warn("Netopia webhook missing payment status.", {
      orderId,
      paymentKeys: Object.keys(payment),
    });
    return {
      response: NextResponse.json({ error: "Missing payment status" }, { status: 400 }),
    };
  }

  return { orderId, payment, status, netopiaTxId };
}

function getPaidOrderUpdate({
  acceptedPayment,
  existingOrder,
  netopiaTxId,
}: {
  acceptedPayment: { paymentAmount: number; paymentCurrency: PaymentCurrency };
  existingOrder: typeof orders.$inferSelect;
  netopiaTxId: string | null;
}) {
  return {
    status: "paid" as const,
    paymentStatus: "paid" as const,
    fulfillmentStatus:
      existingOrder.fulfillmentStatus === "new"
        ? ("processing" as const)
        : existingOrder.fulfillmentStatus,
    netopiaTxId: netopiaTxId ?? existingOrder.netopiaTxId,
    paymentAmount: acceptedPayment.paymentAmount,
    paymentCurrency: acceptedPayment.paymentCurrency,
    updatedAt: new Date(),
  };
}

function sendFirstPaymentEmail(updatedOrder: typeof orders.$inferSelect) {
  void enqueueOrderEmailTask(
    { orderId: updatedOrder.id, type: "customer" },
    () =>
      sendOrderEmail(
        updatedOrder.customerEmail,
        updatedOrder.customerFirstName,
        `TT-${updatedOrder.orderNumber}`,
        updatedOrder.totalAmount,
        false,
        undefined,
        updatedOrder.estimatedShippingStart && updatedOrder.estimatedShippingEnd
          ? {
              start: updatedOrder.estimatedShippingStart,
              end: updatedOrder.estimatedShippingEnd,
            }
          : null,
      ),
  );
}

function queueInvoiceGeneration(updatedOrder: typeof orders.$inferSelect) {
  void enqueueInvoiceGenerationTask({ orderId: updatedOrder.id }, () => {
    console.warn("Skipping inline invoice generation because Cloud Tasks is unavailable.", {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
    });
  });
}

function capturePaymentEvent({
  event,
  netopiaTxId,
  order,
  status,
}: {
  event: "payment_confirmed" | "payment_failed";
  netopiaTxId: string | null;
  order: typeof orders.$inferSelect;
  status: number;
}) {
  const posthog = getPostHogClient();

  // Only report if the browser gave analytics consent at checkout time -
  // this webhook fires asynchronously and has no other way to know.
  if (!posthog || order.analyticsConsent !== "accepted") {
    return;
  }

  const distinctId = crypto
    .createHash("sha256")
    .update(order.customerEmail)
    .digest("hex");

  posthog.capture({
    distinctId,
    event,
    properties: {
      order_id: order.id,
      order_number: order.orderNumber,
      netopia_transaction_id: netopiaTxId,
      amount: order.paymentAmount ?? order.totalAmount,
      currency: order.paymentCurrency,
      order_total_ron: order.totalAmount,
      payment_status: status,
    },
  });
}

async function handlePaidPayment({
  netopiaTxId,
  orderId,
  payment,
  status,
}: {
  netopiaTxId: string | null;
  orderId: string;
  payment: Record<string, unknown>;
  status: number;
}) {
  const [existingOrder] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existingOrder) {
    console.warn("Netopia webhook order was not found.", { orderId });
    return NextResponse.json({ error: "Order was not found" }, { status: 404 });
  }

  const paymentCurrency = getPaymentCurrency(payment);
  const expectedPaymentCurrency: PaymentCurrency = existingOrder.paymentCurrency ?? "RON";
  const acceptedPayment = resolveAcceptedPayment({
    payment,
    paymentCurrency,
    expectedPaymentCurrency,
    expectedPaymentAmount: existingOrder.paymentAmount ?? existingOrder.totalAmount,
    orderTotalAmount: existingOrder.totalAmount,
    orderId,
  });

  if (!acceptedPayment.accepted) {
    console.warn("Netopia webhook currency mismatch.", {
      orderId,
      paymentCurrency,
      expectedPaymentCurrency,
    });
    return NextResponse.json({ error: "Payment currency mismatch" }, { status: 400 });
  }

  if (!paymentAmountMatchesOrder(payment, acceptedPayment.paymentAmount)) {
    console.warn("Netopia webhook amount mismatch.", {
      orderId,
      expectedAmount: acceptedPayment.paymentAmount,
      receivedAmount: payment.amount,
    });
    return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
  }

  // Idempotent regardless of race: the underlying update only ever fires once
  // per order (guarded by stockReducedAt), so concurrent webhooks are safe here.
  await reduceTrackedStockForPaidOrder(existingOrder.id);

  // Atomic conditional transition: the WHERE clause ensures only one of any
  // concurrent/duplicate "paid" webhooks actually flips the status, so only
  // that request sends the confirmation email and queues the invoice.
  const [updatedOrder] = await db
    .update(orders)
    .set(getPaidOrderUpdate({ acceptedPayment, existingOrder, netopiaTxId }))
    .where(and(eq(orders.id, orderId), ne(orders.paymentStatus, "paid")))
    .returning();

  if (!updatedOrder) {
    return null;
  }

  sendFirstPaymentEmail(updatedOrder);
  queueInvoiceGeneration(updatedOrder);

  capturePaymentEvent({
    event: "payment_confirmed",
    netopiaTxId,
    order: updatedOrder,
    status,
  });

  return null;
}

async function handleRejectedPayment({
  netopiaTxId,
  orderId,
  status,
}: {
  netopiaTxId: string | null;
  orderId: string;
  status: number;
}) {
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
    return NextResponse.json({ error: "Order was not found" }, { status: 404 });
  }

  await releaseTrackedStockForOrder(failedOrder.id);

  capturePaymentEvent({
    event: "payment_failed",
    netopiaTxId,
    order: failedOrder,
    status,
  });

  return null;
}

async function handlePaymentStatus(context: WebhookPaymentContext) {
  if (context.status === 3 || context.status === 5) {
    return handlePaidPayment(context);
  }

  return context.status === 12 ? handleRejectedPayment(context) : null;
}

export async function POST(request: Request) {
  try {
    const rejectedRequest = await validateNetopiaRequest(request);

    if (rejectedRequest) {
      return rejectedRequest;
    }

    const context = await getWebhookPaymentContext(request);

    if ("response" in context) {
      return context.response;
    }

    const paymentResponse = await handlePaymentStatus(context);

    return paymentResponse ?? NextResponse.json({ errorCode: 0 });
  } catch (error) {
    console.error("Netopia Webhook Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
