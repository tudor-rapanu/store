"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRODUCT_DETAIL_ICONS, getProductDetailIcon } from "@/lib/product-detail-icons";
import type { ProductDetailsController } from "./use-product-details";

type ProductDetailsSectionProps = {
  controller: ProductDetailsController;
};

export function ProductDetailsSection({ controller }: ProductDetailsSectionProps) {
  return (
    <section className="space-y-4 border border-black p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">
            Product Details
          </h2>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Optional highlights shown on the product page with selectable icons.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={controller.add}
          className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
        >
          <Plus size={14} /> Detail
        </Button>
      </div>

      {controller.rows.length === 0 ? (
        <p className="border border-dashed border-slate-300 p-4 text-xs font-bold uppercase tracking-widest text-slate-500">
          No product details added yet.
        </p>
      ) : (
        <div className="space-y-2">
          {controller.rows.map((detail, index) => {
            const DetailIcon = getProductDetailIcon(detail.icon);

            return (
              <div key={detail.rowId} className="border border-slate-200 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black">
                    <DetailIcon size={16} />
                  </span>
                  <select
                    value={detail.icon}
                    onChange={(event) =>
                      controller.update(detail.rowId, "icon", event.target.value)
                    }
                    aria-label="Detail icon"
                    className="h-9 w-36 rounded-none border border-black bg-white px-2 text-sm"
                  >
                    {PRODUCT_DETAIL_ICONS.map((icon) => (
                      <option key={icon.key} value={icon.key}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={detail.enabled}
                      onChange={(event) =>
                        controller.update(detail.rowId, "enabled", event.target.checked)
                      }
                      className="size-4"
                    />
                    Show
                  </label>
                  <Input
                    value={detail.label.en}
                    onChange={(event) =>
                      controller.updateTranslation(
                        detail.rowId,
                        "label",
                        "en",
                        event.target.value,
                      )
                    }
                    placeholder="Label EN"
                    aria-label="Detail label in English"
                    className="h-9 min-w-32 flex-1 rounded-none border-black"
                  />
                  <Input
                    value={detail.label.ro}
                    onChange={(event) =>
                      controller.updateTranslation(
                        detail.rowId,
                        "label",
                        "ro",
                        event.target.value,
                      )
                    }
                    placeholder="Label RO"
                    aria-label="Detail label in Romanian"
                    className="h-9 min-w-32 flex-1 rounded-none border-black"
                  />
                  <Input
                    value={detail.value.en}
                    onChange={(event) =>
                      controller.updateTranslation(
                        detail.rowId,
                        "value",
                        "en",
                        event.target.value,
                      )
                    }
                    placeholder="Value EN"
                    aria-label="Detail value in English"
                    className="h-9 min-w-40 flex-1 rounded-none border-black"
                  />
                  <Input
                    value={detail.value.ro}
                    onChange={(event) =>
                      controller.updateTranslation(
                        detail.rowId,
                        "value",
                        "ro",
                        event.target.value,
                      )
                    }
                    placeholder="Value RO"
                    aria-label="Detail value in Romanian"
                    className="h-9 min-w-40 flex-1 rounded-none border-black"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => controller.move(index, -1)}
                      className="h-9 w-9 rounded-none border-black"
                      aria-label="Move detail up"
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => controller.move(index, 1)}
                      className="h-9 w-9 rounded-none border-black"
                      aria-label="Move detail down"
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => controller.remove(detail.rowId)}
                      className="h-9 w-9 rounded-none border-black"
                      aria-label="Delete detail"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
