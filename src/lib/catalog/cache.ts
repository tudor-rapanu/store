import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { and, asc, count, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { getCategoryAndDescendantIds } from "@/lib/categories";
import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productDetailBlocks,
  products,
  productVariants,
  sizeGuides,
  type TranslatedText,
} from "@/lib/db/schema";
import {
  type HomepageContentSection,
  getHomepageSettings,
} from "@/lib/homepage/settings";

// Writes bust this via revalidateCatalogCache()/revalidateCatalogViews(), so this is
// just a staleness safety net — kept long to cut DB reads from repeat/bot traffic.
const CATALOG_REVALIDATE_SECONDS = 300;
export const PUBLIC_PRODUCTS_PER_PAGE = 12;

export const CATALOG_CACHE_TAGS = {
  categories: "catalog:categories",
  products: "catalog:products",
} as const;

const CATALOG_LOCALES = ["en", "ro"] as const;

export type CatalogProductCard = {
  id: string;
  slug: string;
  title: TranslatedText;
  basePrice: number;
  salePrice: number | null;
  saleEnabled: boolean;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  imageUrl: string | null;
};

const productCardSelect = {
  id: products.id,
  slug: products.slug,
  title: products.title,
  basePrice: products.basePrice,
  salePrice: products.salePrice,
  saleEnabled: products.saleEnabled,
  saleStartsAt: products.saleStartsAt,
  saleEndsAt: products.saleEndsAt,
  imageUrl: products.imageUrl,
};

export function publicProductWhere(now = new Date()) {
  return and(
    eq(products.isPrivate, false),
    or(isNull(products.publishAt), lte(products.publishAt, now)),
  );
}

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
      .where(publicProductWhere());
    const total = totalResult?.value ?? 0;
    const totalPages = Math.max(Math.ceil(total / safePerPage), 1);
    const currentPage = Math.min(safePage, totalPages);
    const offset = (currentPage - 1) * safePerPage;
    const items = await db
      .select()
      .from(products)
      .where(publicProductWhere())
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
        parentId: categories.parentId,
        slug: categories.slug,
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
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories)
      .orderBy(asc(categories.slug));
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
      .select(productCardSelect)
      .from(products)
      .where(publicProductWhere())
      .orderBy(desc(products.createdAt))
      .limit(safeLimit);
  },
  ["catalog:homepage-products"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedHomepageCategorySliders = unstable_cache(
  async () => {
    const settings = await getHomepageSettings();
    const enabledSections = settings.categorySections.filter(
      (section) => section.enabled,
    );

    if (enabledSections.length === 0) {
      return [];
    }

    const categoryIds = enabledSections.map((section) => section.categoryId);
    const categoryRows = await db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories);
    const descendantCategoryIdsById = new Map<string, string[]>();

    for (const categoryId of categoryIds) {
      descendantCategoryIdsById.set(
        categoryId,
        getCategoryAndDescendantIds(categoryRows, categoryId),
      );
    }
    const categoriesById = new Map(
      categoryRows.map((category) => [category.id, category]),
    );
    const sections = await Promise.all(
      enabledSections.map(async (section) => {
        const category = categoriesById.get(section.categoryId);
        const descendantCategoryIds = descendantCategoryIdsById.get(
          section.categoryId,
        ) ?? [section.categoryId];

        if (!category || descendantCategoryIds.length === 0) {
          return null;
        }

        const sectionProducts = await db
          .select(productCardSelect)
          .from(productCategories)
          .innerJoin(products, eq(products.id, productCategories.productId))
          .where(
            and(
              inArray(productCategories.categoryId, descendantCategoryIds),
              publicProductWhere(),
            ),
          )
          .orderBy(desc(products.createdAt))
          .limit(settings.productsPerSlider);

        if (!category || sectionProducts.length === 0) {
          return null;
        }

        return {
          category,
          products: sectionProducts,
        };
      }),
    );

    return sections.filter(
      (section): section is NonNullable<(typeof sections)[number]> =>
        Boolean(section && section.products.length > 0),
    );
  },
  ["catalog:homepage-category-sliders"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories, CATALOG_CACHE_TAGS.products],
  },
);

function getHomepageFeaturedProductIds(sections: HomepageContentSection[]) {
  return Array.from(
    new Set(
      sections
        .filter((section) => section.enabled && section.type === "featuredProduct")
        .map((section) => section.content.productId)
        .filter((productId): productId is string => typeof productId === "string"),
    ),
  );
}

export const getCachedHomepageContentSections = unstable_cache(
  async () => {
    const settings = await getHomepageSettings();
    const enabledSections = settings.contentSections.filter(
      (section) => section.enabled,
    );
    const featuredProductIds = getHomepageFeaturedProductIds(enabledSections);
    const featuredProducts =
      featuredProductIds.length > 0
        ? await db
            .select(productCardSelect)
            .from(products)
            .where(and(inArray(products.id, featuredProductIds), publicProductWhere()))
        : [];

    return {
      sections: enabledSections,
      featuredProducts,
    };
  },
  ["catalog:homepage-content-sections"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedPublicCategoryProducts = unstable_cache(
  async (slug: string, page = 1, perPage = PUBLIC_PRODUCTS_PER_PAGE) => {
    const safePage = Math.max(Math.floor(page), 1);
    const safePerPage = Math.min(Math.max(Math.floor(perPage), 1), 48);
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) {
      return {
        items: [],
        total: 0,
        page: 1,
        perPage: safePerPage,
      };
    }

    const categoryRows = await db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories);
    const categoryIds = getCategoryAndDescendantIds(categoryRows, category.id);
    const where = and(
      inArray(productCategories.categoryId, categoryIds),
      publicProductWhere(),
    );
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
      .where(and(eq(products.slug, slug), publicProductWhere()))
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

export const getCachedProductDetailBlocks = unstable_cache(
  async (productId: string) => {
    return db
      .select()
      .from(productDetailBlocks)
      .where(
        and(
          eq(productDetailBlocks.productId, productId),
          eq(productDetailBlocks.enabled, true),
        ),
      )
      .orderBy(asc(productDetailBlocks.sortOrder));
  },
  ["catalog:product-detail-blocks"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export const getCachedSizeGuideById = unstable_cache(
  async (sizeGuideId: string | null) => {
    if (!sizeGuideId) {
      return null;
    }

    const [guide] = await db
      .select()
      .from(sizeGuides)
      .where(and(eq(sizeGuides.id, sizeGuideId), eq(sizeGuides.enabled, true)))
      .limit(1);

    return guide ?? null;
  },
  ["catalog:size-guide-by-id"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);
