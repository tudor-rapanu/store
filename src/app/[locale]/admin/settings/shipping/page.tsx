import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ShippingProfilesSettings } from "@/components/settings/ShippingProfilesSettings";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { getCurrencySettings } from "@/lib/currency/settings";
import { getShippingProfiles } from "@/lib/shipping/profiles";

export const metadata: Metadata = {
  title: "Shipping Settings",
};

type ShippingSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ShippingSettingsPage({
  params,
}: ShippingSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const [shippingProfiles, currencySettings] = await Promise.all([
    getShippingProfiles(),
    getCurrencySettings(),
  ]);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <SettingsHeader
        activeLocale={activeLocale}
        title="Shipping & Currency"
        description="Local, international, and currency conversion settings"
      />
      <ShippingProfilesSettings
        profiles={shippingProfiles}
        currencySettings={currencySettings}
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
