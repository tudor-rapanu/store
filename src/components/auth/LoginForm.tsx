"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ResendVerificationEmailForm } from "@/components/auth/ResendVerificationEmailForm";
import { VerifyEmailCodeForm } from "@/components/auth/VerifyEmailCodeForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginState = {
  error?: string;
  email?: string;
  verificationRequired?: boolean;
};

export function LoginForm({ locale }: { locale: "en" | "ro" }) {
  const t = useTranslations("Auth");
  const [state, setState] = useState<LoginState | null>(null);
  const [isPending, setIsPending] = useState(false);
  const errorMessage = state?.error ?? "";
  const verificationEmail = state?.email ?? "";
  const verificationRequired = state?.verificationRequired === true;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = normalizeEmail(formData.get("email"));
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setState({ error: "Email and password are required" });
      return;
    }

    setIsPending(true);

    void (async () => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        const error =
          payload?.message ?? payload?.error?.message ?? "Login failed.";
        setState({
          error,
          email: isEmailVerificationError(error) ? email : undefined,
          verificationRequired: isEmailVerificationError(error),
        });
        setIsPending(false);
        return;
      }

      window.location.assign(`/${locale}`);
    })().catch(() => {
      setState({ error: "Login failed." });
      setIsPending(false);
    });
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("password")}</Label>
              {/* Optional: Future forgot password link */}
              <Link
                href={`/${locale}/forgot-password`}
                className="text-xs text-muted-foreground hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>

          {errorMessage && (
            <div className="space-y-3 rounded-md bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
              {verificationRequired && verificationEmail && (
                <div className="space-y-4">
                  <ResendVerificationEmailForm
                    email={verificationEmail}
                    locale={locale}
                  />
                  <VerifyEmailCodeForm email={verificationEmail} locale={locale} />
                  <ResendVerificationEmailForm
                    email={verificationEmail}
                    locale={locale}
                    presentation="link"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("loading") : t("loginButton")}
          </Button>

          <div className="text-sm text-center text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href={`/${locale}/register`}
              className="font-medium text-foreground hover:underline"
            >
              {t("registerLink")}
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmailVerificationError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("verification") ||
    normalizedMessage.includes("verify") ||
    normalizedMessage.includes("not verified")
  );
}
