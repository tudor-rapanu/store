"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DeleteProductButton({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function deleteProduct() {
    const confirmed = window.confirm(
      `Delete "${productTitle}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Product could not be deleted.");
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("updated", String(Date.now()));
      router.replace(`${nextUrl.pathname}${nextUrl.search}`);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Product could not be deleted.",
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
      onClick={deleteProduct}
      className="rounded-none border-destructive text-destructive hover:text-destructive uppercase tracking-widest font-bold text-xs"
    >
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
