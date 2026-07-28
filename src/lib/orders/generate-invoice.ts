import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { orderItems, orders, products, productVariants } from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";
import { FgoInvoiceError, createFgoInvoice } from "@/lib/invoices/fgo";

type ShippingAddress = {
  street?: string;
  city?: string;
  county?: string;
  zip?: string;
  countryCode?: string;
  countryName?: string;
};

export class GenerateInvoiceError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 400, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

function baniToRon(value: number) {
  return Number((value / 100).toFixed(2));
}

function getVatRate() {
  const configured = Number.parseInt(process.env.FGO_TVA_RATE ?? "21", 10);

  return Number.isFinite(configured) ? configured : 21;
}

function getClientName(order: typeof orders.$inferSelect) {
  return `${order.customerFirstName} ${order.customerLastName}`.trim();
}

function buildClientAddress(address: ShippingAddress) {
  return [address.street, address.city, address.county, address.zip]
    .filter(Boolean)
    .join(", ");
}

async function getInvoiceItems(orderId: string) {
  return db
    .select({
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      productTitle: products.title,
      productSlug: products.slug,
      variantName: productVariants.name,
      variantSku: productVariants.sku,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(orderItems.orderId, orderId));
}

function buildInvoiceLines({
  items,
  order,
}: {
  items: Awaited<ReturnType<typeof getInvoiceItems>>;
  order: typeof orders.$inferSelect;
}) {
  const vatRate = getVatRate();
  const lines = items.map((item) => ({
    Denumire:
      item.variantName ||
      getTranslatedText(item.productTitle, "ro", item.productSlug) ||
      "Produs",
    NrProduse: item.quantity,
    UM: "BUC",
    CotaTVA: vatRate,
    PretTotal: baniToRon(item.unitPrice * item.quantity),
  }));

  if (order.shippingAmount > 0) {
    lines.push({
      Denumire: "Transport",
      NrProduse: 1,
      UM: "BUC",
      CotaTVA: vatRate,
      PretTotal: baniToRon(order.shippingAmount),
    });
  }

  if (order.discountAmount > 0) {
    lines.push({
      Denumire: "Discount",
      NrProduse: 1,
      UM: "BUC",
      CotaTVA: vatRate,
      PretTotal: -baniToRon(order.discountAmount),
    });
  }

  return lines;
}

async function markInvoiceFailed(orderId: string) {
  await db
    .update(orders)
    .set({
      invoiceStatus: "failed",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

export async function generateOrderInvoice(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    throw new GenerateInvoiceError("Order was not found.", 404);
  }

  if (order.invoiceStatus === "generated") {
    throw new GenerateInvoiceError("This order already has an invoice.");
  }

  if (order.paymentStatus !== "paid") {
    throw new GenerateInvoiceError("Invoice can only be generated for paid orders.");
  }

  const items = await getInvoiceItems(order.id);

  if (items.length === 0) {
    throw new GenerateInvoiceError("Order has no invoiceable items.");
  }

  const address = order.shippingAddress as ShippingAddress;
  const clientName = getClientName(order);

  try {
    const invoice = await createFgoInvoice({
      clientName,
      clientType: "PF",
      clientCountryCode: address.countryCode ?? "RO",
      clientCounty: address.county,
      clientAddress: buildClientAddress(address),
      clientEmail: order.customerEmail,
      clientPhone: order.customerPhone,
      invoiceExternalId: order.id,
      currency: "RON",
      lines: buildInvoiceLines({ items, order }),
    });

    await db
      .update(orders)
      .set({
        invoiceStatus: "generated",
        invoiceNumber: invoice.invoiceNumber,
        invoiceUrl: invoice.invoiceUrl,
        fgoInvoiceId: invoice.invoiceId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return invoice;
  } catch (error) {
    await markInvoiceFailed(order.id);

    if (error instanceof FgoInvoiceError) {
      throw new GenerateInvoiceError(
        error.message,
        error.retryable ? 500 : 400,
        error.retryable,
      );
    }

    throw error;
  }
}
