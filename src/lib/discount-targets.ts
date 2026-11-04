import type { DiscountScope } from "@/lib/db/schema";

export type DiscountTargetFields = {
  scope: DiscountScope;
  productId?: string | null;
  categoryId?: string | null;
  productIds?: string[] | null;
  categoryIds?: string[] | null;
};

// Merges the target lists with the legacy single-id columns, so discounts saved
// before multi-select keep applying until they are next edited.
function mergeTargetIds(ids: string[] | null | undefined, legacyId?: string | null) {
  const merged = new Set(ids ?? []);

  if (legacyId) {
    merged.add(legacyId);
  }

  return merged;
}

export function getDiscountProductIds(discount: DiscountTargetFields) {
  return mergeTargetIds(discount.productIds, discount.productId);
}

export function getDiscountCategoryIds(discount: DiscountTargetFields) {
  return mergeTargetIds(discount.categoryIds, discount.categoryId);
}

export function isProductEligibleForDiscount(
  discount: DiscountTargetFields,
  productId: string,
  productCategoryIds: Set<string> | undefined,
) {
  if (discount.scope === "product") {
    return getDiscountProductIds(discount).has(productId);
  }

  if (discount.scope === "category") {
    const categoryIds = getDiscountCategoryIds(discount);

    return Array.from(productCategoryIds ?? []).some((categoryId) =>
      categoryIds.has(categoryId),
    );
  }

  return true;
}
