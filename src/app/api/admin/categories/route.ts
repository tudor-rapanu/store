import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to create categories.", 403);
  }

  const body = (await request.json()) as {
    nameEn?: string;
    nameRo?: string;
    slug?: string;
  };
  const nameEn = body.nameEn?.trim();
  const nameRo = body.nameRo?.trim() || nameEn;
  const slug = slugify(body.slug || nameEn || "");

  if (!nameEn || !slug) {
    return errorResponse("Category name and slug are required.");
  }

  const [existingCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existingCategory) {
    return errorResponse("A category with this slug already exists.", 409);
  }

  await db.insert(categories).values({
    slug,
    name: { en: nameEn, ro: nameRo ?? nameEn },
  });

  revalidateCatalogViews({ categorySlugs: [slug] });

  return NextResponse.json({ ok: true });
}
