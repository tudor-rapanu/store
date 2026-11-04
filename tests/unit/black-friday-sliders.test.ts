import assert from "node:assert/strict";
import test from "node:test";

import { buildBlackFridaySliders } from "../../src/lib/black-friday/sliders";

const categories = [
  { id: "apparel", parentId: null },
  { id: "t-shirts", parentId: "apparel" },
  { id: "patches", parentId: null },
  { id: "stickers", parentId: null },
];
const descendantIdsByCategoryId = new Map([
  ["apparel", ["apparel", "t-shirts"]],
  ["patches", ["patches"]],
  ["stickers", ["stickers"]],
]);
// Newest first, as the catalog loader returns them.
const links = [
  { categoryId: "t-shirts", product: { id: "tee-new" } },
  { categoryId: "apparel", product: { id: "hoodie" } },
  { categoryId: "t-shirts", product: { id: "hoodie" } },
  { categoryId: "patches", product: { id: "patch-full-price" } },
  { categoryId: "apparel", product: { id: "tee-old" } },
  { categoryId: "stickers", product: { id: "sticker" } },
];

function sliderIds(discounted: string[], productsPerSlider = 24) {
  return buildBlackFridaySliders({
    categories,
    descendantIdsByCategoryId,
    links,
    discountedProductIds: new Set(discounted),
    productsPerSlider,
  }).map((slider) => [
    slider.category.id,
    slider.products.map((product) => product.id),
  ]);
}

test("top-level categories collect discounted products from their subcategories", () => {
  assert.deepEqual(sliderIds(["tee-new", "hoodie", "tee-old", "sticker"]), [
    ["apparel", ["tee-new", "hoodie", "tee-old"]],
    ["stickers", ["sticker"]],
  ]);
});

test("categories without discounted products are left out", () => {
  assert.deepEqual(sliderIds(["sticker"]), [["stickers", ["sticker"]]]);
  assert.deepEqual(sliderIds([]), []);
});

test("sliders are capped at the products-per-slider limit, newest first", () => {
  assert.deepEqual(sliderIds(["tee-new", "hoodie", "tee-old"], 2), [
    ["apparel", ["tee-new", "hoodie"]],
  ]);
});
