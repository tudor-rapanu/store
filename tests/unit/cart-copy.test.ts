import assert from "node:assert/strict";
import test from "node:test";

import {
  getCartCopy,
  getCartReconciliationMessage,
} from "../../src/lib/store/cart-copy";

test("cart controls have English and Romanian copy", () => {
  assert.equal(getCartCopy("en").checkout, "Checkout");
  assert.equal(getCartCopy("en").stockLimitReached, "You reached the available stock.");
  assert.equal(getCartCopy("ro").checkout, "Finalizează comanda");
  assert.equal(getCartCopy("ro").stockLimitReached, "Ai atins stocul disponibil.");
});

test("cart reconciliation messages prioritize failures and removals", () => {
  assert.equal(
    getCartReconciliationMessage("en", {
      removedCount: 0,
      adjustedCount: 1,
      failed: false,
    }),
    "Cart prices and quantities were refreshed.",
  );
  assert.equal(
    getCartReconciliationMessage("ro", {
      removedCount: 1,
      adjustedCount: 1,
      failed: false,
    }),
    "Produsele indisponibile au fost eliminate din coș.",
  );
});
