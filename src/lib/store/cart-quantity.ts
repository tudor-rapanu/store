export const MAX_CART_ITEM_QUANTITY = 99;

export function getCartQuantityLimit(maxQuantity?: number | null) {
  if (!Number.isInteger(maxQuantity)) {
    return MAX_CART_ITEM_QUANTITY;
  }

  return Math.min(Math.max(maxQuantity ?? 0, 0), MAX_CART_ITEM_QUANTITY);
}

export function clampCartQuantity(quantity: number, maxQuantity?: number | null) {
  const limit = getCartQuantityLimit(maxQuantity);

  if (limit === 0) {
    return 0;
  }

  const normalizedQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;

  return Math.min(Math.max(normalizedQuantity, 1), limit);
}
