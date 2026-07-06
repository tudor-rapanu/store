import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminOrderEditor } from "@/components/order/AdminOrderEditor";
import { AdminOrderItemsManager } from "@/components/order/AdminOrderItemsManager";
import { SamedayAwbPanel } from "@/components/order/SamedayAwbPanel";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { markStaleNetopiaOrdersFailed } from "@/lib/actions/orders";
import { db } from "@/lib/db";
import { orderItems, orders, products, productVariants } from "@/lib/db/schema";
import { formatFulfillmentEstimate } from "@/lib/fulfillment/estimate";
import { getTranslatedText } from "@/lib/i18n/text";
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from "@/lib/product-pricing";

type AdminOrderPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({
  params,
}: AdminOrderPageProps): Promise<Metadata> {
  const { id } = await params;
  const [order] = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  return {
    title: order ? `Order TT-${order.orderNumber}` : "Order",
  };
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { locale, id } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  await markStaleNetopiaOrdersFailed();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }

  const items = await db
    .select({
      item: {
        id: orderItems.id,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      },
      variant: {
        name: productVariants.name,
        sku: productVariants.sku,
      },
      product: {
        title: products.title,
        slug: products.slug,
      },
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));
  const productRows = await db
    .select({
      id: products.id,
      title: products.title,
      basePrice: products.basePrice,
      salePrice: products.salePrice,
      saleEnabled: products.saleEnabled,
      saleStartsAt: products.saleStartsAt,
      saleEndsAt: products.saleEndsAt,
      createdAt: products.createdAt,
    })
    .from(products)
    .orderBy(desc(products.createdAt));
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      sku: productVariants.sku,
      price: productVariants.price,
      salePrice: productVariants.salePrice,
      saleEnabled: productVariants.saleEnabled,
      saleStartsAt: productVariants.saleStartsAt,
      saleEndsAt: productVariants.saleEndsAt,
      priceAdjustment: productVariants.priceAdjustment,
    })
    .from(productVariants)
    .orderBy(desc(productVariants.createdAt));
  const productOptions = productRows.map((product) => ({
    id: product.id,
    title: getTranslatedText(product.title, activeLocale, product.id),
    basePrice: getEffectiveProductPrice(product),
    variants: variantRows
      .filter((variant) => variant.productId === product.id)
      .map((variant) => ({
        id: variant.id,
        name: variant.name ?? variant.sku,
        sku: variant.sku,
        price: getEffectiveVariantPrice(product, variant),
      })),
  }));
  const address = order.shippingAddress as {
    street?: string;
    city?: string;
    county?: string;
    zip?: string;
    countryCode?: string;
    countryName?: string;
    samedayCountyId?: string;
    samedayCityId?: string;
    samedayLockerId?: string;
    samedayLockerOohType?: number | string;
  };
  const estimatedShippingWindow = formatFulfillmentEstimate(
    order.estimatedShippingStart && order.estimatedShippingEnd
      ? {
          start: order.estimatedShippingStart,
          end: order.estimatedShippingEnd,
        }
      : null,
    activeLocale,
  );

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            TT-{order.orderNumber}
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {new Date(order.createdAt).toLocaleString("ro-RO")}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/admin/orders`}>Back to Orders</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <AdminOrderEditor order={order} />

          <SamedayAwbPanel
            orderId={order.id}
            paymentStatus={order.paymentStatus}
            shippingMethod={order.shippingMethod}
            awbNumber={order.awbNumber}
            trackingUrl={order.trackingUrl}
            labelUrl={order.awbLabelUrl}
            address={address}
          />

          <AdminOrderItemsManager
            orderId={order.id}
            fulfillmentStatus={order.fulfillmentStatus}
            products={productOptions}
            items={items.map((row) => ({
              id: row.item.id,
              title:
                row.product?.title?.[activeLocale] ||
                row.product?.title?.en ||
                row.variant?.name ||
                "Product",
              sku: row.variant?.sku ?? row.product?.slug ?? null,
              quantity: row.item.quantity,
              unitPrice: row.item.unitPrice,
            }))}
          />
        </div>

        <aside className="space-y-6">
          <InfoBox title="Customer">
            <p>
              {order.customerFirstName} {order.customerLastName}
            </p>
            <p>{order.customerEmail}</p>
            <p>{order.customerPhone}</p>
          </InfoBox>

          <InfoBox title="Shipping">
            <p>{order.shippingMethod}</p>
            <p>{address.street}</p>
            <p>
              {address.city}, {address.county}
            </p>
            {address.countryName && <p>{address.countryName}</p>}
            <p>{address.zip}</p>
            {order.awbNumber && (
              <p>
                {order.shippingMethod === "international"
                  ? "Tracking"
                  : "AWB"}
                : {order.awbNumber}
              </p>
            )}
            {order.trackingUrl && (
              <a href={order.trackingUrl} className="underline">
                Tracking link
              </a>
            )}
          </InfoBox>

          <InfoBox title="Payment">
            <p>Method: {order.paymentMethod.replaceAll("_", " ")}</p>
            <p>Status: {order.paymentStatus}</p>
            <p>Subtotal: {(order.subtotalAmount / 100).toFixed(2)} RON</p>
            {order.discountAmount > 0 && (
              <p>Discount: -{(order.discountAmount / 100).toFixed(2)} RON</p>
            )}
            <p>Shipping: {(order.shippingAmount / 100).toFixed(2)} RON</p>
            <p>Total: {(order.totalAmount / 100).toFixed(2)} RON</p>
            <p>
              Payment: {((order.paymentAmount ?? order.totalAmount) / 100).toFixed(2)}{" "}
              {order.paymentCurrency}
            </p>
            {estimatedShippingWindow && (
              <p>Estimated shipping: {estimatedShippingWindow}</p>
            )}
            {order.netopiaTxId && <p>Netopia: {order.netopiaTxId}</p>}
          </InfoBox>

          <InfoBox title="Guest Link">
            <Link
              href={`/${activeLocale}/orders/${order.orderNumber}?token=${order.accessToken}`}
              className="break-all underline"
            >
              View customer order page
            </Link>
          </InfoBox>
        </aside>
      </div>
    </main>
  );
}

function InfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border border-black p-4 text-sm">
      <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
      <div className="space-y-1 text-slate-700">{children}</div>
    </section>
  );
}
