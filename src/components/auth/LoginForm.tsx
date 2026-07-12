"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
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

export function LoginForm({ locale }: { locale: "en" | "ro" }) {
  const t = useTranslations("Auth");

  // useActionState hooks into our Server Action
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return await login(formData);
    },
    null,
  );
  const errorMessage =
    state && "error" in state && typeof state.error === "string"
      ? state.error
      : "";
  const verificationEmail =
    state && "email" in state && typeof state.email === "string"
      ? state.email
      : "";
  const verificationRequired =
    state &&
    "verificationRequired" in state &&
    state.verificationRequired === true;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
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
              <p className="text-sm font-medium text-destructive">
                {errorMessage}
              </p>
              {verificationRequired && verificationEmail && (
                <div className="space-y-4">
                  <ResendVerificationEmailForm
                    email={verificationEmail}
                    locale={locale}
                  />
                  <VerifyEmailCodeForm
                    email={verificationEmail}
                    locale={locale}
                  />
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
