import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductDetailHighlights } from "@/components/product/ProductDetailHighlights";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductSizeGuide } from "@/components/product/ProductSizeGuide";
import { ProductViewTracker } from "@/components/product/ProductViewTracker";
import {
  getCachedFreshStockState,
  getCachedProductDetailBlocks,
  getCachedProductVariants,
  getCachedPublicProductBySlug,
  getCachedSizeGuideById,
} from "@/lib/catalog/cache";
import { getCurrencyPresentation } from "@/lib/currency/display";
import {
  formatFulfillmentDate,
  normalizeProductionRange,
} from "@/lib/fulfillment/estimate";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductImageSrcs } from "@/lib/product-images";

type ProductPageProps = Readonly<{
  params: Promise<
    Readonly<{
      locale: string;
      slug: string;
    }>
  >;
}>;

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
      ? getTranslatedText(product.title, activeLocale, "Product")
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
  const title = getTranslatedText(product.title, activeLocale, product.slug);
  const description = getTranslatedText(product.description, activeLocale);
  const imageSrcs = getProductImageSrcs(product.imageUrl);
  const productionRange = normalizeProductionRange(product);
  const preorderShipDate =
    product.preorderEnabled && product.preorderShipDate
      ? formatFulfillmentDate(product.preorderShipDate, activeLocale)
      : null;
  const [variants, detailBlocks, sizeGuide, currencyPresentation, freshStock] =
    await Promise.all([
      getCachedProductVariants(product.id),
      getCachedProductDetailBlocks(product.id),
      getCachedSizeGuideById(product.sizeGuideId),
      getCurrencyPresentation(),
      getCachedFreshStockState(product.id),
    ]);

  return (
    <main className="max-w-7xl mx-auto px-8 py-16">
      <ProductViewTracker
        productId={product.id}
        productTitle={title}
        productSlug={product.slug}
        basePrice={product.basePrice}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProductImageGallery images={imageSrcs} title={title} locale={activeLocale} />

        <section className="flex flex-col gap-8">
          <div className="border-b border-black pb-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Product
            </p>
            <h1 className="break-words text-4xl font-black uppercase tracking-tight">{title}</h1>
          </div>

          {description && (
            <p className="text-sm leading-7 text-slate-600">{description}</p>
          )}

          <ProductDetailHighlights details={detailBlocks} locale={activeLocale} />

          <div className="border border-black p-4 text-sm">
            {product.isDigital ? (
              <p className="font-black uppercase tracking-widest">
                {activeLocale === "ro"
                  ? "Produs digital. Disponibil pentru descarcare dupa plata."
                  : "Digital product. Available to download after payment."}
              </p>
            ) : preorderShipDate ? (
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
                isDigital: product.isDigital,
                trackStock: freshStock.product?.trackStock ?? product.trackStock,
                stock: freshStock.product?.stock ?? product.stock,
              }}
              variants={variants.map((variant) => ({
                ...variant,
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
                trackStock:
                  freshStock.variants[variant.id]?.trackStock ?? variant.trackStock,
                stock: freshStock.variants[variant.id]?.stock ?? variant.stock,
              }))}
              locale={activeLocale}
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
      <div className="mt-16">
        <ProductSizeGuide sizeGuide={sizeGuide} locale={activeLocale} />
      </div>
    </main>
  );
}
