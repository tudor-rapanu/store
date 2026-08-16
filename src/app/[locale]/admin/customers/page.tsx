import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ImportCustomersWooCommerce } from "@/components/customer/ImportCustomersWooCommerce";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { isWooCommerceMigrationEnabled } from "@/lib/admin/woocommerce-migration-access";

export const metadata: Metadata = {
  title: "Admin Customers",
};

type AdminCustomersPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export default async function AdminCustomersPage({ params }: AdminCustomersPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  if (!isWooCommerceMigrationEnabled()) {
    redirect(`/${activeLocale}/admin/orders`);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Customers</h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Account &amp; order migration
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

      <ImportCustomersWooCommerce />
    </main>
  );
}
