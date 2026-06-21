"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DuplicateProductButton({
  locale,
  productId,
}: {
  locale: "en" | "ro";
  productId: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function duplicateProduct() {
    setIsPending(true);

    try {
      const response = await fetch(`/api/admin/products/${productId}/duplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.ok || !result.redirectTo) {
        throw new Error(result.error ?? "Product could not be duplicated.");
      }

      router.push(result.redirectTo);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Product could not be duplicated.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={duplicateProduct}
      className="rounded-none border-black uppercase tracking-widest font-bold text-xs"
    >
      {isPending ? "Duplicating..." : "Duplicate"}
    </Button>
  );
}
