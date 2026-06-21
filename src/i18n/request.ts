import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

const locales = ["en", "ro"] as const;
const defaultLocale = "en";

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const resolvedLocale = locale ?? (await requestLocale) ?? defaultLocale;

  if (!locales.includes(resolvedLocale as (typeof locales)[number])) {
    notFound();
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  };
});
