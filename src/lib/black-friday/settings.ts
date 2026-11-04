import { eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import {
  type BlackFridaySettings,
  getDefaultBlackFridaySettings,
  normalizeBlackFridaySettings,
} from "@/lib/black-friday/campaign";
import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";

const BLACK_FRIDAY_SETTINGS_KEY = "black-friday";
const BLACK_FRIDAY_CACHE_TAG = "store-settings:black-friday";

export async function getBlackFridaySettings(): Promise<BlackFridaySettings> {
  try {
    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, BLACK_FRIDAY_SETTINGS_KEY))
      .limit(1);

    return normalizeBlackFridaySettings(row?.value);
  } catch (error) {
    console.error("Black Friday settings could not be loaded. Using defaults.", error);
    return getDefaultBlackFridaySettings();
  }
}

// Read on every storefront page through the locale layout, so keep it cached;
// saving from admin busts the tag immediately.
export const getCachedBlackFridaySettings = unstable_cache(
  getBlackFridaySettings,
  ["store-settings:black-friday"],
  {
    revalidate: 300,
    tags: [BLACK_FRIDAY_CACHE_TAG],
  },
);

export async function updateBlackFridaySettings(settings: BlackFridaySettings) {
  const normalizedSettings = normalizeBlackFridaySettings(settings);

  await db
    .insert(storeSettings)
    .values({
      key: BLACK_FRIDAY_SETTINGS_KEY,
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

  revalidateTag(BLACK_FRIDAY_CACHE_TAG, { expire: 0 });

  return normalizedSettings;
}
