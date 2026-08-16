"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductCommerceController } from "./use-product-commerce";

type ProductFulfillmentSectionProps = {
  controller: ProductCommerceController;
};

export function ProductFulfillmentSection({
  controller,
}: ProductFulfillmentSectionProps) {
  const { state, update } = controller;

  return (
    <section className="space-y-4 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">
          Fulfillment Estimate
        </h2>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Used to estimate shipping dates in checkout and order emails.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="productionMinDays"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Minimum Business Days
          </Label>
          <Input
            id="productionMinDays"
            name="productionMinDays"
            type="number"
            min={1}
            step={1}
            value={state.productionMinDays}
            onChange={(event) => update("productionMinDays", event.target.value)}
            className="rounded-none border-black h-12"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="productionMaxDays"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Maximum Business Days
          </Label>
          <Input
            id="productionMaxDays"
            name="productionMaxDays"
            type="number"
            min={1}
            step={1}
            value={state.productionMaxDays}
            onChange={(event) => update("productionMaxDays", event.target.value)}
            className="rounded-none border-black h-12"
          />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <input
          type="checkbox"
          name="preorderEnabled"
          checked={state.preorderEnabled}
          onChange={(event) => update("preorderEnabled", event.target.checked)}
          className="size-4"
        />{" "}
        Enable preorder
      </label>
      {state.preorderEnabled && (
        <div className="space-y-2">
          <Label
            htmlFor="preorderShipDate"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Shipping Starts From
          </Label>
          <Input
            id="preorderShipDate"
            name="preorderShipDate"
            type="datetime-local"
            value={state.preorderShipDate}
            onChange={(event) => update("preorderShipDate", event.target.value)}
            className="rounded-none border-black h-12"
          />
        </div>
      )}
    </section>
  );
}
