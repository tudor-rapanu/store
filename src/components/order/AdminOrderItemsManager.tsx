"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderItemSummary = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
};

type ProductOption = {
  id: string;
  title: string;
  basePrice: number;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number | null;
  }>;
};

export function AdminOrderItemsManager({
  orderId,
  fulfillmentStatus,
  items,
  products,
}: {
  orderId: string;
  fulfillmentStatus: string;
  items: OrderItemSummary[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selectedProduct = products.find((product) => product.id === productId);
  const [variantId, setVariantId] = useState("");
  const selectedVariant = selectedProduct?.variants.find(
    (variant) => variant.id === variantId,
  );
  const initialUnitPrice =
    (selectedVariant?.price ?? selectedProduct?.basePrice ?? 0) / 100;
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasVariants = Boolean(selectedProduct?.variants.length);
  const canAddItems = ["new", "processing"].includes(fulfillmentStatus);
  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [items],
  );

  function selectProduct(nextProductId: string) {
    const nextProduct = products.find((product) => product.id === nextProductId);

    setProductId(nextProductId);
    setVariantId("");
    setUnitPrice((nextProduct?.basePrice ?? 0) / 100);
  }

  function selectVariant(nextVariantId: string) {
    const nextVariant = selectedProduct?.variants.find(
      (variant) => variant.id === nextVariantId,
    );

    setVariantId(nextVariantId);
    setUnitPrice((nextVariant?.price ?? selectedProduct?.basePrice ?? 0) / 100);
  }

  async function addItem() {
    setError(null);
    setPendingKey("add");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId: variantId || null,
          quantity,
          unitPrice,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The item could not be added.");
      }

      router.refresh();
      setIsAddFormOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The item could not be added.");
    } finally {
      setPendingKey(null);
    }
  }

  async function removeItem(itemId: string) {
    const confirmed = window.confirm("Remove this item from the order?");

    if (!confirmed) {
      return;
    }

    setError(null);
    setPendingKey(itemId);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The item could not be removed.");
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "The item could not be removed.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="space-y-4 border border-black p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">
            Ordered Products
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Line subtotal {(subtotal / 100).toFixed(2)} RON
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!canAddItems}
          onClick={() => setIsAddFormOpen((current) => !current)}
          className="h-10 rounded-none border-black text-xs font-black uppercase tracking-widest"
        >
          {isAddFormOpen ? "Close" : "Add Product"}
        </Button>
      </div>

      {isAddFormOpen && (
        <div className="grid gap-3 border border-slate-200 p-3 md:grid-cols-[1fr_1fr_90px_120px_auto] md:items-end">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest">Product</span>
            <select
              value={productId}
              onChange={(event) => selectProduct(event.target.value)}
              className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest">Variant</span>
            <select
              value={variantId}
              disabled={!hasVariants}
              onChange={(event) => selectVariant(event.target.value)}
              className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm disabled:opacity-50"
            >
              <option value="">No variant</option>
              {selectedProduct?.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} / {variant.sku}
                </option>
              ))}
            </select>
          </label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-10 rounded-none border-black"
            aria-label="Quantity"
          />
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(Number(event.target.value))}
            className="h-10 rounded-none border-black"
            aria-label="Unit price"
          />
          <Button
            type="button"
            disabled={!productId || pendingKey === "add"}
            onClick={addItem}
            className="h-10 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            {pendingKey === "add" ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-sm font-bold uppercase tracking-wider text-destructive">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-sm text-slate-500">
          No order items were recorded for this order yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
            >
              <div>
                <div className="font-bold uppercase tracking-tight">{item.title}</div>
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  {item.sku}
                </div>
              </div>
              <div className="font-bold">x{item.quantity}</div>
              <div className="font-bold">{(item.unitPrice / 100).toFixed(2)} RON</div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pendingKey === item.id}
                onClick={() => removeItem(item.id)}
                className="rounded-none border-black"
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
