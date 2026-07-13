import Link from "next/link";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { StatusBadge } from "@/components/order/StatusBadge";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";
import { markStaleNetopiaOrdersFailed } from "@/lib/actions/orders";
import { db } from "@/lib/db";
import {
  type FulfillmentStatus,
  orders,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Admin Orders",
};

type AdminOrdersPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
  searchParams: Promise<Readonly<{
    page?: string;
    q?: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    paymentMethod?: string;
  }>>;
}>;

const ORDERS_PER_PAGE = 12;
const paymentStatusOptions: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
const fulfillmentStatusOptions: FulfillmentStatus[] = [
  "new",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];
const paymentMethodOptions: PaymentMethod[] = ["card", "bank_transfer"];

function getPaymentStatus(value?: string) {
  return paymentStatusOptions.find((option) => option === value);
}

function getFulfillmentStatus(value?: string) {
  return fulfillmentStatusOptions.find((option) => option === value);
}

function getPaymentMethod(value?: string) {
  return paymentMethodOptions.find((option) => option === value);
}

type OrderFilters = Awaited<AdminOrdersPageProps["searchParams"]>;

function parseOrderFilters(filters: OrderFilters) {
  const requestedPage = Math.max(Number.parseInt(filters.page ?? "1", 10) || 1, 1);
  const searchTerm = filters.q?.trim() ?? "";

  return {
    requestedPage,
    searchTerm,
    paymentStatus: getPaymentStatus(filters.paymentStatus),
    fulfillmentStatus: getFulfillmentStatus(filters.fulfillmentStatus),
    paymentMethod: getPaymentMethod(filters.paymentMethod),
  };
}

function getOrderWhereClause(filters: ReturnType<typeof parseOrderFilters>) {
  const searchNumber = filters.searchTerm.replace(/^TT-/i, "");
  const parsedOrderNumber = Number.parseInt(searchNumber, 10);
  const searchCondition = filters.searchTerm
    ? or(
        Number.isFinite(parsedOrderNumber)
          ? eq(orders.orderNumber, parsedOrderNumber)
          : undefined,
        ilike(orders.customerEmail, `%${filters.searchTerm}%`),
        ilike(orders.customerFirstName, `%${filters.searchTerm}%`),
        ilike(orders.customerLastName, `%${filters.searchTerm}%`),
        ilike(orders.customerPhone, `%${filters.searchTerm}%`),
        ilike(orders.awbNumber, `%${filters.searchTerm}%`),
      )
    : undefined;
  const conditions = [
    filters.paymentStatus ? eq(orders.paymentStatus, filters.paymentStatus) : undefined,
    filters.fulfillmentStatus
      ? eq(orders.fulfillmentStatus, filters.fulfillmentStatus)
      : undefined,
    filters.paymentMethod ? eq(orders.paymentMethod, filters.paymentMethod) : undefined,
    searchCondition,
  ].filter(Boolean);

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function getOrderBaseQuery(filters: ReturnType<typeof parseOrderFilters>) {
  const baseQuery = new URLSearchParams();

  if (filters.searchTerm) baseQuery.set("q", filters.searchTerm);
  if (filters.paymentStatus) baseQuery.set("paymentStatus", filters.paymentStatus);
  if (filters.fulfillmentStatus) {
    baseQuery.set("fulfillmentStatus", filters.fulfillmentStatus);
  }
  if (filters.paymentMethod) baseQuery.set("paymentMethod", filters.paymentMethod);

  return baseQuery;
}

function getPageHref(activeLocale: string, baseQuery: URLSearchParams, page: number) {
  const query = new URLSearchParams(baseQuery);
  query.set("page", String(page));

  return `/${activeLocale}/admin/orders?${query.toString()}`;
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: AdminOrdersPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  await markStaleNetopiaOrdersFailed();

  const filters = parseOrderFilters(await searchParams);
  const whereClause = getOrderWhereClause(filters);
  const [totalResult] = await db
    .select({ value: count() })
    .from(orders)
    .where(whereClause);
  const totalOrders = totalResult?.value ?? 0;
  const totalPages = Math.max(Math.ceil(totalOrders / ORDERS_PER_PAGE), 1);
  const currentPage = Math.min(filters.requestedPage, totalPages);
  const offset = (currentPage - 1) * ORDERS_PER_PAGE;
  const items = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerFirstName: orders.customerFirstName,
      customerLastName: orders.customerLastName,
      customerEmail: orders.customerEmail,
      customerPhone: orders.customerPhone,
      paymentStatus: orders.paymentStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(ORDERS_PER_PAGE)
    .offset(offset);
  const baseQuery = getOrderBaseQuery(filters);

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Orders</h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Order Management
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/admin/products`}>Products</Link>
        </Button>
      </div>

      <form className="mb-6 grid gap-3 border border-black p-4 md:grid-cols-[1fr_180px_180px_180px_auto]">
        <input
          name="q"
          defaultValue={filters.searchTerm}
          placeholder="Order, email, phone, AWB"
          className="h-10 rounded-none border border-black px-3 text-sm"
        />
        <FilterSelect
          name="paymentStatus"
          value={filters.paymentStatus}
          label="Payment"
          options={paymentStatusOptions}
        />
        <FilterSelect
          name="fulfillmentStatus"
          value={filters.fulfillmentStatus}
          label="Status"
          options={fulfillmentStatusOptions}
        />
        <FilterSelect
          name="paymentMethod"
          value={filters.paymentMethod}
          label="Method"
          options={paymentMethodOptions}
        />
        <Button
          type="submit"
          className="h-10 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
        >
          Filter
        </Button>
      </form>

      <div className="divide-y divide-black border border-black">
        {items.length === 0 ? (
          <div className="p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            No orders found.
          </div>
        ) : (
          items.map((order) => (
            <div
              key={order.id}
              className="grid gap-4 p-4 lg:grid-cols-[120px_1fr_160px_160px_120px_auto] lg:items-center"
            >
              <div className="font-black uppercase tracking-tight">
                TT-{order.orderNumber}
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight">
                  {order.customerFirstName} {order.customerLastName}
                </div>
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  {order.customerEmail} / {order.customerPhone}
                </div>
              </div>
              <StatusBadge value={order.paymentStatus} />
              <StatusBadge value={order.fulfillmentStatus} />
              <div className="text-sm font-bold">
                {(order.totalAmount / 100).toFixed(2)} RON
              </div>
              <Button
                asChild
                className="rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
              >
                <Link href={`/${activeLocale}/admin/orders/${order.id}`}>Details</Link>
              </Button>
            </div>
          ))
        )}
      </div>

      {totalOrders > ORDERS_PER_PAGE && (
        <nav className="mt-6 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-widest">
          <Button
            asChild
            variant="outline"
            className={`rounded-none border-black text-xs font-bold uppercase tracking-widest ${
              currentPage <= 1 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Link href={getPageHref(activeLocale, baseQuery, Math.max(currentPage - 1, 1))}>
              Previous
            </Link>
          </Button>
          <span className="text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            className={`rounded-none border-black text-xs font-bold uppercase tracking-widest ${
              currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Link href={getPageHref(activeLocale, baseQuery, Math.min(currentPage + 1, totalPages))}>
              Next
            </Link>
          </Button>
        </nav>
      )}
    </main>
  );
}

function FilterSelect({
  name,
  value,
  label,
  options,
}: {
  name: string;
  value?: string;
  label: string;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="h-10 rounded-none border border-black bg-white px-3 text-sm"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
