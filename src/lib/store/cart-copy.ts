type CartReconciliationMessageState = {
  removedCount: number;
  adjustedCount: number;
  failed: boolean;
};

export function getCartCopy(locale: "en" | "ro") {
  return locale === "ro"
    ? {
        cart: "Coș",
        empty: "Coșul tău este gol.",
        subtotal: "Subtotal",
        discount: "Reducere",
        total: "Total",
        checkout: "Finalizează comanda",
        increaseQuantity: "Mărește cantitatea",
        decreaseQuantity: "Micșorează cantitatea",
        removeItem: "Elimină produsul",
        stockLimitReached: "Ai atins stocul disponibil.",
        checkingAvailability: "Verificăm disponibilitatea produselor…",
        cartRefreshed: "Prețurile și cantitățile din coș au fost actualizate.",
        unavailableRemoved: "Produsele indisponibile au fost eliminate din coș.",
        refreshFailed:
          "Coșul nu a putut fi actualizat. Stocul va fi verificat la finalizarea comenzii.",
      }
    : {
        cart: "Cart",
        empty: "Your cart is empty.",
        subtotal: "Subtotal",
        discount: "Discount",
        total: "Total",
        checkout: "Checkout",
        increaseQuantity: "Increase quantity",
        decreaseQuantity: "Decrease quantity",
        removeItem: "Remove item",
        stockLimitReached: "You reached the available stock.",
        checkingAvailability: "Checking product availability…",
        cartRefreshed: "Cart prices and quantities were refreshed.",
        unavailableRemoved: "Unavailable products were removed from your cart.",
        refreshFailed:
          "The cart could not be refreshed. Stock will be checked at checkout.",
      };
}

export function getCartReconciliationMessage(
  locale: "en" | "ro",
  state: CartReconciliationMessageState,
) {
  const copy = getCartCopy(locale);

  if (state.failed) {
    return copy.refreshFailed;
  }

  if (state.removedCount > 0) {
    return copy.unavailableRemoved;
  }

  if (state.adjustedCount > 0) {
    return copy.cartRefreshed;
  }

  return null;
}
