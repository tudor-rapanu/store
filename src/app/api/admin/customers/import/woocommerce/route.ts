import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { isWooCommerceMigrationEnabled } from "@/lib/admin/woocommerce-migration-access";
import {
  getWooCommerceCustomerImportPreview,
  importWooCommerceCustomers,
} from "@/lib/admin/woocommerce-customers-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_CONFIRMATION = "IMPORT_WOOCOMMERCE_CUSTOMERS";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isWooCommerceMigrationEnabled()) {
    return errorResponse("WooCommerce migration is disabled.", 404);
  }

  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to import WooCommerce customers.", 403);
  }

  try {
    const body = (await request.json()) as {
      mode?: unknown;
      customerCsv?: unknown;
      orderMappingCsv?: unknown;
      legacyUserIds?: unknown;
      confirmation?: unknown;
    };
    const customerCsv = typeof body.customerCsv === "string" ? body.customerCsv : "";
    const orderMappingCsv =
      typeof body.orderMappingCsv === "string" ? body.orderMappingCsv : "";

    if (body.mode === "preview") {
      return NextResponse.json({
        ok: true,
        preview: await getWooCommerceCustomerImportPreview(
          customerCsv,
          orderMappingCsv,
        ),
      });
    }

    if (body.mode === "import") {
      if (body.confirmation !== IMPORT_CONFIRMATION) {
        return errorResponse("The customer import was not explicitly confirmed.");
      }

      const legacyUserIds = Array.isArray(body.legacyUserIds)
        ? body.legacyUserIds.filter(
            (value): value is number =>
              typeof value === "number" && Number.isInteger(value) && value > 0,
          )
        : [];
      const result = await importWooCommerceCustomers(
        customerCsv,
        orderMappingCsv,
        legacyUserIds,
      );

      return NextResponse.json(
        { ok: result.errors.length === 0, result },
        { status: result.errors.length > 0 ? 207 : 200 },
      );
    }

    return errorResponse("Unknown customer import mode.");
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "The WooCommerce customer import could not be completed.",
      500,
    );
  }
}
