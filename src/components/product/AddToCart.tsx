"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { useCart } from "@/lib/store/useCart";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatEur, formatRon } from "@/lib/currency/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Variant {
  id: string;
  name?: string | null;
  sku: string;
  attributes: Record<string, string>;
  price?: number | null;
  priceAdjustment: number;
  stock: number;
}

interface AddToCartProps {
  product: { id: string; slug: string; title: string; basePrice: number };
  variants: Variant[];
  displayCurrency?: "RON" | "EUR";
  ronToEurRate?: number;
}

export function AddToCart({
  product,
  variants,
  displayCurrency = "RON",
  ronToEurRate = 0.2,
}: AddToCartProps) {
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(
    {},
  );
  const addItem = useCart((state) => state.addItem);
  const [wasAdded, setWasAdded] = useState(false);
  const isSimpleProduct = variants.length === 0;

  const attributeKeys = Object.keys(variants[0]?.attributes || {});
  const hasSelectedAllAttributes = attributeKeys.every((key) =>
    Boolean(selectedAttrs[key]),
  );
  const selectedVariant = hasSelectedAllAttributes
    ? variants.find((v) =>
        Object.entries(selectedAttrs).every(
          ([key, val]) => v.attributes[key] === val,
        ),
      )
    : undefined;

  const finalPrice =
    selectedVariant?.price ??
    product.basePrice + (selectedVariant?.priceAdjustment || 0);
  const displayPrice =
    displayCurrency === "EUR"
      ? formatEur(finalPrice, ronToEurRate)
      : formatRon(finalPrice);

  const handleAdd = () => {
    if (isSimpleProduct) {
      addItem({
        productId: product.id,
        variantId: product.id,
        title: product.title,
        price: product.basePrice,
        sku: product.slug,
        quantity: 1,
      });
      posthog.capture("add_to_cart", {
        product_id: product.id,
        product_title: product.title,
        product_slug: product.slug,
        price: product.basePrice,
        currency: "RON",
      });
      setWasAdded(true);
      window.setTimeout(() => setWasAdded(false), 1600);
      return;
    }

    if (selectedVariant) {
      addItem({
        productId: product.id,
        variantId: selectedVariant.id,
        title:
          selectedVariant.name ||
          `${product.title} (${Object.values(selectedAttrs).join(" / ")})`,
        price: finalPrice,
        sku: selectedVariant.sku,
        quantity: 1,
      });
      posthog.capture("add_to_cart", {
        product_id: product.id,
        product_title: product.title,
        product_slug: product.slug,
        variant_id: selectedVariant.id,
        variant_sku: selectedVariant.sku,
        variant_attributes: selectedAttrs,
        price: finalPrice,
        currency: "RON",
      });
      setWasAdded(true);
      window.setTimeout(() => setWasAdded(false), 1600);
    }
  };

  return (
    <div className="space-y-6 pt-6">
      {!isSimpleProduct && (
        <div className="grid grid-cols-2 gap-4">
          {attributeKeys.map((key) => (
            <div key={key} className="space-y-2">
              <Label className="uppercase tracking-widest text-xs font-bold">
                {key}
              </Label>
              <Select
                onValueChange={(val: string) =>
                  setSelectedAttrs({ ...selectedAttrs, [key]: val })
                }
              >
                <SelectTrigger className="rounded-none border-black">
                  <SelectValue placeholder={`SELECT ${key.toUpperCase()}`} />
                </SelectTrigger>
                <SelectContent className="rounded-none border-black">
                  {Array.from(
                    new Set(variants.map((v) => v.attributes[key])),
                  ).map((val) => (
                    <SelectItem
                      key={val}
                      value={val}
                      className="rounded-none uppercase text-xs font-bold"
                    >
                      {val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      <div className="text-2xl font-black tracking-tighter">{displayPrice}</div>

      <Button
        onClick={handleAdd}
        disabled={
          (!isSimpleProduct && !selectedVariant) || selectedVariant?.stock === 0
        }
        className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold text-sm"
      >
        {selectedVariant?.stock === 0
          ? "Out of Stock"
          : wasAdded
            ? "Added"
            : "Add to Cart"}
      </Button>
    </div>
  );
}
