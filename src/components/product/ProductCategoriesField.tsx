"use client";

import Link from "next/link";

import { Label } from "@/components/ui/label";
import type { AvailableProductCategory } from "./admin-product-form.types";
import type { ProductCategoriesController } from "./use-product-categories";

type ProductCategoriesFieldProps = {
  locale: "en" | "ro";
  availableCategories: AvailableProductCategory[];
  controller: ProductCategoriesController;
};

export function ProductCategoriesField({
  locale,
  availableCategories,
  controller,
}: ProductCategoriesFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="uppercase text-xs font-bold tracking-widest">Categories</Label>
      <details className="group relative">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between border border-black px-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="truncate">
            {controller.selected.length > 0
              ? controller.labels.join(", ")
              : "Select categories"}
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-open:hidden">
            Open
          </span>
          <span className="hidden text-xs font-black uppercase tracking-widest text-slate-500 group-open:inline">
            Close
          </span>
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto border border-black bg-white p-3 shadow-lg">
          {availableCategories.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                No categories yet.
              </p>
              <Link
                href={`/${locale}/admin/categories`}
                className="text-xs font-black uppercase tracking-widest underline"
              >
                Create categories
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {availableCategories.map((category) => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-3 text-sm font-bold uppercase tracking-widest"
                  style={{
                    paddingLeft: `${(category.depth ?? 0) * 16}px`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={controller.selected.includes(category.value)}
                    onChange={() => controller.toggle(category.value)}
                    className="size-4"
                  />
                  {category.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
