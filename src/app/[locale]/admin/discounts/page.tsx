import Link from "next/link";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminDiscountManager } from "@/components/discounts/AdminDiscountManager";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { getDiscountAdminOptions } from "@/lib/discounts";
import { getTranslatedText } from "@/lib/i18n/text";

export const metadata: Metadata = {
  title: "Admin Discounts",
};

type AdminDiscountsPageProps = {
  params: Promise<{ locale: string }>;
};

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

export default async function AdminDiscountsPage({
  params,
}: AdminDiscountsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [discountRows, options] = await Promise.all([
    db.select().from(discounts).orderBy(desc(discounts.createdAt)),
    getDiscountAdminOptions(),
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            Discounts
          </h1>
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
        categories={options.categories.map((category) => ({
          id: category.id,
          label: getTranslatedText(category.name, activeLocale, category.id),
        }))}
      />
    </main>
  );
}
