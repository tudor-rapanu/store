import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { isWooCommerceMigrationEnabled } from "@/lib/admin/woocommerce-migration-access";
import {
  getWooCommerceImportPreview,
  importWooCommerceProductById,
  importWooCommerceProducts,
} from "@/lib/admin/woocommerce-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!isWooCommerceMigrationEnabled()) {
    return errorResponse("WooCommerce migration is disabled.", 404);
  }

  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to preview WooCommerce imports.", 403);
  }

  try {
    return NextResponse.json({
      ok: true,
      preview: await getWooCommerceImportPreview(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "The WooCommerce import preview could not be loaded.",
      500,
    );
  }
}

async function readWooId(request: Request) {
  try {
    const body = (await request.json()) as { wooId?: unknown };

    return typeof body.wooId === "number" && Number.isInteger(body.wooId)
      ? body.wooId
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isWooCommerceMigrationEnabled()) {
    return errorResponse("WooCommerce migration is disabled.", 404);
  }

  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to import WooCommerce products.", 403);
  }

  try {
    const wooId = await readWooId(request);
    const result = wooId
      ? await importWooCommerceProductById(wooId)
      : await importWooCommerceProducts();
    const status = result.errors.length > 0 ? 207 : 200;

    return NextResponse.json(
      {
        ok: result.errors.length === 0,
        ...result,
      },
      { status },
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "The WooCommerce import could not be completed.",
      500,
    );
  }
}
