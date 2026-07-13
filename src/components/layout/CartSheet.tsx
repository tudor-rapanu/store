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
import { ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatEur, formatRon } from "@/lib/currency/format";
import { fetchCachedJson } from "@/lib/client/api-cache";

export function CartSheet({ locale }: { locale: "en" | "ro" }) {
  const { items, removeItem, total } = useCart();
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-none hover:bg-black hover:text-white transition-colors"
        >
          <ShoppingBag size={20} strokeWidth={1.5} />
          {items.length > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-black text-[10px] text-white flex items-center justify-center font-bold">
              {items.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[350px] sm:w-[400px] border-l-black">
        <SheetHeader>
          <SheetTitle className="uppercase tracking-tighter text-xl">
            Cart
          </SheetTitle>
        </SheetHeader>
        <div className="mt-8 flex flex-col gap-4 h-full pb-12">
          {items.length === 0 ? (
            <p className="text-slate-500 text-sm">Your cart is empty.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.variantId}
                className="flex justify-between items-center border-b border-slate-200 pb-4"
              >
                <div>
                  <p className="font-bold text-sm uppercase">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} x {formatCartAmount(item.price)}
                  </p>
                </div>
                <Button
                  variant="ghost"
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
                  <Trash2 size={16} />
                </Button>
              </div>
            ))
          )}
          <div className="mt-auto pt-6 border-t border-black">
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold uppercase tracking-tighter">
                  Subtotal
                </span>
                <span className="font-bold">{formatCartAmount(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-destructive">
                  <span className="font-bold uppercase tracking-tighter">
                    {discountPreview.discountName ?? "Discount"}
                  </span>
                  <span className="font-bold">
                    -{formatCartAmount(discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-bold uppercase tracking-tighter">
                  Total
                </span>
                <span className="text-lg font-bold">
                  {formatCartAmount(discountedTotal)}
                </span>
              </div>
            </div>
            <Link
              href={`/${locale}/checkout`}
              onClick={() => setIsOpen(false)}
            >
              <Button className="w-full h-12 rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold">
                Checkout
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
