import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { SizeGuidesSettings } from "@/components/settings/SizeGuidesSettings";
import { Button } from "@/components/ui/button";
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
      <SettingsHeader
        activeLocale={activeLocale}
        title="Size Guides"
        description="Reusable apparel size charts"
      />
      <SizeGuidesSettings sizeGuides={guides} />
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
