import { clampCartQuantity } from "./cart-quantity";

export type CartItemData = {
  productId?: string;
  variantId: string;
  title: string;
  price: number;
  quantity: number;
  maxQuantity?: number | null;
  sku: string;
  isDigital?: boolean;
};

export type CartItemValidation = {
  variantId: string;
  available: boolean;
  price?: number;
  maxQuantity?: number | null;
};

export type CartReconciliationResult = {
  items: CartItemData[];
  removedCount: number;
  adjustedCount: number;
};

export function reconcileCartItems(
  items: CartItemData[],
  validations: CartItemValidation[],
): CartReconciliationResult {
  const validationByVariantId = new Map(
    validations.map((validation) => [validation.variantId, validation]),
  );
  const reconciledItems: CartItemData[] = [];
  let removedCount = 0;
  let adjustedCount = 0;

  for (const item of items) {
    const validation = validationByVariantId.get(item.variantId);
    const price = validation?.price;

    if (
      !validation?.available ||
      typeof price !== "number" ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      removedCount += 1;
      continue;
    }

    const maxQuantity =
      validation.maxQuantity == null
        ? null
        : Math.max(Math.trunc(validation.maxQuantity), 0);
    const quantity = clampCartQuantity(item.quantity, maxQuantity);

    if (quantity === 0) {
      removedCount += 1;
      continue;
    }

    if (
      price !== item.price ||
      quantity !== item.quantity ||
      maxQuantity !== (item.maxQuantity ?? null)
    ) {
      adjustedCount += 1;
    }

    reconciledItems.push({
      ...item,
      price,
      quantity,
      maxQuantity,
    });
  }

  return { items: reconciledItems, removedCount, adjustedCount };
}
