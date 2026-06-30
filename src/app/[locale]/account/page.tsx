import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { updateCustomerProfile } from "@/lib/actions/profile";
import { getCustomerProfile, type CustomerProfileAddress } from "@/lib/customer-profile";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { SamedayLocationPicker } from "@/components/shipping/SamedayLocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            My Account
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Profile, saved details and recent orders
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/account/orders`}>All Orders</Link>
        </Button>
      </div>

      {saved === "1" && (
        <div className="mb-6 border border-emerald-600 bg-emerald-50 p-4 text-sm font-bold uppercase tracking-wider text-emerald-700">
          Profile saved.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="rounded-none border-black shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase tracking-tighter">
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCustomerProfile} className="space-y-6">
              <input type="hidden" name="locale" value={activeLocale} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First Name" name="firstName" defaultValue={firstName} />
                <Field label="Last Name" name="lastName" defaultValue={lastName} />
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

              <div className="space-y-4 border-t border-slate-200 pt-6">
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Default Delivery Details
                </h2>
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
                  <Field label="Zip Code" name="zip" defaultValue={address.zip ?? ""} />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-6">
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Preferences
                </h2>
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
              </div>

              <Button
                type="submit"
                className="h-11 rounded-none bg-black px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
              >
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <InfoCard title="Account">
            <p>{user.email}</p>
            <p>Created {formatDate(user.created_at)}</p>
            <p>{completedOrderCount} paid recent orders</p>
          </InfoCard>

          <InfoCard title="Recent Orders">
            {recentOrders.length === 0 ? (
              <p>No orders yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/${activeLocale}/orders/${order.orderNumber}`}
                    className="block py-3 hover:text-slate-500"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black">TT-{order.orderNumber}</span>
                      <span>{(order.totalAmount / 100).toFixed(2)} RON</span>
                    </div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      {order.paymentStatus} / {order.fulfillmentStatus}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </InfoCard>
        </aside>
      </div>
    </main>
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
        className="h-11 rounded-none border-black"
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
