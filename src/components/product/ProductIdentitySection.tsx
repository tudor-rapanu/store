"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslatedText } from "@/lib/i18n/text";
import type { ProductFormProduct } from "./admin-product-form.types";

type ProductIdentitySectionProps = {
  product?: ProductFormProduct;
  onEnglishTitleChange: (value: string) => void;
};

export function ProductIdentitySection({
  product,
  onEnglishTitleChange,
}: ProductIdentitySectionProps) {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="titleEn"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Title (English)
          </Label>
          <Input
            id="titleEn"
            name="titleEn"
            required
            defaultValue={getTranslatedText(product?.title, "en")}
            onChange={(event) => onEnglishTitleChange(event.target.value)}
            className="h-12 rounded-none border-black"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="titleRo"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Title (Romanian)
          </Label>
          <Input
            id="titleRo"
            name="titleRo"
            required
            defaultValue={getTranslatedText(product?.title, "ro")}
            className="h-12 rounded-none border-black"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="descriptionEn"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Description (English)
          </Label>
          <textarea
            id="descriptionEn"
            name="descriptionEn"
            rows={5}
            defaultValue={product?.description?.en ?? ""}
            className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="descriptionRo"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Description (Romanian)
          </Label>
          <textarea
            id="descriptionRo"
            name="descriptionRo"
            rows={5}
            defaultValue={product?.description?.ro ?? ""}
            className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
    </section>
  );
}
