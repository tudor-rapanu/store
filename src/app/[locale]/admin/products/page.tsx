import Link from "next/link";
import Image from "next/image";
import { count, desc } from "drizzle-orm";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/product/DeleteProductButton";
import { DuplicateProductButton } from "@/components/product/DuplicateProductButton";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getProductImageSrc } from "@/lib/product-images";

export const metadata: Metadata = {
  title: "Admin Products",
};

type AdminProductsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

const PRODUCTS_PER_PAGE = 10;

export default async function AdminProductsPage({
  params,
  searchParams,
}: AdminProductsPageProps) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const [totalResult] = await db.select({ value: count() }).from(products);
  const totalProducts = totalResult?.value ?? 0;
  const totalPages = Math.max(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), 1);
  const requestedPage = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const items = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      basePrice: products.basePrice,
      imageUrl: products.imageUrl,
      isPrivate: products.isPrivate,
      createdAt: products.createdAt,
    })
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(PRODUCTS_PER_PAGE)
    .offset(offset);

  return (
    <main className="max-w-5xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-8 flex items-end justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            Products
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Inventory Management
          </p>
        </div>
        <Button
          asChild
          className="rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-xs"
        >
          <Link href={`/${activeLocale}/admin/products/new`}>New Item</Link>
        </Button>
      </div>

      <div className="divide-y divide-black border border-black">
        {items.length === 0 ? (
          <div className="p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            No products yet.
          </div>
        ) : (
          items.map((product) => {
            const imageSrc = getProductImageSrc(product.imageUrl, "thumb");
            const title = product.title[activeLocale] || product.title.en;

            return (
              <div
                key={product.id}
                className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden border border-slate-200 bg-white">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={title}
                        fill
                        unoptimized
                        className="object-contain p-2"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        No Image
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-black uppercase tracking-tight">
                      {title}
                    </h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {product.slug} / {(product.basePrice / 100).toFixed(2)} RON
                    </p>
                    {product.isPrivate && (
                      <p className="mt-1 text-xs font-black uppercase tracking-widest text-destructive">
                        Private
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-none border-black uppercase tracking-widest font-bold text-xs"
                  >
                    <Link href={`/${activeLocale}/products/${product.slug}`}>
                      View
                    </Link>
                  </Button>
                  <DuplicateProductButton
                    locale={activeLocale}
                    productId={product.id}
                  />
                  <Button
                    asChild
                    className="rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-bold text-xs"
                  >
                    <Link
                      href={`/${activeLocale}/admin/products/${product.id}/edit`}
                    >
                      Edit
                    </Link>
                  </Button>
                  <DeleteProductButton
                    productId={product.id}
                    productTitle={title}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalProducts > PRODUCTS_PER_PAGE && (
        <nav className="mt-6 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-widest">
          <Button
            asChild
            variant="outline"
            className={`rounded-none border-black uppercase tracking-widest font-bold text-xs ${
              currentPage <= 1 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Link
              href={`/${activeLocale}/admin/products?page=${Math.max(currentPage - 1, 1)}`}
              aria-disabled={currentPage <= 1}
            >
              Previous
            </Link>
          </Button>
          <span className="text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            className={`rounded-none border-black uppercase tracking-widest font-bold text-xs ${
              currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Link
              href={`/${activeLocale}/admin/products?page=${Math.min(currentPage + 1, totalPages)}`}
              aria-disabled={currentPage >= totalPages}
            >
              Next
            </Link>
          </Button>
        </nav>
      )}
    </main>
  );
}
