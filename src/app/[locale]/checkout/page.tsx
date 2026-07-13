import {
  CheckoutForm,
  type CheckoutInitialCustomer,
} from "@/components/checkout/CheckoutForm";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCustomerProfile } from "@/lib/customer-profile";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const user = await getCurrentUser();
  const [profile, currencyPresentation] = await Promise.all([
    user ? getCustomerProfile(user.id) : null,
    getCurrencyPresentation(),
  ]);
  const address = (profile?.address ?? {}) as CheckoutInitialCustomer["address"];
  const initialCustomer: CheckoutInitialCustomer | undefined = user
    ? {
        email: profile?.email ?? user.email ?? "",
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        phone: profile?.phone ?? "",
        preferredShippingMethod:
          profile?.preferredShippingMethod === "international"
            ? "address"
            : (profile?.preferredShippingMethod ?? "address"),
        address,
      }
    : undefined;

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full space-y-8">
        <CheckoutForm
          locale={activeLocale}
          initialCustomer={initialCustomer}
          detectedCountry={currencyPresentation.countryCode}
          currencySettings={{
            ronToEurRate: currencyPresentation.ronToEurRate,
          }}
          initialPaymentCurrency={currencyPresentation.displayCurrency}
        />
      </div>
    </main>
  );
}
