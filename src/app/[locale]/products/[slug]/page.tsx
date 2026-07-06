import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductViewTracker } from "@/components/product/ProductViewTracker";
import {
  getCachedProductVariants,
  getCachedPublicProductBySlug,
} from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import {
  formatFulfillmentDate,
  normalizeProductionRange,
} from "@/lib/fulfillment/estimate";
import { getProductImageSrcs } from "@/lib/product-images";

type ProductPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

function toIsoString(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const product = await getCachedPublicProductBySlug(slug);

  return {
    title: product
      ? product.title[activeLocale] || product.title.en
      : "Product",
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  const product = await getCachedPublicProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const activeLocale = locale === "ro" ? "ro" : "en";
  const title = product.title[activeLocale] || product.title.en;
  const description =
    product.description?.[activeLocale] || product.description?.en;
  const imageSrcs = getProductImageSrcs(product.imageUrl);
  const productionRange = normalizeProductionRange(product);
  const preorderShipDate =
    product.preorderEnabled && product.preorderShipDate
      ? formatFulfillmentDate(product.preorderShipDate, activeLocale)
      : null;
  const [variants, currencyPresentation] = await Promise.all([
    getCachedProductVariants(product.id),
    getCurrencyPresentation(),
  ]);

  return (
    <main className="max-w-7xl mx-auto px-8 py-16">
      <ProductViewTracker
        productId={product.id}
        productTitle={title}
        productSlug={product.slug}
        basePrice={product.basePrice}
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProductImageGallery images={imageSrcs} title={title} />

        <section className="flex flex-col gap-8">
          <div className="border-b border-black pb-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Product
            </p>
            <h1 className="text-4xl font-black uppercase tracking-tight">
              {title}
            </h1>
          </div>

          {description && (
            <p className="text-sm leading-7 text-slate-600">{description}</p>
          )}

          <div className="border border-black p-4 text-sm">
            {preorderShipDate ? (
              <p className="font-black uppercase tracking-widest">
                {activeLocale === "ro"
                  ? `Livrarea incepe din ${preorderShipDate}`
                  : `Shipping starts from ${preorderShipDate}`}
              </p>
            ) : (
              <p className="font-black uppercase tracking-widest">
                {activeLocale === "ro"
                  ? `Estimare expediere: ${productionRange.minDays}-${productionRange.maxDays} zile lucratoare`
                  : `Estimated dispatch: ${productionRange.minDays}-${productionRange.maxDays} business days`}
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <AddToCart
              product={{
                id: product.id,
                slug: product.slug,
                title,
                basePrice: product.basePrice,
                salePrice: product.salePrice,
                saleEnabled: product.saleEnabled,
                saleStartsAt: toIsoString(product.saleStartsAt),
                saleEndsAt: toIsoString(product.saleEndsAt),
              }}
              variants={variants.map((variant) => ({
                id: variant.id,
                name: variant.name,
                sku: variant.sku,
                attributes: variant.attributes,
                price: variant.price,
                salePrice: variant.salePrice,
                saleEnabled: variant.saleEnabled,
                saleStartsAt: toIsoString(variant.saleStartsAt),
                saleEndsAt: toIsoString(variant.saleEndsAt),
                priceAdjustment: variant.priceAdjustment,
                stock: variant.stock,
              }))}
              displayCurrency={currencyPresentation.displayCurrency}
              ronToEurRate={currencyPresentation.ronToEurRate}
            />
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-none border-black font-black uppercase tracking-widest"
            >
              <Link href={`/${activeLocale}/products`}>Back to catalog</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
