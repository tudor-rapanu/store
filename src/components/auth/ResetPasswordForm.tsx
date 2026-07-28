"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/actions/auth";

export function ResetPasswordForm({
  locale,
  token,
}: {
  locale: "en" | "ro";
  token?: string;
}) {
  const [clientToken, setClientToken] = useState(token ?? "");
  const [state, formAction, isPending] = useActionState(updatePassword, null);

  useEffect(() => {
    if (token || typeof window === "undefined") {
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashToken =
      hashParams.get("token") ??
      hashParams.get("code") ??
      hashParams.get("resetToken") ??
      "";

    if (hashToken) {
      setClientToken(hashToken);
    }
  }, [token]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        {clientToken && <input type="hidden" name="token" value={clientToken} />}
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {state?.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving..." : "Update Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
