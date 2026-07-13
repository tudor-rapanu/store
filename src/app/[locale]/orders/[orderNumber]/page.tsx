import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { CancelOrderButton } from "@/components/order/CancelOrderButton";
import { OrderAmountSummary } from "@/components/order/OrderAmountSummary";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  digitalProductFiles,
  orderItems,
  orders,
  products,
  productVariants,
} from "@/lib/db/schema";
import { formatFulfillmentEstimate } from "@/lib/fulfillment/estimate";
import { getCurrentUser } from "@/lib/auth/session";

type PublicOrderPageProps = {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({
  params,
}: PublicOrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;

  return {
    title: `Order TT-${orderNumber}`,
  };
}

export default async function PublicOrderPage({
  params,
  searchParams,
}: PublicOrderPageProps) {
  const { locale, orderNumber } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const { token } = await searchParams;
  const parsedOrderNumber = Number.parseInt(orderNumber, 10);

  if (!Number.isFinite(parsedOrderNumber)) {
    notFound();
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, parsedOrderNumber))
    .limit(1);

  if (!order) {
    notFound();
  }

  const user = await getCurrentUser();
  const isAccountOwner = Boolean(user?.id && order.userId === user.id);
  const hasGuestToken = Boolean(token && token === order.accessToken);

  if (!isAccountOwner && !hasGuestToken) {
    redirect(`/${activeLocale}/login`);
  }

  const isGuestView = !isAccountOwner;
  const items = await db
    .select({
      item: orderItems,
      variant: productVariants,
      product: products,
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));
  const downloadFiles =
    order.paymentStatus === "paid"
      ? await db
          .select({
            id: digitalProductFiles.id,
            fileName: digitalProductFiles.fileName,
            fileSize: digitalProductFiles.fileSize,
          })
          .from(digitalProductFiles)
          .innerJoin(
            orderItems,
            eq(orderItems.productId, digitalProductFiles.productId),
          )
          .where(eq(orderItems.orderId, order.id))
      : [];
  const address = order.shippingAddress as {
    street?: string;
    city?: string;
    county?: string;
    zip?: string;
    countryName?: string;
  };
  const canCancel = !["shipped", "delivered", "cancelled", "refunded"].includes(
    order.fulfillmentStatus,
  );
  const fulfillmentEstimate =
    order.estimatedShippingStart && order.estimatedShippingEnd
      ? {
          start: order.estimatedShippingStart,
          end: order.estimatedShippingEnd,
        }
      : null;
  const estimatedShippingWindow = formatFulfillmentEstimate(
    fulfillmentEstimate,
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
            Payment: {order.paymentStatus} / Status: {order.fulfillmentStatus}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/products`}>Catalog</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="space-y-3 border border-black p-4">
            <h2 className="text-sm font-black uppercase tracking-widest">Products</h2>
            {items.length === 0 ? (
              <div className="text-sm text-slate-500">
                Product details are not available for this order yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200">
                {items.map((row) => (
                  <div
                    key={row.item.id}
                    className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <div className="font-bold uppercase tracking-tight">
                        {row.product?.title?.[activeLocale] ||
                          row.product?.title?.en ||
                          row.variant?.name ||
                          "Product"}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-slate-500">
                        {row.variant?.sku}
                      </div>
                    </div>
                    <div className="font-bold">x{row.item.quantity}</div>
                    <div className="font-bold">
                      {(row.item.unitPrice / 100).toFixed(2)} RON
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {downloadFiles.length > 0 && (
            <section className="space-y-3 border border-black p-4">
              <h2 className="text-sm font-black uppercase tracking-widest">
                Downloads
              </h2>
              <div className="divide-y divide-slate-200 border border-slate-200">
                {downloadFiles.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/order-downloads/${order.orderNumber}/${file.id}${
                      hasGuestToken ? `?token=${token}` : ""
                    }`}
                    className="flex items-center justify-between gap-4 p-3 text-sm font-bold uppercase tracking-widest underline"
                  >
                    <span>{file.fileName}</span>
                    <span className="text-xs text-slate-500">
                      {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <InfoBox title="Customer">
            <p>
              {order.customerFirstName} {order.customerLastName}
            </p>
            <p>{isGuestView ? maskEmail(order.customerEmail) : order.customerEmail}</p>
            <p>{isGuestView ? maskPhone(order.customerPhone) : order.customerPhone}</p>
          </InfoBox>

          <InfoBox title="Shipping">
            <p>{order.shippingMethod}</p>
            <p>{isGuestView ? maskAddress(address.street) : address.street}</p>
            <p>
              {address.city}, {address.county}
            </p>
            {address.countryName && <p>{address.countryName}</p>}
            <p>{address.zip}</p>
            {order.awbNumber && (
              <p>
                {order.shippingMethod === "international" ? "Tracking" : "AWB"}:{" "}
                {order.awbNumber}
              </p>
            )}
            {order.trackingUrl && (
              <a href={order.trackingUrl} className="underline">
                Tracking link
              </a>
            )}
          </InfoBox>

          <InfoBox title="Summary">
            <OrderAmountSummary
              subtotalAmount={order.subtotalAmount}
              discountAmount={order.discountAmount}
              shippingAmount={order.shippingAmount}
              totalAmount={order.totalAmount}
              paymentAmount={order.paymentAmount}
              paymentCurrency={order.paymentCurrency}
            />
            <p>Payment method: {order.paymentMethod.replaceAll("_", " ")}</p>
            {estimatedShippingWindow && (
              <p>Estimated shipping: {estimatedShippingWindow}</p>
            )}
            {order.customerNotes && <p>{order.customerNotes}</p>}
          </InfoBox>

          <CancelOrderButton
            orderId={order.id}
            accessToken={hasGuestToken ? token : undefined}
            disabled={!canCancel}
          />
        </aside>
      </div>
    </main>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 2);

  return `${visible}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}

function maskPhone(phone: string) {
  return phone.length > 4
    ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`
    : "****";
}

function maskAddress(address?: string) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 8)}...`;
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border border-black p-4 text-sm">
      <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
      <div className="space-y-1 text-slate-700">{children}</div>
    </section>
  );
}
