"use client";

import { useState, useActionState, startTransition } from "react";
import posthog from "posthog-js";
import Script from "next/script";
import { useCart } from "@/lib/store/useCart";
import {
  initiateCheckout,
  createBankTransferOrder,
  type CheckoutCustomerData,
} from "@/lib/actions/checkout";
import { ROMANIAN_COUNTIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

declare global {
  interface Window {
    LockerPlugin: {
      init: (config: {
        clientId: string;
        countryCode: string;
        langCode: string;
        apiUsername: string;
        city?: string;
        county?: string;
        theme?: string;
      }) => void;
      getInstance: () => {
        subscribe: (
          callback: (lockerData: {
            lockerId: string;
            name: string;
            address: string;
          }) => void,
        ) => void;
        open: () => void;
        close: () => void;
      };
    };
  }
}

export function CheckoutForm() {
  const { items, total, clearCart } = useCart();
  const [shippingMethod, setShippingMethod] = useState<"address" | "easybox">(
    "address",
  );
  const [paymentMethod, setPaymentMethod] = useState<"netopia" | "transfer">(
    "netopia",
  );
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sameday Locker State
  const [locker, setLocker] = useState<{
    id: string;
    name: string;
    address: string;
  } | null>(null);

  // Initialize Sameday Widget according to official docs
  const openEasyboxMap = () => {
    if (typeof window !== "undefined" && window.LockerPlugin) {
      // 1. Initialize configuration
      window.LockerPlugin.init({
        clientId: "YOUR_SAMEDAY_CLIENT_ID", // Required
        apiUsername: "YOUR_API_USERNAME", // Required by Sameday
        countryCode: "RO",
        langCode: "ro",
        theme: "light",
      });

      // 2. Get the singleton instance
      const pluginInstance = window.LockerPlugin.getInstance();

      // 3. Subscribe to the callback event when a locker is clicked
      pluginInstance.subscribe((lockerData) => {
        setLocker({
          id: lockerData.lockerId,
          name: lockerData.name,
          address: lockerData.address,
        });
        // Close the modal iframe automatically after selection
        pluginInstance.close();
      });

      // 4. Open the modal map
      pluginInstance.open();
    } else {
      setErrorMessage(
        "Sameday map is still loading. Please try again in a moment.",
      );
    }
  };

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      setErrorMessage(null);

      if (shippingMethod === "easybox" && !locker) {
        setErrorMessage("Please select a Sameday Easybox locker.");
        return null;
      }

      if (!selectedCounty) {
        setErrorMessage("Please select a county.");
        return null;
      }

      const customerData: CheckoutCustomerData = {
        email: formData.get("email") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        phone: formData.get("phone") as string,
        address: {
          street:
            shippingMethod === "easybox" && locker
              ? `Easybox: ${locker.name} (ID: ${locker.id}) - ${locker.address}`
              : (formData.get("street") as string),
          city: formData.get("city") as string,
          county: selectedCounty,
          zip: formData.get("zip") as string,
        },
        shippingMethod,
      };
      const locale = window.location.pathname.split("/")[1] === "ro" ? "ro" : "en";

      posthog.capture("checkout_started", {
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        cart_total: total(),
        item_count: items.length,
        currency: "RON",
      });

      if (paymentMethod === "netopia") {
        const response = await initiateCheckout(
          total(),
          customerData,
          locale,
          items,
        );
        if (response?.url) {
          window.location.href = response.url;
        } else if (response?.error) {
          setErrorMessage(response.error);
        }
        return response;
      } else {
        const response = await createBankTransferOrder(
          total(),
          customerData,
          locale,
          items,
        );
        if (response?.success) {
          clearCart();
          window.location.href = `/${window.location.pathname.split("/")[1]}/checkout/transfer-instructions`;
        } else {
          setErrorMessage(
            response?.error || "Failed to process bank transfer order.",
          );
        }
        return response;
      }
    },
    null,
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-24 text-lg font-bold uppercase tracking-widest text-slate-500">
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      {/* Corrected the script source to lockerpluginsdk.js */}
      <Script
        src="https://cdn.sameday.ro/locker-plugin/lockerpluginsdk.js"
        strategy="lazyOnload"
      />

      <div className="lg:col-span-7 space-y-8">
        <form
          id="checkout-form"
          action={(formData) => startTransition(() => formAction(formData))}
          className="space-y-8"
        >
          {/* 1. Contact Information */}
          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tighter border-b border-black pb-2">
              1. Contact Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="firstName"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  First Name
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="lastName"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
            </div>
          </section>

          {/* 2. Shipping / Delivery Method */}
          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tighter border-b border-black pb-2">
              2. Delivery Option
            </h2>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={shippingMethod === "address" ? "default" : "outline"}
                className="flex-1 h-12 rounded-none border-black uppercase font-bold tracking-widest text-xs"
                onClick={() => {
                  setShippingMethod("address");
                  posthog.capture("shipping_method_selected", { method: "address" });
                }}
              >
                Home Address
              </Button>
              <Button
                type="button"
                variant={shippingMethod === "easybox" ? "default" : "outline"}
                className="flex-1 h-12 rounded-none border-black uppercase font-bold tracking-widest text-xs"
                onClick={() => {
                  setShippingMethod("easybox");
                  posthog.capture("shipping_method_selected", { method: "easybox" });
                }}
              >
                Sameday Easybox
              </Button>
            </div>

            {shippingMethod === "easybox" && (
              <div className="p-6 border border-black bg-slate-50 space-y-4">
                {locker ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                      Locker Selected
                    </p>
                    <p className="font-bold">{locker.name}</p>
                    <p className="text-sm text-slate-500">{locker.address}</p>
                    <Button
                      type="button"
                      variant="link"
                      onClick={openEasyboxMap}
                      className="px-0 text-xs uppercase tracking-widest h-auto"
                    >
                      Change Locker
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={openEasyboxMap}
                    className="w-full h-12 rounded-none border border-black bg-white text-black hover:bg-slate-100 uppercase tracking-widest font-bold text-xs"
                  >
                    Open Map to Select Locker
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* 3. Billing & Address Details */}
          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tighter border-b border-black pb-2">
              3. Billing Address
            </h2>
            {shippingMethod === "easybox" && (
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Mandatory for payment verification and invoicing.
              </p>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="street"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Street Address
              </Label>
              <Input
                id="street"
                name="street"
                required
                className="rounded-none border-black h-11"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="city"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  City
                </Label>
                <Input
                  id="city"
                  name="city"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="county"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  County
                </Label>
                <Select
                  onValueChange={setSelectedCounty}
                  required
                  name="county"
                >
                  <SelectTrigger
                    id="county"
                    className="rounded-none border-black h-11"
                  >
                    <SelectValue placeholder="Selecție Județ" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-black bg-white">
                    {ROMANIAN_COUNTIES.map((county) => (
                      <SelectItem
                        key={county}
                        value={county}
                        className="uppercase text-xs font-bold"
                      >
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="zip"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Zip Code
                </Label>
                <Input
                  id="zip"
                  name="zip"
                  required
                  className="rounded-none border-black h-11"
                />
              </div>
            </div>
          </section>

          {/* 4. Payment Options */}
          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tighter border-b border-black pb-2">
              4. Payment Method
            </h2>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={paymentMethod === "netopia" ? "default" : "outline"}
                className="flex-1 h-12 rounded-none border-black uppercase font-bold tracking-widest text-xs"
                onClick={() => {
                  setPaymentMethod("netopia");
                  posthog.capture("payment_method_selected", { method: "netopia" });
                }}
              >
                Online Card (Netopia)
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "transfer" ? "default" : "outline"}
                className="flex-1 h-12 rounded-none border-black uppercase font-bold tracking-widest text-xs"
                onClick={() => {
                  setPaymentMethod("transfer");
                  posthog.capture("payment_method_selected", { method: "bank_transfer" });
                }}
              >
                Bank Transfer
              </Button>
            </div>
            {paymentMethod === "transfer" && (
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider pt-2">
                Processing info and IBAN configurations will be displayed on the
                final page confirmation.
              </p>
            )}
          </section>

          {/* Error Display */}
          {(errorMessage || state?.error) && (
            <div className="text-sm font-bold text-destructive bg-destructive/10 p-4 border border-destructive uppercase tracking-wider">
              {errorMessage || state?.error}
            </div>
          )}
        </form>
      </div>

      {/* RIGHT COLUMN: Sticky Summary Sidebar */}
      <div className="lg:col-span-5 relative">
        <div className="sticky top-24">
          <Card className="rounded-none border-black bg-slate-50 shadow-none">
            <CardHeader className="border-b border-black pb-4">
              <CardTitle className="uppercase font-black tracking-tighter text-2xl">
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex justify-between items-start text-sm"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold uppercase tracking-tight text-xs">
                        {item.title}
                      </span>
                      <span className="text-slate-500 font-semibold text-xs uppercase">
                        SKU: {item.sku} × Qty: {item.quantity}
                      </span>
                    </div>
                    <span className="font-bold whitespace-nowrap text-xs">
                      {((item.price * item.quantity) / 100).toFixed(2)} RON
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-black pt-4 flex justify-between items-end">
                <span className="uppercase tracking-widest text-xs font-black">
                  Total
                </span>
                <span className="text-3xl font-black tracking-tighter">
                  {(total() / 100).toFixed(2)} RON
                </span>
              </div>

              <Button
                type="submit"
                form="checkout-form"
                disabled={isPending}
                className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm mt-4 transition-colors"
              >
                {isPending
                  ? "Processing..."
                  : paymentMethod === "netopia"
                    ? "Redirect to Payment"
                    : "Place Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
