"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getAdminProductSaveRequest } from "./admin-product-form-utils";

type ProductFormPayloads = {
  existingImages: string;
  variants: string;
  categories: string;
  productDetails: string;
};

type ProductFormFeedback = {
  kind: "error" | "success";
  message: string;
};

type UseProductFormSubmissionOptions = {
  productId?: string;
  onCreated: () => void;
};

export function useProductFormSubmission({
  productId,
  onCreated,
}: UseProductFormSubmissionOptions) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function showFeedback(feedback: ProductFormFeedback) {
    setError(feedback.kind === "error" ? feedback.message : null);
    setSuccess(feedback.kind === "success" ? feedback.message : null);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    payloads: ProductFormPayloads,
  ) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("existingImages", payloads.existingImages);
    formData.set("variants", payloads.variants);
    formData.set("categories", payloads.categories);
    formData.set("productDetails", payloads.productDetails);

    const request = getAdminProductSaveRequest(productId);

    try {
      const response = await fetch(request.endpoint, {
        method: request.method,
        body: formData,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "The product could not be saved.");
        return;
      }

      setSuccess(productId ? "Product updated." : "Product saved.");
      router.refresh();

      if (!productId) {
        form.reset();
        onCreated();
      }
    } catch {
      setError("The product could not be saved.");
    } finally {
      setIsPending(false);
    }
  }

  return {
    error,
    success,
    isPending,
    showFeedback,
    submit,
  };
}

export type ProductFormSubmissionController = ReturnType<
  typeof useProductFormSubmission
>;
