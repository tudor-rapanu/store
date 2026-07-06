import { and, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productVariants,
  products,
} from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import { getProductImagePaths } from "@/lib/product-images";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
import {
  deleteProductImages,
  uploadProductImage,
} from "@/lib/storage/product-images";

export const runtime = "nodejs";

type VariantInput = {
  id?: string | null;
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

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
      id: "id" in variant && typeof variant.id === "string" ? variant.id : null,
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
      throw new Error("Variant sale end date must be after the start date.");
    }
  }
}

function parseExistingImages(value: string) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((path): path is string => typeof path === "string");
}

async function syncProductCategories(productId: string, categoryNames: string[]) {
  await db
    .delete(productCategories)
    .where(eq(productCategories.productId, productId));

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

async function getImagesSafeToDelete(imagePaths: string[], productId: string) {
  if (imagePaths.length === 0) {
    return [];
  }

  const otherProducts = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(ne(products.id, productId));
  const imagePathsUsedElsewhere = new Set(
    otherProducts.flatMap((product) => getProductImagePaths(product.imageUrl)),
  );

  return imagePaths.filter((imagePath) => !imagePathsUsedElsewhere.has(imagePath));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update products.", 403);
  }

  const { id } = await params;
  try {
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
    const publishAtInput = getString(formData, "publishAt");
    const isPrivate = formData.get("isPrivate") === "on";
    const categoryNames = parseCategoryNames(getString(formData, "categories"));
    const existingImages = parseExistingImages(getString(formData, "existingImages"));
    const images = formData
      .getAll("images")
      .filter((image): image is File => image instanceof File && image.size > 0);
    const variantsInput = getString(formData, "variants");

    if (!titleEn || !titleRo || !slug || !priceInput) {
      return errorResponse("All product fields are required.");
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

    const shouldWaitForPublishRevalidation =
      publishAt && publishAt > new Date();

    const [existingProduct] = await db
      .select({ imageUrl: products.imageUrl, slug: products.slug })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    let orderedImages = existingImages;

    if (images.length > 0) {
      const uploadedImages = await Promise.all(
        images.map((image) => uploadProductImage(image, slug)),
      );
      orderedImages = [...existingImages, ...uploadedImages];
    }

    const imageUrl =
      orderedImages.length === 0
        ? null
        : orderedImages.length === 1
          ? orderedImages[0]
          : JSON.stringify(orderedImages);

    const [updatedProduct] = await db
      .update(products)
      .set({
        slug,
        title: { en: titleEn, ro: titleRo },
        description:
          descriptionEn || descriptionRo
            ? { en: descriptionEn, ro: descriptionRo || descriptionEn }
            : null,
        basePrice: Math.round(price * 100),
        salePrice: saleEnabled ? salePrice : null,
        saleEnabled,
        saleStartsAt: saleEnabled ? saleStartsAt : null,
        saleEndsAt: saleEnabled ? saleEndsAt : null,
        productionMinDays,
        productionMaxDays,
        preorderEnabled,
        preorderShipDate: preorderEnabled ? preorderShipDate : null,
        publishAt,
        publishRevalidatedAt: shouldWaitForPublishRevalidation
          ? null
          : new Date(),
        isSimple: variants.length === 0,
        isPrivate,
        updatedAt: new Date(),
        imageUrl,
      })
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      return errorResponse("Product was not found.", 404);
    }

    const previousImages = getProductImagePaths(existingProduct?.imageUrl);
    const removedImages = previousImages.filter(
      (imagePath) => !orderedImages.includes(imagePath),
    );
    const imagesSafeToDelete = await getImagesSafeToDelete(removedImages, id);

    if (imagesSafeToDelete.length > 0) {
      await deleteProductImages(imagesSafeToDelete);
    }

    const existingVariants = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    const existingVariantIds = new Set(existingVariants.map((variant) => variant.id));
    const submittedExistingVariantIds = new Set(
      variants
        .map((variant) => variant.id)
        .filter((variantId): variantId is string =>
          Boolean(variantId && existingVariantIds.has(variantId)),
        ),
    );
    const removedVariantIds = existingVariants
      .map((variant) => variant.id)
      .filter((variantId) => !submittedExistingVariantIds.has(variantId));

    if (removedVariantIds.length > 0) {
      try {
        await db
          .delete(productVariants)
          .where(
            and(
              eq(productVariants.productId, id),
              inArray(productVariants.id, removedVariantIds),
            ),
          );
      } catch {
        return errorResponse(
          "One or more removed variants are linked to order history. Keep them on the product instead of deleting them.",
          409,
        );
      }
    }

    for (const [index, variant] of variants.entries()) {
      const variantValues = {
        name: variant.name,
        sku: getVariantSku(variant, slug, index),
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
        updatedAt: new Date(),
      };

      if (variant.id && existingVariantIds.has(variant.id)) {
        await db
          .update(productVariants)
          .set(variantValues)
          .where(
            and(
              eq(productVariants.id, variant.id),
              eq(productVariants.productId, id),
            ),
          );
      } else {
        await db.insert(productVariants).values({
          productId: id,
          ...variantValues,
        });
      }
    }

    await syncProductCategories(id, categoryNames);

    revalidateCatalogViews({
      productSlugs: [existingProduct?.slug, updatedProduct.slug],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Product update failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Product could not be updated.",
      500,
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to delete products.", 403);
  }

  const { id } = await params;
  const [product] = await db
    .select({ imageUrl: products.imageUrl, slug: products.slug })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    return errorResponse("Product was not found.", 404);
  }

  const imagesSafeToDelete = await getImagesSafeToDelete(
    getProductImagePaths(product.imageUrl),
    id,
  );

  try {
    const [deletedProduct] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!deletedProduct) {
      return errorResponse("Product was not found.", 404);
    }
  } catch {
    return errorResponse(
      "This product could not be deleted. It may already be linked to order history; mark it private instead.",
      409,
    );
  }

  if (imagesSafeToDelete.length > 0) {
    await deleteProductImages(imagesSafeToDelete);
  }

  revalidateCatalogViews({ productSlugs: [product.slug] });

  return NextResponse.json({ ok: true });
}
