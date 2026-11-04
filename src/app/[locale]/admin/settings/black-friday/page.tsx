import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { BlackFridaySettings } from "@/components/settings/BlackFridaySettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { isAdminUser } from "@/lib/admin-auth";
import { getBlackFridaySettings } from "@/lib/black-friday/settings";

export const metadata: Metadata = {
  title: "Black Friday Settings",
};

type BlackFridaySettingsPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export default async function BlackFridaySettingsPage({
  params,
}: BlackFridaySettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  const settings = await getBlackFridaySettings();

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <SettingsPageHeader
        activeLocale={activeLocale}
        title="Black Friday"
        description="Full-screen countdown and sale takeover"
      />
      <BlackFridaySettings settings={settings} />
    </main>
  );
}
