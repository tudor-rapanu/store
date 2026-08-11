"use client";

import { useState } from "react";
import { capturePostHog } from "@/lib/analytics/posthog-client";
import { useCart } from "@/lib/store/useCart";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatEur, formatRon } from "@/lib/currency/format";
import {
  getProductPricePresentation,
  getVariantPricePresentation,
} from "@/lib/product-pricing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIANT_BUTTON_OPTION_LIMIT = 8;

interface Variant {
  id: string;
  name?: string | null;
  sku: string;
  attributes: Record<string, string> | string;
  price?: number | null;
  salePrice?: number | null;
  saleEnabled?: boolean | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  priceAdjustment: number;
  trackStock?: boolean | null;
  stock: number;
}

interface AddToCartProps {
  product: {
    id: string;
    slug: string;
    title: string;
    basePrice: number;
    salePrice?: number | null;
    saleEnabled?: boolean | null;
    saleStartsAt?: Date | string | null;
    saleEndsAt?: Date | string | null;
    isDigital?: boolean | null;
    trackStock?: boolean | null;
    stock?: number | null;
  };
  variants: Variant[];
  locale?: "en" | "ro";
  displayCurrency?: "RON" | "EUR";
  ronToEurRate?: number;
}

function getStockLabel(stock: number | null | undefined, locale: "en" | "ro") {
  const availableStock = Math.max(stock ?? 0, 0);

  if (availableStock <= 0) {
    return locale === "ro" ? "Stoc epuizat" : "Out of stock";
  }

  return locale === "ro" ? `${availableStock} in stoc` : `${availableStock} in stock`;
}

function getVariantAttributes(variant: Variant) {
  if (typeof variant.attributes !== "string") {
    return variant.attributes;
  }

  try {
    const parsed = JSON.parse(variant.attributes) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function getVariantSelectionLabel(
  variant: Variant,
  selectedAttrs: Record<string, string>,
) {
  const attributes =
    Object.keys(selectedAttrs).length > 0
      ? selectedAttrs
      : getVariantAttributes(variant);
  const attributeLabel = Object.entries(attributes)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join(" / ");

  return attributeLabel || variant.name || variant.sku;
}

function getCartItemTitle(
  productTitle: string,
  variant: Variant,
  selectedAttrs: Record<string, string>,
) {
  return `${productTitle} - ${getVariantSelectionLabel(variant, selectedAttrs)}`;
}

export function AddToCart({
  product,
  variants,
  locale = "en",
  displayCurrency = "RON",
  ronToEurRate = 0.2,
}: AddToCartProps) {
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const addItem = useCart((state) => state.addItem);
  const [wasAdded, setWasAdded] = useState(false);
  const isSimpleProduct = variants.length === 0;
  const simpleProductOutOfStock =
    isSimpleProduct && Boolean(product.trackStock) && (product.stock ?? 0) <= 0;

  const attributeKeys = Object.keys(
    variants.reduce<Record<string, string>>(
      (attributes, variant) => ({
        ...attributes,
        ...getVariantAttributes(variant),
      }),
      {},
    ),
  );
  const hasSelectedAllAttributes = attributeKeys.every((key) =>
    Boolean(selectedAttrs[key]),
  );
  const selectedVariant = hasSelectedAllAttributes
    ? variants.find((v) =>
        Object.entries(selectedAttrs).every(
          ([key, val]) => getVariantAttributes(v)[key] === val,
        ),
      )
    : undefined;

  const pricePresentation = selectedVariant
    ? getVariantPricePresentation(product, selectedVariant)
    : getProductPricePresentation(product);
  const finalPrice = pricePresentation.effectivePrice;
  const selectedVariantOutOfStock =
    Boolean(selectedVariant?.trackStock) && (selectedVariant?.stock ?? 0) <= 0;
  const productStockLabel =
    isSimpleProduct && product.trackStock ? getStockLabel(product.stock, locale) : null;
  const selectedVariantStockLabel =
    !isSimpleProduct && selectedVariant?.trackStock
      ? getStockLabel(selectedVariant.stock, locale)
      : null;
  const stockLabel = productStockLabel ?? selectedVariantStockLabel;
  const stockIsOut =
    simpleProductOutOfStock ||
    Boolean(selectedVariantStockLabel && selectedVariantOutOfStock);
  const displayPrice =
    displayCurrency === "EUR"
      ? formatEur(finalPrice, ronToEurRate)
      : formatRon(finalPrice);
  const regularDisplayPrice =
    displayCurrency === "EUR"
      ? formatEur(pricePresentation.regularPrice, ronToEurRate)
      : formatRon(pricePresentation.regularPrice);

  function getVariantOptionStockState(attributeKey: string, value: string) {
    const matchingVariants = variants.filter((variant) => {
      const attributes = getVariantAttributes(variant);

      if (attributes[attributeKey] !== value) {
        return false;
      }

      return Object.entries(selectedAttrs).every(
        ([selectedKey, selectedValue]) =>
          selectedKey === attributeKey ||
          !selectedValue ||
          attributes[selectedKey] === selectedValue,
      );
    });
    const trackedVariants = matchingVariants.filter((variant) =>
      Boolean(variant.trackStock),
    );

    if (trackedVariants.length === 0) {
      return null;
    }

    const optionStock = trackedVariants.reduce(
      (totalStock, variant) => totalStock + Math.max(variant.stock ?? 0, 0),
      0,
    );

    return {
      isOutOfStock: optionStock <= 0,
      label: getStockLabel(optionStock, locale),
    };
  }

  const handleAdd = () => {
    if (simpleProductOutOfStock || selectedVariantOutOfStock) {
      return;
    }

    if (isSimpleProduct) {
      addItem({
        productId: product.id,
        variantId: product.id,
        title: product.title,
        price: finalPrice,
        sku: product.slug,
        quantity: 1,
        isDigital: Boolean(product.isDigital),
      });
      capturePostHog("add_to_cart", {
        product_id: product.id,
        product_title: product.title,
        product_slug: product.slug,
        price: finalPrice,
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
        title: getCartItemTitle(product.title, selectedVariant, selectedAttrs),
        price: finalPrice,
        sku: selectedVariant.sku,
        quantity: 1,
        isDigital: Boolean(product.isDigital),
      });
      capturePostHog("add_to_cart", {
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
        <div
          className={cn(
            "grid gap-4",
            attributeKeys.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {attributeKeys.map((key) => (
            <div key={key} className="space-y-2">
              <Label className="uppercase tracking-widest text-xs font-bold">
                {key}
              </Label>
              {(() => {
                const optionValues = Array.from(
                  new Set(
                    variants
                      .map((variant) => getVariantAttributes(variant)[key])
                      .filter((value): value is string => Boolean(value)),
                  ),
                );
                const useDropdown = optionValues.length > VARIANT_BUTTON_OPTION_LIMIT;

                if (useDropdown) {
                  return (
                    <Select
                      value={selectedAttrs[key] ?? ""}
                      onValueChange={(val: string) =>
                        setSelectedAttrs({ ...selectedAttrs, [key]: val })
                      }
                    >
                      <SelectTrigger className="h-12 rounded-none border-black uppercase font-bold">
                        <SelectValue placeholder={`SELECT ${key.toUpperCase()}`} />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-black">
                        {optionValues.map((val) => {
                          const optionStock = getVariantOptionStockState(key, val);

                          return (
                            <SelectItem
                              key={val}
                              value={val}
                              className="rounded-none uppercase text-xs font-bold"
                            >
                              <span className="flex w-full items-center justify-between gap-3 pr-4">
                                <span>{val}</span>
                                {optionStock && (
                                  <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-500">
                                    <span
                                      className={cn(
                                        "size-1.5 rounded-full",
                                        optionStock.isOutOfStock
                                          ? "bg-destructive"
                                          : "bg-emerald-500",
                                      )}
                                      aria-hidden="true"
                                    />
                                    {optionStock.label}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  );
                }

                return (
                  <div
                    className={cn(
                      "grid gap-2",
                      attributeKeys.length === 1
                        ? "grid-cols-2 sm:grid-cols-3"
                        : "grid-cols-2",
                    )}
                  >
                    {optionValues.map((val) => {
                      const optionStock = getVariantOptionStockState(key, val);
                      const isSelected = selectedAttrs[key] === val;

                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setSelectedAttrs({ ...selectedAttrs, [key]: val })
                          }
                          className={cn(
                            "min-h-14 border border-black px-3 py-2 text-left uppercase transition-colors",
                            isSelected
                              ? "bg-black text-white"
                              : "bg-white text-black hover:bg-slate-100",
                          )}
                        >
                          <span className="block text-xs font-black">{val}</span>
                          {optionStock && (
                            <span
                              className={cn(
                                "mt-1 flex items-center gap-1.5 text-[10px] font-black tracking-widest",
                                isSelected ? "text-white" : "text-slate-500",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  optionStock.isOutOfStock
                                    ? "bg-destructive"
                                    : "bg-emerald-500",
                                )}
                                aria-hidden="true"
                              />
                              {optionStock.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-baseline gap-3">
        {pricePresentation.isOnSale && (
          <span className="text-base font-bold text-slate-400 line-through">
            {regularDisplayPrice}
          </span>
        )}
        <span
          className={`text-2xl font-black tracking-tighter ${
            pricePresentation.isOnSale ? "text-destructive" : ""
          }`}
        >
          {displayPrice}
        </span>
      </div>

      {stockLabel && (
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
          <span
            className={`size-2 rounded-full ${
              stockIsOut ? "bg-destructive" : "bg-emerald-500"
            }`}
            aria-hidden="true"
          />
          <span>{stockLabel}</span>
        </div>
      )}

      <Button
        onClick={handleAdd}
        disabled={
          simpleProductOutOfStock ||
          (!isSimpleProduct && !selectedVariant) ||
          selectedVariantOutOfStock
        }
        className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold text-sm"
      >
        {simpleProductOutOfStock || selectedVariantOutOfStock
          ? "Out of Stock"
          : wasAdded
            ? "Added"
            : "Add to Cart"}
      </Button>
    </div>
  );
}
