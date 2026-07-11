import Link from "next/link";
import Image from "next/image";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AccountSidebar } from "@/components/account/AccountSidebar";
import { StatusBadge } from "@/components/order/StatusBadge";
import { SamedayLocationPicker } from "@/components/shipping/SamedayLocationPicker";
import { updateCustomerProfile } from "@/lib/actions/profile";
import {
  getCustomerProfile,
  type CustomerProfileAddress,
} from "@/lib/customer-profile";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { getProductImageSrc } from "@/lib/product-images";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "My Account",
};

type AccountPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function AccountPage({
  params,
  searchParams,
}: AccountPageProps) {
  const { locale } = await params;
  const { saved } = await searchParams;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${activeLocale}/login`);
  }

  const [profile, recentOrders] = await Promise.all([
    getCustomerProfile(user.id),
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(5),
  ]);
  const address = (profile?.address ?? {}) as CustomerProfileAddress;
  const firstName = profile?.firstName ?? "";
  const lastName = profile?.lastName ?? "";
  const completedOrderCount = recentOrders.filter(
    (order) => order.paymentStatus === "paid",
  ).length;
  const latestOrder = recentOrders[0];
  const displayName =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : user.email;
  const recentOrderIds = recentOrders.map((order) => order.id);
  const recentOrderItems =
    recentOrderIds.length > 0
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
          .where(inArray(orderItems.orderId, recentOrderIds))
      : [];
  const orderPreviewsByOrderId = new Map<string, OrderPreviewItem[]>();

  for (const item of recentOrderItems) {
    const current = orderPreviewsByOrderId.get(item.orderId) ?? [];
    current.push({
      title: item.title?.[activeLocale] ?? item.title?.en ?? item.slug,
      imageSrc: getProductImageSrc(item.imageUrl, "thumb"),
      quantity: item.quantity,
    });
    orderPreviewsByOrderId.set(item.orderId, current);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8">
        <p className="text-3xl font-black tracking-tight">
          {activeLocale === "ro" ? "Bună" : "Hello"},{" "}
          <span>{displayName}</span>
        </p>
      </div>

      {saved === "1" && (
        <div className="mb-6 border border-emerald-600 bg-emerald-50 p-4 text-sm font-bold uppercase tracking-wider text-emerald-700">
          Profile saved.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <AccountSidebar locale={activeLocale} />

        <div id="overview" className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                My Account
              </h1>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Profile, saved details and recent orders
              </p>
            </div>
            <div className="text-sm font-bold text-slate-600">
              {user.email}
            </div>
          </div>

          <section id="orders" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-tight">
                Latest Order
              </h2>
              <Link
                href={`/${activeLocale}/account/orders`}
                className="text-sm font-black tracking-tight hover:underline"
              >
                View all your orders
              </Link>
            </div>

            {latestOrder ? (
              <OrderSummaryCard
                locale={activeLocale}
                order={latestOrder}
                previewItems={orderPreviewsByOrderId.get(latestOrder.id) ?? []}
                featured
              />
            ) : (
              <section className="border border-slate-200 p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
                No orders yet.
              </section>
            )}

            {recentOrders.length > 1 && (
              <div className="space-y-3">
                <h2 className="text-xl font-black tracking-tight">
                  Recent Orders
                </h2>
                {recentOrders.slice(1).map((order) => (
                  <OrderSummaryCard
                    key={order.id}
                    locale={activeLocale}
                    order={order}
                    previewItems={orderPreviewsByOrderId.get(order.id) ?? []}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <InfoCard title="Account Since">
              <p>{formatDate(user.created_at)}</p>
            </InfoCard>
            <InfoCard title="Paid Recent Orders">
              <p>{completedOrderCount}</p>
            </InfoCard>
            <InfoCard title="Preferred Delivery">
              <p>
                {profile?.preferredShippingMethod === "easybox"
                  ? "Sameday Easybox"
                  : "Home Address"}
              </p>
            </InfoCard>
          </section>

          <form action={updateCustomerProfile} className="space-y-8">
            <input type="hidden" name="locale" value={activeLocale} />

            <section id="details" className="space-y-5 border border-black p-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Personal Details
                </h2>
                <p className="text-sm text-slate-600">
                  These details are used to prefill checkout.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First Name"
                  name="firstName"
                  defaultValue={firstName}
                />
                <Field
                  label="Last Name"
                  name="lastName"
                  defaultValue={lastName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={profile?.email ?? user.email ?? ""}
                />
                <Field
                  label="Phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                />
              </div>
            </section>

            <section className="space-y-5 border border-black p-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Delivery Details
                </h2>
                <p className="text-sm text-slate-600">
                  Your default shipping address for future orders.
                </p>
              </div>

              <Field
                label="Street Address"
                name="street"
                defaultValue={address.street ?? ""}
              />
              <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                <SamedayLocationPicker
                  initialCountyId={address.samedayCountyId}
                  initialCountyName={address.county}
                  initialCityId={address.samedayCityId}
                  initialCityName={address.city}
                />
                <Field
                  label="Zip Code"
                  name="zip"
                  defaultValue={address.zip ?? ""}
                />
              </div>
            </section>

            <section id="preferences" className="space-y-5 border border-black p-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Preferences
                </h2>
                <p className="text-sm text-slate-600">
                  Save how you prefer to receive your orders.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 border border-black p-3 text-xs font-bold uppercase tracking-widest">
                  <input
                    type="radio"
                    name="preferredShippingMethod"
                    value="address"
                    defaultChecked={
                      profile?.preferredShippingMethod !== "easybox"
                    }
                  />
                  Home Address
                </label>
                <label className="flex items-center gap-3 border border-black p-3 text-xs font-bold uppercase tracking-widest">
                  <input
                    type="radio"
                    name="preferredShippingMethod"
                    value="easybox"
                    defaultChecked={
                      profile?.preferredShippingMethod === "easybox"
                    }
                  />
                  Sameday Easybox
                </label>
              </div>
              <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-600">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  defaultChecked={profile?.marketingOptIn ?? false}
                />
                Email me about new drops and order updates.
              </label>
            </section>

            <Button
              type="submit"
              className="h-12 rounded-none bg-black px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
            >
              Save Profile
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

function OrderSummaryCard({
  locale,
  order,
  previewItems,
  featured = false,
}: {
  locale: "en" | "ro";
  order: typeof orders.$inferSelect;
  previewItems: OrderPreviewItem[];
  featured?: boolean;
}) {
  return (
    <section className="overflow-hidden border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm font-black">
          <span>{formatDate(order.createdAt.toISOString())}</span>
          <span>TT-{order.orderNumber}</span>
          <StatusBadge value={order.paymentStatus} className="px-2 py-1" />
          <StatusBadge value={order.fulfillmentStatus} className="px-2 py-1" />
        </div>
        <Link
          href={`/${locale}/orders/${order.orderNumber}`}
          className="text-sm font-black hover:underline"
        >
          View
        </Link>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {featured ? "Most recent order" : "Order summary"}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight">
            {(order.totalAmount / 100).toFixed(2)} RON
          </p>
        </div>
        <OrderPreviewStrip items={previewItems} />
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-none border-black px-5 text-xs font-bold uppercase tracking-widest"
          >
            <Link href={`/${locale}/orders/${order.orderNumber}`}>
              Order Status
            </Link>
          </Button>
          {order.trackingUrl && (
            <Button
              asChild
              className="h-11 rounded-none bg-black px-5 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
            >
              <a href={order.trackingUrl} target="_blank" rel="noreferrer">
                Track Order
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={name}
        className="text-xs font-bold uppercase tracking-widest"
      >
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="h-12 rounded-none border-black"
      />
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border border-black p-4 text-sm">
      <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
      <div className="space-y-2 text-slate-700">{children}</div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}
