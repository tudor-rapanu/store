import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogCache } from "@/lib/catalog/cache";
import {
  getHomepageSettings,
  normalizeContentSections,
  updateHomepageSettings,
} from "@/lib/homepage/settings";

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    contentSections?: unknown;
  };
  const currentSettings = await getHomepageSettings();
  const settings = await updateHomepageSettings({
    ...currentSettings,
    contentSections: normalizeContentSections(body.contentSections),
  });

  revalidateCatalogCache();
  revalidatePath("/en");
  revalidatePath("/ro");

  return NextResponse.json({ ok: true, settings });
}
