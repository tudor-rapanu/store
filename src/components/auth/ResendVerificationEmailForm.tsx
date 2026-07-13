"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmail } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

type ResendVerificationEmailFormProps = {
  email: string;
  locale: "en" | "ro";
  presentation?: "button" | "link";
};

export function ResendVerificationEmailForm({
  email,
  locale,
  presentation = "button",
}: ResendVerificationEmailFormProps) {
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorMessage =
    state && "error" in state && typeof state.error === "string" ? state.error : "";
  const successMessage =
    state && "success" in state && typeof state.success === "string"
      ? state.success
      : "";

  function handleResend() {
    const formData = new FormData();
    formData.set("email", email);
    formData.set("locale", locale);

    startTransition(() => {
      void resendVerificationEmail(formData).then(setState);
    });
  }

  return (
    <div className={presentation === "link" ? "space-y-1" : "space-y-3"}>
      <Button
        type="button"
        variant={presentation === "link" ? "link" : "outline"}
        size={presentation === "link" ? "sm" : "default"}
        className={
          presentation === "link"
            ? "h-auto px-0 py-0 text-xs font-medium uppercase tracking-widest"
            : "h-11 w-full rounded-none border-black text-xs font-bold uppercase tracking-widest"
        }
        disabled={isPending}
        onClick={handleResend}
      >
        {isPending
          ? "Sending..."
          : presentation === "link"
            ? "Resend code"
            : "Resend Verification Code"}
      </Button>
      {errorMessage && (
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
      )}
    </div>
  );
}
