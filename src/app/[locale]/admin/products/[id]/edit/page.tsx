import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminProductForm } from "@/components/product/AdminProductForm";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  productVariants,
  products,
} from "@/lib/db/schema";
import { getProductImagePaths, getProductImageSrc } from "@/lib/product-images";

type EditProductPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export async function generateMetadata({
  params,
}: EditProductPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const [product] = await db
    .select({ title: products.title })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return {
    title: product
      ? `Edit ${product.title[activeLocale] || product.title.en}`
      : "Edit Product",
  };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { locale, id } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    notFound();
  }

  const variants = await db
    .select({
      name: productVariants.name,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      price: productVariants.price,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));
  const linkedCategories = await db
    .select({
      name: categories.name,
    })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(eq(productCategories.productId, product.id));
  const allCategories = await db.select().from(categories);
  const imagePaths = getProductImagePaths(product.imageUrl);
  const imageSources = Object.fromEntries(
    imagePaths.map((imagePath) => [
      imagePath,
      getProductImageSrc(imagePath, "thumb"),
    ]),
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            Edit Product
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Inventory Management
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black uppercase tracking-widest font-bold text-xs"
        >
          <Link href={`/${activeLocale}/admin/products`}>Back to Products</Link>
        </Button>
      </div>

      <AdminProductForm
        locale={activeLocale}
        product={product}
        variants={variants.map((variant) => ({
          name: variant.name ?? "",
          sku: variant.sku,
          attributes: variant.attributes,
          price: (variant.price ?? product.basePrice) / 100,
          stock: variant.stock,
        }))}
        imagePaths={imagePaths}
        imageSources={imageSources}
        categories={linkedCategories.map((category) => category.name.en)}
        availableCategories={allCategories.map((category) => ({
          id: category.id,
          name: category.name[activeLocale] || category.name.en,
          value: category.name.en,
        }))}
      />
    </main>
  );
}
