import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { HomepageSlidersSettings } from "@/components/settings/HomepageSlidersSettings";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { getCategoryOptions } from "@/lib/categories";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getHomepageSettings } from "@/lib/homepage/settings";

export const metadata: Metadata = {
  title: "Homepage Slider Settings",
};

type HomepageSlidersSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomepageSlidersSettingsPage({
  params,
}: HomepageSlidersSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [homepageSettings, categoryRows] = await Promise.all([
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
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <SettingsHeader
        activeLocale={activeLocale}
        title="Homepage Sliders"
        description="Category product sliders displayed on the homepage"
      />
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
        <h1 className="text-4xl font-black uppercase tracking-tighter">
          {title}
        </h1>
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
