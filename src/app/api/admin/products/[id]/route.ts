import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  digitalProductFiles,
  productDetailBlocks,
  productVariants,
  products,
} from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import {
  getString,
  getVariantSku,
  parseCategoryNames,
  parseOptionalDate,
  parseOptionalPriceBani,
  parseOptionalUuid,
  parseProductDetailBlocks,
  parseProductionDays,
  parseVariants,
  slugify,
  syncProductCategories,
  validateVariantSales,
  type ProductDetailBlockInput,
  type VariantInput,
} from "@/lib/admin/product-form";
import { getProductImagePaths } from "@/lib/product-images";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
import { uploadDigitalProductFile } from "@/lib/storage/digital-products";
import { deleteProductImages, uploadProductImage } from "@/lib/storage/product-images";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
    const isDigital = formData.get("isDigital") === "on";
    const sizeGuideId = parseOptionalUuid(getString(formData, "sizeGuideId"));
    const trackStock = formData.get("trackStock") === "on";
    const stockInput = getString(formData, "stock");
    const publishAtInput = getString(formData, "publishAt");
    const isPrivate = formData.get("isPrivate") === "on";
    const categoryNames = parseCategoryNames(getString(formData, "categories"));
    const existingImages = parseExistingImages(getString(formData, "existingImages"));
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
      publishAt = publishAtInput ? parseRomaniaDateTimeLocal(publishAtInput) : null;
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
      return errorResponse(
        "Maximum business days must be greater than or equal to minimum business days.",
      );
    }

    if (preorderEnabled && !preorderShipDate) {
      return errorResponse(
        "Choose a preorder shipping start date or disable preorder.",
      );
    }

    if (publishAtInput && !publishAt) {
      return errorResponse("Enter a valid publish date.");
    }

    if (isDigital && digitalFiles.length === 0) {
      const [existingDigitalFile] = await db
        .select({ id: digitalProductFiles.id })
        .from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, id))
        .limit(1);

      if (!existingDigitalFile) {
        return errorResponse("Add at least one protected file for digital products.");
      }
    }

    const shouldWaitForPublishRevalidation = publishAt && publishAt > new Date();

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
        publishRevalidatedAt: shouldWaitForPublishRevalidation ? null : new Date(),
        isDigital,
        sizeGuideId,
        trackStock: variants.length === 0 ? trackStock : false,
        stock: variants.length === 0 && trackStock ? stock : 0,
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

    if (isDigital && digitalFiles.length > 0) {
      const uploadedFiles = await Promise.all(
        digitalFiles.map((file) => uploadDigitalProductFile(file, id)),
      );

      await db.insert(digitalProductFiles).values(
        uploadedFiles.map((file) => ({
          productId: id,
          fileName: file.fileName,
          storageKey: file.storageKey,
          contentType: file.contentType,
          fileSize: file.fileSize,
        })),
      );
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
        trackStock: variant.trackStock ?? false,
        stock: variant.trackStock ? Math.max(Math.floor(variant.stock ?? 0), 0) : 0,
        updatedAt: new Date(),
      };

      if (variant.id && existingVariantIds.has(variant.id)) {
        await db
          .update(productVariants)
          .set(variantValues)
          .where(
            and(eq(productVariants.id, variant.id), eq(productVariants.productId, id)),
          );
      } else {
        await db.insert(productVariants).values({
          productId: id,
          ...variantValues,
        });
      }
    }

    await db.delete(productDetailBlocks).where(eq(productDetailBlocks.productId, id));

    if (detailBlocks.length > 0) {
      await db.insert(productDetailBlocks).values(
        detailBlocks.map((detail, index) => ({
          productId: id,
          icon: detail.icon,
          label: detail.label,
          value: detail.value,
          sortOrder: index,
          enabled: detail.enabled,
        })),
      );
    }

    await syncProductCategories(id, categoryNames, { replace: true });

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
  revalidatePath("/en/admin/products");
  revalidatePath("/ro/admin/products");

  return NextResponse.json({ ok: true });
}
