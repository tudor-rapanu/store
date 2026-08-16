import "server-only";

import { redirect } from "next/navigation";

import { isAdminUser } from "@/lib/admin-auth";

export type StoreLocale = "en" | "ro";

export async function requireAdminPage(locale: string): Promise<StoreLocale> {
  const activeLocale: StoreLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  return activeLocale;
}
