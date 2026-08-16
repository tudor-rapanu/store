import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductSkeleton } from "@/components/product/ProductSkeleton";
import { Button } from "@/components/ui/button";
import { getCachedPublicProducts, PUBLIC_PRODUCTS_PER_PAGE } from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCatalogAutomaticDiscountPrices } from "@/lib/discounts";

export const metadata: Metadata = {
  title: "Products",
};

type ProductsPageProps = Readonly<{
  params: Promise<
    Readonly<{
      locale: string;
    }>
  >;
  searchParams: Promise<
    Readonly<{
      page?: string;
      pageSize?: string;
    }>
  >;
}>;

const PRODUCT_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

function getCurrentPage(pageParam?: string) {
  return Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
}

function getPageSize(pageSizeParam?: string) {
  const requested =
    Number.parseInt(pageSizeParam ?? String(PUBLIC_PRODUCTS_PER_PAGE), 10) ||
    PUBLIC_PRODUCTS_PER_PAGE;

  return PRODUCT_PAGE_SIZE_OPTIONS.includes(
    requested as (typeof PRODUCT_PAGE_SIZE_OPTIONS)[number],
  )
    ? requested
    : PUBLIC_PRODUCTS_PER_PAGE;
}

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const { locale } = await params;
  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const currentPage = getCurrentPage(pageParam);
  const pageSize = getPageSize(pageSizeParam);
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
        <ProductGrid
          locale={locale as "en" | "ro"}
          page={currentPage}
          pageSize={pageSize}
        />
      </Suspense>
    </main>
  );
}

async function ProductGrid({
  locale,
  page,
  pageSize,
}: {
  locale: "en" | "ro";
  page: number;
  pageSize: number;
}) {
  const [catalog, currencyPresentation] = await Promise.all([
    getCachedPublicProducts(page, pageSize),
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
      <PageSizeForm
        action={`/${locale}/products`}
        pageSize={perPage}
        total={total}
        label="Products per page"
      />

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
          pageSize={perPage}
        />
      )}
    </>
  );
}

function PageSizeForm({
  action,
  pageSize,
  total,
  label,
}: {
  action: string;
  pageSize: number;
  total: number;
  label: string;
}) {
  return (
    <form
      action={action}
      className="mb-8 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-slate-500"
    >
      <span>
        Showing {pageSize} per page from {total} products
      </span>
      <div className="flex items-center gap-2">
        <input type="hidden" name="page" value="1" />
        <label htmlFor="catalog-page-size">{label}</label>
        <select
          id="catalog-page-size"
          name="pageSize"
          defaultValue={pageSize}
          className="h-10 rounded-none border border-black bg-white px-3 text-sm text-black"
        >
          {PRODUCT_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="outline"
          className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          Apply
        </Button>
      </div>
    </form>
  );
}
