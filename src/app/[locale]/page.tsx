import { Suspense } from "react";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductSkeleton } from "@/components/product/ProductSkeleton";
import { getTranslations } from "next-intl/server";
import { PaymentReturnNotice } from "@/components/checkout/PaymentReturnNotice";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
};

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function CatalogPage({ params }: PageProps) {
  const { locale } = await params;

  // Pass locale explicitly to getTranslations
  const t = await getTranslations({ locale, namespace: "Catalog" });

  return (
    <main className="max-w-7xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-black tracking-tighter mb-12 uppercase">
        {t("title")}
      </h1>
      <PaymentReturnNotice />
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        }
      >
        <ProductGrid locale={locale as "en" | "ro"} />
      </Suspense>
    </main>
  );
}

async function ProductGrid({ locale }: { locale: "en" | "ro" }) {
  const items = await db
    .select()
    .from(products)
    .where(eq(products.isPrivate, false));

  if (items.length === 0) {
    return (
      <div className="text-slate-500 uppercase tracking-widest text-sm">
        No products found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
      {items.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          eager={index === 0}
        />
      ))}
    </div>
  );
}
