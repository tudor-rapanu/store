import {
  CheckoutForm,
  type CheckoutInitialCustomer,
} from "@/components/checkout/CheckoutForm";
import { getCustomerProfile } from "@/lib/customer-profile";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getCustomerProfile(user.id) : null;
  const address = (profile?.address ?? {}) as CheckoutInitialCustomer["address"];
  const initialCustomer: CheckoutInitialCustomer | undefined = user
    ? {
        email: profile?.email ?? user.email ?? "",
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        phone: profile?.phone ?? "",
        preferredShippingMethod: profile?.preferredShippingMethod ?? "address",
        address,
      }
    : undefined;

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full space-y-8">
        <CheckoutForm initialCustomer={initialCustomer} />
      </div>
    </main>
  );
}
