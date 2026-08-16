"use client";

import { useState } from "react";

import type { ProductFormProduct } from "./admin-product-form.types";
import { toProductDateTimeInputValue } from "./admin-product-form-utils";

type ProductCommerceState = {
  basePrice: string;
  saleEnabled: boolean;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  isDigital: boolean;
  trackStock: boolean;
  stock: string;
  productionMinDays: string;
  productionMaxDays: string;
  preorderEnabled: boolean;
  preorderShipDate: string;
};

function getInitialState(product?: ProductFormProduct): ProductCommerceState {
  return {
    basePrice: product ? (product.basePrice / 100).toFixed(2) : "",
    saleEnabled: product?.saleEnabled ?? false,
    salePrice: product?.salePrice ? (product.salePrice / 100).toFixed(2) : "",
    saleStartsAt: toProductDateTimeInputValue(product?.saleStartsAt),
    saleEndsAt: toProductDateTimeInputValue(product?.saleEndsAt),
    isDigital: product?.isDigital ?? false,
    trackStock: product?.trackStock ?? false,
    stock: String(product?.stock ?? 0),
    productionMinDays: String(product?.productionMinDays ?? 1),
    productionMaxDays: String(product?.productionMaxDays ?? 3),
    preorderEnabled: product?.preorderEnabled ?? false,
    preorderShipDate: toProductDateTimeInputValue(product?.preorderShipDate),
  };
}

export function useProductCommerce(product?: ProductFormProduct) {
  const [state, setState] = useState<ProductCommerceState>(() =>
    getInitialState(product),
  );

  function update<K extends keyof ProductCommerceState>(
    field: K,
    value: ProductCommerceState[K],
  ) {
    setState((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setState(getInitialState());
  }

  return { state, update, reset };
}

export type ProductCommerceController = ReturnType<typeof useProductCommerce>;
