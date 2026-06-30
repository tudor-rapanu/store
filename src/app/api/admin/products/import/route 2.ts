import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productVariants,
  products,
} from "@/lib/db/schema";

export const runtime = "nodejs";

type ImportProductRow = {
  titleEn?: string;
  titleRo?: string;
  descriptionEn?: string;
  descriptionRo?: string;
  slug?: string;
  price?: string | number;
  imageUrl?: string;
  imageUrls?: string;
  categories?: string;
  isPrivate?: string | boolean;
  variants?: string;
};

type VariantInput = {
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price?: number;
  stock?: number;
};

const MAX_IMPORT_ROWS = 200;

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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "y", "private"].includes(
    value.trim().toLowerCase(),
  );
}

function parsePrice(value: unknown) {
  const price = Number.parseFloat(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return Math.round(price * 100);
}

function parseList(value: unknown) {
  return Array.from(
    new Set(
      getString(value)
        .split(/[|,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseImagePaths(row: ImportProductRow) {
  const imageUrls = getString(row.imageUrls);
  const singleImageUrl = getString(row.imageUrl);
  const values = imageUrls
    ? imageUrls.split("|").map((item) => item.trim())
    : singleImageUrl
      ? [singleImageUrl]
      : [];

  return values.filter(Boolean);
}

function parseVariants(value: unknown, rowNumber: number) {
  const raw = getString(value);

  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Row ${rowNumber}: variants must be valid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Row ${rowNumber}: variants must be a JSON array.`);
  }

  return parsed.map((variant, index): VariantInput => {
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
      throw new Error(
        `Row ${rowNumber}: variant ${index + 1} needs a name and attributes object.`,
      );
    }

    return {
      name: variant.name.trim(),
      sku:
        "sku" in variant && typeof variant.sku === "string"
          ? variant.sku.trim()
          : "",
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

function getVariantSku(variant: VariantInput, productSlug: string, index: number) {
  const explicitSku = slugify(variant.sku);

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

async function getCategoryIds(categoryNames: string[]) {
  const categoryIds: string[] = [];

  for (const name of categoryNames) {
    const slug = slugify(name);

    if (!slug) {
      continue;
    }

    const [existingCategory] = await db
      .select({ id: categories.id })
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
      .returning({ id: categories.id });

    categoryIds.push(createdCategory.id);
  }

  return categoryIds;
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to import products.", 403);
  }

  const body = (await request.json().catch(() => null)) as {
    rows?: ImportProductRow[];
  } | null;
  const rows = body?.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return errorResponse("Upload a CSV with at least one product row.");
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return errorResponse(`Import up to ${MAX_IMPORT_ROWS} products at a time.`);
  }

  let normalizedRows: Array<{
    rowNumber: number;
    titleEn: string;
    titleRo: string;
    slug: string;
    descriptionEn: string;
    descriptionRo: string;
    basePrice: number | null;
    imagePaths: string[];
    isPrivate: boolean;
    categoryNames: string[];
    variants: VariantInput[];
  }>;

  try {
    normalizedRows = rows.map((row, index) => {
      const rowNumber = index + 2;
      const titleEn = getString(row.titleEn);
      const titleRo = getString(row.titleRo) || titleEn;
      const slug = slugify(getString(row.slug) || titleEn);
      const basePrice = parsePrice(row.price);
      const imagePaths = parseImagePaths(row);
      const variants = parseVariants(row.variants, rowNumber);

      return {
        rowNumber,
        titleEn,
        titleRo,
        slug,
        descriptionEn: getString(row.descriptionEn),
        descriptionRo: getString(row.descriptionRo),
        basePrice,
        imagePaths,
        isPrivate: getBoolean(row.isPrivate),
        categoryNames: parseList(row.categories),
        variants,
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          error instanceof Error ? error.message : "The CSV could not be parsed.",
        ],
      },
      { status: 400 },
    );
  }
  const errors: string[] = [];
  const slugs = new Set<string>();
  const variantSkus = new Set<string>();

  normalizedRows.forEach((row) => {
    if (!row.titleEn) {
      errors.push(`Row ${row.rowNumber}: titleEn is required.`);
    }

    if (!row.slug) {
      errors.push(`Row ${row.rowNumber}: slug could not be generated.`);
    }

    if (!row.basePrice) {
      errors.push(`Row ${row.rowNumber}: price must be greater than 0.`);
    }

    if (slugs.has(row.slug)) {
      errors.push(`Row ${row.rowNumber}: duplicate slug "${row.slug}" in CSV.`);
    }

    slugs.add(row.slug);

    row.variants.forEach((variant, index) => {
      const sku = getVariantSku(variant, row.slug, index);

      if (variantSkus.has(sku)) {
        errors.push(`Row ${row.rowNumber}: duplicate variant SKU "${sku}" in CSV.`);
      }

      variantSkus.add(sku);
    });
  });

  if (errors.length === 0 && slugs.size > 0) {
    const existingProducts = await db
      .select({ slug: products.slug })
      .from(products)
      .where(inArray(products.slug, Array.from(slugs)));

    existingProducts.forEach((product) => {
      errors.push(`Product slug "${product.slug}" already exists.`);
    });
  }

  if (errors.length === 0 && variantSkus.size > 0) {
    const existingVariants = await db
      .select({ sku: productVariants.sku })
      .from(productVariants)
      .where(inArray(productVariants.sku, Array.from(variantSkus)));

    existingVariants.forEach((variant) => {
      errors.push(`Variant SKU "${variant.sku}" already exists.`);
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const createdSlugs: string[] = [];

  for (const row of normalizedRows) {
    const imageUrl =
      row.imagePaths.length === 0
        ? null
        : row.imagePaths.length === 1
          ? row.imagePaths[0]
          : JSON.stringify(row.imagePaths);
    const [product] = await db
      .insert(products)
      .values({
        slug: row.slug,
        title: { en: row.titleEn, ro: row.titleRo },
        description:
          row.descriptionEn || row.descriptionRo
            ? {
                en: row.descriptionEn,
                ro: row.descriptionRo || row.descriptionEn,
              }
            : null,
        basePrice: row.basePrice ?? 0,
        imageUrl,
        isSimple: row.variants.length === 0,
        isPrivate: row.isPrivate,
      })
      .returning({ id: products.id, slug: products.slug });

    if (row.variants.length > 0) {
      await db.insert(productVariants).values(
        row.variants.map((variant, index) => ({
          productId: product.id,
          name: variant.name,
          sku: getVariantSku(variant, row.slug, index),
          attributes: variant.attributes,
          price: Math.round((variant.price ?? 0) * 100),
          priceAdjustment: 0,
          stock: variant.stock ?? 0,
        })),
      );
    }

    const categoryIds = await getCategoryIds(row.categoryNames);

    if (categoryIds.length > 0) {
      await db.insert(productCategories).values(
        categoryIds.map((categoryId) => ({
          productId: product.id,
          categoryId,
        })),
      );
    }

    createdSlugs.push(product.slug);
  }

  revalidateCatalogViews({ productSlugs: createdSlugs });

  return NextResponse.json({
    ok: true,
    created: createdSlugs.length,
    slugs: createdSlugs,
  });
}
