import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { orderItems, orders, productVariants, products } from "@/lib/db/schema";

export type InventorySummary = {
  productId: string;
  variantId: string | null;
  reserved: number;
  paid: number;
};

type InventorySummaryRow = {
  productId: string;
  variantId: string | null;
  reserved: number | string | null;
  paid: number | string | null;
};

export type InventorySummaryKey = string;

export function getInventorySummaryKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? "product"}`;
}

export async function getInventorySummaryForProducts(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<InventorySummaryKey, InventorySummary>();
  }

  const rows = await db
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      reserved: sql<number>`
        coalesce(sum(${orderItems.quantity}) filter (
          where ${orders.paymentStatus} = 'pending'
          and ${orders.stockReducedAt} is not null
        ), 0)
      `.as("reserved"),
      paid: sql<number>`
        coalesce(sum(${orderItems.quantity}) filter (
          where ${orders.paymentStatus} = 'paid'
          and ${orders.stockReducedAt} is not null
        ), 0)
      `.as("paid"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        inArray(orderItems.productId, productIds),
        sql`coalesce(${productVariants.trackStock}, ${products.trackStock}) = true`,
      ),
    )
    .groupBy(orderItems.productId, orderItems.variantId);

  return toInventorySummaryMap(rows);
}

function toInventorySummaryMap(rows: InventorySummaryRow[]) {
  const map = new Map<InventorySummaryKey, InventorySummary>();

  rows.forEach((row) => {
    const summary = {
      productId: row.productId,
      variantId: row.variantId,
      reserved: Number(row.reserved ?? 0),
      paid: Number(row.paid ?? 0),
    };

    map.set(getInventorySummaryKey(summary.productId, summary.variantId), summary);
  });

  return map;
}
