import Link from "next/link";
import Image from "next/image";
import { count, desc, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteProductButton } from "@/components/product/DeleteProductButton";
import { DuplicateProductButton } from "@/components/product/DuplicateProductButton";
import { ImportProductsCsv } from "@/components/product/ImportProductsCsv";
import { ImportProductsWooCommerce } from "@/components/product/ImportProductsWooCommerce";
import { StatusBadge } from "@/components/order/StatusBadge";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  getInventorySummaryForProducts,
  getInventorySummaryKey,
} from "@/lib/admin/inventory-summary";
import { isWooCommerceMigrationEnabled } from "@/lib/admin/woocommerce-migration-access";
import { requireAdminPage } from "@/lib/admin-page-auth";
import { formatFulfillmentDate } from "@/lib/fulfillment/estimate";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductImageSrc } from "@/lib/product-images";
import { getProductPricePresentation } from "@/lib/product-pricing";

export const metadata: Metadata = {
  title: "Admin Products",
};

type AdminProductsPageProps = Readonly<{
  params: Promise<
    Readonly<{
      locale: string;
    }>
  >;
  searchParams: Promise<
    Readonly<{
      page?: string;
      pageSize?: string;
      q?: string;
    }>
  >;
}>;

const DEFAULT_PRODUCTS_PER_PAGE = 10;
const PRODUCT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default async function AdminProductsPage({
  params,
  searchParams,
}: AdminProductsPageProps) {
  const { locale } = await params;
  const {
    page: pageParam,
    pageSize: pageSizeParam,
    q: queryParam,
  } = await searchParams;
  const activeLocale = await requireAdminPage(locale);
  const searchQuery = queryParam?.trim() ?? "";
  const requestedPageSize =
    Number.parseInt(pageSizeParam ?? String(DEFAULT_PRODUCTS_PER_PAGE), 10) ||
    DEFAULT_PRODUCTS_PER_PAGE;
  const productsPerPage = PRODUCT_PAGE_SIZE_OPTIONS.includes(
    requestedPageSize as (typeof PRODUCT_PAGE_SIZE_OPTIONS)[number],
  )
    ? requestedPageSize
    : DEFAULT_PRODUCTS_PER_PAGE;
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
  const totalPages = Math.max(Math.ceil(totalProducts / productsPerPage), 1);
  const requestedPage = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * productsPerPage;
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
    trackStock: products.trackStock,
    stock: products.stock,
    isPrivate: products.isPrivate,
    createdAt: products.createdAt,
  };
  const items = searchWhere
    ? await db
        .select(productSelect)
        .from(products)
        .where(searchWhere)
        .orderBy(desc(products.createdAt))
        .limit(productsPerPage)
        .offset(offset)
    : await db
        .select(productSelect)
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(productsPerPage)
        .offset(offset);
  const productIds = items.map((product) => product.id);
  const variantInventoryRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productVariants.productId,
            id: productVariants.id,
            trackStock: productVariants.trackStock,
            stock: productVariants.stock,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, productIds))
      : [];
  const inventorySummaryByKey = await getInventorySummaryForProducts(productIds);
  const variantInventoryByProductId = new Map<string, typeof variantInventoryRows>();

  variantInventoryRows.forEach((variant) => {
    const current = variantInventoryByProductId.get(variant.productId) ?? [];
    current.push(variant);
    variantInventoryByProductId.set(variant.productId, current);
  });
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(productsPerPage));

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
      {isWooCommerceMigrationEnabled() && <ImportProductsWooCommerce />}

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
        <input type="hidden" name="pageSize" value={productsPerPage} />
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

      <form
        action={`/${activeLocale}/admin/products`}
        className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-slate-500"
      >
        <span>
          Showing {items.length} of {totalProducts} products
        </span>
        <div className="flex items-center gap-2">
          <input type="hidden" name="page" value="1" />
          {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
          <label htmlFor="products-page-size">Items</label>
          <select
            id="products-page-size"
            name="pageSize"
            defaultValue={productsPerPage}
            className="h-10 rounded-none border border-black bg-white px-3 text-sm text-black"
            aria-label="Products per page"
          >
            {PRODUCT_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            Apply
          </Button>
        </div>
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
            const variantInventory = variantInventoryByProductId.get(product.id) ?? [];
            const inventoryBadges = getProductInventoryBadges({
              product,
              variants: variantInventory,
              inventorySummaryByKey,
            });

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
                      {inventoryBadges.map((badge) => (
                        <StatusBadge key={badge} value={badge} className="px-2 py-1" />
                      ))}
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

      {totalProducts > productsPerPage && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          hrefForPage={pageHref}
        />
      )}
    </main>
  );
}

type ProductInventoryBadgeInput = {
  product: {
    id: string;
    trackStock: boolean;
    stock: number;
  };
  variants: Array<{
    productId: string;
    id: string;
    trackStock: boolean;
    stock: number;
  }>;
  inventorySummaryByKey: Awaited<ReturnType<typeof getInventorySummaryForProducts>>;
};

function getProductInventoryBadges({
  product,
  variants,
  inventorySummaryByKey,
}: ProductInventoryBadgeInput) {
  const trackedVariants = variants.filter((variant) => variant.trackStock);

  if (trackedVariants.length > 0) {
    const available = trackedVariants.reduce((sum, variant) => sum + variant.stock, 0);
    const reserved = trackedVariants.reduce(
      (sum, variant) =>
        sum +
        (inventorySummaryByKey.get(getInventorySummaryKey(product.id, variant.id))
          ?.reserved ?? 0),
      0,
    );

    return getInventoryBadgeLabels({ available, reserved, scope: "variants" });
  }

  if (!product.trackStock) {
    return [];
  }

  const summary = inventorySummaryByKey.get(getInventorySummaryKey(product.id));

  return getInventoryBadgeLabels({
    available: product.stock,
    reserved: summary?.reserved ?? 0,
    scope: "product",
  });
}

function getInventoryBadgeLabels({
  available,
  reserved,
  scope,
}: {
  available: number;
  reserved: number;
  scope: "product" | "variants";
}) {
  const labels = [`${available} available ${scope}`];

  if (reserved > 0) {
    labels.push(`${reserved} reserved`);
  }

  if (available <= 0) {
    labels.push("out of stock");
  } else if (available <= 3) {
    labels.push("low stock");
  }

  return labels;
}
