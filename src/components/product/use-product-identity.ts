"use client";

import { useState } from "react";

import type { ProductFormProduct } from "./admin-product-form.types";
import { slugifyProductIdentifier } from "./admin-product-form-utils";

type SlugChangeEffect = (slug: string) => void;

export function useProductIdentity(product?: ProductFormProduct) {
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  function updateFromEnglishTitle(value: string, onSlugChange: SlugChangeEffect) {
    if (slugWasEdited) {
      return;
    }

    const nextSlug = slugifyProductIdentifier(value);
    setSlug(nextSlug);
    onSlugChange(nextSlug);
  }

  function updateSlug(value: string, onSlugChange: SlugChangeEffect) {
    const nextSlug = slugifyProductIdentifier(value);
    setSlug(nextSlug);
    setSlugWasEdited(true);
    onSlugChange(nextSlug);
  }

  function reset() {
    setSlug("");
    setSlugWasEdited(false);
  }

  return {
    slug,
    updateFromEnglishTitle,
    updateSlug,
    reset,
  };
}

export type ProductIdentityController = ReturnType<typeof useProductIdentity>;
