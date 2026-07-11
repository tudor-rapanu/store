import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { revalidateDiscountCache } from "@/lib/discounts";
import {
  discounts,
  type DiscountKind,
  type DiscountScope,
  type DiscountType,
} from "@/lib/db/schema";

const kinds = new Set<DiscountKind>(["automatic", "voucher"]);
const types = new Set<DiscountType>(["percentage", "fixed"]);
const scopes = new Set<DiscountScope>(["storewide", "category", "product"]);

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

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = readString(body.kind) as DiscountKind;
    const type = readString(body.type) as DiscountType;
    const scope = readString(body.scope) as DiscountScope;

    if (!kinds.has(kind) || !types.has(type) || !scopes.has(scope)) {
      throw new Error("Discount configuration is invalid.");
    }

    const code =
      kind === "voucher" ? readString(body.code).toUpperCase() : null;

    if (kind === "voucher" && !code) {
      throw new Error("Voucher code is required.");
    }

    const [created] = await db
      .insert(discounts)
      .values({
        name: readString(body.name, "Discount"),
        code,
        kind,
        type,
        scope,
        value: readValue(body.value, type),
        enabled: body.enabled !== false,
        expiresAt: readDate(body.expiresAt),
        productId:
          scope === "product" ? readString(body.productId) || null : null,
        categoryId:
          scope === "category" ? readString(body.categoryId) || null : null,
        updatedAt: new Date(),
      })
      .returning();

    revalidateDiscountCache();

    return NextResponse.json({ ok: true, discount: created });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create discount.",
      },
      { status: 400 },
    );
  }
}
