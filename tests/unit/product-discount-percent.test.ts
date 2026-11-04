import assert from "node:assert/strict";
import test from "node:test";

import { getDiscountPercent } from "../../src/lib/product-pricing";

test("discount percent is the rounded saving against the regular price", () => {
  assert.equal(getDiscountPercent(10000, 7500), 25);
  assert.equal(getDiscountPercent(14999, 9999), 33);
  assert.equal(getDiscountPercent(10000, 0), 100);
});

test("no discount percent without a meaningful saving", () => {
  assert.equal(getDiscountPercent(10000, 10000), null);
  assert.equal(getDiscountPercent(10000, 12000), null);
  assert.equal(getDiscountPercent(10000, 9960), null);
  assert.equal(getDiscountPercent(0, 0), null);
});
