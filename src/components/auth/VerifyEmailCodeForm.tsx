"use client";

import { useActionState } from "react";

import { verifyEmailCode } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VerifyEmailCodeFormProps = {
  email: string;
  locale: "en" | "ro";
};

export function VerifyEmailCodeForm({ email, locale }: VerifyEmailCodeFormProps) {
  const [state, formAction, isPending] = useActionState(verifyEmailCode, null);
  const errorMessage =
    state && "error" in state && typeof state.error === "string" ? state.error : "";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="locale" value={locale} />
      <div className="space-y-2">
        <Label htmlFor={`verification-code-${email}`}>Verification Code</Label>
        <Input
          id={`verification-code-${email}`}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Verifying..." : "Verify Email"}
      </Button>
      {errorMessage && (
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      )}
    </form>
  );
}
