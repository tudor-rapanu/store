import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sendInvoiceEmail } from "@/lib/email";
import {
  GenerateInvoiceError,
  generateOrderInvoice,
} from "@/lib/orders/generate-invoice";
import { isAuthorizedTaskRequest } from "@/lib/tasks/auth";
import { enqueueOrderEmailTask } from "@/lib/tasks/order-email";
import type { InvoiceGenerationTaskPayload } from "@/lib/tasks/invoice-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePayload(value: unknown): InvoiceGenerationTaskPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<InvoiceGenerationTaskPayload>;

  return typeof payload.orderId === "string" ? { orderId: payload.orderId } : null;
}

async function sendGeneratedInvoiceEmail(orderId: string, invoiceUrl: string | null) {
  if (!invoiceUrl) {
    console.warn("Skipping invoice email because FGO did not return an invoice URL.", {
      orderId,
    });
    return;
  }

  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      customerEmail: orders.customerEmail,
      customerFirstName: orders.customerFirstName,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.warn("Skipping invoice email because the order could not be reloaded.", {
      orderId,
    });
    return;
  }

  await enqueueOrderEmailTask({ orderId, type: "invoice" }, () =>
    sendInvoiceEmail({
      email: order.customerEmail,
      customerName: order.customerFirstName,
      orderId: `TT-${order.orderNumber}`,
      invoiceUrl,
    }),
  );
}

export async function POST(request: Request) {
  if (!isAuthorizedTaskRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  }

  try {
    const invoice = await generateOrderInvoice(payload.orderId);
    await sendGeneratedInvoiceEmail(payload.orderId, invoice.invoiceUrl);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    console.error("Queued invoice generation failed:", error);

    if (error instanceof GenerateInvoiceError) {
      if (error.message === "This order already has an invoice.") {
        return NextResponse.json({ ok: true, alreadyGenerated: true });
      }

      if (!error.retryable) {
        return NextResponse.json({
          ok: false,
          error: error.message,
          retryable: false,
        });
      }

      return NextResponse.json(
        { error: error.message, retryable: true },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate invoice." },
      { status: 500 },
    );
  }
}
