import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminCategoryManager } from "@/components/category/AdminCategoryManager";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { categories, productCategories, products } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Admin Categories",
};

type AdminCategoriesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AdminCategoriesPage({
  params,
}: AdminCategoriesPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const categoryRows = await db
    .select({
      category: {
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        createdAt: categories.createdAt,
      },
      product: {
        id: products.id,
        slug: products.slug,
        title: products.title,
        imageUrl: products.imageUrl,
      },
    })
    .from(categories)
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
    .leftJoin(products, eq(products.id, productCategories.productId))
    .orderBy(asc(categories.createdAt), asc(products.createdAt));
  const allProducts = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .orderBy(asc(products.createdAt));
  const categoryMap = new Map<
    string,
    {
      id: string;
      slug: string;
      nameEn: string;
      nameRo: string;
      products: Array<{
        id: string;
        title: string;
        slug: string;
        imageUrl: string | null;
      }>;
    }
  >();

  categoryRows.forEach((row) => {
    const category = row.category;

    if (!categoryMap.has(category.id)) {
      categoryMap.set(category.id, {
        id: category.id,
        slug: category.slug,
        nameEn: category.name.en,
        nameRo: category.name.ro,
        products: [],
      });
    }

    if (row.product) {
      categoryMap.get(category.id)?.products.push({
        id: row.product.id,
        title: row.product.title[activeLocale] || row.product.title.en,
        slug: row.product.slug,
        imageUrl: row.product.imageUrl,
      });
    }
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-8 flex items-end justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            Categories
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Product Grouping
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black uppercase tracking-widest font-bold text-xs"
        >
          <Link href={`/${activeLocale}/admin/products`}>Products</Link>
        </Button>
      </div>

      <AdminCategoryManager
        locale={activeLocale}
        categories={Array.from(categoryMap.values())}
        products={allProducts.map((product) => ({
          id: product.id,
          title: product.title[activeLocale] || product.title.en,
          slug: product.slug,
          imageUrl: product.imageUrl,
        }))}
      />
    </main>
  );
}
