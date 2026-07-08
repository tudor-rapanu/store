import Link from "next/link";
import Image from "next/image";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CancelOrderButton } from "@/components/order/CancelOrderButton";
import { StatusBadge } from "@/components/order/StatusBadge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { getProductImageSrc } from "@/lib/product-images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Orders",
};

type AccountOrdersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AccountOrdersPage({
  params,
}: AccountOrdersPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${activeLocale}/login`);
  }

  const items = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));
  const orderIds = items.map((order) => order.id);
  const previewRows =
    orderIds.length > 0
      ? await db
          .select({
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
            title: products.title,
            slug: products.slug,
            imageUrl: products.imageUrl,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(inArray(orderItems.orderId, orderIds))
      : [];
  const previewsByOrderId = new Map<string, OrderPreviewItem[]>();

  for (const row of previewRows) {
    const current = previewsByOrderId.get(row.orderId) ?? [];
    current.push({
      title: row.title?.[activeLocale] ?? row.title?.en ?? row.slug,
      imageSrc: getProductImageSrc(row.imageUrl, "thumb"),
      quantity: row.quantity,
    });
    previewsByOrderId.set(row.orderId, current);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            My Orders
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Order history
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-none border-black px-5 text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/account`}>Back to Account</Link>
        </Button>
      </div>

      <div className="divide-y divide-black border border-black">
        {items.length === 0 ? (
          <div className="p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            No orders yet.
          </div>
        ) : (
          items.map((order) => (
            <div
              key={order.id}
              className="grid gap-4 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"
            >
              <div>
                <h2 className="font-black uppercase tracking-tight">
                  TT-{order.orderNumber}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge value={order.paymentStatus} className="px-2 py-1" />
                  <StatusBadge
                    value={order.fulfillmentStatus}
                    className="px-2 py-1"
                  />
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight">
                  {(order.totalAmount / 100).toFixed(2)} RON
                </p>
              </div>
              <OrderPreviewStrip
                items={previewsByOrderId.get(order.id) ?? []}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  className="rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
                >
                  <Link href={`/${activeLocale}/orders/${order.orderNumber}`}>
                    Details
                  </Link>
                </Button>
                <CancelOrderButton
                  orderId={order.id}
                  disabled={[
                    "shipped",
                    "delivered",
                    "cancelled",
                    "refunded",
                  ].includes(order.fulfillmentStatus)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

type OrderPreviewItem = {
  title: string;
  imageSrc: string | null;
  quantity: number;
};

function OrderPreviewStrip({ items }: { items: OrderPreviewItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 4);
  const remainingCount = items.length - visibleItems.length;

  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="relative size-16 overflow-hidden border border-slate-200 bg-white"
        >
          {item.imageSrc ? (
            <Image
              src={item.imageSrc}
              alt={item.title}
              fill
              unoptimized
              className="object-contain p-2"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
              No Image
            </div>
          )}
          {item.quantity > 1 && (
            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">
              {item.quantity}
            </span>
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="flex size-16 items-center justify-center border border-slate-200 bg-slate-50 text-sm font-black">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
