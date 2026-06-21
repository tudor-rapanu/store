import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

// Declare locales explicitly as an array of strings
const locales: string[] = ["en", "ro"];

export default getRequestConfig(async ({ locale }) => {
  // Ensure locale is defined and valid before using it.
  if (!locale || !locales.includes(locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
