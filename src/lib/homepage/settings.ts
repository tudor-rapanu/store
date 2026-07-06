import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";

const HOMEPAGE_SETTINGS_KEY = "homepage";
const DEFAULT_PRODUCTS_PER_SLIDER = 12;

export type HomepageCategorySection = {
  categoryId: string;
  enabled: boolean;
};

export type HomepageSettings = {
  categorySections: HomepageCategorySection[];
  productsPerSlider: number;
};

function normalizeProductsPerSlider(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 24) {
    return DEFAULT_PRODUCTS_PER_SLIDER;
  }

  return parsed;
}

function normalizeCategorySections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const sections: HomepageCategorySection[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const categoryId =
      "categoryId" in item && typeof item.categoryId === "string"
        ? item.categoryId
        : "";

    if (!categoryId || seen.has(categoryId)) {
      return;
    }

    seen.add(categoryId);
    sections.push({
      categoryId,
      enabled: "enabled" in item ? item.enabled !== false : true,
    });
  });

  return sections;
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  const [row] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, HOMEPAGE_SETTINGS_KEY))
    .limit(1);

  return {
    categorySections: normalizeCategorySections(row?.value?.categorySections),
    productsPerSlider: normalizeProductsPerSlider(row?.value?.productsPerSlider),
  };
}

export async function updateHomepageSettings(settings: HomepageSettings) {
  const normalizedSettings = {
    categorySections: normalizeCategorySections(settings.categorySections),
    productsPerSlider: normalizeProductsPerSlider(settings.productsPerSlider),
  };

  await db
    .insert(storeSettings)
    .values({
      key: HOMEPAGE_SETTINGS_KEY,
      value: normalizedSettings,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: storeSettings.key,
      set: {
        value: normalizedSettings,
        updatedAt: new Date(),
      },
    });

  return normalizedSettings;
}
