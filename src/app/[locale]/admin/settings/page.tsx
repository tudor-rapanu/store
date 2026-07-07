import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc, count } from "drizzle-orm";

import { HomepageSlidersSettings } from "@/components/settings/HomepageSlidersSettings";
import { SamedayLocationSync } from "@/components/settings/SamedayLocationSync";
import { ShippingProfilesSettings } from "@/components/settings/ShippingProfilesSettings";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { getCategoryOptions } from "@/lib/categories";
import { getCurrencySettings } from "@/lib/currency/settings";
import { db } from "@/lib/db";
import { categories, samedayCities, samedayCounties } from "@/lib/db/schema";
import { getHomepageSettings } from "@/lib/homepage/settings";
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
        <Suspense fallback={<SettingsPanelSkeleton />}>
          <HomepageSlidersPanel activeLocale={activeLocale} />
        </Suspense>
        <Suspense fallback={<SettingsPanelSkeleton />}>
          <ShippingProfilesPanel />
        </Suspense>
        <Suspense fallback={<SettingsPanelSkeleton />}>
          <SamedaySyncPanel />
        </Suspense>
      </div>
    </main>
  );
}

async function HomepageSlidersPanel({
  activeLocale,
}: {
  activeLocale: "en" | "ro";
}) {
  try {
    const [homepageSettings, categoryRows] = await withSettingsTimeout(
      Promise.all([
        getHomepageSettings(),
        db
          .select({
            id: categories.id,
            parentId: categories.parentId,
            slug: categories.slug,
            name: categories.name,
            createdAt: categories.createdAt,
            updatedAt: categories.updatedAt,
          })
          .from(categories),
      ]),
      "Homepage slider settings",
    );

    return (
      <HomepageSlidersSettings
        categories={getCategoryOptions(categoryRows, activeLocale).map(
          (category) => ({
            id: category.id,
            label: category.name,
          }),
        )}
        sections={homepageSettings.categorySections}
        productsPerSlider={homepageSettings.productsPerSlider}
      />
    );
  } catch (error) {
    return (
      <SettingsPanelError
        title="Homepage sliders"
        error={error}
        description="The homepage slider settings could not be loaded right now."
      />
    );
  }
}

async function ShippingProfilesPanel() {
  try {
    const [shippingProfiles, currencySettings] = await withSettingsTimeout(
      Promise.all([getShippingProfiles(), getCurrencySettings()]),
      "Shipping profile settings",
    );

    return (
      <ShippingProfilesSettings
        profiles={shippingProfiles}
        currencySettings={currencySettings}
      />
    );
  } catch (error) {
    return (
      <SettingsPanelError
        title="Shipping profiles"
        error={error}
        description="The shipping and currency settings could not be loaded right now."
      />
    );
  }
}

async function SamedaySyncPanel() {
  try {
    const [counties, cityCountResult] = await withSettingsTimeout(
      Promise.all([
        db
          .select({ id: samedayCounties.id, name: samedayCounties.name })
          .from(samedayCounties)
          .orderBy(asc(samedayCounties.name)),
        db.select({ value: count() }).from(samedayCities),
      ]),
      "Sameday location settings",
    );
    const cityCount = cityCountResult[0]?.value ?? 0;

    return (
      <SamedayLocationSync
        countyCount={counties.length}
        cityCount={cityCount}
        counties={counties}
      />
    );
  } catch (error) {
    return (
      <SettingsPanelError
        title="Sameday locations"
        error={error}
        description="The Sameday location counts could not be loaded right now."
      />
    );
  }
}

function withSettingsTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 8000,
) {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

function SettingsPanelSkeleton() {
  return (
    <section className="space-y-5 border border-black p-4">
      <div className="space-y-2">
        <div className="h-4 w-48 animate-pulse bg-slate-100" />
        <div className="h-4 w-full max-w-md animate-pulse bg-slate-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-16 animate-pulse border border-slate-200 bg-slate-50" />
        <div className="h-16 animate-pulse border border-slate-200 bg-slate-50" />
      </div>
      <div className="h-11 w-44 animate-pulse bg-slate-100" />
    </section>
  );
}

function SettingsPanelError({
  title,
  description,
  error,
}: {
  title: string;
  description: string;
  error: unknown;
}) {
  const message = error instanceof Error ? error.message : description;

  return (
    <section className="space-y-3 border border-red-300 bg-red-50 p-4">
      <h2 className="text-sm font-black uppercase tracking-widest text-red-950">
        {title}
      </h2>
      <p className="text-sm font-medium text-red-900">{description}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-red-700">
        {message}
      </p>
    </section>
  );
}
