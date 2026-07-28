import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  GenerateAwbError,
  generateOrderAwb,
  type GenerateAwbBody,
} from "@/lib/orders/generate-awb";
import { enqueueAwbGenerationTask } from "@/lib/tasks/awb-generation";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function validateAwbRequest(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
      shippingMethod: orders.shippingMethod,
      awbNumber: orders.awbNumber,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  if (order.paymentStatus !== "paid") {
    return errorResponse("AWB can only be generated for paid orders.");
  }

  if (order.shippingMethod === "international") {
    return errorResponse(
      "Sameday AWB generation is not available for international orders.",
    );
  }

  if (order.awbNumber) {
    return errorResponse("This order already has an AWB.");
  }

  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to generate AWBs.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as GenerateAwbBody;
  const validationError = await validateAwbRequest(id);

  if (validationError) {
    return validationError;
  }

  try {
    const fallback = () => generateOrderAwb(id, body);
    const result = await enqueueAwbGenerationTask({ orderId: id, body }, fallback);

    revalidatePath("/", "layout");

    if (result && typeof result === "object" && "awbNumber" in result) {
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      message: "AWB generation was queued.",
    });
  } catch (error) {
    console.error("Generate AWB failed:", error);

    if (error instanceof GenerateAwbError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse(
      error instanceof Error ? error.message : "Could not generate AWB.",
      500,
    );
  }
}
