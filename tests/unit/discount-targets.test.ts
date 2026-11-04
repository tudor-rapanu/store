import assert from "node:assert/strict";
import test from "node:test";

import {
  readDiscountSchedule,
  readDiscountTargets,
} from "../../src/lib/admin/discount-input";
import {
  getDiscountProductIds,
  isProductEligibleForDiscount,
} from "../../src/lib/discount-targets";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const CATEGORY_A = "33333333-3333-4333-8333-333333333333";
const CATEGORY_B = "44444444-4444-4444-8444-444444444444";

test("product discounts apply to every picked product", () => {
  const discount = { scope: "product" as const, productIds: [PRODUCT_A, PRODUCT_B] };

  assert.equal(isProductEligibleForDiscount(discount, PRODUCT_A, undefined), true);
  assert.equal(isProductEligibleForDiscount(discount, PRODUCT_B, undefined), true);
  assert.equal(isProductEligibleForDiscount(discount, "other", undefined), false);
});

test("category discounts apply when a product is in any picked category", () => {
  const discount = {
    scope: "category" as const,
    categoryIds: [CATEGORY_A, CATEGORY_B],
  };

  assert.equal(
    isProductEligibleForDiscount(discount, PRODUCT_A, new Set(["x", CATEGORY_B])),
    true,
  );
  assert.equal(
    isProductEligibleForDiscount(discount, PRODUCT_A, new Set(["x"])),
    false,
  );
  assert.equal(isProductEligibleForDiscount(discount, PRODUCT_A, undefined), false);
});

test("discounts saved before multi-select keep their single target", () => {
  const legacy = { scope: "product" as const, productId: PRODUCT_A, productIds: [] };

  assert.deepEqual(Array.from(getDiscountProductIds(legacy)), [PRODUCT_A]);
  assert.equal(
    isProductEligibleForDiscount(
      { scope: "category", categoryId: CATEGORY_A, categoryIds: [] },
      PRODUCT_B,
      new Set([CATEGORY_A]),
    ),
    true,
  );
});

test("storewide discounts apply to everything", () => {
  assert.equal(
    isProductEligibleForDiscount({ scope: "storewide" }, PRODUCT_A, undefined),
    true,
  );
});

test("schedule inputs are read as Romania time", () => {
  const { startsAt, expiresAt } = readDiscountSchedule({
    startsAt: "2026-11-06T00:00",
    expiresAt: "2026-11-07T00:00",
  });

  // Romania is UTC+2 in November.
  assert.equal(startsAt?.toISOString(), "2026-11-05T22:00:00.000Z");
  assert.equal(expiresAt?.toISOString(), "2026-11-06T22:00:00.000Z");
  assert.deepEqual(readDiscountSchedule({ startsAt: "", expiresAt: "" }), {
    startsAt: null,
    expiresAt: null,
  });
});

test("schedule must end after it starts", () => {
  assert.throws(
    () =>
      readDiscountSchedule({
        startsAt: "2026-11-07T00:00",
        expiresAt: "2026-11-06T00:00",
      }),
    /end after it starts/,
  );
  assert.throws(
    () => readDiscountSchedule({ expiresAt: "tomorrow" }),
    /Invalid end date/,
  );
});

test("targets keep only valid ids for the chosen scope and require at least one", () => {
  assert.deepEqual(
    readDiscountTargets("product", {
      productIds: [PRODUCT_A, PRODUCT_A, "not-an-id", PRODUCT_B],
      categoryIds: [CATEGORY_A],
    }),
    {
      productId: null,
      categoryId: null,
      productIds: [PRODUCT_A, PRODUCT_B],
      categoryIds: [],
    },
  );
  assert.deepEqual(readDiscountTargets("storewide", { productIds: [PRODUCT_A] }), {
    productId: null,
    categoryId: null,
    productIds: [],
    categoryIds: [],
  });
  assert.throws(
    () => readDiscountTargets("category", { categoryIds: [] }),
    /at least one category/,
  );
});
