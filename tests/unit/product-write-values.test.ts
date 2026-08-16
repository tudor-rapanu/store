import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedProductForm } from "../../src/lib/admin/product-form";
import {
  getProductDetailWriteValues,
  getProductWriteValues,
  getVariantWriteValues,
} from "../../src/lib/admin/product-write-values";

function createProductForm(
  overrides: Partial<ParsedProductForm> = {},
): ParsedProductForm {
  return {
    titleEn: "Shirt",
    titleRo: "Tricou",
    descriptionEn: "Cotton",
    descriptionRo: "Bumbac",
    slug: "shirt",
    price: 100,
    basePrice: 10_000,
    salePrice: 8_000,
    saleEnabled: true,
    saleStartsAt: null,
    saleEndsAt: null,
    productionMinDays: 1,
    productionMaxDays: 3,
    preorderEnabled: false,
    preorderShipDate: null,
    publishAt: null,
    isDigital: false,
    sizeGuideId: null,
    trackStock: true,
    stock: 5,
    isPrivate: false,
    categoryNames: [],
    variants: [],
    detailBlocks: [],
    shouldWaitForPublishRevalidation: false,
    ...overrides,
  };
}

test("product write values preserve simple-product stock and sale settings", () => {
  const values = getProductWriteValues(createProductForm());

  assert.deepEqual(values.title, { en: "Shirt", ro: "Tricou" });
  assert.deepEqual(values.description, { en: "Cotton", ro: "Bumbac" });
  assert.equal(values.salePrice, 8_000);
  assert.equal(values.trackStock, true);
  assert.equal(values.stock, 5);
  assert.equal(values.isSimple, true);
  assert.ok(values.publishRevalidatedAt instanceof Date);
});

test("variant products disable product-level stock", () => {
  const values = getProductWriteValues(
    createProductForm({
      variants: [
        {
          name: "Large",
          sku: "shirt-large",
          attributes: { Size: "Large" },
        },
      ],
    }),
  );

  assert.equal(values.trackStock, false);
  assert.equal(values.stock, 0);
  assert.equal(values.isSimple, false);
});

test("variant write values normalize money and stock", () => {
  const values = getVariantWriteValues(
    {
      name: "Large",
      sku: "",
      attributes: { Size: "Large" },
      price: 99.99,
      saleEnabled: true,
      salePrice: 79.5,
      trackStock: true,
      stock: 3.9,
    },
    "shirt",
    0,
  );

  assert.equal(values.sku, "shirt-large-1");
  assert.equal(values.price, 9_999);
  assert.equal(values.salePrice, 7_950);
  assert.equal(values.stock, 3);
});

test("detail write values assign their display order", () => {
  assert.deepEqual(
    getProductDetailWriteValues(
      {
        icon: "shirt",
        label: { en: "Material", ro: "Material" },
        value: { en: "Cotton", ro: "Bumbac" },
        enabled: true,
      },
      2,
    ),
    {
      icon: "shirt",
      label: { en: "Material", ro: "Material" },
      value: { en: "Cotton", ro: "Bumbac" },
      sortOrder: 2,
      enabled: true,
    },
  );
});
