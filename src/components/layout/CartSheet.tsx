"use client";

import { useState } from "react";
import posthog from "posthog-js";
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

export function CartSheet({ locale }: { locale: "en" | "ro" }) {
  const { items, removeItem, total } = useCart();
  const [isOpen, setIsOpen] = useState(false);

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
                    {(item.price / 100).toFixed(2)} RON
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    removeItem(item.variantId);
                    posthog.capture("cart_item_removed", {
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
            <div className="flex justify-between items-center mb-6">
              <span className="uppercase tracking-tighter font-bold">
                Total
              </span>
              <span className="text-lg font-bold">
                {(total() / 100).toFixed(2)} RON
              </span>
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
