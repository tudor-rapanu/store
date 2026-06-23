import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sendTrackingEmail } from "@/lib/email";
import {
  createSamedayAwb,
  getSamedayTrackingUrl,
} from "@/lib/shipping/sameday";

type GenerateAwbBody = {
  pickupPointId?: string;
  contactPersonId?: string;
  serviceId?: string;
  packageType?: string;
  packageWeight?: string;
  packageWidth?: string;
  packageLength?: string;
  packageHeight?: string;
  countyId?: string;
  cityId?: string;
  observation?: string;
  personalEasyboxLoad?: boolean;
};

type ShippingAddress = {
  street?: string;
  city?: string;
  county?: string;
  zip?: string;
  postalCode?: string;
  samedayCountyId?: string;
  samedayCityId?: string;
  samedayLockerId?: string;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requiredString(value: string | undefined, label: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }

  return cleaned;
}

function getLegacyEasyboxId(address: ShippingAddress) {
  const match = address.street?.match(/\(ID:\s*([^)]+)\)/i);
  return match?.[1]?.trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminUser())) {
    return errorResponse("You are not allowed to generate AWBs.", 403);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as GenerateAwbBody;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    return errorResponse("Order was not found.", 404);
  }

  if (order.paymentStatus !== "paid") {
    return errorResponse("AWB can only be generated for paid orders.");
  }

  if (order.awbNumber) {
    return errorResponse("This order already has an AWB.");
  }

  const address = order.shippingAddress as ShippingAddress;

  try {
    const pickupPointId = requiredString(body.pickupPointId, "Pickup point");
    const contactPersonId = requiredString(
      body.contactPersonId,
      "Contact person",
    );
    const packageType = requiredString(
      body.packageType ?? "1",
      "Package type",
    );
    const packageWeight = requiredString(
      body.packageWeight ?? "1",
      "Package weight",
    );
    const packageWidth = requiredString(
      body.packageWidth ?? "18",
      "Package width",
    );
    const packageLength = requiredString(
      body.packageLength ?? "26.5",
      "Package length",
    );
    const packageHeight = requiredString(
      body.packageHeight ?? "1",
      "Package height",
    );
    const countyId = requiredString(
      body.countyId ?? address.samedayCountyId,
      "Sameday county",
    );
    const cityId = requiredString(
      body.cityId ?? address.samedayCityId,
      "Sameday city",
    );
    const oohLastMile =
      order.shippingMethod === "easybox"
        ? requiredString(
            address.samedayLockerId ?? getLegacyEasyboxId(address),
            "Easybox locker",
          )
        : undefined;
    const serviceId = requiredString(
      body.serviceId ?? (order.shippingMethod === "easybox" ? "15" : "7"),
      "Service",
    );

    const awb = await createSamedayAwb({
      orderId: order.id,
      orderNumber: order.orderNumber,
      pickupPointId,
      contactPersonId,
      serviceId,
      packageType,
      packageWeight,
      packageWidth,
      packageLength,
      packageHeight,
      countyId,
      cityId,
      oohLastMile,
      recipientName: `${order.customerFirstName} ${order.customerLastName}`,
      recipientPhone: order.customerPhone,
      recipientEmail: order.customerEmail,
      recipientAddress: requiredString(address.street, "Recipient address"),
      recipientPostalCode: address.zip ?? address.postalCode,
      observation: body.observation?.trim() || undefined,
      personalEasyboxLoad: Boolean(body.personalEasyboxLoad),
    });
    const trackingUrl = getSamedayTrackingUrl(awb.awbNumber);
    const updatedAddress = {
      ...address,
      samedayCountyId: countyId,
      samedayCityId: cityId,
    };

    await db
      .update(orders)
      .set({
        shippingAddress: updatedAddress,
        awbNumber: awb.awbNumber,
        trackingUrl,
        awbLabelUrl: awb.pdfLink,
        awbGeneratedAt: new Date(),
        samedayPickupPointId: pickupPointId,
        samedayContactPersonId: contactPersonId ?? null,
        samedayServiceId: serviceId,
        samedayPackageType: packageType,
        samedayAwbCost:
          typeof awb.awbCost === "number" ? Math.round(awb.awbCost * 100) : null,
        samedayRawResponse: awb.raw,
        fulfillmentStatus: "shipped",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await sendTrackingEmail({
      email: order.customerEmail,
      customerName: order.customerFirstName,
      orderId: `TT-${order.orderNumber}`,
      trackingUrl,
    });

    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      awbNumber: awb.awbNumber,
      trackingUrl,
      labelUrl: awb.pdfLink,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Could not generate AWB.",
      500,
    );
  }
}
