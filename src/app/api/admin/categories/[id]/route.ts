import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update categories.", 403);
  }

  const { id } = await params;
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

  const [updatedCategory] = await db
    .update(categories)
    .set({
      slug,
      name: { en: nameEn, ro: nameRo ?? nameEn },
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();

  if (!updatedCategory) {
    return errorResponse("Category was not found.", 404);
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to delete categories.", 403);
  }

  const { id } = await params;
  const [deletedCategory] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning();

  if (!deletedCategory) {
    return errorResponse("Category was not found.", 404);
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
