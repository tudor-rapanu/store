import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { orderItems, orders, productVariants, products } from "@/lib/db/schema";

export async function reserveTrackedStockForOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [reservedOrder] = await tx
      .update(orders)
      .set({
        stockReducedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), isNull(orders.stockReducedAt)))
      .returning({ id: orders.id });

    if (!reservedOrder) {
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
          throw new Error("An order could not reserve variant stock.");
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
        throw new Error("An order could not reserve product stock.");
      }
    }
  });
}

export async function reduceTrackedStockForPaidOrder(orderId: string) {
  await reserveTrackedStockForOrder(orderId);
}

export async function releaseTrackedStockForOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        paymentStatus: orders.paymentStatus,
        stockReducedAt: orders.stockReducedAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order?.stockReducedAt || order.paymentStatus === "paid") {
      return;
    }

    const items = await tx
      .select({
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

        await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, item.variantId));
        continue;
      }

      if (!item.productTrackStock) {
        continue;
      }

      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }

    await tx
      .update(orders)
      .set({
        stockReducedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  });
}
