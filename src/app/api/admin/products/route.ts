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
  stock?: number;
};

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
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid variants JSON.",
    );
  }

  const basePrice = Math.round(price * 100);
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
        priceAdjustment: 0,
        stock: variant.stock ?? 0,
      })),
    );
  }

  await syncProductCategories(product.id, categoryNames);

  revalidateCatalogViews({ productSlugs: [product.slug] });

  return NextResponse.json({ ok: true });
}
