import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { SizeGuidesSettings } from "@/components/settings/SizeGuidesSettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sizeGuides } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Size Guide Settings",
};

type SizeGuideSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SizeGuideSettingsPage({
  params,
}: SizeGuideSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const guides = await db.select().from(sizeGuides).orderBy(asc(sizeGuides.createdAt));

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
        activeLocale={activeLocale}
        title="Size Guides"
        description="Reusable apparel size charts"
      />
      <SizeGuidesSettings sizeGuides={guides} />
    </main>
  );
}
