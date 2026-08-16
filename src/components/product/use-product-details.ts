"use client";

import { useMemo, useState } from "react";

import type { ProductDetailBlock, ProductDetailRow } from "./admin-product-form.types";
import { moveListItem, serializeProductDetailRows } from "./admin-product-form-utils";

type UseProductDetailsOptions = {
  initialDetails: ProductDetailBlock[];
  createId: () => string;
};

export function useProductDetails({
  initialDetails,
  createId,
}: UseProductDetailsOptions) {
  const [rows, setRows] = useState<ProductDetailRow[]>(() =>
    initialDetails.map((detail) => ({
      ...detail,
      rowId: createId(),
    })),
  );
  const payload = useMemo(() => serializeProductDetailRows(rows), [rows]);

  function add() {
    setRows((current) => [
      ...current,
      {
        rowId: createId(),
        icon: "shirt",
        label: { en: "", ro: "" },
        value: { en: "", ro: "" },
        enabled: true,
      },
    ]);
  }

  function remove(rowId: string) {
    setRows((current) => current.filter((detail) => detail.rowId !== rowId));
  }

  function move(index: number, direction: -1 | 1) {
    setRows((current) => moveListItem(current, index, direction));
  }

  function update(rowId: string, field: "icon" | "enabled", value: string | boolean) {
    setRows((current) =>
      current.map((detail) =>
        detail.rowId === rowId ? { ...detail, [field]: value } : detail,
      ),
    );
  }

  function updateTranslation(
    rowId: string,
    field: "label" | "value",
    language: "en" | "ro",
    value: string,
  ) {
    setRows((current) =>
      current.map((detail) =>
        detail.rowId === rowId
          ? {
              ...detail,
              [field]: {
                ...detail[field],
                [language]: value,
              },
            }
          : detail,
      ),
    );
  }

  function reset() {
    setRows([]);
  }

  return {
    rows,
    payload,
    add,
    remove,
    move,
    update,
    updateTranslation,
    reset,
  };
}

export type ProductDetailsController = ReturnType<typeof useProductDetails>;
