import assert from "node:assert/strict";
import test from "node:test";

import { reconcileCartItems } from "../../src/lib/store/cart-reconciliation";

const items = [
  {
    productId: "product-1",
    variantId: "variant-1",
    title: "First",
    price: 1000,
    quantity: 4,
    maxQuantity: 6,
    sku: "FIRST",
  },
  {
    productId: "product-2",
    variantId: "variant-2",
    title: "Second",
    price: 2000,
    quantity: 1,
    sku: "SECOND",
  },
];

test("cart reconciliation refreshes price, stock, and quantity", () => {
  const result = reconcileCartItems(items, [
    {
      variantId: "variant-1",
      available: true,
      price: 1200,
      maxQuantity: 2,
    },
    {
      variantId: "variant-2",
      available: true,
      price: 2000,
      maxQuantity: null,
    },
  ]);

  assert.equal(result.removedCount, 0);
  assert.equal(result.adjustedCount, 1);
  assert.deepEqual(result.items[0], {
    ...items[0],
    price: 1200,
    quantity: 2,
    maxQuantity: 2,
  });
});

test("cart reconciliation removes unavailable or missing items", () => {
  const result = reconcileCartItems(items, [
    { variantId: "variant-1", available: false },
  ]);

  assert.deepEqual(result.items, []);
  assert.equal(result.removedCount, 2);
  assert.equal(result.adjustedCount, 0);
});
