import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";

const SAMEDAY_LOCATION_SUMMARY_KEY = "sameday-location-summary";

export type SamedayLocationSummary = {
  countyCount: number;
  cityCount: number;
  countyCityCounts: Record<string, number>;
  updatedAt?: string;
};

function normalizeSummary(value: unknown): SamedayLocationSummary {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const countyCityCounts =
    record.countyCityCounts &&
    typeof record.countyCityCounts === "object" &&
    !Array.isArray(record.countyCityCounts)
      ? Object.entries(record.countyCityCounts as Record<string, unknown>).reduce<
          Record<string, number>
        >((counts, [countyId, count]) => {
          const numericCount = Number(count);

          if (Number.isFinite(numericCount) && numericCount >= 0) {
            counts[countyId] = numericCount;
          }

          return counts;
        }, {})
      : {};
  const derivedCityCount = Object.values(countyCityCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const cityCount = Number(record.cityCount);
  const countyCount = Number(record.countyCount);

  return {
    countyCount:
      Number.isFinite(countyCount) && countyCount >= 0
        ? countyCount
        : Object.keys(countyCityCounts).length,
    cityCount:
      Number.isFinite(cityCount) && cityCount >= 0 ? cityCount : derivedCityCount,
    countyCityCounts,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

async function writeSummary(summary: SamedayLocationSummary) {
  await db
    .insert(storeSettings)
    .values({
      key: SAMEDAY_LOCATION_SUMMARY_KEY,
      value: summary,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: storeSettings.key,
      set: {
        value: summary,
        updatedAt: new Date(),
      },
    });

  return summary;
}

export async function getSamedayLocationSummary() {
  try {
    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, SAMEDAY_LOCATION_SUMMARY_KEY))
      .limit(1);

    return normalizeSummary(row?.value);
  } catch (error) {
    console.error(
      "Sameday location summary could not be loaded. Using defaults.",
      error,
    );
    return normalizeSummary(null);
  }
}

export async function updateSamedayCountySummary(countyCount: number) {
  const current = await getSamedayLocationSummary();

  return writeSummary({
    ...current,
    countyCount,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateSamedayCountyCitySummary(
  countyId: number,
  cityCount: number,
) {
  const current = await getSamedayLocationSummary();
  const countyCityCounts = {
    ...current.countyCityCounts,
    [String(countyId)]: Math.max(Math.floor(cityCount), 0),
  };
  const totalCityCount = Object.values(countyCityCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return writeSummary({
    ...current,
    cityCount: totalCityCount,
    countyCityCounts,
    updatedAt: new Date().toISOString(),
  });
}
