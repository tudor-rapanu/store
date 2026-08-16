"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitOptionValues } from "./admin-product-form-utils";
import type { ProductVariantsController } from "./use-product-variants";

type ProductVariantsSectionProps = {
  controller: ProductVariantsController;
  onGenerateMatrix: () => void;
};

export function ProductVariantsSection({
  controller,
  onGenerateMatrix,
}: ProductVariantsSectionProps) {
  return (
    <section className="space-y-4 border border-black p-4">
      <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <input
          type="checkbox"
          checked={controller.enabled}
          onChange={(event) => controller.setEnabled(event.target.checked)}
          className="size-4"
        />{" "}
        Enable variants
      </label>

      {controller.enabled && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest">
                Variant Types
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={controller.addOption}
                className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
              >
                <Plus size={14} /> Type
              </Button>
            </div>
            {controller.options.map((option) => (
              <div key={option.id} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <Input
                  value={option.name}
                  onChange={(event) =>
                    controller.updateOption(option.id, "name", event.target.value)
                  }
                  placeholder="size"
                  className="rounded-none border-black h-10"
                />
                <Input
                  value={option.values}
                  onChange={(event) =>
                    controller.updateOption(option.id, "values", event.target.value)
                  }
                  placeholder="S, M, L"
                  className="rounded-none border-black h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => controller.removeOption(option.id)}
                  className="rounded-none border-black"
                  aria-label="Delete variant type"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest">Variants</h3>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateMatrix}
                  className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
                >
                  Generate Matrix
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={controller.addVariant}
                  className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
                >
                  <Plus size={14} /> Variant
                </Button>
              </div>
            </div>
            {controller.rows.map((variant) => (
              <div key={variant.id} className="border border-slate-200 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={variant.name}
                    onChange={(event) =>
                      controller.updateVariant(variant.id, "name", event.target.value)
                    }
                    placeholder="Black / Medium"
                    className="h-9 min-w-44 flex-1 rounded-none border-black"
                  />
                  <Input
                    value={variant.sku}
                    onChange={(event) =>
                      controller.updateVariant(variant.id, "sku", event.target.value)
                    }
                    placeholder="SKU"
                    className="h-9 w-36 rounded-none border-black"
                  />
                  <Input
                    value={variant.price}
                    onChange={(event) =>
                      controller.updateVariant(variant.id, "price", event.target.value)
                    }
                    type="number"
                    step="0.01"
                    placeholder="Price RON"
                    className="h-9 w-28 rounded-none border-black"
                  />
                  <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={variant.trackStock ?? false}
                      onChange={(event) =>
                        controller.updateVariantFields(variant.id, {
                          trackStock: event.target.checked,
                        })
                      }
                      className="size-4"
                    />{" "}
                    Track stock
                  </label>
                  <Input
                    value={variant.stock}
                    onChange={(event) =>
                      controller.updateVariant(variant.id, "stock", event.target.value)
                    }
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Stock"
                    disabled={!variant.trackStock}
                    className="h-9 w-24 rounded-none border-black disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {variant.trackStock && variant.inventorySummary && (
                    <div className="flex h-9 items-center border border-slate-200 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Reserved {variant.inventorySummary.reserved} / Paid{" "}
                      {variant.inventorySummary.paid}
                    </div>
                  )}
                  <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={variant.saleEnabled ?? false}
                      onChange={(event) =>
                        controller.updateVariantFields(variant.id, {
                          saleEnabled: event.target.checked,
                        })
                      }
                      className="size-4"
                    />{" "}
                    Sale
                  </label>
                  <Input
                    value={variant.salePrice ?? ""}
                    onChange={(event) =>
                      controller.updateVariantFields(variant.id, {
                        salePrice:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    type="number"
                    step="0.01"
                    placeholder="Sale RON"
                    disabled={!variant.saleEnabled}
                    className="h-9 w-28 rounded-none border-black disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {variant.saleEnabled && (
                    <>
                      <Input
                        value={variant.saleStartsAt ? String(variant.saleStartsAt) : ""}
                        onChange={(event) =>
                          controller.updateVariantFields(variant.id, {
                            saleStartsAt: event.target.value,
                          })
                        }
                        type="datetime-local"
                        className="h-9 w-44 rounded-none border-black"
                      />
                      <Input
                        value={variant.saleEndsAt ? String(variant.saleEndsAt) : ""}
                        onChange={(event) =>
                          controller.updateVariantFields(variant.id, {
                            saleEndsAt: event.target.value,
                          })
                        }
                        type="datetime-local"
                        className="h-9 w-44 rounded-none border-black"
                      />
                    </>
                  )}
                  {controller.options
                    .filter((option) => option.name.trim())
                    .map((option) => (
                      <label key={option.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {option.name}
                        </span>
                        <select
                          value={variant.attributes[option.name.trim()] ?? ""}
                          onChange={(event) =>
                            controller.updateVariantAttribute(
                              variant.id,
                              option.name.trim(),
                              event.target.value,
                            )
                          }
                          className="h-9 w-32 rounded-none border border-black bg-white px-2 text-sm"
                        >
                          {splitOptionValues(option.values).map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => controller.removeVariant(variant.id)}
                    className="h-9 w-9 rounded-none border-black"
                    aria-label="Delete variant"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
