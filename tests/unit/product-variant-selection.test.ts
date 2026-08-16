import assert from "node:assert/strict";
import test from "node:test";

import {
  getVariantAttributes,
  getVariantOptionAvailability,
  selectVariantAttribute,
} from "../../src/components/product/product-variant-selection";

const attributeKeys = ["Color", "Size"];
const variants = [
  {
    attributes: { Color: "Black", Size: "S" },
    trackStock: true,
    stock: 2,
  },
  {
    attributes: { Color: "Black", Size: "M" },
    trackStock: true,
    stock: 0,
  },
  {
    attributes: { Color: "White", Size: "S" },
    trackStock: false,
    stock: 0,
  },
];

test("variant attributes accept objects and safe serialized values", () => {
  assert.deepEqual(getVariantAttributes(variants[0]), {
    Color: "Black",
    Size: "S",
  });
  assert.deepEqual(
    getVariantAttributes({ attributes: '{"Color":"White","Size":"M"}' }),
    { Color: "White", Size: "M" },
  );
  assert.deepEqual(getVariantAttributes({ attributes: "invalid" }), {});
});

test("changing an earlier attribute clears dependent selections", () => {
  assert.deepEqual(
    selectVariantAttribute({
      selectedAttributes: { Color: "Black", Size: "S" },
      attributeKeys,
      attributeKey: "Color",
      value: "White",
    }),
    { Color: "White" },
  );
  assert.deepEqual(
    selectVariantAttribute({
      selectedAttributes: { Color: "Black" },
      attributeKeys,
      attributeKey: "Size",
      value: "S",
    }),
    { Color: "Black", Size: "S" },
  );
});

test("variant availability follows preceding choices and inventory", () => {
  assert.deepEqual(
    getVariantOptionAvailability({
      variants,
      selectedAttributes: { Color: "Black" },
      attributeKeys,
      attributeKey: "Size",
      value: "S",
    }),
    { isAvailable: true, reason: null, stock: 2 },
  );
  assert.deepEqual(
    getVariantOptionAvailability({
      variants,
      selectedAttributes: { Color: "Black" },
      attributeKeys,
      attributeKey: "Size",
      value: "M",
    }),
    { isAvailable: false, reason: "outOfStock", stock: 0 },
  );
  assert.deepEqual(
    getVariantOptionAvailability({
      variants,
      selectedAttributes: { Color: "White" },
      attributeKeys,
      attributeKey: "Size",
      value: "M",
    }),
    { isAvailable: false, reason: "unavailable", stock: null },
  );
});

test("an untracked matching variant keeps an option available", () => {
  assert.deepEqual(
    getVariantOptionAvailability({
      variants,
      selectedAttributes: {},
      attributeKeys,
      attributeKey: "Color",
      value: "White",
    }),
    { isAvailable: true, reason: null, stock: null },
  );
});
