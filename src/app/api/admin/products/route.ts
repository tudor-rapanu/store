import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productVariants,
  products,
} from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { uploadProductImage } from "@/lib/storage/product-images";

export const runtime = "nodejs";

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
  stock?: number;
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

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid sale date.");
  }

  return parsed;
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

  const categoryIds: string[] = [];

  for (const name of categoryNames) {
    const slug = slugify(name);

    if (!slug) {
      continue;
    }

    const [existingCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (existingCategory) {
      categoryIds.push(existingCategory.id);
      continue;
    }

    const [createdCategory] = await db
      .insert(categories)
      .values({
        slug,
        name: { en: name, ro: name },
      })
      .returning();

    categoryIds.push(createdCategory.id);
  }

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
  const isPrivate = formData.get("isPrivate") === "on";
  const categoryNames = parseCategoryNames(getString(formData, "categories"));
  const images = formData
    .getAll("images")
    .filter((image): image is File => image instanceof File && image.size > 0);
  const variantsInput = getString(formData, "variants");

  if (!titleEn || !titleRo || !slug || !priceInput) {
    return errorResponse("All product fields are required.");
  }

  if (images.length === 0) {
    return errorResponse("At least one valid product image is required.");
  }

  const price = Number.parseFloat(priceInput);

  if (!Number.isFinite(price) || price <= 0) {
    return errorResponse("Enter a valid product price.");
  }

  let variants: VariantInput[];

  try {
    variants = parseVariants(variantsInput);
    validateVariantSales(variants);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid variants JSON.",
    );
  }

  const basePrice = Math.round(price * 100);
  let salePrice: number | null = null;
  let saleStartsAt: Date | null = null;
  let saleEndsAt: Date | null = null;

  try {
    salePrice = parseOptionalPriceBani(salePriceInput);
    saleStartsAt = parseOptionalDate(saleStartsAtInput);
    saleEndsAt = parseOptionalDate(saleEndsAtInput);
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
    imageUrl,
    isSimple: variants.length === 0,
    isPrivate,
  }).returning();

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
        stock: variant.stock ?? 0,
      })),
    );
  }

  await syncProductCategories(product.id, categoryNames);

  revalidateCatalogViews({ productSlugs: [product.slug] });

  return NextResponse.json({ ok: true });
}
