import { eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";

const CURRENCY_SETTINGS_KEY = "currency";
const CURRENCY_SETTINGS_CACHE_TAG = "settings:currency";
const DEFAULT_RON_TO_EUR_RATE = 0.2;

export type CurrencySettings = {
  ronToEurRate: number;
};

function normalizeRate(value: unknown) {
  const rate = Number(value);

  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
    return DEFAULT_RON_TO_EUR_RATE;
  }

  return rate;
}

export const getCurrencySettings = unstable_cache(
  async (): Promise<CurrencySettings> => {
  const [row] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, CURRENCY_SETTINGS_KEY))
    .limit(1);

  return {
    ronToEurRate: normalizeRate(row?.value?.ronToEurRate),
  };
  },
  ["settings:currency"],
  {
    revalidate: 300,
    tags: [CURRENCY_SETTINGS_CACHE_TAG],
  },
);

export async function updateCurrencySettings({
  ronToEurRate,
}: CurrencySettings) {
  const settings = {
    ronToEurRate: normalizeRate(ronToEurRate),
  };

  await db
    .insert(storeSettings)
    .values({
      key: CURRENCY_SETTINGS_KEY,
      value: settings,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: storeSettings.key,
      set: {
        value: settings,
        updatedAt: new Date(),
      },
    });

  revalidateTag(CURRENCY_SETTINGS_CACHE_TAG, { expire: 0 });

  return settings;
}
