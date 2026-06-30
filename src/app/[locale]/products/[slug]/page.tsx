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
import { getProductImageSrcs } from "@/lib/product-images";

type ProductPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

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
  const variants = await getCachedProductVariants(product.id);

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

          <div className="grid gap-3">
            <AddToCart
              product={{
                id: product.id,
                slug: product.slug,
                title,
                basePrice: product.basePrice,
              }}
              variants={variants}
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
