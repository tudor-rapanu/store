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
import {
  getProductPurchaseCopy,
  getSelectAttributeLabel,
} from "./product-purchase-copy";
import {
  getVariantAttributes,
  getVariantOptionAvailability,
  selectVariantAttribute,
} from "./product-variant-selection";

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
  const copy = getProductPurchaseCopy(locale);
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
  const cartVariantId = isSimpleProduct ? product.id : selectedVariant?.id;
  const selectedStockLimit = isSimpleProduct
    ? product.trackStock
      ? Math.max(product.stock ?? 0, 0)
      : null
    : selectedVariant?.trackStock
      ? Math.max(selectedVariant.stock ?? 0, 0)
      : null;
  const currentCartQuantity = useCart(
    (state) =>
      state.items.find((item) => item.variantId === cartVariantId)?.quantity ?? 0,
  );
  const reachedCartLimit =
    selectedStockLimit !== null && currentCartQuantity >= selectedStockLimit;
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

  function selectAttribute(attributeKey: string, value: string) {
    setSelectedAttrs((current) =>
      selectVariantAttribute({
        selectedAttributes: current,
        attributeKeys,
        attributeKey,
        value,
      }),
    );
  }

  function getOptionState(attributeKey: string, value: string) {
    const availability = getVariantOptionAvailability({
      variants,
      selectedAttributes: selectedAttrs,
      attributeKeys,
      attributeKey,
      value,
    });

    return {
      ...availability,
      label:
        availability.reason === "unavailable"
          ? copy.unavailable
          : availability.stock !== null
            ? getStockLabel(availability.stock, locale)
            : null,
    };
  }

  const handleAdd = () => {
    if (simpleProductOutOfStock || selectedVariantOutOfStock || reachedCartLimit) {
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
        maxQuantity: selectedStockLimit,
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
        maxQuantity: selectedStockLimit,
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
                      onValueChange={(val: string) => selectAttribute(key, val)}
                    >
                      <SelectTrigger className="h-12 rounded-none border-black uppercase font-bold">
                        <SelectValue
                          placeholder={getSelectAttributeLabel(key, locale)}
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-black">
                        {optionValues.map((val) => {
                          const optionState = getOptionState(key, val);

                          return (
                            <SelectItem
                              key={val}
                              value={val}
                              disabled={!optionState.isAvailable}
                              className="rounded-none uppercase text-xs font-bold"
                            >
                              <span className="flex w-full items-center justify-between gap-3 pr-4">
                                <span>{val}</span>
                                {optionState.label && (
                                  <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-500">
                                    <span
                                      className={cn(
                                        "size-1.5 rounded-full",
                                        !optionState.isAvailable
                                          ? "bg-destructive"
                                          : "bg-emerald-500",
                                      )}
                                      aria-hidden="true"
                                    />
                                    {optionState.label}
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
                      const optionState = getOptionState(key, val);
                      const isSelected = selectedAttrs[key] === val;

                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => selectAttribute(key, val)}
                          disabled={!optionState.isAvailable}
                          aria-pressed={isSelected}
                          className={cn(
                            "min-h-14 border border-black px-3 py-2 text-left uppercase transition-colors disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400",
                            isSelected
                              ? "bg-black text-white"
                              : "bg-white text-black hover:bg-slate-100",
                          )}
                        >
                          <span className="block text-xs font-black">{val}</span>
                          {optionState.label && (
                            <span
                              className={cn(
                                "mt-1 flex items-center gap-1.5 text-[10px] font-black tracking-widest",
                                isSelected ? "text-white" : "text-slate-500",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  !optionState.isAvailable
                                    ? "bg-destructive"
                                    : "bg-emerald-500",
                                )}
                                aria-hidden="true"
                              />
                              {optionState.label}
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
          selectedVariantOutOfStock ||
          reachedCartLimit
        }
        className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold text-sm"
      >
        {simpleProductOutOfStock || selectedVariantOutOfStock
          ? copy.outOfStock
          : reachedCartLimit
            ? copy.maximumInCart
            : wasAdded
              ? copy.added
              : copy.addToCart}
      </Button>
      <p className="sr-only" role="status" aria-live="polite">
        {wasAdded ? copy.addedConfirmation : ""}
      </p>
    </div>
  );
}
