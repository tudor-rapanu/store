"use client";

import { useMemo, useState } from "react";

import { moveListItem } from "./admin-product-form-utils";

export function useProductImages(initialImages: string[]) {
  const [paths, setPaths] = useState(initialImages);
  const payload = useMemo(() => JSON.stringify(paths), [paths]);

  function move(index: number, direction: -1 | 1) {
    setPaths((current) => moveListItem(current, index, direction));
  }

  function remove(path: string) {
    setPaths((current) => current.filter((item) => item !== path));
  }

  function reset() {
    setPaths([]);
  }

  return { paths, payload, move, remove, reset };
}

export type ProductImagesController = ReturnType<typeof useProductImages>;
