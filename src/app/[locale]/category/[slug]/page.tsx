import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductCard } from "@/components/product/ProductCard";
import { db } from "@/lib/db";
import { categories, productCategories, products } from "@/lib/db/schema";

type CategoryPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  try {
    const [category] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    return {
      title: category
        ? category.name[activeLocale] || category.name.en
        : "Category",
    };
  } catch {
    return { title: "Category" };
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, slug } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  let category:
    | {
        id: string;
        name: { en: string; ro: string };
      }
    | undefined;
  let categoryLookupFailed = false;
  let items: Array<typeof products.$inferSelect> = [];

  try {
    [category] = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);
  } catch {
    categoryLookupFailed = true;
  }

  if (!categoryLookupFailed && !category) {
    notFound();
  }

  if (category) {
    try {
      const rows = await db
        .select({ product: products })
        .from(products)
        .innerJoin(
          productCategories,
          eq(productCategories.productId, products.id),
        )
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(
          and(eq(categories.slug, slug), eq(products.isPrivate, false)),
        );

      items = rows.map((row) => row.product);
    } catch {
      items = [];
    }
  }

  const title = category?.name[activeLocale] || category?.name.en || slug;

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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={activeLocale}
              eager={index === 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}
