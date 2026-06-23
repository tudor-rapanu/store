import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { downloadSamedayAwbLabel } from "@/lib/shipping/sameday";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to download AWB labels.", 403);
  }

  const { id } = await params;
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      awbNumber: orders.awbNumber,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  if (!order.awbNumber) {
    return errorResponse("This order does not have an AWB label yet.");
  }

  try {
    const label = await downloadSamedayAwbLabel(order.awbNumber);

    if (!label.body) {
      return errorResponse("Sameday returned an empty AWB label.", 502);
    }

    return new Response(label.body, {
      headers: {
        "Content-Disposition": `inline; filename="TT-${order.orderNumber}-${order.awbNumber}.pdf"`,
        "Content-Type": label.contentType,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Could not download AWB label.",
      502,
    );
  }
}
