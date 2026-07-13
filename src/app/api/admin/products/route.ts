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
  getUploadedFiles,
  getVariantSku,
  parseProductFormData,
  syncProductCategories,
  validateProductMediaRequirements,
  type ParsedProductForm,
} from "@/lib/admin/product-form";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { uploadDigitalProductFile } from "@/lib/storage/digital-products";
import { uploadProductImage } from "@/lib/storage/product-images";

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

  const uploadedImages = await Promise.all(
    images.map((image) => uploadProductImage(image, productForm.slug)),
  );
  const imageUrl =
    uploadedImages.length === 1 ? uploadedImages[0] : JSON.stringify(uploadedImages);

  const [product] = await db
    .insert(products)
    .values({
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
      preorderShipDate: productForm.preorderEnabled
        ? productForm.preorderShipDate
        : null,
      publishAt: productForm.publishAt,
      publishRevalidatedAt: productForm.shouldWaitForPublishRevalidation
        ? null
        : new Date(),
      imageUrl,
      isDigital: productForm.isDigital,
      sizeGuideId: productForm.sizeGuideId,
      trackStock: productForm.variants.length === 0 ? productForm.trackStock : false,
      stock:
        productForm.variants.length === 0 && productForm.trackStock
          ? productForm.stock
          : 0,
      isSimple: productForm.variants.length === 0,
      isPrivate: productForm.isPrivate,
    })
    .returning();

  if (productForm.isDigital && digitalFiles.length > 0) {
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

  if (productForm.variants.length > 0) {
    await db.insert(productVariants).values(
      productForm.variants.map((variant, index) => ({
        productId: product.id,
        name: variant.name,
        sku: getVariantSku(variant, productForm.slug, index),
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

  if (productForm.detailBlocks.length > 0) {
    await db.insert(productDetailBlocks).values(
      productForm.detailBlocks.map((detail, index) => ({
        productId: product.id,
        icon: detail.icon,
        label: detail.label,
        value: detail.value,
        sortOrder: index,
        enabled: detail.enabled,
      })),
    );
  }

  await syncProductCategories(product.id, productForm.categoryNames);

  revalidateCatalogViews({ productSlugs: [product.slug] });

  return NextResponse.json({ ok: true });
}
