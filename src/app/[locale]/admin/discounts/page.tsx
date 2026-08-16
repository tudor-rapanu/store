import Link from "next/link";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminDiscountManager } from "@/components/discounts/AdminDiscountManager";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { getCategoryOptions } from "@/lib/categories";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { getDiscountAdminOptions } from "@/lib/discounts";
import { getTranslatedText } from "@/lib/i18n/text";

export const metadata: Metadata = {
  title: "Admin Discounts",
};

type AdminDiscountsPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

function toIsoString(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default async function AdminDiscountsPage({ params }: AdminDiscountsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Discounts</h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Automatic discounts and voucher codes
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/admin/orders`}>Back to Orders</Link>
        </Button>
      </div>

      <Suspense fallback={<DiscountsSkeleton />}>
        <DiscountsPanel activeLocale={activeLocale} />
      </Suspense>
    </main>
  );
}

async function loadDiscountsPanelData() {
  const [discountRows, options] = await withDiscountsTimeout(
    Promise.all([
      db.select().from(discounts).orderBy(desc(discounts.createdAt)),
      getDiscountAdminOptions(),
    ]),
  );

  return { discountRows, options };
}

async function DiscountsPanel({ activeLocale }: { activeLocale: "en" | "ro" }) {
  const result = await loadDiscountsPanelData().catch((error: unknown) => ({
    error,
  }));

  if ("error" in result) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : "Discounts could not be loaded.";

    return (
      <section className="space-y-3 border border-red-300 bg-red-50 p-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-red-950">
          Discounts could not load
        </h2>
        <p className="text-sm font-medium text-red-900">
          The admin discounts data took too long to respond.
        </p>
        <p className="text-xs font-bold uppercase tracking-wider text-red-700">
          {message}
        </p>
      </section>
    );
  }

  const { discountRows, options } = result;

  return (
    <AdminDiscountManager
      discounts={discountRows.map((discount) => ({
        id: discount.id,
        name: discount.name,
        code: discount.code,
        kind: discount.kind,
        type: discount.type,
        scope: discount.scope,
        value: discount.value,
        enabled: discount.enabled,
        expiresAt: toIsoString(discount.expiresAt),
        productId: discount.productId,
        categoryId: discount.categoryId,
      }))}
      products={options.products.map((product) => ({
        id: product.id,
        label: getTranslatedText(product.title, activeLocale, product.id),
      }))}
      categories={getCategoryOptions(options.categories, activeLocale).map(
        (category) => ({
          id: category.id,
          label: category.name,
        }),
      )}
    />
  );
}

function withDiscountsTimeout<T>(promise: Promise<T>, timeoutMs = 8000) {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Discounts timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

function DiscountsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-4 border border-black p-4">
        <div className="h-4 w-40 animate-pulse bg-slate-100" />
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="space-y-2">
            <div className="h-3 w-24 animate-pulse bg-slate-100" />
            <div className="h-12 animate-pulse border border-slate-200 bg-slate-50" />
          </div>
        ))}
      </section>
      <section className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="grid gap-4 border border-black p-4 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="space-y-3">
              <div className="h-4 w-48 animate-pulse bg-slate-100" />
              <div className="h-4 w-64 animate-pulse bg-slate-100" />
              <div className="h-4 w-56 animate-pulse bg-slate-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-24 animate-pulse bg-slate-100" />
              <div className="h-10 w-20 animate-pulse bg-slate-100" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
