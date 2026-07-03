import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("Unauthorized.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
  };

  if (typeof body.enabled !== "boolean") {
    return errorResponse("Enabled state is required.");
  }

  const [updated] = await db
    .update(discounts)
    .set({ enabled: body.enabled, updatedAt: new Date() })
    .where(eq(discounts.id, id))
    .returning();

  if (!updated) {
    return errorResponse("Discount not found.", 404);
  }

  return NextResponse.json({ ok: true, discount: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("Unauthorized.", 403);
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(discounts)
    .where(eq(discounts.id, id))
    .returning();

  if (!deleted) {
    return errorResponse("Discount not found.", 404);
  }

  return NextResponse.json({ ok: true });
}
