import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full space-y-8">
        <CheckoutForm />
      </div>
    </main>
  );
}
