"use client";

import { useState, useTransition } from "react";

import { verifyEmailCode } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VerifyEmailCodeFormProps = {
  email: string;
  locale: "en" | "ro";
};

export function VerifyEmailCodeForm({ email, locale }: VerifyEmailCodeFormProps) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorMessage =
    state && "error" in state && typeof state.error === "string" ? state.error : "";

  function handleVerify() {
    const formData = new FormData();
    formData.set("email", email);
    formData.set("locale", locale);
    formData.set("code", code);

    startTransition(() => {
      void verifyEmailCode(formData).then(setState);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`verification-code-${email}`}>Verification Code</Label>
        <Input
          id={`verification-code-${email}`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={isPending}
        onClick={handleVerify}
      >
        {isPending ? "Verifying..." : "Verify Email"}
      </Button>
      {errorMessage && (
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
