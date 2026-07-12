"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
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

export function RegisterForm({ locale }: { locale: "en" | "ro" }) {
  const t = useTranslations("Auth");

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return await register(formData);
    },
    null,
  );
  const errorMessage =
    state && "error" in state && typeof state.error === "string"
      ? state.error
      : "";
  const successMessage =
    state && "success" in state && typeof state.success === "string"
      ? state.success
      : "";
  const warningMessage =
    state && "warning" in state && typeof state.warning === "string"
      ? state.warning
      : "";
  const registeredEmail =
    state && "email" in state && typeof state.email === "string"
      ? state.email
      : "";

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("registerTitle")}</CardTitle>
        <CardDescription>{t("registerDescription")}</CardDescription>
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
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {errorMessage && (
            <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <div className="space-y-3 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/20">
              <p className="text-sm font-medium text-emerald-600">
                {successMessage}
              </p>
              {warningMessage && (
                <p className="text-sm font-medium text-amber-700">
                  {warningMessage}
                </p>
              )}
              {registeredEmail && (
                <div className="space-y-4">
                  <ResendVerificationEmailForm
                    email={registeredEmail}
                    locale={locale}
                  />
                  <VerifyEmailCodeForm
                    email={registeredEmail}
                    locale={locale}
                  />
                  <ResendVerificationEmailForm
                    email={registeredEmail}
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
            {isPending ? t("loading") : t("registerButton")}
          </Button>

          <div className="text-sm text-center text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link
              href={`/${locale}/login`}
              className="font-medium text-foreground hover:underline"
            >
              {t("loginLink")}
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
