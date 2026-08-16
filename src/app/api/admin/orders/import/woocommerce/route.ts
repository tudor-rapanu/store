import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { isWooCommerceMigrationEnabled } from "@/lib/admin/woocommerce-migration-access";
import {
  getWooCommerceOrderImportPreview,
  importWooCommerceOrderById,
  normalizeWooCommerceOrderExtras,
  updateWooCommerceImportedOrderMetadataBatch,
  type WooCommerceOrderImportOptions,
  type WooCommerceOrderManualMatches,
} from "@/lib/admin/woocommerce-orders-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asManualMatches(value: unknown): WooCommerceOrderManualMatches | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as WooCommerceOrderManualMatches)
    : undefined;
}

function asImportOptions(value: unknown): WooCommerceOrderImportOptions | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as WooCommerceOrderImportOptions)
    : undefined;
}

async function readImportBody(request: Request) {
  try {
    const body = (await request.json()) as {
      wooId?: unknown;
      wooIds?: unknown;
      extras?: unknown;
      manualMatches?: unknown;
      options?: unknown;
      repairImported?: unknown;
    };

    return {
      wooId:
        typeof body.wooId === "number" && Number.isInteger(body.wooId)
          ? body.wooId
          : null,
      wooIds: Array.isArray(body.wooIds)
        ? body.wooIds.filter(
            (wooId): wooId is number =>
              typeof wooId === "number" && Number.isInteger(wooId),
          )
        : [],
      extras: normalizeWooCommerceOrderExtras(body.extras),
      manualMatches: asManualMatches(body.manualMatches),
      options: asImportOptions(body.options),
      repairImported: body.repairImported === true,
    };
  } catch {
    return {
      wooId: null,
      wooIds: [],
      extras: undefined,
      manualMatches: undefined,
      options: undefined,
      repairImported: false,
    };
  }
}

export async function POST(request: Request) {
  if (!isWooCommerceMigrationEnabled()) {
    return errorResponse("WooCommerce migration is disabled.", 404);
  }

  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to import WooCommerce orders.", 403);
  }

  try {
    const { wooId, wooIds, extras, manualMatches, options, repairImported } =
      await readImportBody(request);

    if (repairImported) {
      const result = await updateWooCommerceImportedOrderMetadataBatch(extras, options);
      const status = result.errors.length > 0 ? 207 : 200;

      return NextResponse.json(
        {
          ok: result.errors.length === 0,
          ...result,
        },
        { status },
      );
    }

    if (wooId) {
      const result = await importWooCommerceOrderById(wooId, extras, manualMatches);
      const status = result.errors.length > 0 ? 207 : 200;

      return NextResponse.json(
        {
          ok: result.errors.length === 0,
          ...result,
        },
        { status },
      );
    }

    if (wooIds.length > 0) {
      const results = [];

      for (const id of wooIds) {
        results.push(await importWooCommerceOrderById(id, extras, manualMatches));
      }

      const created = results.reduce((sum, result) => sum + result.created, 0);
      const skipped = results.flatMap((result) => result.skipped);
      const errors = results.flatMap((result) => result.errors);
      const status = errors.length > 0 ? 207 : 200;

      return NextResponse.json(
        {
          ok: errors.length === 0,
          created,
          skipped,
          errors,
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      preview: await getWooCommerceOrderImportPreview(extras, manualMatches, options),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "The WooCommerce order import could not be completed.",
      500,
    );
  }
}
