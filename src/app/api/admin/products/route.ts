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
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
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

  const [product] = await db
    .insert(products)
    .values({
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
    })
    .returning();

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
