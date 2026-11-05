import type { DiscountType } from "@/lib/db/schema";

export type DiscountRule = {
  name: string;
  type: DiscountType;
  value: number;
};

export function calculateDiscountAmount(
  discount: Pick<DiscountRule, "type" | "value">,
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

// The discount that saves the most on one unit at this price, as shown in the
// catalog; checkout applies the same rules to the whole cart.
export function getBestDiscountForPrice(discounts: DiscountRule[], unitPrice: number) {
  let best: { name: string; discountAmount: number; discountedPrice: number } | null =
    null;

  for (const discount of discounts) {
    const discountAmount = calculateDiscountAmount(discount, unitPrice);

    if (discountAmount > (best?.discountAmount ?? 0)) {
      best = {
        name: discount.name,
        discountAmount,
        discountedPrice: Math.max(unitPrice - discountAmount, 0),
      };
    }
  }

  return best;
}
