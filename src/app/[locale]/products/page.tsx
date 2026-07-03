import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductSkeleton } from "@/components/product/ProductSkeleton";
import {
  getCachedPublicProducts,
  PUBLIC_PRODUCTS_PER_PAGE,
} from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCatalogAutomaticDiscountPrices } from "@/lib/discounts";

export const metadata: Metadata = {
  title: "Products",
};

type ProductsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

function getCurrentPage(pageParam?: string) {
  return Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getCurrentPage(pageParam);
  const t = await getTranslations({ locale, namespace: "Catalog" });

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <div className="mb-12 flex flex-col gap-4 border-b border-black pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Catalog
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            {t("title")}
          </h1>
        </div>
        <Link
          href={`/${locale}`}
          className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-black"
        >
          Back home
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        }
      >
        <ProductGrid locale={locale as "en" | "ro"} page={currentPage} />
      </Suspense>
    </main>
  );
}

async function ProductGrid({
  locale,
  page,
}: {
  locale: "en" | "ro";
  page: number;
}) {
  const [catalog, currencyPresentation] = await Promise.all([
    getCachedPublicProducts(page, PUBLIC_PRODUCTS_PER_PAGE),
    getCurrencyPresentation(),
  ]);
  const { items, total, page: resolvedPage, perPage } = catalog;
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const catalogDiscounts = await getCatalogAutomaticDiscountPrices(items);

  if (items.length === 0) {
    return (
      <div className="text-sm uppercase tracking-widest text-slate-500">
        No products found.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
        {items.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            locale={locale}
            eager={index === 0}
            displayCurrency={currencyPresentation.displayCurrency}
            ronToEurRate={currencyPresentation.ronToEurRate}
            catalogDiscount={catalogDiscounts.get(product.id)}
          />
        ))}
      </div>

      {total > perPage && (
        <CatalogPagination
          basePath={`/${locale}/products`}
          currentPage={resolvedPage}
          totalPages={totalPages}
        />
      )}
    </>
  );
}
