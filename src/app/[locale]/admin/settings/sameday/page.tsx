import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { SamedayLocationSync } from "@/components/settings/SamedayLocationSync";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { samedayCounties } from "@/lib/db/schema";
import { getSamedayLocationSummary } from "@/lib/shipping/sameday-location-summary";

export const metadata: Metadata = {
  title: "Sameday Settings",
};

type SamedaySettingsPageProps = {
  params: Promise<{ locale: string }>;
};

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
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            Sameday Settings
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Location cache and sync tools
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/admin/settings`}>
            Back to Settings
          </Link>
        </Button>
      </div>

      <SamedayLocationSync
        countyCount={summary.countyCount || counties.length}
        cityCount={summary.cityCount}
        counties={counties}
      />
    </main>
  );
}
