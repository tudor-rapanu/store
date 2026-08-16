"use client";

import { useMemo, useState } from "react";

import type {
  ProductFormVariant,
  ProductOptionRow,
  ProductVariantRow,
} from "./admin-product-form.types";
import {
  buildVariantMatrix,
  deriveVariantOptions,
  getVariantSku,
  serializeVariantRows,
  slugifyProductIdentifier,
  splitOptionValues,
} from "./admin-product-form-utils";

type UseProductVariantsOptions = {
  initialVariants: ProductFormVariant[];
  productSlug: string;
  existingProductBasePrice?: number;
  matrixDefaultPrice: number;
  createId: () => string;
};

export type VariantMatrixFeedback = {
  kind: "error" | "success";
  message: string;
};

export function useProductVariants({
  initialVariants,
  productSlug,
  existingProductBasePrice,
  matrixDefaultPrice,
  createId,
}: UseProductVariantsOptions) {
  const [enabled, setEnabled] = useState(initialVariants.length > 0);
  const [options, setOptions] = useState<ProductOptionRow[]>(() =>
    deriveVariantOptions(initialVariants, createId),
  );
  const [rows, setRows] = useState<ProductVariantRow[]>(() =>
    initialVariants.map((variant) => ({
      ...variant,
      id: createId(),
      skuWasEdited: false,
    })),
  );
  const payload = useMemo(() => serializeVariantRows(rows, enabled), [enabled, rows]);

  function addOption() {
    setOptions((current) => [...current, { id: createId(), name: "", values: "" }]);
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id));
  }

  function updateOption(id: string, field: "name" | "values", value: string) {
    setOptions((current) =>
      current.map((option) =>
        option.id === id ? { ...option, [field]: value } : option,
      ),
    );
  }

  function updateVariant(
    id: string,
    field: "name" | "sku" | "price" | "stock",
    value: string,
  ) {
    setRows((current) =>
      current.map((variant, index) => {
        if (variant.id !== id) {
          return variant;
        }

        if (field === "sku") {
          return {
            ...variant,
            sku: slugifyProductIdentifier(value),
            skuWasEdited: true,
          };
        }

        if (field === "name") {
          return {
            ...variant,
            name: value,
            sku: variant.skuWasEdited
              ? variant.sku
              : getVariantSku(productSlug, value, index),
          };
        }

        return {
          ...variant,
          [field]: Number(value),
        };
      }),
    );
  }

  function updateVariantFields(id: string, fields: Partial<ProductVariantRow>) {
    setRows((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, ...fields } : variant,
      ),
    );
  }

  function updateVariantAttribute(id: string, key: string, value: string) {
    setRows((current) =>
      current.map((variant) =>
        variant.id === id
          ? {
              ...variant,
              attributes: { ...variant.attributes, [key]: value },
            }
          : variant,
      ),
    );
  }

  function addVariant() {
    const attributes = Object.fromEntries(
      options
        .filter((option) => option.name.trim())
        .map((option) => [
          option.name.trim(),
          splitOptionValues(option.values)[0] ?? "",
        ]),
    );

    setRows((current) => [
      ...current,
      {
        id: createId(),
        name: "",
        sku: getVariantSku(productSlug, "", current.length),
        skuWasEdited: false,
        attributes,
        price: existingProductBasePrice ?? 0,
        salePrice: null,
        saleEnabled: false,
        saleStartsAt: "",
        saleEndsAt: "",
        trackStock: false,
        stock: 0,
      },
    ]);
  }

  function removeVariant(id: string) {
    setRows((current) => current.filter((variant) => variant.id !== id));
  }

  function generateMatrix(): VariantMatrixFeedback {
    const result = buildVariantMatrix(options, rows);

    if (!result.ok) {
      return { kind: "error", message: result.error };
    }

    if (result.missingVariants.length === 0) {
      return {
        kind: "success",
        message: "All generated variants are already added.",
      };
    }

    setRows((current) => [
      ...current,
      ...result.missingVariants.map(({ attributes, name }, index) => {
        const nextIndex = current.length + index;

        return {
          id: createId(),
          name,
          sku: getVariantSku(productSlug, name, nextIndex),
          skuWasEdited: false,
          attributes,
          price: matrixDefaultPrice,
          salePrice: null,
          saleEnabled: false,
          saleStartsAt: "",
          saleEndsAt: "",
          trackStock: false,
          stock: 0,
        };
      }),
    ]);

    return {
      kind: "success",
      message: `Added ${result.missingVariants.length} missing variants. ${result.totalCombinations - result.missingVariants.length} already existed.`,
    };
  }

  function syncGeneratedSkus(nextProductSlug: string) {
    setRows((current) =>
      current.map((variant, index) =>
        variant.skuWasEdited
          ? variant
          : {
              ...variant,
              sku: getVariantSku(nextProductSlug, variant.name, index),
            },
      ),
    );
  }

  function reset() {
    setEnabled(false);
    setOptions([]);
    setRows([]);
  }

  return {
    enabled,
    setEnabled,
    options,
    rows,
    payload,
    addOption,
    removeOption,
    updateOption,
    addVariant,
    removeVariant,
    updateVariant,
    updateVariantFields,
    updateVariantAttribute,
    generateMatrix,
    syncGeneratedSkus,
    reset,
  };
}

export type ProductVariantsController = ReturnType<typeof useProductVariants>;
