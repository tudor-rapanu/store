import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ProductCard } from "@/components/product/ProductCard";
import {
  getCachedCategoryBySlug,
  getCachedPublicCategoryProducts,
  PUBLIC_PRODUCTS_PER_PAGE,
} from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCatalogAutomaticDiscountPrices } from "@/lib/discounts";
import { getTranslatedText } from "@/lib/i18n/text";

type CategoryPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  try {
    const category = await getCachedCategoryBySlug(slug);

    return {
      title: category
        ? getTranslatedText(category.name, activeLocale, "Category")
        : "Category",
    };
  } catch {
    return { title: "Category" };
  }
}

function getCurrentPage(pageParam?: string) {
  return Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { locale, slug } = await params;
  const { page: pageParam } = await searchParams;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const currentPage = getCurrentPage(pageParam);
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [catalog, currencyPresentation] = await Promise.all([
    getCachedPublicCategoryProducts(slug, currentPage, PUBLIC_PRODUCTS_PER_PAGE),
    getCurrencyPresentation(),
  ]);
  const { items, total, page: resolvedPage, perPage } = catalog;
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const title = getTranslatedText(category?.name, activeLocale, slug);
  const catalogDiscounts = await getCatalogAutomaticDiscountPrices(items);

  return (
    <main className="max-w-7xl mx-auto px-8 py-16">
      <div className="mb-12 border-b border-black pb-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Category
        </p>
        <h1 className="text-4xl font-black tracking-tighter uppercase">
          {title}
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="text-slate-500 uppercase tracking-widest text-sm">
          No products found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
            {items.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={activeLocale}
                eager={index === 0}
                displayCurrency={currencyPresentation.displayCurrency}
                ronToEurRate={currencyPresentation.ronToEurRate}
                catalogDiscount={catalogDiscounts.get(product.id)}
              />
            ))}
          </div>

          {total > perPage && (
            <CatalogPagination
              basePath={`/${activeLocale}/category/${slug}`}
              currentPage={resolvedPage}
              totalPages={totalPages}
            />
          )}
        </>
      )}
    </main>
  );
}
