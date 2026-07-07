import { inArray, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { revalidateCatalogViews } from "@/lib/catalog/cache";
import { db } from "@/lib/db";
import { sizeGuides, type SizeGuideRow } from "@/lib/db/schema";

type SizeGuideInput = {
  id?: string;
  slug?: string;
  title?: {
    en?: string;
    ro?: string;
  };
  description?: {
    en?: string;
    ro?: string;
  };
  imageUrl?: string;
  columns?: string[];
  rows?: SizeGuideRow[];
  enabled?: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function cleanString(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeSizeGuide(input: SizeGuideInput, index: number) {
  const titleEn = cleanString(input.title?.en, 120);
  const titleRo = cleanString(input.title?.ro, 120) || titleEn;
  const slug = slugify(input.slug || titleEn);
  const columns = Array.isArray(input.columns)
    ? input.columns
        .map((column) => cleanString(column, 24))
        .filter(Boolean)
        .slice(0, 16)
    : [];
  const rows = Array.isArray(input.rows)
    ? input.rows
        .map((row) => ({
          label: cleanString(row.label, 40),
          values: Array.isArray(row.values)
            ? row.values.map((value) => cleanString(value, 40)).slice(0, 16)
            : [],
        }))
        .filter((row) => row.label && row.values.some(Boolean))
        .slice(0, 16)
    : [];

  if (!titleEn || !slug) {
    throw new Error(`Size guide ${index + 1} needs an English title.`);
  }

  if (columns.length === 0) {
    throw new Error(`Size guide ${titleEn} needs at least one size column.`);
  }

  if (rows.length === 0) {
    throw new Error(`Size guide ${titleEn} needs at least one measurement row.`);
  }

  return {
    id:
      input.id && UUID_PATTERN.test(input.id)
        ? input.id
        : undefined,
    slug,
    title: {
      en: titleEn,
      ro: titleRo,
    },
    description: {
      en: cleanString(input.description?.en, 800),
      ro: cleanString(input.description?.ro, 800),
    },
    imageUrl: cleanString(input.imageUrl, 1000) || null,
    columns,
    rows,
    enabled: input.enabled !== false,
  };
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to update size guides.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    sizeGuides?: SizeGuideInput[];
  };

  if (!Array.isArray(body.sizeGuides)) {
    return errorResponse("Size guides payload is invalid.");
  }

  let normalizedGuides: ReturnType<typeof normalizeSizeGuide>[];

  try {
    normalizedGuides = body.sizeGuides
      .slice(0, 30)
      .map((guide, index) => normalizeSizeGuide(guide, index));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Size guides are invalid.",
    );
  }

  const slugs = new Set<string>();

  for (const guide of normalizedGuides) {
    if (slugs.has(guide.slug)) {
      return errorResponse(`Duplicate size guide slug: ${guide.slug}.`);
    }

    slugs.add(guide.slug);
  }

  const keptIds = normalizedGuides
    .map((guide) => guide.id)
    .filter((id): id is string => Boolean(id));

  await db.transaction(async (tx) => {
    if (keptIds.length > 0) {
      await tx.delete(sizeGuides).where(notInArray(sizeGuides.id, keptIds));
    } else {
      await tx.delete(sizeGuides);
    }

    for (const guide of normalizedGuides) {
      if (guide.id) {
        await tx
          .update(sizeGuides)
          .set({
            slug: guide.slug,
            title: guide.title,
            description:
              guide.description.en || guide.description.ro
                ? guide.description
                : null,
            imageUrl: guide.imageUrl,
            columns: guide.columns,
            rows: guide.rows,
            enabled: guide.enabled,
            updatedAt: new Date(),
          })
          .where(inArray(sizeGuides.id, [guide.id]));
      } else {
        await tx.insert(sizeGuides).values({
          slug: guide.slug,
          title: guide.title,
          description:
            guide.description.en || guide.description.ro
              ? guide.description
              : null,
          imageUrl: guide.imageUrl,
          columns: guide.columns,
          rows: guide.rows,
          enabled: guide.enabled,
        });
      }
    }
  });

  revalidateCatalogViews();

  return NextResponse.json({ ok: true });
}
