import { and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { publicProductWhere } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/db/schema";
import {
  formatFulfillmentEstimate,
  getCartFulfillmentEstimate,
} from "@/lib/fulfillment/estimate";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EstimateCartItem = {
  productId?: string;
  variantId?: string;
};

export async function POST(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "fulfillment:estimate",
    limit: 80,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = (await request.json()) as {
      items?: EstimateCartItem[];
      locale?: "en" | "ro";
    };
    const directProductIds = Array.from(
      new Set(
        (body.items ?? [])
          .map((item) =>
            typeof item.productId === "string" ? item.productId.trim() : "",
          )
          .filter((id) => UUID_PATTERN.test(id)),
      ),
    );
    const variantIds = Array.from(
      new Set(
        (body.items ?? [])
          .filter((item) => !item.productId)
          .map((item) =>
            typeof item.variantId === "string" ? item.variantId.trim() : "",
          )
          .filter((id) => UUID_PATTERN.test(id)),
      ),
    );

    if (
      directProductIds.length + variantIds.length === 0 ||
      directProductIds.length + variantIds.length > 50
    ) {
      return NextResponse.json({ estimate: null });
    }

    const variantRows =
      variantIds.length > 0
        ? await db
            .select({ productId: productVariants.productId })
            .from(productVariants)
            .where(inArray(productVariants.id, variantIds))
        : [];
    const productIds = Array.from(
      new Set([
        ...directProductIds,
        ...variantRows.map((variant) => variant.productId),
      ]),
    );

    if (productIds.length === 0) {
      return NextResponse.json({ estimate: null });
    }

    const productRows = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), publicProductWhere()));
    const estimate = getCartFulfillmentEstimate(productRows);
    const locale = body.locale === "ro" ? "ro" : "en";

    return NextResponse.json({
      estimate: estimate
        ? {
            start: estimate.start.toISOString(),
            end: estimate.end.toISOString(),
            label: formatFulfillmentEstimate(estimate, locale),
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not estimate fulfillment time." },
      { status: 400 },
    );
  }
}
