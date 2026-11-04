import { notFound } from "next/navigation";
import { BlackFridayTakeover } from "@/components/layout/BlackFridayTakeover";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { getCachedBlackFridaySettings } from "@/lib/black-friday/settings";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!["en", "ro"].includes(locale)) {
    notFound();
  }

  // 1. Fetch messages specifically for this locale
  const [messages, blackFridaySettings] = await Promise.all([
    getMessages({ locale }),
    getCachedBlackFridaySettings(),
  ]);

  return (
    // 2. Wrap your layout in the provider so Client Components can access 't()'
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Navbar locale={locale as "en" | "ro"} />
      <div className="min-h-[calc(100vh-10rem)]">{children}</div>
      <Footer locale={locale as "en" | "ro"} />
      <CookieConsentBanner locale={locale as "en" | "ro"} />
      {blackFridaySettings.enabled && (
        <BlackFridayTakeover
          locale={locale as "en" | "ro"}
          settings={blackFridaySettings}
        />
      )}
    </NextIntlClientProvider>
  );
}
