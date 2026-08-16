"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductCommerceController } from "./use-product-commerce";

type ProductPricingSectionProps = {
  slug: string;
  onSlugChange: (value: string) => void;
  controller: ProductCommerceController;
};

export function ProductPricingSection({
  slug,
  onSlugChange,
  controller,
}: ProductPricingSectionProps) {
  const { state, update } = controller;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="slug" className="uppercase text-xs font-bold tracking-widest">
            URL Slug
          </Label>
          <Input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            className="rounded-none border-black h-12"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="price"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Base Price (RON)
          </Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            required
            value={state.basePrice}
            onChange={(event) => update("basePrice", event.target.value)}
            className="rounded-none border-black h-12"
          />
        </div>
      </div>

      <section className="space-y-4 border border-black p-4">
        <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
          <input
            type="checkbox"
            name="saleEnabled"
            checked={state.saleEnabled}
            onChange={(event) => update("saleEnabled", event.target.checked)}
            className="size-4"
          />
          Enable product sale price
        </label>
        {state.saleEnabled && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                htmlFor="salePrice"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Sale Price (RON)
              </Label>
              <Input
                id="salePrice"
                name="salePrice"
                type="number"
                step="0.01"
                value={state.salePrice}
                onChange={(event) => update("salePrice", event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="saleStartsAt"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Starts At
              </Label>
              <Input
                id="saleStartsAt"
                name="saleStartsAt"
                type="datetime-local"
                value={state.saleStartsAt}
                onChange={(event) => update("saleStartsAt", event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="saleEndsAt"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Ends At
              </Label>
              <Input
                id="saleEndsAt"
                name="saleEndsAt"
                type="datetime-local"
                value={state.saleEndsAt}
                onChange={(event) => update("saleEndsAt", event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
