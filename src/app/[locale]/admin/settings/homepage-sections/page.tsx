import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";

import { HomepageSectionsSettings } from "@/components/settings/HomepageSectionsSettings";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getHomepageSettings } from "@/lib/homepage/settings";
import { getTranslatedText } from "@/lib/i18n/text";

export const metadata: Metadata = {
  title: "Homepage Section Settings",
};

type HomepageSectionsSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomepageSectionsSettingsPage({
  params,
}: HomepageSectionsSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [homepageSettings, productRows] = await Promise.all([
    getHomepageSettings(),
    db
      .select({
        id: products.id,
        title: products.title,
        slug: products.slug,
      })
      .from(products)
      .orderBy(desc(products.createdAt))
      .limit(100),
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsHeader
        activeLocale={activeLocale}
        title="Homepage Sections"
        description="Banners, featured products, and custom homepage blocks"
      />
      <HomepageSectionsSettings
        sections={homepageSettings.contentSections}
        products={productRows.map((product) => ({
          id: product.id,
          title: getTranslatedText(product.title, activeLocale, product.slug),
        }))}
      />
    </main>
  );
}

function SettingsHeader({
  activeLocale,
  title,
  description,
}: {
  activeLocale: "en" | "ro";
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter">{title}</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {description}
        </p>
      </div>
      <Button
        asChild
        variant="outline"
        className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
      >
        <Link href={`/${activeLocale}/admin/settings`}>Back to Settings</Link>
      </Button>
    </div>
  );
}
