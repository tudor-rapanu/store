import assert from "node:assert/strict";
import test from "node:test";

import {
  clampCartQuantity,
  getCartQuantityLimit,
  MAX_CART_ITEM_QUANTITY,
} from "../../src/lib/store/cart-quantity";

test("cart quantity limits support tracked and untracked products", () => {
  assert.equal(getCartQuantityLimit(), MAX_CART_ITEM_QUANTITY);
  assert.equal(getCartQuantityLimit(null), MAX_CART_ITEM_QUANTITY);
  assert.equal(getCartQuantityLimit(4), 4);
  assert.equal(getCartQuantityLimit(120), MAX_CART_ITEM_QUANTITY);
  assert.equal(getCartQuantityLimit(0), 0);
});

test("cart quantities are clamped to valid inventory limits", () => {
  assert.equal(clampCartQuantity(3, 5), 3);
  assert.equal(clampCartQuantity(8, 5), 5);
  assert.equal(clampCartQuantity(-4, 5), 1);
  assert.equal(clampCartQuantity(Number.NaN, 5), 1);
  assert.equal(clampCartQuantity(1, 0), 0);
});
