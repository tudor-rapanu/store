import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { productCategories } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update categories.", 403);
  }

  const { id, productId } = await params;

  await db
    .delete(productCategories)
    .where(
      and(
        eq(productCategories.categoryId, id),
        eq(productCategories.productId, productId),
      ),
    );

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
