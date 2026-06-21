import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

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
  const messages = await getMessages({ locale });

  return (
    // 2. Wrap your layout in the provider so Client Components can access 't()'
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Navbar locale={locale as "en" | "ro"} />
      <div className="min-h-[calc(100vh-10rem)]">{children}</div>
      <Footer locale={locale as "en" | "ro"} />
    </NextIntlClientProvider>
  );
}
