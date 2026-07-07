import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  productCategories,
  productDetailBlocks,
  productVariants,
  products,
} from "@/lib/db/schema";
import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { getTranslatedText } from "@/lib/i18n/text";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getUniqueProductSlug(baseSlug: string) {
  const cleanBaseSlug = slugify(baseSlug) || "product-copy";
  let candidate = cleanBaseSlug;
  let suffix = 2;

  while (true) {
    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1);

    if (!existingProduct) {
      return candidate;
    }

    candidate = `${cleanBaseSlug}-${suffix}`;
    suffix += 1;
  }
}

function getDuplicateVariantSku(
  productSlug: string,
  variant: {
    name: string | null;
    attributes: Record<string, string>;
  },
  index: number,
) {
  const fallbackLabel =
    variant.name ||
    Object.values(variant.attributes).filter(Boolean).join("-") ||
    `variant-${index + 1}`;
  const baseSku =
    slugify(`${productSlug}-${fallbackLabel}`) || `${productSlug}-variant`;

  return `${baseSku}-${index + 1}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to duplicate products.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = body.locale === "ro" ? "ro" : "en";
  const [sourceProduct] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!sourceProduct) {
    return errorResponse("Product was not found.", 404);
  }

  const [sourceVariants, sourceCategories, sourceDetailBlocks] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, sourceProduct.id)),
    db
      .select({ categoryId: productCategories.categoryId })
      .from(productCategories)
      .where(eq(productCategories.productId, sourceProduct.id)),
    db
      .select()
      .from(productDetailBlocks)
      .where(eq(productDetailBlocks.productId, sourceProduct.id)),
  ]);

  const duplicateSlug = await getUniqueProductSlug(`${sourceProduct.slug}-copy`);
  const sourceTitleEn = getTranslatedText(
    sourceProduct.title,
    "en",
    sourceProduct.slug,
  );
  const sourceTitleRo = getTranslatedText(
    sourceProduct.title,
    "ro",
    sourceTitleEn,
  );
  const [duplicatedProduct] = await db
    .insert(products)
    .values({
      slug: duplicateSlug,
      title: {
        en: `${sourceTitleEn} Copy`,
        ro: `${sourceTitleRo} Copy`,
      },
      description: sourceProduct.description,
      basePrice: sourceProduct.basePrice,
      salePrice: sourceProduct.salePrice,
      saleEnabled: sourceProduct.saleEnabled,
      saleStartsAt: sourceProduct.saleStartsAt,
      saleEndsAt: sourceProduct.saleEndsAt,
      productionMinDays: sourceProduct.productionMinDays,
      productionMaxDays: sourceProduct.productionMaxDays,
      preorderEnabled: sourceProduct.preorderEnabled,
      preorderShipDate: sourceProduct.preorderShipDate,
      publishAt: sourceProduct.publishAt,
      publishRevalidatedAt:
        sourceProduct.publishAt && sourceProduct.publishAt > new Date()
          ? null
          : new Date(),
      imageUrl: sourceProduct.imageUrl,
      isDigital: sourceProduct.isDigital,
      sizeGuideId: sourceProduct.sizeGuideId,
      trackStock: sourceProduct.trackStock,
      stock: sourceProduct.stock,
      isSimple: sourceProduct.isSimple,
      isPrivate: sourceProduct.isPrivate,
    })
    .returning();

  if (sourceVariants.length > 0) {
    await db.insert(productVariants).values(
      sourceVariants.map((variant, index) => ({
        productId: duplicatedProduct.id,
        name: variant.name,
        sku: getDuplicateVariantSku(duplicateSlug, variant, index),
        attributes: variant.attributes,
        price: variant.price,
        salePrice: variant.salePrice,
        saleEnabled: variant.saleEnabled,
        saleStartsAt: variant.saleStartsAt,
        saleEndsAt: variant.saleEndsAt,
        priceAdjustment: variant.priceAdjustment,
        trackStock: variant.trackStock,
        stock: variant.stock,
      })),
    );
  }

  if (sourceDetailBlocks.length > 0) {
    await db.insert(productDetailBlocks).values(
      sourceDetailBlocks.map((detail) => ({
        productId: duplicatedProduct.id,
        icon: detail.icon,
        label: detail.label,
        value: detail.value,
        sortOrder: detail.sortOrder,
        enabled: detail.enabled,
      })),
    );
  }

  if (sourceCategories.length > 0) {
    await db.insert(productCategories).values(
      sourceCategories.map((category) => ({
        productId: duplicatedProduct.id,
        categoryId: category.categoryId,
      })),
    );
  }

  revalidateCatalogViews({ productSlugs: [duplicatedProduct.slug] });

  return NextResponse.json({
    ok: true,
    redirectTo: `/${locale}/admin/products/${duplicatedProduct.id}/edit`,
  });
}
