"use client";

import { useEffect, useState } from "react";
import { capturePostHog } from "@/lib/analytics/posthog-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/store/useCart";
import { getCartQuantityLimit } from "@/lib/store/cart-quantity";
import { useCartReconciliation } from "@/lib/store/use-cart-reconciliation";
import { getCartCopy, getCartReconciliationMessage } from "@/lib/store/cart-copy";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatEur, formatRon } from "@/lib/currency/format";
import { fetchCachedJson } from "@/lib/client/api-cache";

export function CartSheet({ locale }: { locale: "en" | "ro" }) {
  const { items, removeItem, total, updateQuantity } = useCart();
  const copy = getCartCopy(locale);
  const [isOpen, setIsOpen] = useState(false);
  const reconciliation = useCartReconciliation({ active: isOpen });
  const [discountPreview, setDiscountPreview] = useState<{
    discountAmount: number;
    discountName?: string;
  }>({
    discountAmount: 0,
  });
  const [currencyPresentation, setCurrencyPresentation] = useState<{
    displayCurrency: "RON" | "EUR";
    ronToEurRate: number;
  }>({
    displayCurrency: "RON",
    ronToEurRate: 0.2,
  });

  useEffect(() => {
    async function loadCurrencyPresentation() {
      try {
        const data = await fetchCachedJson<{
          displayCurrency?: "RON" | "EUR";
          ronToEurRate?: number;
        }>("currency:presentation", "/api/currency/presentation", {
          ttlMs: 60 * 1000,
        });

        if (data.displayCurrency && data.ronToEurRate) {
          setCurrencyPresentation({
            displayCurrency: data.displayCurrency,
            ronToEurRate: data.ronToEurRate,
          });
        }
      } catch {
        setCurrencyPresentation({
          displayCurrency: "RON",
          ronToEurRate: 0.2,
        });
      }
    }

    void loadCurrencyPresentation();
  }, []);

  useEffect(() => {
    async function previewDiscount() {
      if (items.length === 0) {
        setDiscountPreview({ discountAmount: 0 });
        return;
      }

      const previewItems = items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
      }));
      const body = JSON.stringify({ items: previewItems });

      try {
        const data = await fetchCachedJson<{
          discountAmount?: number;
          discount?: {
            name?: string;
          } | null;
        }>(`discounts:preview:${body}`, "/api/discounts/preview", {
          ttlMs: 30 * 1000,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        setDiscountPreview({
          discountAmount: data.discountAmount ?? 0,
          discountName: data.discount?.name,
        });
      } catch {
        setDiscountPreview({ discountAmount: 0 });
      }
    }

    const timeout = window.setTimeout(() => {
      void previewDiscount();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [items]);

  function formatCartAmount(value: number) {
    if (currencyPresentation.displayCurrency === "EUR") {
      return formatEur(value, currencyPresentation.ronToEurRate);
    }

    return formatRon(value);
  }

  const subtotal = total();
  const discountAmount = Math.min(discountPreview.discountAmount, subtotal);
  const discountedTotal = Math.max(subtotal - discountAmount, 0);
  const cartItemCount = items.reduce((count, item) => count + item.quantity, 0);
  const reconciliationMessage = getCartReconciliationMessage(locale, reconciliation);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`${copy.cart} (${cartItemCount})`}
          className="relative h-10 w-10 rounded-none hover:bg-black hover:text-white transition-colors"
        >
          <ShoppingBag size={20} strokeWidth={1.5} aria-hidden="true" />
          {items.length > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-black text-[10px] text-white flex items-center justify-center font-bold">
              {cartItemCount > 99 ? "99+" : cartItemCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[350px] sm:w-[400px] border-l-black">
        <SheetHeader>
          <SheetTitle className="uppercase tracking-tighter text-xl">
            {copy.cart}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-8 flex flex-col gap-4 h-full pb-12">
          {(reconciliation.isRefreshing || reconciliationMessage) && (
            <p
              className="border border-slate-200 bg-slate-50 p-3 text-xs font-bold uppercase tracking-wider text-slate-600"
              role="status"
              aria-live="polite"
            >
              {reconciliation.isRefreshing
                ? copy.checkingAvailability
                : reconciliationMessage}
            </p>
          )}
          {items.length === 0 ? (
            <p className="text-slate-500 text-sm">{copy.empty}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.variantId}
                className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm uppercase">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatCartAmount(item.price)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={item.quantity <= 1}
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      aria-label={`${copy.decreaseQuantity}: ${item.title}`}
                      className="size-8 rounded-none"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </Button>
                    <span
                      className="min-w-6 text-center text-sm font-bold"
                      aria-live="polite"
                    >
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={item.quantity >= getCartQuantityLimit(item.maxQuantity)}
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      aria-label={`${copy.increaseQuantity}: ${item.title}`}
                      className="size-8 rounded-none"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </Button>
                  </div>
                  {item.maxQuantity != null &&
                    item.quantity >= getCartQuantityLimit(item.maxQuantity) && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {copy.stockLimitReached}
                      </p>
                    )}
                </div>
                <Button
                  variant="ghost"
                  aria-label={`${copy.removeItem}: ${item.title}`}
                  onClick={() => {
                    removeItem(item.variantId);
                    capturePostHog("cart_item_removed", {
                      variant_id: item.variantId,
                      product_title: item.title,
                      sku: item.sku,
                      price: item.price,
                      quantity: item.quantity,
                      currency: "RON",
                    });
                  }}
                  className="rounded-none hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
          <div className="mt-auto pt-6 border-t border-black">
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold uppercase tracking-tighter">
                  {copy.subtotal}
                </span>
                <span className="font-bold">{formatCartAmount(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-destructive">
                  <span className="font-bold uppercase tracking-tighter">
                    {discountPreview.discountName ?? copy.discount}
                  </span>
                  <span className="font-bold">-{formatCartAmount(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-bold uppercase tracking-tighter">
                  {copy.total}
                </span>
                <span className="text-lg font-bold">
                  {formatCartAmount(discountedTotal)}
                </span>
              </div>
            </div>
            <Link
              href={`/${locale}/checkout`}
              onClick={(event) => {
                if (reconciliation.isRefreshing) {
                  event.preventDefault();
                  return;
                }

                setIsOpen(false);
              }}
              aria-disabled={reconciliation.isRefreshing}
              tabIndex={reconciliation.isRefreshing ? -1 : undefined}
              className={reconciliation.isRefreshing ? "pointer-events-none" : ""}
            >
              <Button
                disabled={reconciliation.isRefreshing}
                className="w-full h-12 rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold"
              >
                {copy.checkout}
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
