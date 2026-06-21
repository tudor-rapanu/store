import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
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
  const body = (await request.json()) as { productId?: string };
  const productId = body.productId?.trim();

  if (!productId) {
    return errorResponse("Product is required.");
  }

  const [existingLink] = await db
    .select()
    .from(productCategories)
    .where(
      and(
        eq(productCategories.categoryId, id),
        eq(productCategories.productId, productId),
      ),
    )
    .limit(1);

  if (!existingLink) {
    await db.insert(productCategories).values({
      categoryId: id,
      productId,
    });
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
