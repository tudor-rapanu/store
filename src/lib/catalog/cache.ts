import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { categories, productCategories, products, productVariants } from "@/lib/db/schema";

const CATALOG_REVALIDATE_SECONDS = 300;
export const PUBLIC_PRODUCTS_PER_PAGE = 12;

export const CATALOG_CACHE_TAGS = {
  categories: "catalog:categories",
  products: "catalog:products",
} as const;

const CATALOG_LOCALES = ["en", "ro"] as const;

export function revalidateCatalogCache() {
  revalidateTag(CATALOG_CACHE_TAGS.categories, { expire: 0 });
  revalidateTag(CATALOG_CACHE_TAGS.products, { expire: 0 });
}

export function revalidateCatalogViews({
  productSlugs = [],
  categorySlugs = [],
}: {
  productSlugs?: Array<string | null | undefined>;
  categorySlugs?: Array<string | null | undefined>;
} = {}) {
  revalidateCatalogCache();
  revalidatePath("/", "layout");

  for (const locale of CATALOG_LOCALES) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/products`);

    for (const productSlug of productSlugs) {
      if (productSlug) {
        revalidatePath(`/${locale}/products/${productSlug}`);
      }
    }

    for (const categorySlug of categorySlugs) {
      if (categorySlug) {
        revalidatePath(`/${locale}/category/${categorySlug}`);
      }
    }
  }
}

export const getCachedPublicProducts = unstable_cache(
  async (page = 1, perPage = PUBLIC_PRODUCTS_PER_PAGE) => {
    const safePage = Math.max(Math.floor(page), 1);
    const safePerPage = Math.min(Math.max(Math.floor(perPage), 1), 48);
    const [totalResult] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.isPrivate, false));
    const total = totalResult?.value ?? 0;
    const totalPages = Math.max(Math.ceil(total / safePerPage), 1);
    const currentPage = Math.min(safePage, totalPages);
    const offset = (currentPage - 1) * safePerPage;
    const items = await db
      .select()
      .from(products)
      .where(eq(products.isPrivate, false))
      .orderBy(desc(products.createdAt))
      .limit(safePerPage)
      .offset(offset);

    return {
      items,
      total,
      page: currentPage,
      perPage: safePerPage,
    };
  },
  ["catalog:public-products"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedCategoryBySlug = unstable_cache(
  async (slug: string) => {
    const [category] = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    return category ?? null;
  },
  ["catalog:category-by-slug"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories],
  },
);

export const getCachedPublicCategories = unstable_cache(
  async () => {
    return db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories)
      .orderBy(desc(categories.createdAt));
  },
  ["catalog:public-categories"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories],
  },
);

export const getCachedHomepageProducts = unstable_cache(
  async (limit = 4) => {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 8);

    return db
      .select()
      .from(products)
      .where(eq(products.isPrivate, false))
      .orderBy(desc(products.createdAt))
      .limit(safeLimit);
  },
  ["catalog:homepage-products"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedPublicCategoryProducts = unstable_cache(
  async (slug: string, page = 1, perPage = PUBLIC_PRODUCTS_PER_PAGE) => {
    const safePage = Math.max(Math.floor(page), 1);
    const safePerPage = Math.min(Math.max(Math.floor(perPage), 1), 48);
    const where = and(eq(categories.slug, slug), eq(products.isPrivate, false));
    const [totalResult] = await db
      .select({ value: count() })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.productId, products.id))
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(where);
    const total = totalResult?.value ?? 0;
    const totalPages = Math.max(Math.ceil(total / safePerPage), 1);
    const currentPage = Math.min(safePage, totalPages);
    const offset = (currentPage - 1) * safePerPage;
    const rows = await db
      .select({ product: products })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.productId, products.id))
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(safePerPage)
      .offset(offset);

    return {
      items: rows.map((row) => row.product),
      total,
      page: currentPage,
      perPage: safePerPage,
    };
  },
  ["catalog:public-category-products"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories, CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedPublicProductBySlug = unstable_cache(
  async (slug: string) => {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.isPrivate, false)))
      .limit(1);

    return product ?? null;
  },
  ["catalog:public-product-by-slug"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedProductVariants = unstable_cache(
  async (productId: string) => {
    return db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));
  },
  ["catalog:product-variants"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);
