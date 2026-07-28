import { and, eq, isNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueProducts = await db
    .select({
      id: products.id,
      slug: products.slug,
    })
    .from(products)
    .where(
      and(
        eq(products.isPrivate, false),
        isNull(products.publishRevalidatedAt),
        lte(products.publishAt, now),
      ),
    )
    .limit(50);

  if (dueProducts.length === 0) {
    return NextResponse.json({
      revalidated: false,
      count: 0,
      checkedAt: now.toISOString(),
    });
  }

  revalidateCatalogViews({
    productSlugs: dueProducts.map((product) => product.slug),
  });

  await db
    .update(products)
    .set({
      publishRevalidatedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(products.isPrivate, false),
        isNull(products.publishRevalidatedAt),
        lte(products.publishAt, now),
      ),
    );

  return NextResponse.json({
    revalidated: true,
    count: dueProducts.length,
    productSlugs: dueProducts.map((product) => product.slug),
    checkedAt: now.toISOString(),
  });
}
