import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import {
  getSamedayCityCacheStatus,
  syncSamedayCities,
  syncSamedayCounties,
} from "@/lib/shipping/sameday";
import {
  updateSamedayCountyCitySummary,
  updateSamedayCountySummary,
} from "@/lib/shipping/sameday-location-summary";

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      countyId?: number;
      force?: boolean;
    };

    if (body.countyId) {
      const cacheStatus = await getSamedayCityCacheStatus(body.countyId);

      if (!body.force && cacheStatus.isComplete) {
        const summary = await updateSamedayCountyCitySummary(
          body.countyId,
          cacheStatus.cached,
        );

        return NextResponse.json({
          ok: true,
          countyId: body.countyId,
          cities: 0,
          skipped: true,
          cached: cacheStatus.cached,
          remoteTotal: cacheStatus.remoteTotal,
          summary,
        });
      }

      const cities = await syncSamedayCities(body.countyId);
      const summary = await updateSamedayCountyCitySummary(
        body.countyId,
        cities.length,
      );

      return NextResponse.json({
        ok: true,
        countyId: body.countyId,
        cities: cities.length,
        skipped: false,
        cached: cacheStatus.cached,
        remoteTotal: cacheStatus.remoteTotal,
        summary,
      });
    }

    const counties = await syncSamedayCounties();
    const summary = await updateSamedayCountySummary(counties.length);

    return NextResponse.json({
      ok: true,
      counties: counties.length,
      countyList: counties,
      summary,
    });
  } catch (error) {
    console.error("Sameday location sync failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not sync Sameday locations.",
      },
      { status: 500 },
    );
  }
}
