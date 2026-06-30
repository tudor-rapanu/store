import { eq } from "drizzle-orm";
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
import { uploadProductImageBuffer } from "@/lib/storage/product-images";

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
  variantType1?: string;
  variantValues1?: string;
  variantType2?: string;
  variantValues2?: string;
  variantType3?: string;
  variantValues3?: string;
  variantPrice?: string | number;
  variantStock?: string | number;
};

type VariantInput = {
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price?: number;
  stock?: number;
};

type NormalizedImportRow = {
  rowNumber: number;
  titleEn: string;
  titleRo: string;
  slug: string;
  baseSlug: string;
  descriptionEn: string;
  descriptionRo: string;
  basePrice: number | null;
  sourceImageUrls: string[];
  isPrivate: boolean;
  categoryNames: string[];
  variants: VariantInput[];
  copyIndex: number;
};

const MAX_IMPORT_ROWS = 200;
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_REMOTE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

function getImportPrivateValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const raw = getString(value).toLowerCase();

  if (["false", "0", "no", "n", "public"].includes(raw)) {
    return false;
  }

  return true;
}

function parsePrice(value: unknown) {
  const price = Number.parseFloat(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return Math.round(price * 100);
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
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

function parseImageUrls(row: ImportProductRow) {
  const imageUrls = getString(row.imageUrls);
  const singleImageUrl = getString(row.imageUrl);
  const values = imageUrls
    ? imageUrls.split("|").map((item) => item.trim())
    : singleImageUrl
      ? [singleImageUrl]
      : [];

  return values.filter(Boolean);
}

function parseVariantJson(value: unknown, rowNumber: number) {
  const raw = getString(value);

  if (!raw) {
    return null;
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

function getOptionCombinations(options: { name: string; values: string[] }[]) {
  return options.reduce<Record<string, string>[]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => ({
          ...combination,
          [option.name]: value,
        })),
      ),
    [{}],
  );
}

function parseFriendlyVariants(row: ImportProductRow) {
  const options = [
    { name: getString(row.variantType1), values: parseList(row.variantValues1) },
    { name: getString(row.variantType2), values: parseList(row.variantValues2) },
    { name: getString(row.variantType3), values: parseList(row.variantValues3) },
  ].filter((option) => option.name);

  if (options.length === 0) {
    return [];
  }

  const completeOptions = options.filter((option) => option.values.length > 0);

  if (completeOptions.length !== options.length) {
    throw new Error("Variant types need at least one variant value.");
  }

  const defaultPrice = parseNumber(row.variantPrice, 0);
  const defaultStock = Math.max(Math.floor(parseNumber(row.variantStock, 0)), 0);

  return getOptionCombinations(completeOptions).map((attributes) => ({
    name: completeOptions.map((option) => attributes[option.name]).join(" / "),
    sku: "",
    attributes,
    price: defaultPrice,
    stock: defaultStock,
  }));
}

function parseVariants(row: ImportProductRow, rowNumber: number) {
  const jsonVariants = parseVariantJson(row.variants, rowNumber);

  if (jsonVariants) {
    return jsonVariants;
  }

  try {
    return parseFriendlyVariants(row);
  } catch (error) {
    throw new Error(
      `Row ${rowNumber}: ${
        error instanceof Error ? error.message : "variant columns are invalid"
      }`,
    );
  }
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

function getCopyTitle(title: string, copyIndex: number) {
  if (copyIndex === 0) {
    return title;
  }

  return `${title} Copy${copyIndex > 1 ? ` ${copyIndex}` : ""}`;
}

function getUniqueSlug(baseSlug: string, usedSlugs: Set<string>) {
  let candidate = baseSlug;
  let copyIndex = 0;

  while (usedSlugs.has(candidate)) {
    copyIndex += 1;
    candidate = `${baseSlug}-copy${copyIndex > 1 ? `-${copyIndex}` : ""}`;
  }

  usedSlugs.add(candidate);
  return { slug: candidate, copyIndex };
}

function getUniqueSku(baseSku: string, usedSkus: Set<string>) {
  let candidate = baseSku;
  let suffix = 1;

  while (usedSkus.has(candidate)) {
    suffix += 1;
    candidate = `${baseSku}-copy${suffix > 2 ? `-${suffix - 1}` : ""}`;
  }

  usedSkus.add(candidate);
  return candidate;
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

async function fetchImportImage(url: string, rowNumber: number) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Row ${rowNumber}: image URL is invalid.`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`Row ${rowNumber}: image URL must use http or https.`);
  }

  const response = await fetch(parsedUrl, {
    headers: {
      Accept: "image/jpeg,image/png,image/webp",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Row ${rowNumber}: image download failed with status ${response.status}.`,
    );
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim();

  if (!contentType || !ALLOWED_REMOTE_IMAGE_TYPES.has(contentType)) {
    throw new Error(
      `Row ${rowNumber}: image must be JPEG, PNG, or WebP.`,
    );
  }

  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REMOTE_IMAGE_BYTES
  ) {
    throw new Error(`Row ${rowNumber}: image must be 25 MB or smaller.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error(`Row ${rowNumber}: image must be 25 MB or smaller.`);
  }

  return { buffer, contentType };
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

  let normalizedRows: NormalizedImportRow[];

  try {
    normalizedRows = rows.map((row, index) => {
      const rowNumber = index + 2;
      const titleEn = getString(row.titleEn);
      const titleRo = getString(row.titleRo) || titleEn;
      const baseSlug = slugify(getString(row.slug) || titleEn);

      return {
        rowNumber,
        titleEn,
        titleRo,
        slug: baseSlug,
        baseSlug,
        descriptionEn: getString(row.descriptionEn),
        descriptionRo: getString(row.descriptionRo),
        basePrice: parsePrice(row.price),
        sourceImageUrls: parseImageUrls(row),
        isPrivate: getImportPrivateValue(row.isPrivate),
        categoryNames: parseList(row.categories),
        variants: parseVariants(row, rowNumber),
        copyIndex: 0,
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

  normalizedRows.forEach((row) => {
    if (!row.titleEn) {
      errors.push(`Row ${row.rowNumber}: titleEn is required.`);
    }

    if (!row.baseSlug) {
      errors.push(`Row ${row.rowNumber}: slug could not be generated.`);
    }

    if (!row.basePrice) {
      errors.push(`Row ${row.rowNumber}: price must be greater than 0.`);
    }

    if (row.sourceImageUrls.length === 0) {
      errors.push(`Row ${row.rowNumber}: imageUrl or imageUrls is required.`);
    }
  });

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const [existingProducts, existingVariants] = await Promise.all([
    db.select({ slug: products.slug }).from(products),
    db.select({ sku: productVariants.sku }).from(productVariants),
  ]);
  const usedSlugs = new Set(existingProducts.map((product) => product.slug));
  const usedSkus = new Set(existingVariants.map((variant) => variant.sku));

  normalizedRows = normalizedRows.map((row) => {
    const unique = getUniqueSlug(row.baseSlug, usedSlugs);

    return {
      ...row,
      slug: unique.slug,
      copyIndex: unique.copyIndex,
      titleEn: getCopyTitle(row.titleEn, unique.copyIndex),
      titleRo: getCopyTitle(row.titleRo, unique.copyIndex),
    };
  });

  normalizedRows.forEach((row) => {
    row.variants = row.variants.map((variant, index) => ({
      ...variant,
      sku: getUniqueSku(getVariantSku(variant, row.slug, index), usedSkus),
    }));
  });

  const createdSlugs: string[] = [];

  try {
    for (const row of normalizedRows) {
      const uploadedImagePaths = await Promise.all(
        row.sourceImageUrls.map(async (url) => {
          const image = await fetchImportImage(url, row.rowNumber);
          return uploadProductImageBuffer(image.buffer, image.contentType, row.slug);
        }),
      );
      const imageUrl =
        uploadedImagePaths.length === 1
          ? uploadedImagePaths[0]
          : JSON.stringify(uploadedImagePaths);
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
          row.variants.map((variant) => ({
            productId: product.id,
            name: variant.name,
            sku: variant.sku,
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
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          error instanceof Error
            ? error.message
            : "The import could not be completed.",
        ],
      },
      { status: 500 },
    );
  }

  revalidateCatalogViews({ productSlugs: createdSlugs });

  return NextResponse.json({
    ok: true,
    created: createdSlugs.length,
    slugs: createdSlugs,
  });
}
