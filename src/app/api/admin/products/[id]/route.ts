import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productVariants,
  products,
} from "@/lib/db/schema";
import { readEnvValue } from "@/lib/env";
import { getProductImagePaths } from "@/lib/product-images";
import { r2Client } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

async function syncProductCategories(productId: string, categoryNames: string[]) {
  await db
    .delete(productCategories)
    .where(eq(productCategories.productId, productId));

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

async function uploadProductImage(image: File, slug: string) {
  if (image.size > MAX_IMAGE_SIZE) {
    throw new Error("Product images must be 25 MB or smaller.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }

  const fileExtension = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const uniqueFileName = `${slug}-${crypto.randomUUID()}.${fileExtension}`;
  const s3Key = `catalog/${uniqueFileName}`;
  const buffer = Buffer.from(await image.arrayBuffer());

  await r2Client.send(
    new PutObjectCommand({
      Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
      Key: s3Key,
      Body: buffer,
      ContentType: image.type,
    }),
  );

  return `/${s3Key}`;
}

function getStorageKey(imagePath: string) {
  try {
    return new URL(imagePath).pathname.replace(/^\/+/, "");
  } catch {
    return imagePath.replace(/^\/+/, "");
  }
}

async function deleteProductImages(imagePaths: string[]) {
  await Promise.allSettled(
    imagePaths.map((imagePath) =>
      r2Client.send(
        new DeleteObjectCommand({
          Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
          Key: getStorageKey(imagePath),
        }),
      ),
    ),
  );
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

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = readEnvValue(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");

  return Boolean(user && user.email?.toLowerCase() === adminEmail.toLowerCase());
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await assertAdmin())) {
    return errorResponse("You are not allowed to update products.", 403);
  }

  const { id } = await params;
  const formData = await request.formData();
  const titleEn = getString(formData, "titleEn");
  const titleRo = getString(formData, "titleRo");
  const descriptionEn = getString(formData, "descriptionEn");
  const descriptionRo = getString(formData, "descriptionRo");
  const slug = slugify(getString(formData, "slug"));
  const priceInput = getString(formData, "price");
  const isPrivate = formData.get("isPrivate") === "on";
  const categoryNames = parseCategoryNames(getString(formData, "categories"));
  const existingImages = parseExistingImages(getString(formData, "existingImages"));
  const images = formData
    .getAll("images")
    .filter((image): image is File => image instanceof File && image.size > 0);
  const variantsInput = getString(formData, "variants");

  if (!titleEn || !titleRo || !slug || !priceInput) {
    return errorResponse("All product fields are required.");
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

  const [existingProduct] = await db
    .select({ imageUrl: products.imageUrl })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  let orderedImages = existingImages;

  if (images.length > 0) {
    const uploadedImages = await Promise.all(
      images.map((image) => uploadProductImage(image, slug)),
    );
    orderedImages = [...existingImages, ...uploadedImages];
  }

  const imageUrl =
    orderedImages.length === 0
      ? null
      : orderedImages.length === 1
        ? orderedImages[0]
        : JSON.stringify(orderedImages);

  const [updatedProduct] = await db
    .update(products)
    .set({
      slug,
      title: { en: titleEn, ro: titleRo },
      description:
        descriptionEn || descriptionRo
          ? { en: descriptionEn, ro: descriptionRo || descriptionEn }
          : null,
      basePrice: Math.round(price * 100),
      isSimple: variants.length === 0,
      isPrivate,
      updatedAt: new Date(),
      imageUrl,
    })
    .where(eq(products.id, id))
    .returning();

  if (!updatedProduct) {
    return errorResponse("Product was not found.", 404);
  }

  const previousImages = getProductImagePaths(existingProduct?.imageUrl);
  const removedImages = previousImages.filter(
    (imagePath) => !orderedImages.includes(imagePath),
  );
  const imagesSafeToDelete = await getImagesSafeToDelete(removedImages, id);

  if (imagesSafeToDelete.length > 0) {
    await deleteProductImages(imagesSafeToDelete);
  }

  await db.delete(productVariants).where(eq(productVariants.productId, id));

  if (variants.length > 0) {
    await db.insert(productVariants).values(
      variants.map((variant) => ({
        productId: id,
        name: variant.name,
        sku: getVariantSku(variant, slug, variants.indexOf(variant)),
        attributes: variant.attributes,
        price: Math.round((variant.price ?? 0) * 100),
        priceAdjustment: 0,
        stock: variant.stock ?? 0,
      })),
    );
  }

  await syncProductCategories(id, categoryNames);

  revalidatePath("/", "layout");
  revalidatePath(`/${updatedProduct.slug}`, "page");

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await assertAdmin())) {
    return errorResponse("You are not allowed to delete products.", 403);
  }

  const { id } = await params;
  const [product] = await db
    .select({ imageUrl: products.imageUrl })
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

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
