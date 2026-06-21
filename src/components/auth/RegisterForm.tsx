"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("registerTitle")}</CardTitle>
        <CardDescription>{t("registerDescription")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
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

          {state?.error && (
            <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">
              {state.error}
            </p>
          )}

          {state?.success && (
            <p className="text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md">
              {state.success}
            </p>
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
