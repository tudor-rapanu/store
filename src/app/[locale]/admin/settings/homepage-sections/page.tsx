import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";

import { HomepageSectionsSettings } from "@/components/settings/HomepageSectionsSettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getHomepageSettings } from "@/lib/homepage/settings";
import { getTranslatedText } from "@/lib/i18n/text";

export const metadata: Metadata = {
  title: "Homepage Section Settings",
};

type HomepageSectionsSettingsPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

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
        imageUrl: products.imageUrl,
        isPrivate: products.isPrivate,
      })
      .from(products)
      .orderBy(desc(products.createdAt)),
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
        activeLocale={activeLocale}
        title="Homepage Sections"
        description="Banners, featured products, and custom homepage blocks"
      />
      <HomepageSectionsSettings
        sections={homepageSettings.contentSections}
        products={productRows.map((product) => ({
          id: product.id,
          title: getTranslatedText(product.title, activeLocale, product.slug),
          slug: product.slug,
          imageUrl: product.imageUrl,
          isPrivate: product.isPrivate,
        }))}
      />
    </main>
  );
}
