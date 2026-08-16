import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductGalleryLabel,
  getProductImageLabel,
  getProductPurchaseCopy,
  getSelectAttributeLabel,
  getViewProductImageLabel,
} from "../../src/components/product/product-purchase-copy";

test("purchase controls provide complete English and Romanian labels", () => {
  assert.deepEqual(getProductPurchaseCopy("en"), {
    addToCart: "Add to Cart",
    added: "Added",
    addedConfirmation: "Product added to cart.",
    outOfStock: "Out of Stock",
    maximumInCart: "Maximum in cart",
    unavailable: "Unavailable",
    imagePlaceholder: "Image unavailable",
    previousImage: "Previous product image",
    nextImage: "Next product image",
  });
  assert.deepEqual(getProductPurchaseCopy("ro"), {
    addToCart: "Adaugă în coș",
    added: "Adăugat",
    addedConfirmation: "Produs adăugat în coș.",
    outOfStock: "Stoc epuizat",
    maximumInCart: "Cantitate maximă în coș",
    unavailable: "Indisponibil",
    imagePlaceholder: "Imagine indisponibilă",
    previousImage: "Imaginea anterioară a produsului",
    nextImage: "Imaginea următoare a produsului",
  });
});

test("dynamic purchase and gallery labels use the active locale", () => {
  assert.equal(getSelectAttributeLabel("Size", "en"), "SELECT SIZE");
  assert.equal(getSelectAttributeLabel("Mărime", "ro"), "SELECTEAZĂ MĂRIME");
  assert.equal(
    getProductGalleryLabel("Hanorac", "ro"),
    "Galerie de imagini pentru Hanorac",
  );
  assert.equal(
    getProductImageLabel({
      title: "Hanorac",
      index: 2,
      total: 4,
      locale: "ro",
    }),
    "Hanorac, imaginea 2 din 4",
  );
  assert.equal(getViewProductImageLabel(3, "en"), "View product image 3");
});
