import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  digitalProductFiles,
  productCategories,
  productDetailBlocks,
  productVariants,
  products,
} from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import { findOrCreateCategoryIds } from "@/lib/categories";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
import { uploadDigitalProductFile } from "@/lib/storage/digital-products";
import { uploadProductImage } from "@/lib/storage/product-images";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type VariantInput = {
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

type ProductDetailBlockInput = {
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

function parseOptionalPriceBani(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid sale price.");
  }

  return Math.round(parsed * 100);
}

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = parseRomaniaDateTimeLocal(value);

  if (!parsed) {
    throw new Error("Enter a valid sale date.");
  }

  return parsed;
}

function parseProductionDays(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalUuid(value: string) {
  if (!value) {
    return null;
  }

  return UUID_PATTERN.test(value) ? value : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getVariantSku(variant: VariantInput, productSlug: string, index: number) {
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

function parseVariants(value: string) {
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
      name: variant.name.trim(),
      sku: "sku" in variant && typeof variant.sku === "string" ? variant.sku.trim() : "",
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

function parseCategoryNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseProductDetailBlocks(value: string) {
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
      const labelEn =
        typeof label.en === "string" ? label.en.trim() : "";
      const labelRo =
        typeof label.ro === "string" ? label.ro.trim() : "";
      const valueEn =
        typeof detailValue.en === "string" ? detailValue.en.trim() : "";
      const valueRo =
        typeof detailValue.ro === "string" ? detailValue.ro.trim() : "";

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

function validateVariantSales(variants: VariantInput[]) {
  for (const variant of variants) {
    if (variant.saleEnabled && (!variant.salePrice || variant.salePrice <= 0)) {
      throw new Error(`Enter a sale price for ${variant.name || "each enabled variant sale"}.`);
    }

    if (
      variant.saleStartsAt &&
      variant.saleEndsAt &&
      variant.saleStartsAt >= variant.saleEndsAt
    ) {
      throw new Error(`Variant sale end date must be after the start date.`);
    }
  }
}

async function syncProductCategories(productId: string, categoryNames: string[]) {
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

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to create products.", 403);
  }

  const formData = await request.formData();
  const titleEn = getString(formData, "titleEn");
  const titleRo = getString(formData, "titleRo");
  const descriptionEn = getString(formData, "descriptionEn");
  const descriptionRo = getString(formData, "descriptionRo");
  const slug = slugify(getString(formData, "slug"));
  const priceInput = getString(formData, "price");
  const saleEnabled = formData.get("saleEnabled") === "on";
  const salePriceInput = getString(formData, "salePrice");
  const saleStartsAtInput = getString(formData, "saleStartsAt");
  const saleEndsAtInput = getString(formData, "saleEndsAt");
  const productionMinDays = parseProductionDays(
    getString(formData, "productionMinDays"),
    1,
  );
  const productionMaxDays = parseProductionDays(
    getString(formData, "productionMaxDays"),
    3,
  );
  const preorderEnabled = formData.get("preorderEnabled") === "on";
  const preorderShipDateInput = getString(formData, "preorderShipDate");
  const isDigital = formData.get("isDigital") === "on";
  const sizeGuideId = parseOptionalUuid(getString(formData, "sizeGuideId"));
  const trackStock = formData.get("trackStock") === "on";
  const stockInput = getString(formData, "stock");
  const publishAtInput = getString(formData, "publishAt");
  const isPrivate = formData.get("isPrivate") === "on";
  const categoryNames = parseCategoryNames(getString(formData, "categories"));
  const images = formData
    .getAll("images")
    .filter((image): image is File => image instanceof File && image.size > 0);
  const digitalFiles = formData
    .getAll("digitalFiles")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const variantsInput = getString(formData, "variants");
  const detailsInput = getString(formData, "productDetails");

  if (!titleEn || !titleRo || !slug || !priceInput) {
    return errorResponse("All product fields are required.");
  }

  if (images.length === 0) {
    return errorResponse("At least one valid product image is required.");
  }

  if (isDigital && digitalFiles.length === 0) {
    return errorResponse("Add at least one protected file for digital products.");
  }

  const price = Number.parseFloat(priceInput);

  if (!Number.isFinite(price) || price <= 0) {
    return errorResponse("Enter a valid product price.");
  }
  const stock = Math.max(Number.parseInt(stockInput || "0", 10), 0);

  if (trackStock && !Number.isInteger(stock)) {
    return errorResponse("Enter a valid product stock.");
  }

  let variants: VariantInput[];
  let detailBlocks: ProductDetailBlockInput[];

  try {
    variants = parseVariants(variantsInput);
    validateVariantSales(variants);
    detailBlocks = parseProductDetailBlocks(detailsInput);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid product form data.",
    );
  }

  const basePrice = Math.round(price * 100);
  let salePrice: number | null = null;
  let saleStartsAt: Date | null = null;
  let saleEndsAt: Date | null = null;
  let preorderShipDate: Date | null = null;
  let publishAt: Date | null = null;

  try {
    salePrice = parseOptionalPriceBani(salePriceInput);
    saleStartsAt = parseOptionalDate(saleStartsAtInput);
    saleEndsAt = parseOptionalDate(saleEndsAtInput);
    preorderShipDate = parseOptionalDate(preorderShipDateInput);
    publishAt = publishAtInput
      ? parseRomaniaDateTimeLocal(publishAtInput)
      : null;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid sale settings.",
    );
  }

  if (saleEnabled && !salePrice) {
    return errorResponse("Enter a sale price or disable the sale.");
  }

  if (saleStartsAt && saleEndsAt && saleStartsAt >= saleEndsAt) {
    return errorResponse("Sale end date must be after the start date.");
  }

  if (productionMinDays > productionMaxDays) {
    return errorResponse("Maximum business days must be greater than or equal to minimum business days.");
  }

  if (preorderEnabled && !preorderShipDate) {
    return errorResponse("Choose a preorder shipping start date or disable preorder.");
  }

  if (publishAtInput && !publishAt) {
    return errorResponse("Enter a valid publish date.");
  }

  const shouldWaitForPublishRevalidation = publishAt && publishAt > new Date();

  const uploadedImages = await Promise.all(
    images.map((image) => uploadProductImage(image, slug)),
  );
  const imageUrl =
    uploadedImages.length === 1 ? uploadedImages[0] : JSON.stringify(uploadedImages);

  const [product] = await db.insert(products).values({
    slug,
    title: { en: titleEn, ro: titleRo },
    description:
      descriptionEn || descriptionRo
        ? { en: descriptionEn, ro: descriptionRo || descriptionEn }
        : null,
    basePrice,
    salePrice: saleEnabled ? salePrice : null,
    saleEnabled,
    saleStartsAt: saleEnabled ? saleStartsAt : null,
    saleEndsAt: saleEnabled ? saleEndsAt : null,
    productionMinDays,
    productionMaxDays,
    preorderEnabled,
    preorderShipDate: preorderEnabled ? preorderShipDate : null,
    publishAt,
    publishRevalidatedAt: shouldWaitForPublishRevalidation ? null : new Date(),
    imageUrl,
    isDigital,
    sizeGuideId,
    trackStock: variants.length === 0 ? trackStock : false,
    stock: variants.length === 0 && trackStock ? stock : 0,
    isSimple: variants.length === 0,
    isPrivate,
  }).returning();

  if (isDigital && digitalFiles.length > 0) {
    const uploadedFiles = await Promise.all(
      digitalFiles.map((file) => uploadDigitalProductFile(file, product.id)),
    );

    await db.insert(digitalProductFiles).values(
      uploadedFiles.map((file) => ({
        productId: product.id,
        fileName: file.fileName,
        storageKey: file.storageKey,
        contentType: file.contentType,
        fileSize: file.fileSize,
      })),
    );
  }

  if (variants.length > 0) {
    await db.insert(productVariants).values(
      variants.map((variant) => ({
        productId: product.id,
        name: variant.name,
        sku: getVariantSku(variant, slug, variants.indexOf(variant)),
        attributes: variant.attributes,
        price: Math.round((variant.price ?? 0) * 100),
        salePrice:
          variant.saleEnabled && variant.salePrice
            ? Math.round(variant.salePrice * 100)
            : null,
        saleEnabled: variant.saleEnabled ?? false,
        saleStartsAt: variant.saleEnabled ? variant.saleStartsAt : null,
        saleEndsAt: variant.saleEnabled ? variant.saleEndsAt : null,
        priceAdjustment: 0,
        trackStock: variant.trackStock ?? false,
        stock: variant.trackStock ? Math.max(Math.floor(variant.stock ?? 0), 0) : 0,
      })),
    );
  }

  if (detailBlocks.length > 0) {
    await db.insert(productDetailBlocks).values(
      detailBlocks.map((detail, index) => ({
        productId: product.id,
        icon: detail.icon,
        label: detail.label,
        value: detail.value,
        sortOrder: index,
        enabled: detail.enabled,
      })),
    );
  }

  await syncProductCategories(product.id, categoryNames);

  revalidateCatalogViews({ productSlugs: [product.slug] });

  return NextResponse.json({ ok: true });
}
