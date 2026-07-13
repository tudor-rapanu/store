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
  getUploadedFiles,
  getVariantSku,
  parseProductFormData,
  syncProductCategories,
  type ParsedProductForm,
  type ProductDetailBlockInput,
  type VariantInput,
} from "@/lib/admin/product-form";
import { getProductImagePaths } from "@/lib/product-images";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { uploadDigitalProductFile } from "@/lib/storage/digital-products";
import { deleteProductImages, uploadProductImage } from "@/lib/storage/product-images";

export const runtime = "nodejs";

class VariantRemovalError extends Error {}

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

function serializeProductImages(imagePaths: string[]) {
  if (imagePaths.length === 0) {
    return null;
  }

  return imagePaths.length === 1 ? imagePaths[0] : JSON.stringify(imagePaths);
}

async function validateDigitalProductFiles(productId: string, digitalFiles: File[]) {
  if (digitalFiles.length > 0) {
    return;
  }

  const [existingDigitalFile] = await db
    .select({ id: digitalProductFiles.id })
    .from(digitalProductFiles)
    .where(eq(digitalProductFiles.productId, productId))
    .limit(1);

  if (!existingDigitalFile) {
    throw new Error("Add at least one protected file for digital products.");
  }
}

async function appendProductImages({
  existingImages,
  images,
  slug,
}: {
  existingImages: string[];
  images: File[];
  slug: string;
}) {
  if (images.length === 0) {
    return existingImages;
  }

  const uploadedImages = await Promise.all(
    images.map((image) => uploadProductImage(image, slug)),
  );

  return [...existingImages, ...uploadedImages];
}

async function insertDigitalFiles(productId: string, digitalFiles: File[]) {
  if (digitalFiles.length === 0) {
    return;
  }

  const uploadedFiles = await Promise.all(
    digitalFiles.map((file) => uploadDigitalProductFile(file, productId)),
  );

  await db.insert(digitalProductFiles).values(
    uploadedFiles.map((file) => ({
      productId,
      fileName: file.fileName,
      storageKey: file.storageKey,
      contentType: file.contentType,
      fileSize: file.fileSize,
    })),
  );
}

function getVariantValues(variant: VariantInput, slug: string, index: number) {
  return {
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
}

async function deleteRemovedVariants(
  productId: string,
  existingVariantIds: Set<string>,
  variants: VariantInput[],
) {
  const submittedVariantIds = new Set(
    variants
      .map((variant) => variant.id)
      .filter((variantId): variantId is string =>
        Boolean(variantId && existingVariantIds.has(variantId)),
      ),
  );
  const removedVariantIds = [...existingVariantIds].filter(
    (variantId) => !submittedVariantIds.has(variantId),
  );

  if (removedVariantIds.length === 0) {
    return;
  }

  try {
    await db
      .delete(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          inArray(productVariants.id, removedVariantIds),
        ),
      );
  } catch {
    throw new VariantRemovalError(
      "One or more removed variants are linked to order history. Keep them on the product instead of deleting them.",
    );
  }
}

async function syncProductVariants(
  productId: string,
  slug: string,
  variants: VariantInput[],
) {
  const existingVariants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const existingVariantIds = new Set(existingVariants.map((variant) => variant.id));

  await deleteRemovedVariants(productId, existingVariantIds, variants);

  for (const [index, variant] of variants.entries()) {
    const variantValues = getVariantValues(variant, slug, index);

    if (variant.id && existingVariantIds.has(variant.id)) {
      await db
        .update(productVariants)
        .set(variantValues)
        .where(
          and(eq(productVariants.id, variant.id), eq(productVariants.productId, productId)),
        );
    } else {
      await db.insert(productVariants).values({
        productId,
        ...variantValues,
      });
    }
  }
}

async function syncProductDetailBlocks(
  productId: string,
  detailBlocks: ProductDetailBlockInput[],
) {
  await db.delete(productDetailBlocks).where(eq(productDetailBlocks.productId, productId));

  if (detailBlocks.length === 0) {
    return;
  }

  await db.insert(productDetailBlocks).values(
    detailBlocks.map((detail, index) => ({
      productId,
      icon: detail.icon,
      label: detail.label,
      value: detail.value,
      sortOrder: index,
      enabled: detail.enabled,
    })),
  );
}

function getProductUpdateValues(productForm: ParsedProductForm, imageUrl: string | null) {
  return {
    slug: productForm.slug,
    title: { en: productForm.titleEn, ro: productForm.titleRo },
    description:
      productForm.descriptionEn || productForm.descriptionRo
        ? {
            en: productForm.descriptionEn,
            ro: productForm.descriptionRo || productForm.descriptionEn,
          }
        : null,
    basePrice: productForm.basePrice,
    salePrice: productForm.saleEnabled ? productForm.salePrice : null,
    saleEnabled: productForm.saleEnabled,
    saleStartsAt: productForm.saleEnabled ? productForm.saleStartsAt : null,
    saleEndsAt: productForm.saleEnabled ? productForm.saleEndsAt : null,
    productionMinDays: productForm.productionMinDays,
    productionMaxDays: productForm.productionMaxDays,
    preorderEnabled: productForm.preorderEnabled,
    preorderShipDate: productForm.preorderEnabled ? productForm.preorderShipDate : null,
    publishAt: productForm.publishAt,
    publishRevalidatedAt: productForm.shouldWaitForPublishRevalidation
      ? null
      : new Date(),
    isDigital: productForm.isDigital,
    sizeGuideId: productForm.sizeGuideId,
    trackStock: productForm.variants.length === 0 ? productForm.trackStock : false,
    stock:
      productForm.variants.length === 0 && productForm.trackStock
        ? productForm.stock
        : 0,
    isSimple: productForm.variants.length === 0,
    isPrivate: productForm.isPrivate,
    updatedAt: new Date(),
    imageUrl,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update products.", 403);
  }

  const { id } = await params;
  const formData = await request.formData();
  const existingImages = parseExistingImages(getString(formData, "existingImages"));
  const images = getUploadedFiles(formData, "images");
  const digitalFiles = getUploadedFiles(formData, "digitalFiles");
  let productForm: ParsedProductForm;

  try {
    productForm = parseProductFormData(formData);

    if (productForm.isDigital) {
      await validateDigitalProductFiles(id, digitalFiles);
    }
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid product form data.",
    );
  }

  try {
    const [existingProduct] = await db
      .select({ imageUrl: products.imageUrl, slug: products.slug })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    const orderedImages = await appendProductImages({
      existingImages,
      images,
      slug: productForm.slug,
    });
    const imageUrl = serializeProductImages(orderedImages);

    const [updatedProduct] = await db
      .update(products)
      .set(getProductUpdateValues(productForm, imageUrl))
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      return errorResponse("Product was not found.", 404);
    }

    await insertDigitalFiles(id, digitalFiles);

    const previousImages = getProductImagePaths(existingProduct?.imageUrl);
    const removedImages = previousImages.filter(
      (imagePath) => !orderedImages.includes(imagePath),
    );
    const imagesSafeToDelete = await getImagesSafeToDelete(removedImages, id);

    if (imagesSafeToDelete.length > 0) {
      await deleteProductImages(imagesSafeToDelete);
    }

    await syncProductVariants(id, productForm.slug, productForm.variants);
    await syncProductDetailBlocks(id, productForm.detailBlocks);

    await syncProductCategories(id, productForm.categoryNames, { replace: true });

    revalidateCatalogViews({
      productSlugs: [existingProduct?.slug, updatedProduct.slug],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof VariantRemovalError) {
      return errorResponse(error.message, 409);
    }

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
