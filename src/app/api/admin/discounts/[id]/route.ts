import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  discounts,
  type DiscountKind,
  type DiscountScope,
  type DiscountType,
} from "@/lib/db/schema";
import { revalidateDiscountCache } from "@/lib/discounts";

const kinds = new Set<DiscountKind>(["automatic", "voucher"]);
const types = new Set<DiscountType>(["percentage", "fixed"]);
const scopes = new Set<DiscountScope>(["storewide", "category", "product"]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readDate(value: unknown) {
  const raw = readString(value);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid expiration date.");
  }

  return date;
}

function readValue(value: unknown, type: DiscountType) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Discount value is invalid.");
  }

  if (type === "percentage") {
    if (number > 100) {
      throw new Error("Percentage discounts cannot exceed 100%.");
    }

    return Math.round(number);
  }

  return Math.round(number);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("Unauthorized.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  try {
    const isEnableOnlyUpdate =
      Object.keys(body).length === 1 && typeof body.enabled === "boolean";

    const values = isEnableOnlyUpdate
      ? {
          enabled: body.enabled as boolean,
          updatedAt: new Date(),
        }
      : getDiscountUpdateValues(body);

    const [updated] = await db
      .update(discounts)
      .set(values)
      .where(eq(discounts.id, id))
      .returning();

    if (!updated) {
      return errorResponse("Discount not found.", 404);
    }

    revalidateDiscountCache();

    return NextResponse.json({ ok: true, discount: updated });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Could not update discount.",
    );
  }
}

function getDiscountUpdateValues(body: Record<string, unknown>) {
  const kind = readString(body.kind) as DiscountKind;
  const type = readString(body.type) as DiscountType;
  const scope = readString(body.scope) as DiscountScope;

  if (!kinds.has(kind) || !types.has(type) || !scopes.has(scope)) {
    throw new Error("Discount configuration is invalid.");
  }

  const code = kind === "voucher" ? readString(body.code).toUpperCase() : null;

  if (kind === "voucher" && !code) {
    throw new Error("Voucher code is required.");
  }

  return {
    name: readString(body.name, "Discount"),
    code,
    kind,
    type,
    scope,
    value: readValue(body.value, type),
    enabled: body.enabled !== false,
    expiresAt: readDate(body.expiresAt),
    productId: scope === "product" ? readString(body.productId) || null : null,
    categoryId:
      scope === "category" ? readString(body.categoryId) || null : null,
    updatedAt: new Date(),
  };
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

  revalidateDiscountCache();

  return NextResponse.json({ ok: true });
}
