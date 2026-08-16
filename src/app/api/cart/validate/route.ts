import { and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { publicProductWhere } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/db/schema";
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from "@/lib/product-pricing";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { CartItemValidation } from "@/lib/store/cart-reconciliation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CART_ITEMS = 50;

type CartValidationRequestItem = {
  productId?: unknown;
  variantId?: unknown;
};

function unavailable(variantId: string): CartItemValidation {
  return { variantId, available: false };
}

export async function POST(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "cart:validate",
    limit: 300,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = (await request.json()) as {
      items?: CartValidationRequestItem[];
    };
    const rawItems = body.items;

    if (!Array.isArray(rawItems) || rawItems.length > MAX_CART_ITEMS) {
      return NextResponse.json(
        { error: "Cart contents are invalid." },
        { status: 400 },
      );
    }

    const items = rawItems.map((item) => {
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const variantId = typeof item.variantId === "string" ? item.variantId.trim() : "";

      if (!UUID_PATTERN.test(productId) || !UUID_PATTERN.test(variantId)) {
        throw new Error("Cart contains an invalid product.");
      }

      return { productId, variantId };
    });
    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [
      ...new Set(
        items
          .filter((item) => item.variantId !== item.productId)
          .map((item) => item.variantId),
      ),
    ];
    const [productRows, variantRows] = await Promise.all([
      productIds.length > 0
        ? db
            .select()
            .from(products)
            .where(and(inArray(products.id, productIds), publicProductWhere()))
        : [],
      variantIds.length > 0
        ? db
            .select()
            .from(productVariants)
            .where(inArray(productVariants.id, variantIds))
        : [],
    ]);
    const productById = new Map(productRows.map((product) => [product.id, product]));
    const variantById = new Map(variantRows.map((variant) => [variant.id, variant]));
    const validations = items.map<CartItemValidation>((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        return unavailable(item.variantId);
      }

      if (item.variantId === item.productId) {
        if (!product.isSimple) {
          return unavailable(item.variantId);
        }

        const maxQuantity = product.trackStock ? Math.max(product.stock, 0) : null;

        return maxQuantity === 0
          ? unavailable(item.variantId)
          : {
              variantId: item.variantId,
              available: true,
              price: getEffectiveProductPrice(product),
              maxQuantity,
            };
      }

      const variant = variantById.get(item.variantId);

      if (!variant || variant.productId !== product.id) {
        return unavailable(item.variantId);
      }

      const maxQuantity = variant.trackStock ? Math.max(variant.stock, 0) : null;

      return maxQuantity === 0
        ? unavailable(item.variantId)
        : {
            variantId: item.variantId,
            available: true,
            price: getEffectiveVariantPrice(product, variant),
            maxQuantity,
          };
    });

    return NextResponse.json(
      { items: validations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Cart could not be validated." },
      { status: 400 },
    );
  }
}
