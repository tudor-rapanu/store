import Link from "next/link";
import Image from "next/image";
import { count, desc, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteProductButton } from "@/components/product/DeleteProductButton";
import { DuplicateProductButton } from "@/components/product/DuplicateProductButton";
import { ImportProductsCsv } from "@/components/product/ImportProductsCsv";
import { StatusBadge } from "@/components/order/StatusBadge";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatFulfillmentDate } from "@/lib/fulfillment/estimate";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductImageSrc } from "@/lib/product-images";
import { getProductPricePresentation } from "@/lib/product-pricing";

export const metadata: Metadata = {
  title: "Admin Products",
};

type AdminProductsPageProps = Readonly<{
  params: Promise<Readonly<{
    locale: string;
  }>>;
  searchParams: Promise<Readonly<{
    page?: string;
    q?: string;
  }>>;
}>;

const PRODUCTS_PER_PAGE = 10;

export default async function AdminProductsPage({
  params,
  searchParams,
}: AdminProductsPageProps) {
  const { locale } = await params;
  const { page: pageParam, q: queryParam } = await searchParams;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const searchQuery = queryParam?.trim() ?? "";
  const searchPattern = `%${searchQuery}%`;
  const searchWhere = searchQuery
    ? sql`(
        ${products.slug} ilike ${searchPattern}
        or ${products.title}->>'en' ilike ${searchPattern}
        or ${products.title}->>'ro' ilike ${searchPattern}
      )`
    : undefined;
  const [totalResult] = searchWhere
    ? await db.select({ value: count() }).from(products).where(searchWhere)
    : await db.select({ value: count() }).from(products);
  const totalProducts = totalResult?.value ?? 0;
  const totalPages = Math.max(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), 1);
  const requestedPage = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const productSelect = {
    id: products.id,
    slug: products.slug,
    title: products.title,
    basePrice: products.basePrice,
    salePrice: products.salePrice,
    saleEnabled: products.saleEnabled,
    saleStartsAt: products.saleStartsAt,
    saleEndsAt: products.saleEndsAt,
    publishAt: products.publishAt,
    imageUrl: products.imageUrl,
    isPrivate: products.isPrivate,
    createdAt: products.createdAt,
  };
  const items = searchWhere
    ? await db
        .select(productSelect)
        .from(products)
        .where(searchWhere)
        .orderBy(desc(products.createdAt))
        .limit(PRODUCTS_PER_PAGE)
        .offset(offset)
    : await db
        .select(productSelect)
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(PRODUCTS_PER_PAGE)
        .offset(offset);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));

    if (searchQuery) {
      params.set("q", searchQuery);
    }

    return `/${activeLocale}/admin/products?${params.toString()}`;
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-8 flex items-end justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Products</h1>
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

      <ImportProductsCsv />

      <form
        action={`/${activeLocale}/admin/products`}
        className="mb-6 grid gap-3 border border-black p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
      >
        <Input
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search products by title or slug"
          className="h-12 rounded-none border-black text-sm"
        />
        {searchQuery && (
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <Link href={`/${activeLocale}/admin/products`}>Clear</Link>
          </Button>
        )}
        <Button
          type="submit"
          className="h-12 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
        >
          Search
        </Button>
      </form>

      <div className="divide-y divide-black border border-black">
        {items.length === 0 ? (
          <div className="p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            {searchQuery ? "No products matched your search." : "No products yet."}
          </div>
        ) : (
          items.map((product) => {
            const imageSrc = getProductImageSrc(product.imageUrl, "thumb");
            const title = getTranslatedText(product.title, activeLocale, product.slug);
            const price = getProductPricePresentation(product);
            const isScheduled = product.publishAt && product.publishAt > new Date();

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
                    <h2 className="font-black uppercase tracking-tight">{title}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {product.slug} / {(price.effectivePrice / 100).toFixed(2)} RON
                      {price.isOnSale ? " sale" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.isPrivate && (
                        <StatusBadge value="private" className="px-2 py-1" />
                      )}
                      {isScheduled && product.publishAt && (
                        <StatusBadge
                          value={`scheduled ${formatFulfillmentDate(product.publishAt, activeLocale)}`}
                          className="px-2 py-1"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-none border-black uppercase tracking-widest font-bold text-xs"
                  >
                    <Link href={`/${activeLocale}/products/${product.slug}`}>View</Link>
                  </Button>
                  <DuplicateProductButton
                    locale={activeLocale}
                    productId={product.id}
                  />
                  <Button
                    asChild
                    className="rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-bold text-xs"
                  >
                    <Link href={`/${activeLocale}/admin/products/${product.id}/edit`}>
                      Edit
                    </Link>
                  </Button>
                  <DeleteProductButton productId={product.id} productTitle={title} />
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
              href={pageHref(Math.max(currentPage - 1, 1))}
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
              href={pageHref(Math.min(currentPage + 1, totalPages))}
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
