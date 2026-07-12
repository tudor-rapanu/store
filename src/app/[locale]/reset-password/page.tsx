import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "en" | "ro" }>;
  searchParams: Promise<{
    token?: string;
    code?: string;
    resetToken?: string;
  }>;
}) {
  const { locale } = await params;
  const { token, code, resetToken } = await searchParams;
  const passwordResetToken = token ?? code ?? resetToken ?? "";

  return (
    <main className="container max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <ResetPasswordForm locale={locale} token={passwordResetToken} />
      </div>
    </main>
  );
}
