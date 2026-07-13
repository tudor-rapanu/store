import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { SamedayLocationSync } from "@/components/settings/SamedayLocationSync";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { samedayCounties } from "@/lib/db/schema";
import { getSamedayLocationSummary } from "@/lib/shipping/sameday-location-summary";

export const metadata: Metadata = {
  title: "Sameday Settings",
};

type SamedaySettingsPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export default async function SamedaySettingsPage({
  params,
}: SamedaySettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [counties, summary] = await Promise.all([
    db
      .select({ id: samedayCounties.id, name: samedayCounties.name })
      .from(samedayCounties)
      .orderBy(asc(samedayCounties.name)),
    getSamedayLocationSummary(),
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
        activeLocale={activeLocale}
        title="Sameday Settings"
        description="Location cache and sync tools"
      />

      <SamedayLocationSync
        countyCount={summary.countyCount || counties.length}
        cityCount={summary.cityCount}
        counties={counties}
      />
    </main>
  );
}
