import { eq } from "drizzle-orm";

import { findOrCreateCategoryIds } from "@/lib/categories";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
import { db } from "@/lib/db";
import { productCategories } from "@/lib/db/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VariantInput = {
  id?: string | null;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price?: number;
  salePrice?: number | null;
  saleEnabled?: boolean;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  trackStock?: boolean;
  stock?: number;
};

export type ProductDetailBlockInput = {
  icon: string;
  label: {
    en: string;
    ro: string;
  };
  value: {
    en: string;
    ro: string;
  };
  enabled: boolean;
};

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseOptionalPriceBani(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid sale price.");
  }

  return Math.round(parsed * 100);
}

export function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = parseRomaniaDateTimeLocal(value);

  if (!parsed) {
    throw new Error("Enter a valid sale date.");
  }

  return parsed;
}

export function parseProductionDays(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseOptionalUuid(value: string) {
  if (!value) {
    return null;
  }

  return UUID_PATTERN.test(value) ? value : null;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getVariantSku(
  variant: VariantInput,
  productSlug: string,
  index: number,
) {
  const explicitSku = variant.sku.trim();

  if (explicitSku) {
    return explicitSku;
  }

  const fallbackLabel =
    variant.name ||
    Object.values(variant.attributes).filter(Boolean).join("-") ||
    `variant-${index + 1}`;
  const baseSku =
    slugify(`${productSlug}-${fallbackLabel}`) || `${productSlug}-variant`;

  return `${baseSku}-${index + 1}`;
}

export function parseVariants(value: string) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Variants must be a JSON array.");
  }

  return parsed.map((variant): VariantInput => {
    if (
      !variant ||
      typeof variant !== "object" ||
      !("name" in variant) ||
      typeof variant.name !== "string" ||
      !("attributes" in variant) ||
      !variant.attributes ||
      typeof variant.attributes !== "object" ||
      Array.isArray(variant.attributes)
    ) {
      throw new Error("Each variant needs a name and attributes object.");
    }

    return {
      id: "id" in variant && typeof variant.id === "string" ? variant.id : null,
      name: variant.name.trim(),
      sku:
        "sku" in variant && typeof variant.sku === "string"
          ? variant.sku.trim()
          : "",
      attributes: variant.attributes as Record<string, string>,
      price:
        "price" in variant && typeof variant.price === "number"
          ? variant.price
          : 0,
      salePrice:
        "salePrice" in variant && typeof variant.salePrice === "number"
          ? variant.salePrice
          : null,
      saleEnabled:
        "saleEnabled" in variant && typeof variant.saleEnabled === "boolean"
          ? variant.saleEnabled
          : false,
      saleStartsAt:
        "saleStartsAt" in variant && typeof variant.saleStartsAt === "string"
          ? parseOptionalDate(variant.saleStartsAt)
          : null,
      saleEndsAt:
        "saleEndsAt" in variant && typeof variant.saleEndsAt === "string"
          ? parseOptionalDate(variant.saleEndsAt)
          : null,
      trackStock:
        "trackStock" in variant && typeof variant.trackStock === "boolean"
          ? variant.trackStock
          : false,
      stock:
        "stock" in variant && typeof variant.stock === "number"
          ? variant.stock
          : 0,
    };
  });
}

export function parseCategoryNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseProductDetailBlocks(value: string) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Product details must be a JSON array.");
  }

  return parsed
    .map((detail): ProductDetailBlockInput | null => {
      if (!detail || typeof detail !== "object") {
        return null;
      }

      const icon =
        "icon" in detail && typeof detail.icon === "string"
          ? detail.icon.trim()
          : "info";
      const label =
        "label" in detail &&
        detail.label &&
        typeof detail.label === "object" &&
        !Array.isArray(detail.label)
          ? (detail.label as Record<string, unknown>)
          : {};
      const detailValue =
        "value" in detail &&
        detail.value &&
        typeof detail.value === "object" &&
        !Array.isArray(detail.value)
          ? (detail.value as Record<string, unknown>)
          : {};
      const labelEn = typeof label.en === "string" ? label.en.trim() : "";
      const labelRo = typeof label.ro === "string" ? label.ro.trim() : "";
      const valueEn = typeof detailValue.en === "string" ? detailValue.en.trim() : "";
      const valueRo = typeof detailValue.ro === "string" ? detailValue.ro.trim() : "";

      if ((!labelEn && !labelRo) || (!valueEn && !valueRo)) {
        return null;
      }

      return {
        icon: icon || "info",
        label: {
          en: labelEn || labelRo,
          ro: labelRo || labelEn,
        },
        value: {
          en: valueEn || valueRo,
          ro: valueRo || valueEn,
        },
        enabled:
          "enabled" in detail && typeof detail.enabled === "boolean"
            ? detail.enabled
            : true,
      };
    })
    .filter((detail): detail is ProductDetailBlockInput => Boolean(detail));
}

export function validateVariantSales(variants: VariantInput[]) {
  for (const variant of variants) {
    if (variant.saleEnabled && (!variant.salePrice || variant.salePrice <= 0)) {
      throw new Error(
        `Enter a sale price for ${variant.name || "each enabled variant sale"}.`,
      );
    }

    if (
      variant.saleStartsAt &&
      variant.saleEndsAt &&
      variant.saleStartsAt >= variant.saleEndsAt
    ) {
      throw new Error("Variant sale end date must be after the start date.");
    }
  }
}

export async function syncProductCategories(
  productId: string,
  categoryNames: string[],
  options: { replace?: boolean } = {},
) {
  if (options.replace) {
    await db.delete(productCategories).where(eq(productCategories.productId, productId));
  }

  if (categoryNames.length === 0) {
    return;
  }

  const categoryIds = await findOrCreateCategoryIds(categoryNames);

  if (categoryIds.length > 0) {
    await db.insert(productCategories).values(
      categoryIds.map((categoryId) => ({
        productId,
        categoryId,
      })),
    );
  }
}
