"use client";

import { useEffect, useRef, useState } from "react";

import { useCart } from "./useCart";
import { reconcileCartItems, type CartItemValidation } from "./cart-reconciliation";

export type CartReconciliationState = {
  isRefreshing: boolean;
  removedCount: number;
  adjustedCount: number;
  failed: boolean;
};

const initialState: CartReconciliationState = {
  isRefreshing: false,
  removedCount: 0,
  adjustedCount: 0,
  failed: false,
};

function getCartRequestKey(
  items: Array<{ productId?: string; variantId: string; quantity: number }>,
) {
  return items
    .map(
      (item) =>
        `${item.productId ?? item.variantId}:${item.variantId}:${item.quantity}`,
    )
    .sort()
    .join("|");
}

export function useCartReconciliation({ active }: { active: boolean }) {
  const items = useCart((state) => state.items);
  const replaceItems = useCart((state) => state.replaceItems);
  const lastRequestKeyRef = useRef<string | null>(null);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!active) {
      lastRequestKeyRef.current = null;
      setState(initialState);
      return;
    }

    if (items.length === 0) {
      lastRequestKeyRef.current = "";
      setState(initialState);
      return;
    }

    const requestKey = getCartRequestKey(items);

    if (lastRequestKeyRef.current === requestKey) {
      return;
    }

    lastRequestKeyRef.current = requestKey;
    const controller = new AbortController();
    setState({ ...initialState, isRefreshing: true });

    async function refreshCart() {
      try {
        const response = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({
              productId: item.productId ?? item.variantId,
              variantId: item.variantId,
            })),
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Cart validation failed.");
        }

        const data = (await response.json()) as {
          items?: CartItemValidation[];
        };
        const result = reconcileCartItems(items, data.items ?? []);

        lastRequestKeyRef.current = getCartRequestKey(result.items);

        if (result.removedCount > 0 || result.adjustedCount > 0) {
          replaceItems(result.items);
        }

        setState({
          isRefreshing: false,
          removedCount: result.removedCount,
          adjustedCount: result.adjustedCount,
          failed: false,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({ ...initialState, failed: true });
      }
    }

    void refreshCart();

    return () => controller.abort();
  }, [active, items, replaceItems]);

  return state;
}
