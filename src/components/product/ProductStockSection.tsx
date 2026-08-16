"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventorySummary } from "./admin-product-form.types";
import type { ProductCommerceController } from "./use-product-commerce";

type ProductStockSectionProps = {
  inventorySummary?: InventorySummary;
  controller: ProductCommerceController;
};

export function ProductStockSection({
  inventorySummary,
  controller,
}: ProductStockSectionProps) {
  const { state, update } = controller;

  return (
    <section className="space-y-4 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">Product Stock</h2>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Leave stock tracking disabled for permanent or made-to-order products.
        </p>
      </div>
      <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <input
          type="checkbox"
          name="trackStock"
          checked={state.trackStock}
          onChange={(event) => update("trackStock", event.target.checked)}
          className="size-4"
        />{" "}
        Track stock for this product
      </label>
      {state.trackStock && (
        <div className="space-y-2">
          <Label
            htmlFor="stock"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Available Stock
          </Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            value={state.stock}
            onChange={(event) => update("stock", event.target.value)}
            className="rounded-none border-black h-12"
          />
          {inventorySummary && (
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Reserved in pending orders: {inventorySummary.reserved} / Paid orders:{" "}
              {inventorySummary.paid}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
