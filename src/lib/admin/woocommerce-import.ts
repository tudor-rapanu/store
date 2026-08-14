import { findOrCreateCategoryIds } from "@/lib/categories";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { productCategories, productVariants, products } from "@/lib/db/schema";
import { readEnvValue } from "@/lib/env";
import { normalizeRomanianCharacters, slugify } from "@/lib/slug";
import { uploadProductImageBuffer } from "@/lib/storage/product-images";

const DEFAULT_WOOCOMMERCE_SITE_URL = "https://toddsthreads.com";
const MAX_PRODUCTS = 500;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type WooImage = {
  src?: string;
};

type WooCategoryRef = {
  id: number;
  name: string;
  slug: string;
};

type WooAttribute = {
  name: string;
  option?: string;
  options?: string[];
};

type WooProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  catalog_visibility?: string;
  downloadable?: boolean;
  permalink?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  images?: WooImage[];
  categories?: WooCategoryRef[];
  attributes?: WooAttribute[];
  variations?: number[];
};

type WooVariation = {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  attributes?: WooAttribute[];
  image?: WooImage;
};

type WooCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
};

type ImportedVariant = {
  wooId: number;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export type WooCommerceImportPreviewItem = {
  wooId: number;
  nameRo: string;
  nameEn: string;
  slug: string;
  type: string;
  status: string;
  visibility: string;
  duplicate: boolean;
  duplicateReason: string | null;
  isPrivate: boolean;
  price: number | null;
  imageCount: number;
  categoryPaths: string[];
  variantCount: number;
};

export type WooCommerceImportPreview = {
  products: WooCommerceImportPreviewItem[];
  total: number;
  importable: number;
  duplicates: number;
};

function getWooBaseUrl() {
  return (
    process.env.WOOCOMMERCE_SITE_URL?.trim().replace(/\/+$/g, "") ||
    DEFAULT_WOOCOMMERCE_SITE_URL
  );
}

function getWooAuthHeader() {
  const key = readEnvValue(
    process.env.WOOCOMMERCE_CONSUMER_KEY,
    "WOOCOMMERCE_CONSUMER_KEY",
  );
  const secret = readEnvValue(
    process.env.WOOCOMMERCE_CONSUMER_SECRET,
    "WOOCOMMERCE_CONSUMER_SECRET",
  );

  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function fetchWooPage<T>(path: string, page: number) {
  const url = new URL(`${getWooBaseUrl()}/wp-json/wc/v3/${path}`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Authorization: getWooAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `WooCommerce request failed: ${response.status} ${await response.text()}`,
    );
  }

  return {
    rows: (await response.json()) as T[],
    totalPages: Number.parseInt(response.headers.get("x-wp-totalpages") ?? "1", 10),
  };
}

async function fetchWooItem<T>(path: string) {
  const url = new URL(`${getWooBaseUrl()}/wp-json/wc/v3/${path}`);

  const response = await fetch(url, {
    headers: {
      Authorization: getWooAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `WooCommerce request failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

async function fetchAllWooPages<T>(path: string, maxRows = MAX_PRODUCTS) {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await fetchWooPage<T>(path, page);
    rows.push(...result.rows);
    totalPages = Number.isFinite(result.totalPages) ? result.totalPages : page;
    page += 1;
  } while (page <= totalPages && rows.length < maxRows);

  return rows.slice(0, maxRows);
}

async function fetchWooVariations(productId: number) {
  return fetchAllWooPages<WooVariation>(`products/${productId}/variations`, 300);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value?: string) {
  return decodeHtmlEntities(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedTitleKey(value?: string | null) {
  return normalizeRomanianCharacters(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEnglishTitleDraft(titleRo: string) {
  // WooCommerce only gives us the Romanian title. This keeps English editable and
  // readable until a real translation pass/provider is configured.
  return normalizeRomanianCharacters(titleRo);
}

function parsePriceMajor(value?: string) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseWooDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toMinorUnits(value: number | null) {
  return value ? Math.round(value * 100) : null;
}

function getValidSalePrice(regularPrice: number | null, salePrice: number | null) {
  return salePrice && regularPrice && salePrice < regularPrice ? salePrice : null;
}

function getProductRegularPrice(product: WooProduct, variants: ImportedVariant[]) {
  const directPrice =
    parsePriceMajor(product.regular_price) ?? parsePriceMajor(product.price);

  if (directPrice) {
    return directPrice;
  }

  const variantPrices = variants
    .map((variant) => variant.price)
    .filter((price): price is number => Boolean(price && price > 0));

  return variantPrices.length > 0 ? Math.min(...variantPrices) : null;
}

function getProductSalePrice(product: WooProduct) {
  const regularPrice =
    parsePriceMajor(product.regular_price) ?? parsePriceMajor(product.price);

  return getValidSalePrice(regularPrice, parsePriceMajor(product.sale_price));
}

function getProductSlug(product: WooProduct) {
  return slugify(product.slug || product.name) || `woocommerce-${product.id}`;
}

function getImportedVariant(product: WooProduct, variation: WooVariation) {
  const attributes = Object.fromEntries(
    (variation.attributes ?? [])
      .map((attribute) => [attribute.name.trim(), (attribute.option ?? "").trim()])
      .filter(([key, value]) => key && value),
  );
  const name = Object.values(attributes).filter(Boolean).join(" / ");
  const fallbackSku = slugify(
    `${product.slug || product.name}-${name || variation.id}`,
  );
  const regularPrice =
    parsePriceMajor(variation.regular_price) ?? parsePriceMajor(variation.price);

  return {
    wooId: variation.id,
    name: name || variation.sku || `Variant ${variation.id}`,
    sku: variation.sku?.trim() || fallbackSku || `woo-${product.id}-${variation.id}`,
    attributes,
    price: regularPrice,
    salePrice: getValidSalePrice(regularPrice, parsePriceMajor(variation.sale_price)),
    saleStartsAt: parseWooDate(variation.date_on_sale_from),
    saleEndsAt: parseWooDate(variation.date_on_sale_to),
  };
}

function getIsPrivate(product: WooProduct) {
  return (
    product.status !== "publish" ||
    product.catalog_visibility === "hidden" ||
    product.catalog_visibility === "search"
  );
}

function buildCategoryPath(
  category: WooCategory,
  categoriesById: Map<number, WooCategory>,
) {
  const names: string[] = [];
  let current: WooCategory | undefined = category;
  const visited = new Set<number>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parent ? categoriesById.get(current.parent) : undefined;
  }

  return names.join(" > ");
}

function getCategoryPaths(
  product: WooProduct,
  categoriesById: Map<number, WooCategory>,
) {
  return Array.from(
    new Set(
      (product.categories ?? [])
        .map((category) => categoriesById.get(category.id))
        .filter((category): category is WooCategory => Boolean(category))
        .map((category) => buildCategoryPath(category, categoriesById))
        .filter(Boolean),
    ),
  );
}

async function getExistingIdentitySets() {
  const [productRows, variantRows] = await Promise.all([
    db.select({ slug: products.slug, title: products.title }).from(products),
    db.select({ sku: productVariants.sku }).from(productVariants),
  ]);
  const titleKeys = new Set<string>();

  productRows.forEach((product) => {
    [product.title.en, product.title.ro].forEach((title) => {
      const key = getNormalizedTitleKey(title);

      if (key) {
        titleKeys.add(key);
      }
    });
  });

  return {
    slugs: new Set(productRows.map((product) => product.slug)),
    titleKeys,
    skus: new Set(variantRows.map((variant) => variant.sku)),
  };
}

function getDuplicateReason({
  product,
  slug,
  variants,
  existingSlugs,
  existingTitleKeys,
  existingSkus,
}: {
  product: WooProduct;
  slug: string;
  variants: ImportedVariant[];
  existingSlugs: Set<string>;
  existingTitleKeys: Set<string>;
  existingSkus: Set<string>;
}) {
  if (existingSlugs.has(slug)) {
    return "slug already exists";
  }

  if (existingTitleKeys.has(getNormalizedTitleKey(stripHtml(product.name)))) {
    return "normalized title already exists";
  }

  const productSku = product.sku?.trim();

  if (productSku && existingSkus.has(productSku)) {
    return "product SKU already exists as a variant SKU";
  }

  const duplicateVariant = variants.find(
    (variant) => variant.sku && existingSkus.has(variant.sku),
  );

  return duplicateVariant
    ? `variant SKU already exists: ${duplicateVariant.sku}`
    : null;
}

async function getWooProductsWithVariations() {
  const [productsRows, categoryRows] = await Promise.all([
    fetchAllWooPages<WooProduct>("products?status=any"),
    fetchAllWooPages<WooCategory>("products/categories?hide_empty=false", 500),
  ]);
  const categoriesById = new Map(
    categoryRows.map((category) => [category.id, category]),
  );
  const rows = await Promise.all(
    productsRows.map((product) => getWooProductImportRow(product, categoriesById)),
  );

  return rows;
}

async function getWooProductWithVariations(productId: number) {
  const [product, categoryRows] = await Promise.all([
    fetchWooItem<WooProduct>(`products/${productId}`),
    fetchAllWooPages<WooCategory>("products/categories?hide_empty=false", 500),
  ]);
  const categoriesById = new Map(
    categoryRows.map((category) => [category.id, category]),
  );

  return getWooProductImportRow(product, categoriesById);
}

async function getWooProductImportRow(
  product: WooProduct,
  categoriesById: Map<number, WooCategory>,
) {
  const variations =
    product.type === "variable" ? await fetchWooVariations(product.id) : [];

  return {
    product,
    variants: variations.map((variation) => getImportedVariant(product, variation)),
    categoryPaths: getCategoryPaths(product, categoriesById),
  };
}

function getPreviewItem({
  product,
  variants,
  categoryPaths,
  existingSlugs,
  existingTitleKeys,
  existingSkus,
}: {
  product: WooProduct;
  variants: ImportedVariant[];
  categoryPaths: string[];
  existingSlugs: Set<string>;
  existingTitleKeys: Set<string>;
  existingSkus: Set<string>;
}): WooCommerceImportPreviewItem {
  const slug = getProductSlug(product);
  const duplicateReason = getDuplicateReason({
    product,
    slug,
    variants,
    existingSlugs,
    existingTitleKeys,
    existingSkus,
  });

  return {
    wooId: product.id,
    nameRo: stripHtml(product.name),
    nameEn: getEnglishTitleDraft(stripHtml(product.name)),
    slug,
    type: product.type,
    status: product.status,
    visibility: product.catalog_visibility ?? "visible",
    duplicate: Boolean(duplicateReason),
    duplicateReason,
    isPrivate: getIsPrivate(product),
    price: getProductRegularPrice(product, variants),
    imageCount: product.images?.length ?? 0,
    categoryPaths,
    variantCount: variants.length,
  };
}

export async function getWooCommerceImportPreview(): Promise<WooCommerceImportPreview> {
  const [{ slugs, titleKeys, skus }, rows] = await Promise.all([
    getExistingIdentitySets(),
    getWooProductsWithVariations(),
  ]);
  const products = rows.map((row) =>
    getPreviewItem({
      ...row,
      existingSlugs: slugs,
      existingTitleKeys: titleKeys,
      existingSkus: skus,
    }),
  );

  return {
    products,
    total: products.length,
    importable: products.filter((product) => !product.duplicate && product.price)
      .length,
    duplicates: products.filter((product) => product.duplicate).length,
  };
}

async function fetchImage(url: string, productName: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "image/jpeg,image/png,image/webp",
    },
  });

  if (!response.ok) {
    throw new Error(`${productName}: image download failed with ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim();

  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`${productName}: image must be JPEG, PNG, or WebP.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${productName}: image must be 25 MB or smaller.`);
  }

  return { buffer, contentType };
}

async function uploadWooImages(product: WooProduct, slug: string) {
  const images =
    product.images
      ?.map((image) => image.src)
      .filter((src): src is string => Boolean(src)) ?? [];

  if (images.length === 0) {
    return null;
  }

  const uploaded = await Promise.all(
    images.map(async (url) => {
      const image = await fetchImage(url, product.name);
      return uploadProductImageBuffer(image.buffer, image.contentType, slug);
    }),
  );

  return uploaded.length === 1 ? uploaded[0] : JSON.stringify(uploaded);
}

async function insertWooProduct({
  product,
  variants,
  categoryPaths,
}: {
  product: WooProduct;
  variants: ImportedVariant[];
  categoryPaths: string[];
}) {
  const slug = getProductSlug(product);
  const price = getProductRegularPrice(product, variants);
  const salePrice = getProductSalePrice(product);

  if (!price) {
    throw new Error(`${product.name}: price could not be resolved.`);
  }

  const imageUrl = await uploadWooImages(product, slug);
  const [createdProduct] = await db
    .insert(products)
    .values({
      slug,
      title: {
        en: getEnglishTitleDraft(stripHtml(product.name)),
        ro: stripHtml(product.name),
      },
      description: {
        en: stripHtml(product.description || product.short_description),
        ro: stripHtml(product.description || product.short_description),
      },
      basePrice: Math.round(price * 100),
      salePrice: toMinorUnits(salePrice),
      saleEnabled: Boolean(salePrice),
      saleStartsAt: salePrice ? parseWooDate(product.date_on_sale_from) : null,
      saleEndsAt: salePrice ? parseWooDate(product.date_on_sale_to) : null,
      productionMinDays: 1,
      productionMaxDays: 3,
      publishAt: null,
      publishRevalidatedAt: getIsPrivate(product) ? null : new Date(),
      imageUrl,
      isDigital: Boolean(product.downloadable),
      trackStock: false,
      stock: 0,
      isSimple: variants.length === 0,
      isPrivate: getIsPrivate(product),
    })
    .returning({ id: products.id, slug: products.slug });

  if (variants.length > 0) {
    await db.insert(productVariants).values(
      variants.map((variant) => {
        const variantPrice = toMinorUnits(variant.price);
        const variantSalePrice = toMinorUnits(variant.salePrice);

        return {
          productId: createdProduct.id,
          name: variant.name,
          sku: variant.sku,
          attributes: variant.attributes,
          price:
            variantPrice && variantPrice !== Math.round(price * 100)
              ? variantPrice
              : null,
          salePrice: variantSalePrice,
          saleEnabled: Boolean(variantSalePrice),
          saleStartsAt: variantSalePrice ? variant.saleStartsAt : null,
          saleEndsAt: variantSalePrice ? variant.saleEndsAt : null,
          priceAdjustment: 0,
          trackStock: false,
          stock: 0,
        };
      }),
    );
  }

  const categoryIds = await findOrCreateCategoryIds(categoryPaths);

  if (categoryIds.length > 0) {
    await db.insert(productCategories).values(
      categoryIds.map((categoryId) => ({
        productId: createdProduct.id,
        categoryId,
      })),
    );
  }

  return createdProduct.slug;
}

export async function importWooCommerceProducts() {
  const [{ slugs, titleKeys, skus }, rows] = await Promise.all([
    getExistingIdentitySets(),
    getWooProductsWithVariations(),
  ]);
  const createdSlugs: string[] = [];
  const skipped: Array<{ wooId: number; name: string; reason: string }> = [];
  const errors: string[] = [];
  const incomingSlugs = new Set<string>();
  const incomingTitleKeys = new Set<string>();
  const incomingSkus = new Set<string>();

  for (const row of rows) {
    const slug = getProductSlug(row.product);
    const titleKey = getNormalizedTitleKey(stripHtml(row.product.name));
    const duplicateReason = incomingSlugs.has(slug)
      ? "duplicate slug in WooCommerce import"
      : incomingTitleKeys.has(titleKey)
        ? "duplicate normalized title in WooCommerce import"
        : getDuplicateReason({
            product: row.product,
            slug,
            variants: row.variants,
            existingSlugs: slugs,
            existingTitleKeys: titleKeys,
            existingSkus: skus,
          });

    if (duplicateReason) {
      skipped.push({
        wooId: row.product.id,
        name: row.product.name,
        reason: duplicateReason,
      });
      continue;
    }

    const duplicateIncomingSku = row.variants.find(
      (variant) => variant.sku && incomingSkus.has(variant.sku),
    );

    if (duplicateIncomingSku) {
      skipped.push({
        wooId: row.product.id,
        name: row.product.name,
        reason: `duplicate variant SKU in WooCommerce import: ${duplicateIncomingSku.sku}`,
      });
      continue;
    }

    try {
      const createdSlug = await insertWooProduct(row);
      createdSlugs.push(createdSlug);
      incomingSlugs.add(slug);
      incomingTitleKeys.add(titleKey);
      slugs.add(slug);
      titleKeys.add(titleKey);

      row.variants.forEach((variant) => {
        incomingSkus.add(variant.sku);
        skus.add(variant.sku);
      });
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `${row.product.name}: product could not be imported.`,
      );
    }
  }

  revalidateCatalogViews({ productSlugs: createdSlugs });

  return {
    created: createdSlugs.length,
    skipped,
    errors,
    slugs: createdSlugs,
  };
}

export async function importWooCommerceProductById(productId: number) {
  const [{ slugs, titleKeys, skus }, row] = await Promise.all([
    getExistingIdentitySets(),
    getWooProductWithVariations(productId),
  ]);
  const slug = getProductSlug(row.product);
  const titleKey = getNormalizedTitleKey(stripHtml(row.product.name));
  const duplicateReason = getDuplicateReason({
    product: row.product,
    slug,
    variants: row.variants,
    existingSlugs: slugs,
    existingTitleKeys: titleKeys,
    existingSkus: skus,
  });

  if (duplicateReason) {
    return {
      created: 0,
      skipped: [
        {
          wooId: row.product.id,
          name: row.product.name,
          reason: duplicateReason,
        },
      ],
      errors: [],
      slugs: [],
    };
  }

  try {
    const createdSlug = await insertWooProduct(row);

    revalidateCatalogViews({ productSlugs: [createdSlug] });

    return {
      created: 1,
      skipped: [],
      errors: [],
      slugs: [createdSlug],
      titleKey,
    };
  } catch (error) {
    return {
      created: 0,
      skipped: [],
      errors: [
        error instanceof Error
          ? error.message
          : `${row.product.name}: product could not be imported.`,
      ],
      slugs: [],
    };
  }
}
