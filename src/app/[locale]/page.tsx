import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCategorySlider } from "@/components/product/ProductCategorySlider";
import { ProductSkeleton } from "@/components/product/ProductSkeleton";
import { PaymentReturnNotice } from "@/components/checkout/PaymentReturnNotice";
import type { Metadata } from "next";
import {
  getCachedHomepageCategorySliders,
  getCachedHomepageProducts,
  getCachedPublicCategories,
} from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCatalogAutomaticDiscountPrices } from "@/lib/discounts";
import { getTranslatedText } from "@/lib/i18n/text";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Home",
};

const homeCopy = {
  en: {
    eyebrow: "Todd's Threads",
    title: "Small-batch patches and apparel for everyday obsessions.",
    intro:
      "Start with the latest drops, then jump into the full collection when you want to browse every piece.",
    latest: "Latest Products",
    categories: "Shop Categories",
    allProducts: "View All Products",
    empty: "No products found.",
  },
  ro: {
    eyebrow: "Todd's Threads",
    title: "Patch-uri si apparel in serii mici pentru obsesiile de zi cu zi.",
    intro:
      "Incepe cu cele mai noi produse, apoi intra in colectia completa cand vrei sa vezi toate piesele.",
    latest: "Produse Noi",
    categories: "Categorii",
    allProducts: "Vezi Toate Produsele",
    empty: "Nu exista produse.",
  },
} as const;

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const copy = homeCopy[activeLocale];

  return (
    <main className="mx-auto max-w-7xl px-8 py-16">
      <PaymentReturnNotice />

      <section className="grid gap-8 border-b border-black pb-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div>
          <h1 className="max-w-4xl text-4xl font-black uppercase tracking-tighter sm:text-5xl lg:text-6xl">
            {copy.title}
          </h1>
        </div>
        <div className="space-y-5">
          <p className="text-sm leading-7 text-slate-600">{copy.intro}</p>
          <Button
            asChild
            className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            <Link href={`/${activeLocale}/products`}>{copy.allProducts}</Link>
          </Button>
        </div>
      </section>

      <Suspense fallback={<HomeCatalogSkeleton />}>
        <HomeCatalogContent locale={activeLocale} copy={copy} />
      </Suspense>
    </main>
  );
}

async function HomeCatalogContent({
  locale,
  copy,
}: {
  locale: "en" | "ro";
  copy: (typeof homeCopy)["en" | "ro"];
}) {
  const [products, homepageSliders, categories, currencyPresentation] =
    await Promise.all([
      getCachedHomepageProducts(4),
      getCachedHomepageCategorySliders(),
      getCachedPublicCategories(),
      getCurrencyPresentation(),
    ]);
  const sliderProducts = homepageSliders.flatMap((section) => section.products);
  const catalogProductsById = new Map(
    [...products, ...sliderProducts].map((product) => [product.id, product]),
  );
  const catalogDiscounts = await getCatalogAutomaticDiscountPrices(
    Array.from(catalogProductsById.values()),
  );

  return (
    <>
      {homepageSliders.length > 0 ? (
        <div>
          {homepageSliders.map((section) => (
            <ProductCategorySlider
              key={section.category.id}
              title={getTranslatedText(section.category.name, locale)}
              href={`/${locale}/category/${section.category.slug}`}
              products={section.products}
              locale={locale}
              displayCurrency={currencyPresentation.displayCurrency}
              ronToEurRate={currencyPresentation.ronToEurRate}
              catalogDiscounts={catalogDiscounts}
            />
          ))}
        </div>
      ) : (
        <section className="py-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {copy.latest}
            </h2>
            <Link
              href={`/${locale}/products`}
              className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-black"
            >
              {copy.allProducts}
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="text-sm uppercase tracking-widest text-slate-500">
              {copy.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => (
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
          )}
        </section>
      )}

      {categories.length > 0 && (
        <section className="border-t border-black py-12">
          <h2 className="mb-6 text-2xl font-black uppercase tracking-tight">
            {copy.categories}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/category/${category.slug}`}
                className="border border-black p-4 text-sm font-black uppercase tracking-widest transition-colors hover:bg-black hover:text-white"
              >
                {getTranslatedText(category.name, locale, category.slug)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function HomeCatalogSkeleton() {
  return (
    <section className="space-y-6 py-12">
      <div className="flex items-end justify-between gap-4">
        <div className="h-8 w-56 animate-pulse bg-slate-100" />
        <div className="h-10 w-24 animate-pulse bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <ProductSkeleton key={item} />
        ))}
      </div>
    </section>
  );
}
