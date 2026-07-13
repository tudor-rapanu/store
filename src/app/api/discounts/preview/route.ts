import { and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/db/schema";
import { publicProductWhere } from "@/lib/catalog/cache";
import { resolveBestDiscount, type DiscountCartItem } from "@/lib/discounts";
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from "@/lib/product-pricing";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PreviewCartItem = {
  productId?: string;
  variantId?: string;
  quantity?: number;
};

function getQuantity(value: unknown) {
  const quantity = Number(value);

  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99
    ? quantity
    : 0;
}

async function resolvePreviewItems(cartItems: PreviewCartItem[]) {
  const normalized = cartItems
    .map((item) => {
      const productId =
        typeof item.productId === "string" ? item.productId.trim() : "";
      const variantId =
        typeof item.variantId === "string" ? item.variantId.trim() : "";
      const resolvedProductId = productId || variantId;
      const quantity = getQuantity(item.quantity);

      if (
        !resolvedProductId ||
        !variantId ||
        !UUID_PATTERN.test(resolvedProductId) ||
        !UUID_PATTERN.test(variantId) ||
        quantity === 0
      ) {
        return null;
      }

      return { productId: resolvedProductId, variantId, quantity };
    })
    .filter(Boolean) as Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;

  if (normalized.length === 0 || normalized.length > 50) {
    return { items: [], subtotal: 0 };
  }

  const productIds = [...new Set(normalized.map((item) => item.productId))];
  const variantIds = [
    ...new Set(
      normalized
        .filter((item) => item.variantId !== item.productId)
        .map((item) => item.variantId),
    ),
  ];
  const [productRows, variantRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), publicProductWhere())),
    variantIds.length > 0
      ? db
          .select()
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : [],
  ]);
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const variantById = new Map(
    variantRows.map((variant) => [variant.id, variant]),
  );
  const resolvedItems: DiscountCartItem[] = [];

  for (const item of normalized) {
    const product = productById.get(item.productId);

    if (!product) {
      continue;
    }

    const variant =
      item.variantId === item.productId ? null : variantById.get(item.variantId);
    const unitPrice = variant
      ? getEffectiveVariantPrice(product, variant)
      : getEffectiveProductPrice(product);

    if (unitPrice > 0) {
      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
      });
    }
  }

  return {
    items: resolvedItems,
    subtotal: resolvedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    ),
  };
}

export async function POST(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "discounts:preview",
    limit: 300,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = (await request.json()) as {
      items?: PreviewCartItem[];
      email?: string;
      voucherCode?: string;
    };
    const email =
      typeof body.email === "string" && EMAIL_PATTERN.test(body.email.trim())
        ? body.email.trim().toLowerCase()
        : "guest@example.com";
    const user = await getCurrentUser();
    const { items, subtotal } = await resolvePreviewItems(body.items ?? []);
    const discount = await resolveBestDiscount({
      items,
      email,
      userId: user?.id ?? null,
      voucherCode: body.voucherCode,
    });

    return NextResponse.json({
      subtotal,
      discountAmount: discount.discountAmount,
      discount: discount.discountSnapshot,
      message: discount.message,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not preview discount." },
      { status: 400 },
    );
  }
}
