"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import posthog from "posthog-js";
import Script from "next/script";
import { useCart } from "@/lib/store/useCart";
import {
  initiateCheckout,
  createBankTransferOrder,
  type CheckoutCustomerData,
} from "@/lib/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SamedayLocationPicker,
  type SamedayLocationSelection,
} from "@/components/shipping/SamedayLocationPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

declare global {
  interface Window {
    LockerPlugin: {
      init: (config: SamedayLockerPluginConfig) => void;
      getInstance: () => {
        reinitializePlugin?: (config: SamedayLockerPluginConfig) => void;
        subscribe: (
          callback: (lockerData: {
            lockerId: number | string;
            id?: number | string;
            oohId?: number | string;
            oohType?: number;
            name: string;
            address: string;
            cityId?: number;
            city?: string;
            countyId?: number;
            county?: string;
            postalCode?: string;
          }) => void,
        ) => void;
        open: () => void;
        close: () => void;
      };
    };
  }
}

type SamedayLockerPluginConfig = {
  clientId: string;
  countryCode: "RO";
  langCode: "ro" | "en";
  apiUsername: string;
  city?: string;
  county?: string;
  theme?: "light" | "dark";
  filters?: [{ showLockers: boolean }, { showPudos: boolean }];
  initialMapCenter?: "City" | "County";
};

type SamedayLockerRuntimeConfig = {
  clientId: string;
  apiUsername: string;
};

type ShippingProfile = {
  id: string;
  name: string;
  method: "address" | "easybox";
  price: number;
  freeShippingThreshold: number;
  enabled: boolean;
};

export type CheckoutInitialCustomer = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  preferredShippingMethod?: "address" | "easybox";
  address?: {
    street?: string;
    city?: string;
    county?: string;
    zip?: string;
    samedayCityId?: string;
    samedayCountyId?: string;
  };
};

type CheckoutFormProps = {
  initialCustomer?: CheckoutInitialCustomer;
};

export function CheckoutForm({ initialCustomer }: CheckoutFormProps) {
  const { items, total, clearCart } = useCart();
  const lockerPluginSubscribedRef = useRef(false);
  const [shippingMethod, setShippingMethod] = useState<"address" | "easybox">(
    initialCustomer?.preferredShippingMethod ?? "address",
  );
  const [paymentMethod, setPaymentMethod] = useState<"netopia" | "transfer">(
    "netopia",
  );
  const [selectedLocation, setSelectedLocation] =
    useState<SamedayLocationSelection>({
      countyId: initialCustomer?.address?.samedayCountyId ?? "",
      countyName: initialCustomer?.address?.county ?? "",
      cityId: initialCustomer?.address?.samedayCityId ?? "",
      cityName: initialCustomer?.address?.city ?? "",
    });
  const [isLockerScriptReady, setIsLockerScriptReady] = useState(false);
  const [lockerConfig, setLockerConfig] =
    useState<SamedayLockerRuntimeConfig | null>(null);
  const [isLoadingLockerConfig, setIsLoadingLockerConfig] = useState(false);
  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>(
    [],
  );
  const [isLoadingShippingProfiles, setIsLoadingShippingProfiles] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sameday Locker State
  const [locker, setLocker] = useState<{
    id: string;
    name: string;
    address: string;
    cityId?: string;
    city?: string;
    countyId?: string;
    county?: string;
    postalCode?: string;
    oohType?: number;
  } | null>(null);

  const cartSubtotal = total();
  const activeShippingProfile = shippingProfiles.find(
    (profile) => profile.method === shippingMethod && profile.enabled,
  );
  const shippingAmount = activeShippingProfile
    ? cartSubtotal >= activeShippingProfile.freeShippingThreshold
      ? 0
      : activeShippingProfile.price
    : 0;
  const orderTotal = cartSubtotal + shippingAmount;
  const freeShippingRemainder = activeShippingProfile
    ? Math.max(activeShippingProfile.freeShippingThreshold - cartSubtotal, 0)
    : 0;

  useEffect(() => {
    async function loadShippingProfiles() {
      setIsLoadingShippingProfiles(true);

      try {
        const response = await fetch("/api/shipping/profiles", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          profiles?: ShippingProfile[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Could not load shipping profiles.");
        }

        setShippingProfiles(data.profiles ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load shipping profiles.",
        );
      } finally {
        setIsLoadingShippingProfiles(false);
      }
    }

    void loadShippingProfiles();
  }, []);

  useEffect(() => {
    async function loadLockerConfig() {
      setIsLoadingLockerConfig(true);

      try {
        const response = await fetch("/api/shipping/sameday/locker-config", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          clientId?: string;
          apiUsername?: string;
          error?: string;
        };

        if (!response.ok || !data.clientId || !data.apiUsername) {
          throw new Error(data.error ?? "Sameday map is not configured.");
        }

        setLockerConfig({
          clientId: data.clientId,
          apiUsername: data.apiUsername,
        });
      } catch (error) {
        setLockerConfig(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load Sameday map configuration.",
        );
      } finally {
        setIsLoadingLockerConfig(false);
      }
    }

    void loadLockerConfig();
  }, []);

  const openEasyboxMap = useCallback(() => {
    setErrorMessage(null);

    if (!lockerConfig) {
      setErrorMessage("Sameday Easybox map is not configured yet.");
      return;
    }

    if (
      !isLockerScriptReady ||
      typeof window === "undefined" ||
      !window.LockerPlugin
    ) {
      setErrorMessage(
        "Sameday map is still loading. Please try again in a moment.",
      );
      return;
    }

    const pluginConfig: SamedayLockerPluginConfig = {
      clientId: lockerConfig.clientId,
      apiUsername: lockerConfig.apiUsername,
      countryCode: "RO",
      langCode: "ro",
      county: selectedLocation.countyName,
      city: selectedLocation.cityName,
      theme: "light",
      filters: [{ showLockers: true }, { showPudos: true }],
      initialMapCenter: selectedLocation.cityName
        ? "City"
        : selectedLocation.countyName
          ? "County"
          : undefined,
    };

    window.LockerPlugin.init(pluginConfig);

    const pluginInstance = window.LockerPlugin.getInstance();
    pluginInstance.reinitializePlugin?.(pluginConfig);

    if (!lockerPluginSubscribedRef.current) {
      pluginInstance.subscribe((lockerData) => {
        const lockerId =
          lockerData.lockerId || lockerData.id || lockerData.oohId;

        if (!lockerId) {
          setErrorMessage("The selected Easybox did not return a locker id.");
          return;
        }

        setLocker({
          id: String(lockerId),
          name: lockerData.name,
          address: lockerData.address,
          cityId:
            lockerData.cityId !== undefined
              ? String(lockerData.cityId)
              : undefined,
          city: lockerData.city,
          countyId:
            lockerData.countyId !== undefined
              ? String(lockerData.countyId)
              : undefined,
          county: lockerData.county,
          postalCode: lockerData.postalCode,
          oohType: lockerData.oohType,
        });
        pluginInstance.close();
      });
      lockerPluginSubscribedRef.current = true;
    }

    pluginInstance.open();
  }, [
    isLockerScriptReady,
    lockerConfig,
    selectedLocation.cityName,
    selectedLocation.countyName,
  ]);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      setErrorMessage(null);

      if (shippingMethod === "easybox" && !locker) {
        setErrorMessage("Please select a Sameday Easybox locker.");
        return null;
      }

      if (!selectedLocation.countyName || !selectedLocation.countyId) {
        setErrorMessage("Please select a county.");
        return null;
      }

      if (!selectedLocation.cityName || !selectedLocation.cityId) {
        setErrorMessage("Please select a city.");
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
          city: selectedLocation.cityName,
          county: selectedLocation.countyName,
          zip: formData.get("zip") as string,
          samedayCityId: selectedLocation.cityId,
          samedayCountyId: selectedLocation.countyId,
          samedayLockerId:
            shippingMethod === "easybox" && locker ? locker.id : undefined,
          samedayLockerName:
            shippingMethod === "easybox" && locker ? locker.name : undefined,
          samedayLockerAddress:
            shippingMethod === "easybox" && locker ? locker.address : undefined,
          samedayLockerCityId:
            shippingMethod === "easybox" && locker ? locker.cityId : undefined,
          samedayLockerCity:
            shippingMethod === "easybox" && locker ? locker.city : undefined,
          samedayLockerCountyId:
            shippingMethod === "easybox" && locker
              ? locker.countyId
              : undefined,
          samedayLockerCounty:
            shippingMethod === "easybox" && locker ? locker.county : undefined,
          samedayLockerPostalCode:
            shippingMethod === "easybox" && locker
              ? locker.postalCode
              : undefined,
          samedayLockerOohType:
            shippingMethod === "easybox" && locker ? locker.oohType : undefined,
        },
        shippingMethod,
      };
      const locale =
        window.location.pathname.split("/")[1] === "ro" ? "ro" : "en";

      posthog.capture("checkout_started", {
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        cart_total: total(),
        item_count: items.length,
        currency: "RON",
        shipping_amount: shippingAmount,
        order_total: orderTotal,
      });

      if (paymentMethod === "netopia") {
        const response = await initiateCheckout(
          cartSubtotal,
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
          cartSubtotal,
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
  const isCheckoutDisabled =
    isPending || isLoadingShippingProfiles || !activeShippingProfile;

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
        onLoad={() => setIsLockerScriptReady(true)}
        onError={() =>
          setErrorMessage("Could not load the Sameday Easybox map.")
        }
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
                  defaultValue={initialCustomer?.firstName ?? ""}
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
                  defaultValue={initialCustomer?.lastName ?? ""}
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
                  defaultValue={initialCustomer?.email ?? ""}
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
                  defaultValue={initialCustomer?.phone ?? ""}
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
                  posthog.capture("shipping_method_selected", {
                    method: "address",
                  });
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
                  posthog.capture("shipping_method_selected", {
                    method: "easybox",
                  });
                }}
              >
                Sameday Easybox
              </Button>
            </div>

            {shippingMethod === "easybox" && (
              <div className="p-6 border border-black bg-slate-50 space-y-4">
                {isLoadingLockerConfig ? (
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Loading Sameday map configuration.
                  </p>
                ) : null}
                {!isLoadingLockerConfig && !lockerConfig ? (
                  <p className="text-xs font-bold uppercase tracking-wider text-destructive">
                    Sameday Easybox map is missing configuration.
                  </p>
                ) : null}
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
            {activeShippingProfile && (
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {shippingAmount === 0
                  ? "Shipping is free for this order."
                  : `${(shippingAmount / 100).toFixed(2)} RON shipping. ${freeShippingRemainder > 0 ? `Add ${(freeShippingRemainder / 100).toFixed(2)} RON for free shipping.` : ""}`}
              </p>
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
                defaultValue={initialCustomer?.address?.street ?? ""}
                className="rounded-none border-black h-11"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_160px]">
              <SamedayLocationPicker
                initialCountyId={initialCustomer?.address?.samedayCountyId}
                initialCountyName={initialCustomer?.address?.county}
                initialCityId={initialCustomer?.address?.samedayCityId}
                initialCityName={initialCustomer?.address?.city}
                onSelectionChange={setSelectedLocation}
              />
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
                  defaultValue={initialCustomer?.address?.zip ?? ""}
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
                  posthog.capture("payment_method_selected", {
                    method: "netopia",
                  });
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
                  posthog.capture("payment_method_selected", {
                    method: "bank_transfer",
                  });
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

              <div className="space-y-3 border-t border-black pt-4">
                <SummaryRow label="Subtotal" value={cartSubtotal} />
                <SummaryRow
                  label={
                    isLoadingShippingProfiles ? "Shipping" : "Shipping"
                  }
                  value={shippingAmount}
                  valueLabel={
                    isLoadingShippingProfiles
                      ? "Loading"
                      : shippingAmount === 0
                        ? "Free"
                        : undefined
                  }
                />
                <div className="flex justify-between items-end pt-2">
                  <span className="uppercase tracking-widest text-xs font-black">
                    Total
                  </span>
                  <span className="text-3xl font-black tracking-tighter">
                    {(orderTotal / 100).toFixed(2)} RON
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                form="checkout-form"
                disabled={isCheckoutDisabled}
                className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm mt-4 transition-colors"
              >
                {isPending || isLoadingShippingProfiles
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

function SummaryRow({
  label,
  value,
  valueLabel,
}: {
  label: string;
  value: number;
  valueLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="font-black tracking-tight">
        {valueLabel ?? `${(value / 100).toFixed(2)} RON`}
      </span>
    </div>
  );
}
