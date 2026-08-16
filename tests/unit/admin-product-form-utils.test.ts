import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVariantMatrix,
  deriveVariantOptions,
  getAttributeSignature,
  getAdminProductSaveRequest,
  getOptionCombinations,
  getSelectedCategoryLabels,
  getVariantSku,
  moveListItem,
  serializeCategoryValues,
  serializeProductDetailRows,
  serializeVariantRows,
  slugifyProductIdentifier,
  splitOptionValues,
} from "../../src/components/product/admin-product-form-utils";

test("product saves use the correct create and update requests", () => {
  assert.deepEqual(getAdminProductSaveRequest(), {
    endpoint: "/api/admin/products",
    method: "POST",
  });
  assert.deepEqual(getAdminProductSaveRequest("product-123"), {
    endpoint: "/api/admin/products/product-123",
    method: "PATCH",
  });
});

test("selected categories preserve their form payload and display labels", () => {
  const values = ["shirts", "legacy-category"];
  const availableCategories = [{ id: "category-1", name: "Shirts", value: "shirts" }];

  assert.equal(serializeCategoryValues(values), "shirts, legacy-category");
  assert.deepEqual(getSelectedCategoryLabels(values, availableCategories), [
    "Shirts",
    "legacy-category",
  ]);
});

test("list items move one position without crossing a boundary", () => {
  const items = ["first", "second", "third"];

  assert.deepEqual(moveListItem(items, 1, -1), ["second", "first", "third"]);
  assert.deepEqual(moveListItem(items, 1, 1), ["first", "third", "second"]);
  assert.equal(moveListItem(items, 0, -1), items);
  assert.equal(moveListItem(items, 2, 1), items);
});

test("variant matrix generation requires a type and values", () => {
  assert.deepEqual(buildVariantMatrix([], []), {
    ok: false,
    error: "Add at least one variant type before generating variants.",
  });
  assert.deepEqual(
    buildVariantMatrix([{ id: "color", name: "Color", values: "" }], []),
    {
      ok: false,
      error: "Add at least one value for Color.",
    },
  );
});

test("variant matrix generation only returns missing combinations", () => {
  const result = buildVariantMatrix(
    [
      { id: "color", name: "Color", values: "Black, White" },
      { id: "size", name: "Size", values: "S, M" },
    ],
    [{ attributes: { Color: "Black", Size: "S" } }],
  );

  assert.deepEqual(result, {
    ok: true,
    totalCombinations: 4,
    missingVariants: [
      {
        attributes: { Color: "Black", Size: "M" },
        name: "Black / M",
      },
      {
        attributes: { Color: "White", Size: "S" },
        name: "White / S",
      },
      {
        attributes: { Color: "White", Size: "M" },
        name: "White / M",
      },
    ],
  });
});

test("product identifiers and option values are normalized consistently", () => {
  assert.equal(slugifyProductIdentifier("  Black / Large  "), "black-large");
  assert.equal(
    getVariantSku("Summer Shirt", "Black / Large", 1),
    "summer-shirt-black-large-2",
  );
  assert.deepEqual(splitOptionValues(" S, M, S, , L "), ["S", "M", "L"]);
});

test("variant options are derived without duplicate values", () => {
  let nextId = 0;
  const options = deriveVariantOptions(
    [
      {
        name: "Black / S",
        sku: "black-s",
        attributes: { Color: "Black", Size: "S" },
        price: 100,
        stock: 1,
      },
      {
        name: "Black / M",
        sku: "black-m",
        attributes: { Color: "Black", Size: "M" },
        price: 100,
        stock: 1,
      },
    ],
    () => `option-${(nextId += 1)}`,
  );

  assert.deepEqual(options, [
    { id: "option-1", name: "Color", values: "Black" },
    { id: "option-2", name: "Size", values: "S, M" },
  ]);
});

test("variant combinations and signatures are deterministic", () => {
  const combinations = getOptionCombinations([
    { name: "Color", values: ["Black", "White"] },
    { name: "Size", values: ["S", "M"] },
  ]);

  assert.deepEqual(combinations, [
    { Color: "Black", Size: "S" },
    { Color: "Black", Size: "M" },
    { Color: "White", Size: "S" },
    { Color: "White", Size: "M" },
  ]);
  assert.equal(
    getAttributeSignature(combinations[0], ["Color", "Size"]),
    "Color:Black|Size:S",
  );
});

test("variant payload serialization excludes client-only row state", () => {
  const payload = serializeVariantRows(
    [
      {
        id: "client-row",
        dbId: "database-row",
        skuWasEdited: true,
        name: "Black / S",
        sku: "black-s",
        attributes: { Color: "Black", Size: "S" },
        price: 120,
        stock: 3,
      },
    ],
    true,
  );

  assert.deepEqual(JSON.parse(payload), [
    {
      id: "database-row",
      name: "Black / S",
      sku: "black-s",
      attributes: { Color: "Black", Size: "S" },
      price: 120,
      salePrice: null,
      saleEnabled: false,
      saleStartsAt: "",
      saleEndsAt: "",
      trackStock: false,
      stock: 3,
    },
  ]);
  assert.equal(serializeVariantRows([], false), "[]");
});

test("product detail payload serialization excludes row identifiers", () => {
  const payload = serializeProductDetailRows([
    {
      rowId: "client-row",
      id: "database-row",
      icon: "shirt",
      label: { en: "Material", ro: "Material" },
      value: { en: "Cotton", ro: "Bumbac" },
      enabled: true,
    },
  ]);

  assert.deepEqual(JSON.parse(payload), [
    {
      icon: "shirt",
      label: { en: "Material", ro: "Material" },
      value: { en: "Cotton", ro: "Bumbac" },
      enabled: true,
    },
  ]);
});
