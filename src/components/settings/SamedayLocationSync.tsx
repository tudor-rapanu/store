"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getFetchErrorMessage, showToast } from "@/lib/client/toast";

type SamedayLocationSyncProps = {
  countyCount: number;
  cityCount: number;
  counties: {
    id: number;
    name: string;
  }[];
};

type SamedayLocationSummary = {
  countyCount?: number;
  cityCount?: number;
};

export function SamedayLocationSync({
  countyCount,
  cityCount,
  counties,
}: SamedayLocationSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [displayCountyCount, setDisplayCountyCount] = useState(countyCount);
  const [displayCityCount, setDisplayCityCount] = useState(cityCount);

  async function syncLocations(force: boolean) {
    setIsSyncing(true);
    setMessage(null);

    try {
      const syncedCounties = await syncCounties();
      const countiesToSync = syncedCounties.length > 0 ? syncedCounties : counties;
      let syncedCities = 0;
      let skippedCounties = 0;
      let skippedCachedCities = 0;
      const failures: string[] = [];
      const skippedDetails: string[] = [];

      for (const [index, county] of countiesToSync.entries()) {
        setMessage(
          `${force ? "Refreshing" : "Syncing missing"} cities ${index + 1}/${countiesToSync.length}: ${county.name}`,
        );

        try {
          const result = await syncCountyCities(county.id, force);
          syncedCities += result.cities;
          if (result.skipped) {
            skippedCounties += 1;
            skippedCachedCities += result.cached;
            skippedDetails.push(
              `${county.name}: ${result.cached}/${result.remoteTotal ?? "?"}`,
            );
          }
        } catch (error) {
          failures.push(
            `${county.name}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      }

      const finalMessage =
        failures.length > 0
          ? `${force ? "Refreshed" : "Synced"} ${countiesToSync.length} counties and ${syncedCities} new cities. Skipped ${skippedCounties} complete counties with ${skippedCachedCities} cached cities. First skipped: ${skippedDetails[0] ?? "none"}. ${failures.length} counties failed. First failure: ${failures[0]}`
          : `${force ? "Refreshed" : "Synced"} ${countiesToSync.length} counties and ${syncedCities} new cities. Skipped ${skippedCounties} complete counties with ${skippedCachedCities} cached cities. First skipped: ${skippedDetails[0] ?? "none"}.`;

      setDisplayCountyCount((current) => Math.max(current, countiesToSync.length));
      setMessage(finalMessage);
      showToast({
        title: failures.length > 0 ? "Sync completed with issues" : "Sync complete",
        description: finalMessage,
        variant: failures.length > 0 ? "error" : "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not sync Sameday locations.";

      setMessage(errorMessage);
      showToast({
        title: "Sync failed",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncCounties() {
    const response = await fetch("/api/admin/settings/sameday/sync-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const responseText = await response.text();
    const data = parseJsonResponse(responseText) as {
      ok?: boolean;
      counties?: number;
      countyList?: { id: number; name: string }[];
      summary?: SamedayLocationSummary;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          responseText.slice(0, 500) ||
          getFetchErrorMessage(response, "Could not sync Sameday counties."),
      );
    }

    if (data.counties !== undefined) {
      setDisplayCountyCount(data.counties);
    }
    if (data.summary?.countyCount !== undefined) {
      setDisplayCountyCount(data.summary.countyCount);
    }
    if (data.summary?.cityCount !== undefined) {
      setDisplayCityCount(data.summary.cityCount);
    }

    return data.countyList ?? [];
  }

  async function syncCountyCities(countyId: number, force: boolean) {
    const response = await fetch("/api/admin/settings/sameday/sync-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countyId, force }),
    });
    const responseText = await response.text();
    const data = parseJsonResponse(responseText) as {
      ok?: boolean;
      cities?: number;
      skipped?: boolean;
      cached?: number;
      remoteTotal?: number | null;
      summary?: SamedayLocationSummary;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          responseText.slice(0, 500) ||
          getFetchErrorMessage(response, "Could not sync Sameday cities."),
      );
    }

    if (data.summary?.countyCount !== undefined) {
      setDisplayCountyCount(data.summary.countyCount);
    }
    if (data.summary?.cityCount !== undefined) {
      setDisplayCityCount(data.summary.cityCount);
    }

    return {
      cities: data.cities ?? 0,
      skipped: Boolean(data.skipped),
      cached: data.cached ?? 0,
      remoteTotal: data.remoteTotal ?? null,
    };
  }

  return (
    <section className="space-y-5 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">
          Sameday Locations
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cache counties and cities locally for checkout and AWB generation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-slate-200 p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Counties
          </div>
          <div className="text-2xl font-black tracking-tighter">
            {displayCountyCount}
          </div>
        </div>
        <div className="border border-slate-200 p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Cities
          </div>
          <div className="text-2xl font-black tracking-tighter">{displayCityCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={isSyncing}
          onClick={() => syncLocations(false)}
          className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSyncing ? "Syncing..." : "Sync Missing Locations"}
        </Button>
        <Button
          type="button"
          disabled={isSyncing}
          variant="outline"
          onClick={() => syncLocations(true)}
          className="h-12 rounded-none border-black px-6 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh All Locations
        </Button>
      </div>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}

function parseJsonResponse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
