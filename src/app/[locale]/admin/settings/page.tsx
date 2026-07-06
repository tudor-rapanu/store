import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc, count } from "drizzle-orm";

import { HomepageSlidersSettings } from "@/components/settings/HomepageSlidersSettings";
import { SamedayLocationSync } from "@/components/settings/SamedayLocationSync";
import { ShippingProfilesSettings } from "@/components/settings/ShippingProfilesSettings";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { getCurrencySettings } from "@/lib/currency/settings";
import { db } from "@/lib/db";
import { categories, samedayCities, samedayCounties } from "@/lib/db/schema";
import { getHomepageSettings } from "@/lib/homepage/settings";
import { getTranslatedText } from "@/lib/i18n/text";
import { getShippingProfiles } from "@/lib/shipping/profiles";

export const metadata: Metadata = {
  title: "Admin Settings",
};

type AdminSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSettingsPage({
  params,
}: AdminSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [
    counties,
    cityCountResult,
    shippingProfiles,
    currencySettings,
    homepageSettings,
    categoryRows,
  ] = await Promise.all([
    db
      .select({ id: samedayCounties.id, name: samedayCounties.name })
      .from(samedayCounties)
      .orderBy(asc(samedayCounties.name)),
    db.select({ value: count() }).from(samedayCities),
    getShippingProfiles(),
    getCurrencySettings(),
    getHomepageSettings(),
    db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories),
  ]);

  const cityCount = cityCountResult[0]?.value ?? 0;

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            Settings
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Admin configuration
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

      <div className="space-y-6">
        <HomepageSlidersSettings
          categories={categoryRows.map((category) => ({
            id: category.id,
            label: getTranslatedText(category.name, activeLocale, category.id),
          }))}
          sections={homepageSettings.categorySections}
          productsPerSlider={homepageSettings.productsPerSlider}
        />
        <ShippingProfilesSettings
          profiles={shippingProfiles}
          currencySettings={currencySettings}
        />
        <SamedayLocationSync
          countyCount={counties.length}
          cityCount={cityCount}
          counties={counties}
        />
      </div>
    </main>
  );
}
