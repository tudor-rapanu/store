import { revalidateTag, unstable_cache } from "next/cache";
import { and, eq, inArray, or } from "drizzle-orm";

import { getAllCategories } from "@/lib/categories";
import { db } from "@/lib/db";
import {
  categories,
  discounts,
  discountUsages,
  productCategories,
  products,
  type DiscountScope,
  type DiscountType,
} from "@/lib/db/schema";
import {
  getEffectiveProductPrice,
  type ProductPriceFields,
} from "@/lib/product-pricing";

export type DiscountCartItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type CatalogDiscountProduct = ProductPriceFields & {
  id: string;
};

export type CatalogDiscountPresentation = {
  discountName: string;
  discountAmount: number;
  discountedPrice: number;
};

export type DiscountResult = {
  discountAmount: number;
  discountSnapshot: {
    id: string;
    name: string;
    code: string | null;
    type: DiscountType;
    scope: DiscountScope;
    value: number;
    eligibleSubtotal: number;
    amount: number;
  } | null;
  message?: string;
};

const EMPTY_DISCOUNT: DiscountResult = {
  discountAmount: 0,
  discountSnapshot: null,
};

const DISCOUNT_REVALIDATE_SECONDS = 60;

export const DISCOUNT_CACHE_TAGS = {
  automatic: "discounts:automatic",
} as const;

export function revalidateDiscountCache() {
  revalidateTag(DISCOUNT_CACHE_TAGS.automatic, { expire: 0 });
}

const getCachedAutomaticDiscountRows = unstable_cache(
  async () => {
    return db.select().from(discounts).where(eq(discounts.kind, "automatic"));
  },
  ["discounts:automatic-rows"],
  {
    revalidate: DISCOUNT_REVALIDATE_SECONDS,
    tags: [DISCOUNT_CACHE_TAGS.automatic],
  },
);

function normalizeVoucherCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().toUpperCase();

  return code.length > 0 && code.length <= 64 ? code : null;
}

function toDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isActiveDiscount(row: typeof discounts.$inferSelect, now: Date) {
  if (!row.enabled) {
    return false;
  }

  const startsAt = toDate(row.startsAt);
  const expiresAt = toDate(row.expiresAt);

  if (startsAt && startsAt > now) {
    return false;
  }

  if (expiresAt && expiresAt < now) {
    return false;
  }

  return true;
}

async function getProductCategoryMap(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, Set<string>>();
  }

  const rows = await db
    .select({
      productId: productCategories.productId,
      categoryId: productCategories.categoryId,
    })
    .from(productCategories)
    .where(inArray(productCategories.productId, productIds));
  const map = new Map<string, Set<string>>();

  for (const row of rows) {
    const set = map.get(row.productId) ?? new Set<string>();
    set.add(row.categoryId);
    map.set(row.productId, set);
  }

  return map;
}

function getEligibleSubtotal(
  discount: typeof discounts.$inferSelect,
  items: DiscountCartItem[],
  productCategoryMap: Map<string, Set<string>>,
) {
  return items.reduce((sum, item) => {
    if (discount.scope === "product" && discount.productId !== item.productId) {
      return sum;
    }

    if (
      discount.scope === "category" &&
      (!discount.categoryId ||
        !productCategoryMap.get(item.productId)?.has(discount.categoryId))
    ) {
      return sum;
    }

    return sum + item.unitPrice * item.quantity;
  }, 0);
}

function calculateDiscountAmount(
  discount: typeof discounts.$inferSelect,
  eligibleSubtotal: number,
) {
  if (eligibleSubtotal <= 0) {
    return 0;
  }

  if (discount.type === "percentage") {
    return Math.min(
      eligibleSubtotal,
      Math.round((eligibleSubtotal * discount.value) / 100),
    );
  }

  return Math.min(eligibleSubtotal, discount.value);
}

async function voucherWasUsed({
  discountId,
  email,
  userId,
}: {
  discountId: string;
  email: string;
  userId: string | null;
}) {
  const identityCondition = userId
    ? or(eq(discountUsages.email, email), eq(discountUsages.userId, userId))!
    : eq(discountUsages.email, email);

  const [usage] = await db
    .select({ id: discountUsages.id })
    .from(discountUsages)
    .where(and(eq(discountUsages.discountId, discountId), identityCondition))
    .limit(1);

  return Boolean(usage);
}

export async function resolveBestDiscount({
  items,
  email,
  userId,
  voucherCode,
}: {
  items: DiscountCartItem[];
  email: string;
  userId: string | null;
  voucherCode?: string | null;
}): Promise<DiscountResult> {
  if (items.length === 0) {
    return EMPTY_DISCOUNT;
  }

  const now = new Date();
  const code = normalizeVoucherCode(voucherCode);
  const automaticRows = await getCachedAutomaticDiscountRows();
  const voucherRows = code
    ? await db
        .select()
        .from(discounts)
        .where(and(eq(discounts.kind, "voucher"), eq(discounts.code, code)))
    : [];
  const candidates = [...automaticRows, ...voucherRows].filter((discount) =>
    isActiveDiscount(discount, now),
  );
  const productCategoryMap = candidates.some(
    (discount) => discount.scope === "category",
  )
    ? await getProductCategoryMap([...new Set(items.map((item) => item.productId))])
    : new Map<string, Set<string>>();

  let best: DiscountResult = code
    ? {
        ...EMPTY_DISCOUNT,
        message: "Voucher code is not valid.",
      }
    : EMPTY_DISCOUNT;

  for (const discount of candidates) {
    if (discount.kind === "voucher") {
      const alreadyUsed = await voucherWasUsed({
        discountId: discount.id,
        email,
        userId,
      });

      if (alreadyUsed) {
        continue;
      }
    }

    const eligibleSubtotal = getEligibleSubtotal(discount, items, productCategoryMap);
    const amount = calculateDiscountAmount(discount, eligibleSubtotal);

    if (amount > best.discountAmount) {
      best = {
        discountAmount: amount,
        discountSnapshot: {
          id: discount.id,
          name: discount.name,
          code: discount.code,
          type: discount.type,
          scope: discount.scope,
          value: discount.value,
          eligibleSubtotal,
          amount,
        },
        message:
          discount.kind === "voucher"
            ? `Voucher ${discount.code} applied.`
            : `${discount.name} applied.`,
      };
    }
  }

  if (best.discountAmount === 0 && !code) {
    return EMPTY_DISCOUNT;
  }

  return best;
}

export async function recordVoucherUsage({
  discountSnapshot,
  orderId,
  userId,
  email,
}: {
  discountSnapshot: DiscountResult["discountSnapshot"];
  orderId: string;
  userId: string | null;
  email: string;
}) {
  if (!discountSnapshot?.code) {
    return;
  }

  await db.insert(discountUsages).values({
    discountId: discountSnapshot.id,
    orderId,
    userId,
    email,
  });
}

export async function getCatalogAutomaticDiscountPrices(
  productRows: CatalogDiscountProduct[],
) {
  if (productRows.length === 0) {
    return new Map<string, CatalogDiscountPresentation>();
  }

  const now = new Date();
  const activeDiscounts = (await getCachedAutomaticDiscountRows()).filter((discount) =>
    isActiveDiscount(discount, now),
  );

  if (activeDiscounts.length === 0) {
    return new Map<string, CatalogDiscountPresentation>();
  }

  const productCategoryMap = activeDiscounts.some(
    (discount) => discount.scope === "category",
  )
    ? await getProductCategoryMap(productRows.map((product) => product.id))
    : new Map<string, Set<string>>();
  const discountMap = new Map<string, CatalogDiscountPresentation>();

  for (const product of productRows) {
    const unitPrice = getEffectiveProductPrice(product, now);

    for (const discount of activeDiscounts) {
      const eligibleSubtotal = getEligibleSubtotal(
        discount,
        [{ productId: product.id, quantity: 1, unitPrice }],
        productCategoryMap,
      );
      const discountAmount = calculateDiscountAmount(discount, eligibleSubtotal);
      const current = discountMap.get(product.id);

      if (discountAmount > (current?.discountAmount ?? 0)) {
        discountMap.set(product.id, {
          discountName: discount.name,
          discountAmount,
          discountedPrice: Math.max(unitPrice - discountAmount, 0),
        });
      }
    }
  }

  return discountMap;
}

export async function getDiscountAdminOptions() {
  const [productRows, categoryRows] = await Promise.all([
    db
      .select({
        id: products.id,
        title: products.title,
      })
      .from(products),
    getAllCategories(),
  ]);

  return {
    products: productRows,
    categories: categoryRows,
  };
}
