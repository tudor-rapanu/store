import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";
import { slugify } from "@/lib/slug";

type CategoryRow = typeof categories.$inferSelect;
type CategoryDatabase = Pick<typeof db, "insert" | "select">;

export type CategoryTreeNode = CategoryRow & {
  children: CategoryTreeNode[];
};

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  value: string;
  parentId: string | null;
  depth: number;
};

export type CategoryPathInput = {
  name: string;
  slug: string;
};

export function slugifyCategory(value: string) {
  return slugify(value);
}

export function parseCategoryPath(value: string): CategoryPathInput[] {
  return value
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      slug: slugifyCategory(name),
    }))
    .filter((part) => part.slug);
}

export async function getAllCategories() {
  return db.select().from(categories).orderBy(asc(categories.slug));
}

export function buildCategoryTree(rows: CategoryRow[]) {
  const nodes = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  rows.forEach((category) => {
    nodes.set(category.id, { ...category, children: [] });
  });

  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;

    if (parent) {
      parent.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

export function getCategoryOptions(rows: CategoryRow[], locale: "en" | "ro") {
  const options: CategoryOption[] = [];

  function visit(
    node: CategoryTreeNode,
    depth: number,
    parentLabel?: string,
    parentValue?: string,
  ) {
    const label = getTranslatedText(node.name, locale, node.slug);
    const englishLabel = getTranslatedText(node.name, "en", node.slug);
    const displayLabel = parentLabel ? `${parentLabel} > ${label}` : label;
    const value = parentValue ? `${parentValue} > ${englishLabel}` : englishLabel;

    options.push({
      id: node.id,
      slug: node.slug,
      name: displayLabel,
      value,
      parentId: node.parentId,
      depth,
    });

    node.children.forEach((child) => visit(child, depth + 1, displayLabel, value));
  }

  buildCategoryTree(rows).forEach((node) => visit(node, 0));

  return options;
}

export function getCategoryAndDescendantIds(
  rows: Pick<CategoryRow, "id" | "parentId">[],
  categoryId: string,
) {
  const childrenByParent = new Map<string, string[]>();

  rows.forEach((row) => {
    if (!row.parentId) {
      return;
    }

    childrenByParent.set(row.parentId, [
      ...(childrenByParent.get(row.parentId) ?? []),
      row.id,
    ]);
  });

  const ids = new Set<string>([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const childId of childrenByParent.get(current) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId);
        queue.push(childId);
      }
    }
  }

  return Array.from(ids);
}

export function getDirectSubcategories<T extends Pick<CategoryRow, "parentId">>(
  rows: T[],
  parentId: string,
) {
  return rows.filter((category) => category.parentId === parentId);
}

export async function findOrCreateCategoryPath(
  pathValue: string,
  database: CategoryDatabase = db,
) {
  const path = parseCategoryPath(pathValue);

  if (path.length === 0) {
    return null;
  }

  let parentId: string | null = null;
  let lastCategoryId: string | null = null;

  for (const part of path) {
    const [existingCategory] = await database
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, part.slug))
      .limit(1);

    if (existingCategory) {
      lastCategoryId = existingCategory.id;
      parentId = existingCategory.id;
      continue;
    }

    const createdCategories: Array<{ id: string }> = await database
      .insert(categories)
      .values({
        parentId,
        slug: part.slug,
        name: { en: part.name, ro: part.name },
      })
      .returning({ id: categories.id });
    const createdCategory = createdCategories[0];

    lastCategoryId = createdCategory.id;
    parentId = createdCategory.id;
  }

  return lastCategoryId;
}

export async function findOrCreateCategoryIds(
  pathValues: string[],
  database: CategoryDatabase = db,
) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const pathValue of pathValues) {
    const id = await findOrCreateCategoryPath(pathValue, database);

    if (id && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }

  return ids;
}

export async function getCategoryRowsByIds(categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return [];
  }

  return db.select().from(categories).where(inArray(categories.id, categoryIds));
}
