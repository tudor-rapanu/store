"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/order/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type FulfillmentStatus,
  type InvoiceStatus,
  type PaymentStatus,
  type ShippingMethod,
} from "@/lib/db/schema";

type EditableOrder = {
  id: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  shippingMethod: ShippingMethod;
  awbNumber: string | null;
  trackingUrl: string | null;
  adminNotes: string | null;
  customerNotes: string | null;
  invoiceStatus: InvoiceStatus;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  fgoInvoiceId: string | null;
};

const paymentStatuses: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
const fulfillmentStatuses: FulfillmentStatus[] = [
  "new",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];
const shippingMethods: ShippingMethod[] = ["address", "easybox", "international"];
const invoiceStatuses: InvoiceStatus[] = ["not_generated", "generated", "failed"];

export function AdminOrderEditor({ order }: { order: EditableOrder }) {
  const router = useRouter();
  const [draft, setDraft] = useState(order);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const isInternational = draft.shippingMethod === "international";

  async function saveOrder() {
    setMessage(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The order could not be saved.");
      }

      setMessage("Order updated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The order could not be saved.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="space-y-6 border border-black p-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={draft.paymentStatus} className="py-1" />
        <StatusBadge value={draft.fulfillmentStatus} className="py-1" />
        <StatusBadge value={draft.invoiceStatus} className="py-1" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          label="Payment status"
          value={draft.paymentStatus}
          options={paymentStatuses}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              paymentStatus: value as PaymentStatus,
            }))
          }
        />
        <SelectField
          label="Order status"
          value={draft.fulfillmentStatus}
          options={fulfillmentStatuses}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              fulfillmentStatus: value as FulfillmentStatus,
            }))
          }
        />
        <SelectField
          label="Shipping method"
          value={draft.shippingMethod}
          options={shippingMethods}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              shippingMethod: value as ShippingMethod,
            }))
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label={isInternational ? "Posta Romana tracking number" : "AWB number"}
          value={draft.awbNumber ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, awbNumber: value }))
          }
        />
        <TextField
          label={isInternational ? "Tracking URL" : "AWB tracking URL"}
          value={draft.trackingUrl ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, trackingUrl: value }))
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          label="Invoice status"
          value={draft.invoiceStatus}
          options={invoiceStatuses}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              invoiceStatus: value as InvoiceStatus,
            }))
          }
        />
        <TextField
          label="Invoice number"
          value={draft.invoiceNumber ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, invoiceNumber: value }))
          }
        />
        <TextField
          label="FGO invoice ID"
          value={draft.fgoInvoiceId ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, fgoInvoiceId: value }))
          }
        />
      </div>

      <TextField
        label="Invoice URL"
        value={draft.invoiceUrl ?? ""}
        onChange={(value) => setDraft((current) => ({ ...current, invoiceUrl: value }))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField
          label="Admin notes"
          value={draft.adminNotes ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, adminNotes: value }))
          }
        />
        <TextareaField
          label="Customer notes"
          value={draft.customerNotes ?? ""}
          onChange={(value) =>
            setDraft((current) => ({ ...current, customerNotes: value }))
          }
        />
      </div>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-widest">
          {message}
        </div>
      )}

      <Button
        type="button"
        disabled={isPending}
        onClick={saveOrder}
        className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
      >
        {isPending ? "Saving..." : "Save Order"}
      </Button>
    </section>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-none border-black"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </label>
  );
}
