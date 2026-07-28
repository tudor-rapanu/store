import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sendTrackingEmail } from "@/lib/email";
import { SAMEDAY_SERVICE_IDS } from "@/lib/shipping/constants";
import { createSamedayAwb, getSamedayTrackingUrl } from "@/lib/shipping/sameday";
import { enqueueOrderEmailTask } from "@/lib/tasks/order-email";

export type GenerateAwbBody = {
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
  samedayLockerOohType?: number | string;
};

export class GenerateAwbError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function requiredString(value: string | undefined, label: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new GenerateAwbError(`${label} is required.`);
  }

  return cleaned;
}

function getLegacyEasyboxId(address: ShippingAddress) {
  const match = address.street?.match(/\(ID:\s*([^)]+)\)/i);
  return match?.[1]?.trim();
}

function getSamedayServiceId(shippingMethod: string) {
  if (shippingMethod !== "easybox") {
    return SAMEDAY_SERVICE_IDS.homeDelivery;
  }

  return SAMEDAY_SERVICE_IDS.easybox;
}

export async function generateOrderAwb(orderId: string, body: GenerateAwbBody) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new GenerateAwbError("Order was not found.", 404);
  }

  if (order.paymentStatus !== "paid") {
    throw new GenerateAwbError("AWB can only be generated for paid orders.");
  }

  if (order.shippingMethod === "international") {
    throw new GenerateAwbError(
      "Sameday AWB generation is not available for international orders.",
    );
  }

  if (order.awbNumber) {
    throw new GenerateAwbError("This order already has an AWB.");
  }

  const address = order.shippingAddress as ShippingAddress;
  const pickupPointId = requiredString(body.pickupPointId, "Pickup point");
  const contactPersonId = requiredString(body.contactPersonId, "Contact person");
  const packageType = requiredString(body.packageType ?? "1", "Package type");
  const packageWeight = requiredString(body.packageWeight ?? "1", "Package weight");
  const packageWidth = requiredString(body.packageWidth ?? "18", "Package width");
  const packageLength = requiredString(body.packageLength ?? "26.5", "Package length");
  const packageHeight = requiredString(body.packageHeight ?? "1", "Package height");
  const countyId = requiredString(
    body.countyId ?? address.samedayCountyId,
    "Sameday county",
  );
  const cityId = requiredString(body.cityId ?? address.samedayCityId, "Sameday city");
  const oohLastMile =
    order.shippingMethod === "easybox"
      ? requiredString(
          address.samedayLockerId ?? getLegacyEasyboxId(address),
          "Easybox locker",
        )
      : undefined;
  const serviceId = getSamedayServiceId(order.shippingMethod);

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

  await db
    .update(orders)
    .set({
      shippingAddress: {
        ...address,
        samedayCountyId: countyId,
        samedayCityId: cityId,
      },
      awbNumber: awb.awbNumber,
      trackingUrl,
      awbLabelUrl: awb.pdfLink,
      awbGeneratedAt: new Date(),
      samedayPickupPointId: pickupPointId,
      samedayContactPersonId: contactPersonId,
      samedayServiceId: serviceId,
      samedayPackageType: packageType,
      samedayAwbCost:
        typeof awb.awbCost === "number" ? Math.round(awb.awbCost * 100) : null,
      samedayRawResponse: awb.raw,
      fulfillmentStatus: "shipped",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  void enqueueOrderEmailTask(
    { orderId: order.id, type: "tracking" },
    () =>
      sendTrackingEmail({
        email: order.customerEmail,
        customerName: order.customerFirstName,
        orderId: `TT-${order.orderNumber}`,
        trackingUrl,
      }),
  );

  return {
    awbNumber: awb.awbNumber,
    trackingUrl,
    labelUrl: awb.pdfLink,
  };
}
