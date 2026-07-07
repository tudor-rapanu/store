import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { orderItems, orders, productVariants, products } from "@/lib/db/schema";

export async function reduceTrackedStockForPaidOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ stockReducedAt: orders.stockReducedAt })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.stockReducedAt) {
      return;
    }

    const items = await tx
      .select({
        itemId: orderItems.id,
        quantity: orderItems.quantity,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        productTrackStock: products.trackStock,
        variantTrackStock: productVariants.trackStock,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      if (item.variantId) {
        if (!item.variantTrackStock) {
          continue;
        }

        const [updatedVariant] = await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.trackStock, true),
              gte(productVariants.stock, item.quantity),
            ),
          )
          .returning({ id: productVariants.id });

        if (!updatedVariant) {
          throw new Error("A paid order could not reduce variant stock.");
        }

        continue;
      }

      if (!item.productTrackStock) {
        continue;
      }

      const [updatedProduct] = await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.trackStock, true),
            gte(products.stock, item.quantity),
          ),
        )
        .returning({ id: products.id });

      if (!updatedProduct) {
        throw new Error("A paid order could not reduce product stock.");
      }
    }

    await tx
      .update(orders)
      .set({
        stockReducedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  });
}
