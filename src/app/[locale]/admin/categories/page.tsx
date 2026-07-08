import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminCategoryManager } from "@/components/category/AdminCategoryManager";
import { Button } from "@/components/ui/button";
import { buildCategoryTree } from "@/lib/categories";
import { db } from "@/lib/db";
import { categories, productCategories, products } from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";

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
        parentId: categories.parentId,
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
      parentId: string | null;
      slug: string;
      nameEn: string;
      nameRo: string;
      depth: number;
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
        parentId: category.parentId,
        slug: category.slug,
        nameEn: getTranslatedText(category.name, "en", category.slug),
        nameRo: getTranslatedText(category.name, "ro", category.slug),
        depth: 0,
        products: [],
      });
    }

    if (row.product) {
      categoryMap.get(category.id)?.products.push({
        id: row.product.id,
        title: getTranslatedText(row.product.title, activeLocale, row.product.slug),
        slug: row.product.slug,
        imageUrl: row.product.imageUrl,
      });
    }
  });
  const categoryTree = buildCategoryTree(
    Array.from(categoryMap.values()).map((category) => ({
      id: category.id,
      parentId: category.parentId,
      slug: category.slug,
      name: { en: category.nameEn, ro: category.nameRo },
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
  const sortedCategoryIds: Array<{ id: string; depth: number }> = [];

  function visitCategory(node: (typeof categoryTree)[number], depth: number) {
    sortedCategoryIds.push({ id: node.id, depth });
    node.children.forEach((child) => visitCategory(child, depth + 1));
  }

  categoryTree.forEach((node) => visitCategory(node, 0));
  const sortedCategories = sortedCategoryIds
    .map(({ id, depth }) => {
      const category = categoryMap.get(id);

      return category ? { ...category, depth } : null;
    })
    .filter((category): category is NonNullable<typeof category> =>
      Boolean(category),
    );

  return (
    <main className="max-w-6xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
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
        categories={sortedCategories}
        products={allProducts.map((product) => ({
          id: product.id,
          title: getTranslatedText(product.title, activeLocale, product.slug),
          slug: product.slug,
          imageUrl: product.imageUrl,
        }))}
      />
    </main>
  );
}
