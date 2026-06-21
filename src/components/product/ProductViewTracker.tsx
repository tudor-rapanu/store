"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface ProductViewTrackerProps {
  productId: string;
  productTitle: string;
  productSlug: string;
  basePrice: number;
}

export function ProductViewTracker({
  productId,
  productTitle,
  productSlug,
  basePrice,
}: ProductViewTrackerProps) {
  useEffect(() => {
    posthog.capture("product_viewed", {
      product_id: productId,
      product_title: productTitle,
      product_slug: productSlug,
      base_price: basePrice,
      currency: "RON",
    });
  }, [productId, productTitle, productSlug, basePrice]);

  return null;
}
