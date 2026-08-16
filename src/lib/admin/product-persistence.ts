import { and, eq, inArray } from "drizzle-orm";

import { findOrCreateCategoryIds } from "@/lib/categories";
import { db } from "@/lib/db";
import {
  digitalProductFiles,
  productCategories,
  productDetailBlocks,
  productVariants,
  products,
} from "@/lib/db/schema";
import type {
  ParsedProductForm,
  ProductDetailBlockInput,
  VariantInput,
} from "./product-form";
import {
  getProductDetailWriteValues,
  getProductWriteValues,
  getVariantWriteValues,
} from "./product-write-values";

type ProductTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type UploadedDigitalProductFile = {
  fileName: string;
  storageKey: string;
  contentType: string;
  fileSize: number;
};

export class VariantRemovalError extends Error {}

async function insertDigitalFileRecords(
  tx: ProductTransaction,
  productId: string,
  files: UploadedDigitalProductFile[],
) {
  if (files.length === 0) {
    return;
  }

  await tx.insert(digitalProductFiles).values(
    files.map((file) => ({
      productId,
      fileName: file.fileName,
      storageKey: file.storageKey,
      contentType: file.contentType,
      fileSize: file.fileSize,
    })),
  );
}

async function insertProductVariants(
  tx: ProductTransaction,
  productId: string,
  productForm: ParsedProductForm,
) {
  if (productForm.variants.length === 0) {
    return;
  }

  await tx.insert(productVariants).values(
    productForm.variants.map((variant, index) => ({
      productId,
      ...getVariantWriteValues(variant, productForm.slug, index),
    })),
  );
}

async function deleteRemovedVariants(
  tx: ProductTransaction,
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
    await tx
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
  tx: ProductTransaction,
  productId: string,
  slug: string,
  variants: VariantInput[],
) {
  const existingVariants = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const existingVariantIds = new Set(existingVariants.map((variant) => variant.id));

  await deleteRemovedVariants(tx, productId, existingVariantIds, variants);

  for (const [index, variant] of variants.entries()) {
    const variantValues = {
      ...getVariantWriteValues(variant, slug, index),
      updatedAt: new Date(),
    };

    if (variant.id && existingVariantIds.has(variant.id)) {
      await tx
        .update(productVariants)
        .set(variantValues)
        .where(
          and(
            eq(productVariants.id, variant.id),
            eq(productVariants.productId, productId),
          ),
        );
    } else {
      await tx.insert(productVariants).values({
        productId,
        ...variantValues,
      });
    }
  }
}

async function insertProductDetailBlocks(
  tx: ProductTransaction,
  productId: string,
  detailBlocks: ProductDetailBlockInput[],
) {
  if (detailBlocks.length === 0) {
    return;
  }

  await tx.insert(productDetailBlocks).values(
    detailBlocks.map((detail, index) => ({
      productId,
      ...getProductDetailWriteValues(detail, index),
    })),
  );
}

async function syncProductDetailBlocks(
  tx: ProductTransaction,
  productId: string,
  detailBlocks: ProductDetailBlockInput[],
) {
  await tx
    .delete(productDetailBlocks)
    .where(eq(productDetailBlocks.productId, productId));
  await insertProductDetailBlocks(tx, productId, detailBlocks);
}

async function syncProductCategoryIds(
  tx: ProductTransaction,
  productId: string,
  categoryIds: string[],
  replace: boolean,
) {
  if (replace) {
    await tx
      .delete(productCategories)
      .where(eq(productCategories.productId, productId));
  }

  if (categoryIds.length === 0) {
    return;
  }

  await tx.insert(productCategories).values(
    categoryIds.map((categoryId) => ({
      productId,
      categoryId,
    })),
  );
}

export async function createProductRecord({
  productId,
  productForm,
  imageUrl,
  digitalFiles,
}: {
  productId: string;
  productForm: ParsedProductForm;
  imageUrl: string | null;
  digitalFiles: UploadedDigitalProductFile[];
}) {
  return db.transaction(async (tx) => {
    const categoryIds = await findOrCreateCategoryIds(productForm.categoryNames, tx);
    const [product] = await tx
      .insert(products)
      .values({
        id: productId,
        ...getProductWriteValues(productForm),
        imageUrl,
      })
      .returning();

    if (!product) {
      throw new Error("Product could not be created.");
    }

    await insertDigitalFileRecords(tx, productId, digitalFiles);
    await insertProductVariants(tx, productId, productForm);
    await insertProductDetailBlocks(tx, productId, productForm.detailBlocks);
    await syncProductCategoryIds(tx, productId, categoryIds, false);

    return product;
  });
}

export async function updateProductRecord({
  productId,
  productForm,
  imageUrl,
  digitalFiles,
}: {
  productId: string;
  productForm: ParsedProductForm;
  imageUrl: string | null;
  digitalFiles: UploadedDigitalProductFile[];
}) {
  return db.transaction(async (tx) => {
    const categoryIds = await findOrCreateCategoryIds(productForm.categoryNames, tx);
    const [existingProduct] = await tx
      .select({ imageUrl: products.imageUrl, slug: products.slug })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existingProduct) {
      return null;
    }

    const [updatedProduct] = await tx
      .update(products)
      .set({
        ...getProductWriteValues(productForm),
        updatedAt: new Date(),
        imageUrl,
      })
      .where(eq(products.id, productId))
      .returning();

    if (!updatedProduct) {
      return null;
    }

    await insertDigitalFileRecords(tx, productId, digitalFiles);
    await syncProductVariants(tx, productId, productForm.slug, productForm.variants);
    await syncProductDetailBlocks(tx, productId, productForm.detailBlocks);
    await syncProductCategoryIds(tx, productId, categoryIds, true);

    return { existingProduct, updatedProduct };
  });
}
