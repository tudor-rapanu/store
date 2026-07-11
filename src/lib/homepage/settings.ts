import { randomUUID } from "crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";

const HOMEPAGE_SETTINGS_KEY = "homepage";
const DEFAULT_PRODUCTS_PER_SLIDER = 12;

export type HomepageSectionType =
  | "promoStrip"
  | "heroBanner"
  | "bannerSlider"
  | "featuredProduct"
  | "textImage";

export type HomepageCategorySection = {
  categoryId: string;
  enabled: boolean;
};

export type HomepageContentSection = {
  id: string;
  type: HomepageSectionType;
  enabled: boolean;
  content: Record<string, unknown>;
};

export type HomepageSettings = {
  categorySections: HomepageCategorySection[];
  contentSections: HomepageContentSection[];
  productsPerSlider: number;
};

function getDefaultHomepageSettings(): HomepageSettings {
  return {
    categorySections: [],
    contentSections: [],
    productsPerSlider: DEFAULT_PRODUCTS_PER_SLIDER,
  };
}

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

function createSectionId() {
  return randomUUID();
}

function normalizeHomepageSectionType(value: unknown): HomepageSectionType {
  if (
    value === "promoStrip" ||
    value === "heroBanner" ||
    value === "bannerSlider" ||
    value === "featuredProduct" ||
    value === "textImage"
  ) {
    return value;
  }

  return "heroBanner";
}

export function normalizeContentSections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): HomepageContentSection | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id =
        "id" in item && typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : createSectionId();
      const content =
        "content" in item &&
        item.content &&
        typeof item.content === "object" &&
        !Array.isArray(item.content)
          ? (item.content as Record<string, unknown>)
          : {};

      return {
        id,
        type: normalizeHomepageSectionType("type" in item ? item.type : null),
        enabled: "enabled" in item ? item.enabled !== false : true,
        content,
      };
    })
    .filter((section): section is HomepageContentSection => Boolean(section))
    .slice(0, 24);
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  try {
    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, HOMEPAGE_SETTINGS_KEY))
      .limit(1);

    return {
      categorySections: normalizeCategorySections(row?.value?.categorySections),
      contentSections: normalizeContentSections(row?.value?.contentSections),
      productsPerSlider: normalizeProductsPerSlider(row?.value?.productsPerSlider),
    };
  } catch (error) {
    console.error("Homepage settings could not be loaded. Using defaults.", error);
    return getDefaultHomepageSettings();
  }
}

export async function updateHomepageSettings(settings: HomepageSettings) {
  const normalizedSettings = {
    categorySections: normalizeCategorySections(settings.categorySections),
    contentSections: normalizeContentSections(settings.contentSections),
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
