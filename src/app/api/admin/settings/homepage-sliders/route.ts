import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogCache } from "@/lib/catalog/cache";
import { updateHomepageSettings } from "@/lib/homepage/settings";

type HomepageSliderPayload = {
  categorySections?: Array<{
    categoryId?: unknown;
    enabled?: unknown;
  }>;
  productsPerSlider?: unknown;
};

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as HomepageSliderPayload;
  const categorySections = Array.isArray(body.categorySections)
    ? body.categorySections
        .map((section) => ({
          categoryId:
            typeof section.categoryId === "string"
              ? section.categoryId.trim()
              : "",
          enabled: section.enabled !== false,
        }))
        .filter((section) => section.categoryId)
    : [];
  const productsPerSlider = Number(body.productsPerSlider);
  const settings = await updateHomepageSettings({
    categorySections,
    productsPerSlider,
  });

  revalidateCatalogCache();
  revalidatePath("/en");
  revalidatePath("/ro");

  return NextResponse.json({ ok: true, settings });
}
