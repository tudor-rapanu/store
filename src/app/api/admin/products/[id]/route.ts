import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { digitalProductFiles, products } from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import {
  updateProductRecord,
  VariantRemovalError,
} from "@/lib/admin/product-persistence";
import {
  getString,
  getUploadedFiles,
  parseProductFormData,
  type ParsedProductForm,
} from "@/lib/admin/product-form";
import { getProductImagePaths } from "@/lib/product-images";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import {
  deleteDigitalProductFiles,
  uploadDigitalProductFile,
} from "@/lib/storage/digital-products";
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

  const [existingProduct] = await db
    .select({ imageUrl: products.imageUrl, slug: products.slug })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existingProduct) {
    return errorResponse("Product was not found.", 404);
  }

  const uploadedImages: string[] = [];
  const uploadedDigitalFiles: Awaited<ReturnType<typeof uploadDigitalProductFile>>[] = [];

  try {
    for (const image of images) {
      uploadedImages.push(await uploadProductImage(image, productForm.slug));
    }

    for (const file of digitalFiles) {
      uploadedDigitalFiles.push(await uploadDigitalProductFile(file, id));
    }

    const orderedImages = [...existingImages, ...uploadedImages];
    const imageUrl = serializeProductImages(orderedImages);
    const result = await updateProductRecord({
      productId: id,
      productForm,
      imageUrl,
      digitalFiles: uploadedDigitalFiles,
    });

    if (!result) {
      throw new Error("Product was not found.");
    }

    const previousImages = getProductImagePaths(result.existingProduct.imageUrl);
    const removedImages = previousImages.filter(
      (imagePath) => !orderedImages.includes(imagePath),
    );
    const imagesSafeToDelete = await getImagesSafeToDelete(removedImages, id);

    if (imagesSafeToDelete.length > 0) {
      await deleteProductImages(imagesSafeToDelete);
    }

    revalidateCatalogViews({
      productSlugs: [result.existingProduct.slug, result.updatedProduct.slug],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await Promise.all([
      deleteProductImages(uploadedImages),
      deleteDigitalProductFiles(uploadedDigitalFiles.map((file) => file.storageKey)),
    ]);

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
  } catch (error) {
    console.error("Failed to delete product:", error);
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
