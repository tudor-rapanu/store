import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ShippingProfilesSettings } from "@/components/settings/ShippingProfilesSettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
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
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
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
