"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CancelOrderButton({
  orderId,
  accessToken,
  disabled = false,
}: {
  orderId: string;
  accessToken?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function cancelOrder() {
    const confirmed = window.confirm("Cancel this order?");

    if (!confirmed) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The order could not be cancelled.");
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "The order could not be cancelled.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || isPending}
      onClick={cancelOrder}
      className="h-12 rounded-none border-black text-xs font-black uppercase tracking-widest"
    >
      {isPending ? "Cancelling..." : "Cancel Order"}
    </Button>
  );
}
