import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import {
  getSamedayCityCacheStatus,
  syncSamedayCities,
  syncSamedayCounties,
} from "@/lib/shipping/sameday";

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
        return NextResponse.json({
          ok: true,
          countyId: body.countyId,
          cities: 0,
          skipped: true,
          cached: cacheStatus.cached,
          remoteTotal: cacheStatus.remoteTotal,
        });
      }

      const cities = await syncSamedayCities(body.countyId);

      return NextResponse.json({
        ok: true,
        countyId: body.countyId,
        cities: cities.length,
        skipped: false,
        cached: cacheStatus.cached,
        remoteTotal: cacheStatus.remoteTotal,
      });
    }

    const counties = await syncSamedayCounties();

    return NextResponse.json({
      ok: true,
      counties: counties.length,
      countyList: counties,
    });
  } catch (error) {
    console.error("Sameday location sync failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not sync Sameday locations.",
      },
      { status: 500 },
    );
  }
}
