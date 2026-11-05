import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDiscountAmount,
  getBestDiscountForPrice,
} from "../../src/lib/discount-pricing";

test("discount amounts never exceed the price", () => {
  assert.equal(calculateDiscountAmount({ type: "percentage", value: 25 }, 9999), 2500);
  assert.equal(calculateDiscountAmount({ type: "fixed", value: 1500 }, 9999), 1500);
  assert.equal(calculateDiscountAmount({ type: "fixed", value: 1500 }, 1000), 1000);
  assert.equal(calculateDiscountAmount({ type: "percentage", value: 25 }, 0), 0);
});

test("the best discount depends on the price being shown", () => {
  const discounts = [
    { name: "Ten percent", type: "percentage" as const, value: 10 },
    { name: "Twenty off", type: "fixed" as const, value: 2000 },
  ];

  assert.deepEqual(getBestDiscountForPrice(discounts, 10000), {
    name: "Twenty off",
    discountAmount: 2000,
    discountedPrice: 8000,
  });
  assert.deepEqual(getBestDiscountForPrice(discounts, 30000), {
    name: "Ten percent",
    discountAmount: 3000,
    discountedPrice: 27000,
  });
  assert.equal(getBestDiscountForPrice([], 10000), null);
});
