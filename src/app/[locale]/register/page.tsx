import { RegisterForm } from "@/components/auth/RegisterForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
};

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: "en" | "ro" }>;
}) {
  const { locale } = await params;

  return (
    <main className="container max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <RegisterForm locale={locale} />
      </div>
    </main>
  );
}
