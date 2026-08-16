"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDigitalFile } from "./admin-product-form.types";
import type { ProductCommerceController } from "./use-product-commerce";

type ProductDigitalSectionProps = {
  digitalFiles: ProductDigitalFile[];
  controller: ProductCommerceController;
};

export function ProductDigitalSection({
  digitalFiles,
  controller,
}: ProductDigitalSectionProps) {
  const { state, update } = controller;

  return (
    <section className="space-y-4 border border-black p-4">
      <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <input
          type="checkbox"
          name="isDigital"
          checked={state.isDigital}
          onChange={(event) => update("isDigital", event.target.checked)}
          className="size-4"
        />
        Digital downloadable product
      </label>
      {state.isDigital && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Digital products have no shipping cost or fulfillment estimate. Files are
            only downloadable after payment.
          </p>
          {digitalFiles.length > 0 && (
            <div className="divide-y divide-slate-200 border border-slate-200">
              {digitalFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <span className="font-bold uppercase tracking-wider">
                    {file.fileName}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label
              htmlFor="digitalFiles"
              className="uppercase text-xs font-bold tracking-widest"
            >
              Protected Files
            </Label>
            <Input
              id="digitalFiles"
              name="digitalFiles"
              type="file"
              multiple
              className="rounded-none border-black h-12"
            />
          </div>
        </div>
      )}
    </section>
  );
}
