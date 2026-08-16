"use client";

import { useMemo, useState } from "react";

import type { AvailableProductCategory } from "./admin-product-form.types";
import {
  getSelectedCategoryLabels,
  serializeCategoryValues,
} from "./admin-product-form-utils";

export function useProductCategories(
  initialCategories: string[],
  availableCategories: AvailableProductCategory[],
) {
  const [selected, setSelected] = useState(initialCategories);
  const payload = serializeCategoryValues(selected);
  const labels = useMemo(
    () => getSelectedCategoryLabels(selected, availableCategories),
    [availableCategories, selected],
  );

  function toggle(categoryValue: string) {
    setSelected((current) =>
      current.includes(categoryValue)
        ? current.filter((value) => value !== categoryValue)
        : [...current, categoryValue],
    );
  }

  function reset() {
    setSelected([]);
  }

  return { selected, labels, payload, toggle, reset };
}

export type ProductCategoriesController = ReturnType<typeof useProductCategories>;
