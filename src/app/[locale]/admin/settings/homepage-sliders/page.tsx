import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { HomepageSlidersSettings } from "@/components/settings/HomepageSlidersSettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
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
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
        activeLocale={activeLocale}
        title="Homepage Sliders"
        description="Category product sliders displayed on the homepage"
      />
      <HomepageSlidersSettings
        categories={getCategoryOptions(categoryRows, activeLocale).map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        sections={homepageSettings.categorySections}
        productsPerSlider={homepageSettings.productsPerSlider}
      />
    </main>
  );
}
