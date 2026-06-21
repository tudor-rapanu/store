import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CancelOrderButton } from "@/components/order/CancelOrderButton";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
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

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-16">
      <div className="mb-8 border-b border-black pb-4">
        <h1 className="text-4xl font-black uppercase tracking-tighter">
          My Orders
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Order history
        </p>
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
              className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <h2 className="font-black uppercase tracking-tight">
                  TT-{order.orderNumber}
                </h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Payment: {order.paymentStatus} / Status:{" "}
                  {order.fulfillmentStatus}
                </p>
                <p className="text-sm font-bold">
                  {(order.totalAmount / 100).toFixed(2)} RON
                </p>
              </div>
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
