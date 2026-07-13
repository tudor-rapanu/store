import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orderItems, orders, products, productVariants } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update orders.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    variantId?: string | null;
    quantity?: number;
    unitPrice?: number;
  };
  const quantity = Number(body.quantity);
  const unitPrice = Math.round(Number(body.unitPrice) * 100);

  if (!body.productId) {
    return errorResponse("Choose a product.");
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    return errorResponse("Enter a valid quantity.");
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 1) {
    return errorResponse("Enter a valid unit price.");
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, body.productId))
    .limit(1);

  if (!product) {
    return errorResponse("Product was not found.", 404);
  }

  if (body.variantId) {
    const [variant] = await db
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(eq(productVariants.id, body.variantId))
      .limit(1);

    if (!variant || variant.productId !== body.productId) {
      return errorResponse("Variant does not belong to this product.");
    }
  }

  await db.insert(orderItems).values({
    orderId: order.id,
    productId: product.id,
    variantId: body.variantId || null,
    quantity,
    unitPrice,
  });

  await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, order.id));

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
