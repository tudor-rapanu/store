import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  GenerateInvoiceError,
  generateOrderInvoice,
} from "@/lib/orders/generate-invoice";
import { enqueueInvoiceGenerationTask } from "@/lib/tasks/invoice-generation";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function validateInvoiceRequest(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
      invoiceStatus: orders.invoiceStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  if (order.paymentStatus !== "paid") {
    return errorResponse("Invoice can only be generated for paid orders.");
  }

  if (order.invoiceStatus === "generated") {
    return errorResponse("This order already has an invoice.");
  }

  return null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to generate invoices.", 403);
  }

  const { id } = await params;
  const validationError = await validateInvoiceRequest(id);

  if (validationError) {
    return validationError;
  }

  try {
    const fallback = () => generateOrderInvoice(id);
    const result = await enqueueInvoiceGenerationTask({ orderId: id }, fallback);

    revalidatePath("/", "layout");

    if (result && typeof result === "object" && "invoiceNumber" in result) {
      return NextResponse.json({ ok: true, invoice: result });
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      message: "Invoice generation was queued.",
    });
  } catch (error) {
    console.error("Generate invoice failed:", error);

    if (error instanceof GenerateInvoiceError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse(
      error instanceof Error ? error.message : "Could not generate invoice.",
      500,
    );
  }
}
