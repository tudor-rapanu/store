import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { AdminProductForm } from "@/components/product/AdminProductForm";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-page-auth";
import { getAllCategories, getCategoryOptions } from "@/lib/categories";
import { db } from "@/lib/db";
import {
  getInventorySummaryForProducts,
  getInventorySummaryKey,
} from "@/lib/admin/inventory-summary";
import {
  categories,
  digitalProductFiles,
  productCategories,
  productDetailBlocks,
  productVariants,
  products,
  sizeGuides,
} from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductImagePaths, getProductImageSrc } from "@/lib/product-images";

type EditProductPageProps = Readonly<{
  params: Promise<
    Readonly<{
      locale: string;
      id: string;
    }>
  >;
}>;

export async function generateMetadata({
  params,
}: EditProductPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const activeLocale = await requireAdminPage(locale);
  const [product] = await db
    .select({ title: products.title })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return {
    title: product
      ? `Edit ${getTranslatedText(product.title, activeLocale, "Product")}`
      : "Edit Product",
  };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { locale, id } = await params;
  const activeLocale = await requireAdminPage(locale);
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
      id: productVariants.id,
      name: productVariants.name,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      price: productVariants.price,
      salePrice: productVariants.salePrice,
      saleEnabled: productVariants.saleEnabled,
      saleStartsAt: productVariants.saleStartsAt,
      saleEndsAt: productVariants.saleEndsAt,
      trackStock: productVariants.trackStock,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));
  const linkedCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
    })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(eq(productCategories.productId, product.id));
  const linkedDigitalFiles = await db
    .select({
      id: digitalProductFiles.id,
      fileName: digitalProductFiles.fileName,
      fileSize: digitalProductFiles.fileSize,
    })
    .from(digitalProductFiles)
    .where(eq(digitalProductFiles.productId, product.id));
  const linkedDetailBlocks = await db
    .select({
      id: productDetailBlocks.id,
      icon: productDetailBlocks.icon,
      label: productDetailBlocks.label,
      value: productDetailBlocks.value,
      enabled: productDetailBlocks.enabled,
    })
    .from(productDetailBlocks)
    .where(eq(productDetailBlocks.productId, product.id))
    .orderBy(asc(productDetailBlocks.sortOrder));
  const [allCategories, guides] = await Promise.all([
    getAllCategories(),
    db.select().from(sizeGuides),
  ]);
  const categoryOptions = getCategoryOptions(allCategories, activeLocale);
  const categoryValuesById = new Map(
    categoryOptions.map((category) => [category.id, category.value]),
  );
  const imagePaths = getProductImagePaths(product.imageUrl);
  const imageSources = Object.fromEntries(
    imagePaths.map((imagePath) => [imagePath, getProductImageSrc(imagePath, "thumb")]),
  );
  const inventorySummaryByKey = await getInventorySummaryForProducts([product.id]);
  const productInventorySummary = inventorySummaryByKey.get(
    getInventorySummaryKey(product.id),
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
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
        inventorySummary={
          product.trackStock
            ? {
                reserved: productInventorySummary?.reserved ?? 0,
                paid: productInventorySummary?.paid ?? 0,
              }
            : undefined
        }
        variants={variants.map((variant) => {
          const variantInventorySummary = inventorySummaryByKey.get(
            getInventorySummaryKey(product.id, variant.id),
          );

          return {
            dbId: variant.id,
            name: variant.name ?? "",
            sku: variant.sku,
            attributes: variant.attributes,
            price: (variant.price ?? product.basePrice) / 100,
            salePrice: variant.salePrice ? variant.salePrice / 100 : null,
            saleEnabled: variant.saleEnabled,
            saleStartsAt: variant.saleStartsAt,
            saleEndsAt: variant.saleEndsAt,
            trackStock: variant.trackStock,
            stock: variant.stock,
            inventorySummary: variant.trackStock
              ? {
                  reserved: variantInventorySummary?.reserved ?? 0,
                  paid: variantInventorySummary?.paid ?? 0,
                }
              : undefined,
          };
        })}
        imagePaths={imagePaths}
        imageSources={imageSources}
        categories={linkedCategories.map(
          (category) =>
            categoryValuesById.get(category.id) ??
            getTranslatedText(category.name, "en"),
        )}
        availableCategories={categoryOptions}
        availableSizeGuides={guides.map((guide) => ({
          id: guide.id,
          title: getTranslatedText(guide.title, activeLocale, guide.slug),
        }))}
        digitalFiles={linkedDigitalFiles}
        detailBlocks={linkedDetailBlocks}
      />
    </main>
  );
}
