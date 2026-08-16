import crypto from "crypto";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import {
  getUploadedFiles,
  parseProductFormData,
  validateProductMediaRequirements,
  type ParsedProductForm,
} from "@/lib/admin/product-form";
import { createProductRecord } from "@/lib/admin/product-persistence";
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

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to create products.", 403);
  }

  const formData = await request.formData();
  const images = getUploadedFiles(formData, "images");
  const digitalFiles = getUploadedFiles(formData, "digitalFiles");
  let productForm: ParsedProductForm;

  try {
    productForm = parseProductFormData(formData);
    validateProductMediaRequirements({
      isDigital: productForm.isDigital,
      digitalFiles,
      images,
      requireImage: true,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid product form data.",
    );
  }

  const productId = crypto.randomUUID();
  const uploadedImages: string[] = [];
  const uploadedDigitalFiles: Awaited<ReturnType<typeof uploadDigitalProductFile>>[] = [];

  try {
    for (const image of images) {
      uploadedImages.push(await uploadProductImage(image, productForm.slug));
    }

    if (productForm.isDigital) {
      for (const file of digitalFiles) {
        uploadedDigitalFiles.push(await uploadDigitalProductFile(file, productId));
      }
    }

    const imageUrl =
      uploadedImages.length === 1 ? uploadedImages[0] : JSON.stringify(uploadedImages);
    const product = await createProductRecord({
      productId,
      productForm,
      imageUrl,
      digitalFiles: uploadedDigitalFiles,
    });

    revalidateCatalogViews({ productSlugs: [product.slug] });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await Promise.all([
      deleteProductImages(uploadedImages),
      deleteDigitalProductFiles(uploadedDigitalFiles.map((file) => file.storageKey)),
    ]);
    console.error("Product creation failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Product could not be created.",
      500,
    );
  }
}
