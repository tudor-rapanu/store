import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { productCategories } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update categories.", 403);
  }

  const { id } = await params;
  const body = (await request.json()) as { productIds?: string[] };
  const productIds = [...new Set(body.productIds ?? [])].filter(Boolean);

  if (productIds.length === 0) {
    return errorResponse("At least one product is required.");
  }

  await db
    .insert(productCategories)
    .values(productIds.map((productId) => ({ categoryId: id, productId })))
    .onConflictDoNothing();

  revalidateCatalogViews();

  return NextResponse.json({ ok: true });
}
