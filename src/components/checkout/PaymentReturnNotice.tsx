"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getOrderPaymentStatus } from "@/lib/actions/orders";
import { useCart } from "@/lib/store/useCart";

export function PaymentReturnNotice() {
  const searchParams = useSearchParams();
  const clearCart = useCart((state) => state.clearCart);
  const [message, setMessage] = useState<string | null>(null);
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let isMounted = true;
    let attempts = 0;
    const activeOrderId = orderId;
    let timeoutId: number | undefined;

    function checkPaymentStatus() {
      attempts += 1;

      getOrderPaymentStatus(activeOrderId)
        .then((status) => {
          if (!isMounted) {
            return;
          }

          if (status === "paid") {
            clearCart();
            setMessage("Payment confirmed. Thank you for your order.");
            return;
          }

          if (status === "failed") {
            setMessage("Payment failed. Your cart is still available.");
            return;
          }

          setMessage(
            "Payment is still pending. Your cart will stay available until the payment is confirmed.",
          );

          if (attempts < 10) {
            timeoutId = window.setTimeout(checkPaymentStatus, 3000);
          }
        })
        .catch(() => {
          if (isMounted) {
            setMessage("We could not verify the payment status yet.");
          }
        });
    }

    checkPaymentStatus();

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [clearCart, orderId]);

  if (!orderId || !message) {
    return null;
  }

  return (
    <div className="mb-8 border border-black bg-slate-50 p-4 text-sm font-bold uppercase tracking-wider">
      {message}
    </div>
  );
}
