"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DiscountKind,
  DiscountScope,
  DiscountType,
} from "@/lib/db/schema";

type DiscountRow = {
  id: string;
  name: string;
  code: string | null;
  kind: DiscountKind;
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  enabled: boolean;
  expiresAt: Date | string | null;
  productId: string | null;
  categoryId: string | null;
};

type Option = {
  id: string;
  label: string;
};

type AdminDiscountManagerProps = {
  discounts: DiscountRow[];
  products: Option[];
  categories: Option[];
};

function formatValue(discount: DiscountRow) {
  return discount.type === "percentage"
    ? `${discount.value}%`
    : `${(discount.value / 100).toFixed(2)} RON`;
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "No expiration";
  }

  return new Date(value).toLocaleDateString("ro-RO");
}

export function AdminDiscountManager({
  discounts,
  products,
  categories,
}: AdminDiscountManagerProps) {
  const router = useRouter();
  const [kind, setKind] = useState<DiscountKind>("automatic");
  const [type, setType] = useState<DiscountType>("percentage");
  const [scope, setScope] = useState<DiscountScope>("storewide");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createDiscount(formData: FormData) {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
          kind,
          type,
          scope,
          value:
            type === "fixed"
              ? Math.round(Number(formData.get("value")) * 100)
              : Number(formData.get("value")),
          productId: formData.get("productId"),
          categoryId: formData.get("categoryId"),
          expiresAt: formData.get("expiresAt"),
          enabled: formData.get("enabled") === "on",
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not create discount.");
      }

      setMessage("Discount created.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create discount.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function setEnabled(id: string, enabled: boolean) {
    setMessage(null);
    const response = await fetch(`/api/admin/discounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      setMessage("Could not update discount.");
      return;
    }

    router.refresh();
  }

  async function updateDiscount(
    id: string,
    formData: FormData,
    state: {
      kind: DiscountKind;
      type: DiscountType;
      scope: DiscountScope;
    },
  ) {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
          kind: state.kind,
          type: state.type,
          scope: state.scope,
          value:
            state.type === "fixed"
              ? Math.round(Number(formData.get("value")) * 100)
              : Number(formData.get("value")),
          productId: formData.get("productId"),
          categoryId: formData.get("categoryId"),
          expiresAt: formData.get("expiresAt"),
          enabled: formData.get("enabled") === "on",
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not update discount.");
      }

      setEditingId(null);
      setMessage("Discount updated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update discount.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDiscount(id: string) {
    if (!window.confirm("Delete this discount?")) {
      return;
    }

    setMessage(null);
    const response = await fetch(`/api/admin/discounts/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setMessage("Could not delete discount.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void createDiscount(new FormData(event.currentTarget));
        }}
        className="space-y-4 border border-black p-4"
      >
        <h2 className="text-sm font-black uppercase tracking-widest">
          New Discount
        </h2>

        <Field label="Name">
          <Input
            name="name"
            required
            className="h-12 rounded-none border-black"
          />
        </Field>

        <Field label="Mode">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DiscountKind)}
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="automatic">Automatic</option>
            <option value="voucher">Voucher code</option>
          </select>
        </Field>

        {kind === "voucher" && (
          <Field label="Voucher Code">
            <Input
              name="code"
              required
              className="h-12 rounded-none border-black uppercase"
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as DiscountType)}
              className="h-12 w-full rounded-none border border-black bg-white px-3"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed RON</option>
            </select>
          </Field>
          <Field label={type === "percentage" ? "Value %" : "Value RON"}>
            <Input
              name="value"
              type="number"
              min="0"
              step={type === "percentage" ? "1" : "0.01"}
              required
              className="h-12 rounded-none border-black"
            />
          </Field>
        </div>

        <Field label="Scope">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as DiscountScope)}
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="storewide">Storewide</option>
            <option value="category">Category</option>
            <option value="product">Product</option>
          </select>
        </Field>

        {scope === "category" && (
          <Field label="Category">
            <select
              name="categoryId"
              required
              className="h-12 w-full rounded-none border border-black bg-white px-3"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {scope === "product" && (
          <Field label="Product">
            <select
              name="productId"
              required
              className="h-12 w-full rounded-none border border-black bg-white px-3"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Expiration">
          <Input
            name="expiresAt"
            type="date"
            className="h-12 rounded-none border-black"
          />
        </Field>

        <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
          <input name="enabled" type="checkbox" defaultChecked />
          Enabled
        </label>

        <Button
          type="submit"
          disabled={isSaving}
          className="h-12 w-full rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
        >
          {isSaving ? "Saving..." : "Create Discount"}
        </Button>

        {message && (
          <p className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
            {message}
          </p>
        )}
      </form>

      <section className="space-y-4">
        {discounts.length === 0 ? (
          <div className="border border-black p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            No discounts yet.
          </div>
        ) : (
          discounts.map((discount) => (
            <div
              key={discount.id}
              className="grid gap-4 border border-black p-4 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              {editingId === discount.id ? (
                <DiscountEditForm
                  discount={discount}
                  products={products}
                  categories={categories}
                  isSaving={isSaving}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(formData, state) =>
                    updateDiscount(discount.id, formData, state)
                  }
                />
              ) : (
                <div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black uppercase tracking-widest">
                        {discount.name}
                      </h3>
                      {!discount.enabled && (
                        <span className="border border-black px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {discount.kind} / {discount.scope} /{" "}
                      {formatValue(discount)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {discount.code ? `Code: ${discount.code}` : "Automatic"} /{" "}
                      {formatDate(discount.expiresAt)}
                    </p>
                  </div>
                </div>
              )}
              {editingId !== discount.id && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingId(discount.id)}
                    className="h-10 rounded-none border-black text-xs font-black uppercase tracking-widest"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEnabled(discount.id, !discount.enabled)}
                    className="h-10 rounded-none border-black text-xs font-black uppercase tracking-widest"
                  >
                    {discount.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => deleteDiscount(discount.id)}
                    className="h-10 rounded-none border-black text-xs font-black uppercase tracking-widest"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function DiscountEditForm({
  discount,
  products,
  categories,
  isSaving,
  onCancel,
  onSubmit,
}: {
  discount: DiscountRow;
  products: Option[];
  categories: Option[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (
    formData: FormData,
    state: {
      kind: DiscountKind;
      type: DiscountType;
      scope: DiscountScope;
    },
  ) => void;
}) {
  const [kind, setKind] = useState<DiscountKind>(discount.kind);
  const [type, setType] = useState<DiscountType>(discount.type);
  const [scope, setScope] = useState<DiscountScope>(discount.scope);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget), { kind, type, scope });
      }}
      className="space-y-4 md:col-span-2"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            defaultValue={discount.name}
            required
            className="h-12 rounded-none border-black"
          />
        </Field>
        <Field label="Mode">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DiscountKind)}
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="automatic">Automatic</option>
            <option value="voucher">Voucher code</option>
          </select>
        </Field>
      </div>

      {kind === "voucher" && (
        <Field label="Voucher Code">
          <Input
            name="code"
            defaultValue={discount.code ?? ""}
            required
            className="h-12 rounded-none border-black uppercase"
          />
        </Field>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Type">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DiscountType)}
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed RON</option>
          </select>
        </Field>
        <Field label={type === "percentage" ? "Value %" : "Value RON"}>
          <Input
            name="value"
            type="number"
            min="0"
            step={type === "percentage" ? "1" : "0.01"}
            defaultValue={
              type === "fixed"
                ? String(discount.value / 100)
                : String(discount.value)
            }
            required
            className="h-12 rounded-none border-black"
          />
        </Field>
        <Field label="Scope">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as DiscountScope)}
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="storewide">Storewide</option>
            <option value="category">Category</option>
            <option value="product">Product</option>
          </select>
        </Field>
      </div>

      {scope === "category" && (
        <Field label="Category">
          <select
            name="categoryId"
            defaultValue={discount.categoryId ?? ""}
            required
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {scope === "product" && (
        <Field label="Product">
          <select
            name="productId"
            defaultValue={discount.productId ?? ""}
            required
            className="h-12 w-full rounded-none border border-black bg-white px-3"
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Expiration">
          <Input
            name="expiresAt"
            type="date"
            defaultValue={toDateInputValue(discount.expiresAt)}
            className="h-12 rounded-none border-black"
          />
        </Field>
        <label className="flex items-center gap-3 pt-8 text-xs font-bold uppercase tracking-widest">
          <input name="enabled" type="checkbox" defaultChecked={discount.enabled} />
          Enabled
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-none border-black text-xs font-black uppercase tracking-widest"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function toDateInputValue(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">
        {label}
      </Label>
      {children}
    </div>
  );
}
