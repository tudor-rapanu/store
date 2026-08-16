import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampCartQuantity } from "./cart-quantity";
import type { CartItemData } from "./cart-reconciliation";

export type CartItem = CartItemData;

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  replaceItems: (items: CartItem[]) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? {
                      ...i,
                      ...item,
                      quantity: clampCartQuantity(
                        i.quantity + item.quantity,
                        item.maxQuantity,
                      ),
                    }
                  : i,
              ),
            };
          }
          const quantity = clampCartQuantity(item.quantity, item.maxQuantity);

          return quantity > 0
            ? { items: [...state.items, { ...item, quantity }] }
            : state;
        }),
      replaceItems: (items) => set({ items }),
      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId
              ? {
                  ...item,
                  quantity: clampCartQuantity(quantity, item.maxQuantity),
                }
              : item,
          ),
        })),
      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),
      clearCart: () => set({ items: [] }),
      total: () =>
        get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    { name: "todd-cart-storage" },
  ),
);
