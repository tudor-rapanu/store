import { formatRomaniaDateTimeLocal } from "@/lib/dates/romania";

import type {
  AvailableProductCategory,
  ProductDetailRow,
  ProductFormVariant,
  ProductOptionRow,
  ProductVariantRow,
} from "./admin-product-form.types";

export function getAdminProductSaveRequest(productId?: string) {
  return productId
    ? { endpoint: `/api/admin/products/${productId}`, method: "PATCH" as const }
    : { endpoint: "/api/admin/products", method: "POST" as const };
}

export function serializeCategoryValues(categoryValues: string[]) {
  return categoryValues.join(", ");
}

export function getSelectedCategoryLabels(
  categoryValues: string[],
  availableCategories: AvailableProductCategory[],
) {
  return categoryValues.map((categoryValue) => {
    const category = availableCategories.find((item) => item.value === categoryValue);

    return category?.name ?? categoryValue;
  });
}

export function moveListItem<T>(items: T[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

  return next;
}

export function splitOptionValues(values: string) {
  return Array.from(
    new Set(
      values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function slugifyProductIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getVariantSku(productSlug: string, variantName: string, index: number) {
  const cleanProductSlug = slugifyProductIdentifier(productSlug);
  const cleanVariantName = slugifyProductIdentifier(variantName);

  if (!cleanProductSlug || !cleanVariantName) {
    return "";
  }

  return `${cleanProductSlug}-${cleanVariantName}-${index + 1}`;
}

export function toProductDateTimeInputValue(value?: Date | string | null) {
  return formatRomaniaDateTimeLocal(value);
}

export function deriveVariantOptions(
  variants: ProductFormVariant[],
  createId: () => string,
): ProductOptionRow[] {
  const optionMap = new Map<string, Set<string>>();

  variants.forEach((variant) => {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (!optionMap.has(key)) {
        optionMap.set(key, new Set());
      }
      optionMap.get(key)?.add(value);
    });
  });

  return Array.from(optionMap.entries()).map(([name, values]) => ({
    id: createId(),
    name,
    values: Array.from(values).join(", "),
  }));
}

export function getAttributeSignature(
  attributes: Record<string, string>,
  optionNames: string[],
) {
  return optionNames.map((name) => `${name}:${attributes[name] ?? ""}`).join("|");
}

export function getOptionCombinations(options: { name: string; values: string[] }[]) {
  return options.reduce<Record<string, string>[]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => ({
          ...combination,
          [option.name]: value,
        })),
      ),
    [{}],
  );
}

export type VariantMatrixResult =
  | { ok: false; error: string }
  | {
      ok: true;
      totalCombinations: number;
      missingVariants: Array<{
        attributes: Record<string, string>;
        name: string;
      }>;
    };

export function buildVariantMatrix(
  options: ProductOptionRow[],
  existingVariants: Pick<ProductVariantRow, "attributes">[],
): VariantMatrixResult {
  const matrixOptions = options
    .map((option) => ({
      name: option.name.trim(),
      values: splitOptionValues(option.values),
    }))
    .filter((option) => option.name);

  if (matrixOptions.length === 0) {
    return {
      ok: false,
      error: "Add at least one variant type before generating variants.",
    };
  }

  const missingValues = matrixOptions.find((option) => option.values.length === 0);

  if (missingValues) {
    return {
      ok: false,
      error: `Add at least one value for ${missingValues.name}.`,
    };
  }

  const optionNames = matrixOptions.map((option) => option.name);
  const existingSignatures = new Set(
    existingVariants.map((variant) =>
      getAttributeSignature(variant.attributes, optionNames),
    ),
  );
  const combinations = getOptionCombinations(matrixOptions);
  const missingVariants = combinations
    .map((attributes) => ({
      attributes,
      name: optionNames.map((optionName) => attributes[optionName]).join(" / "),
      signature: getAttributeSignature(attributes, optionNames),
    }))
    .filter((combination) => !existingSignatures.has(combination.signature))
    .map(({ attributes, name }) => ({ attributes, name }));

  return {
    ok: true,
    totalCombinations: combinations.length,
    missingVariants,
  };
}

export function serializeVariantRows(
  variantRows: ProductVariantRow[],
  variantsEnabled: boolean,
) {
  if (!variantsEnabled) {
    return "[]";
  }

  return JSON.stringify(
    variantRows.map((variant) => ({
      id: variant.dbId ?? null,
      name: variant.name,
      sku: variant.sku,
      attributes: variant.attributes,
      price: variant.price,
      salePrice: variant.salePrice ?? null,
      saleEnabled: variant.saleEnabled ?? false,
      saleStartsAt: toProductDateTimeInputValue(variant.saleStartsAt),
      saleEndsAt: toProductDateTimeInputValue(variant.saleEndsAt),
      trackStock: variant.trackStock ?? false,
      stock: variant.stock,
    })),
  );
}

export function serializeProductDetailRows(detailRows: ProductDetailRow[]) {
  return JSON.stringify(
    detailRows.map((detail) => ({
      icon: detail.icon,
      label: detail.label,
      value: detail.value,
      enabled: detail.enabled,
    })),
  );
}
