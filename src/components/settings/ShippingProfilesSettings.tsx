"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFetchErrorMessage, showToast } from "@/lib/client/toast";

type ShippingProfile = {
  id: string;
  method: "address" | "easybox" | "international";
  price: number;
  freeShippingThreshold: number;
};

type ShippingProfilesSettingsProps = {
  profiles: ShippingProfile[];
  currencySettings: {
    ronToEurRate: number;
  };
};

function baniToRon(value: number) {
  return (value / 100).toFixed(2);
}

function ronToBani(value: string) {
  return Math.round(Number(value) * 100);
}

export function ShippingProfilesSettings({
  profiles,
  currencySettings,
}: ShippingProfilesSettingsProps) {
  const easyboxProfile = profiles.find((profile) => profile.method === "easybox");
  const addressProfile = profiles.find((profile) => profile.method === "address");
  const internationalProfile = profiles.find(
    (profile) => profile.method === "international",
  );
  const [easyboxPrice, setEasyboxPrice] = useState(
    baniToRon(easyboxProfile?.price ?? 1500),
  );
  const [addressPrice, setAddressPrice] = useState(
    baniToRon(addressProfile?.price ?? 2500),
  );
  const [internationalPrice, setInternationalPrice] = useState(
    baniToRon(internationalProfile?.price ?? 7500),
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    baniToRon(
      easyboxProfile?.freeShippingThreshold ??
        addressProfile?.freeShippingThreshold ??
        15000,
    ),
  );
  const [ronToEurRate, setRonToEurRate] = useState(
    String(currencySettings.ronToEurRate),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfiles() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings/shipping-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          easyboxPrice: ronToBani(easyboxPrice),
          addressPrice: ronToBani(addressPrice),
          internationalPrice: ronToBani(internationalPrice),
          freeShippingThreshold: ronToBani(freeShippingThreshold),
          ronToEurRate: Number(ronToEurRate),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ??
            getFetchErrorMessage(response, "Could not save shipping profiles."),
        );
      }

      setMessage("Shipping profiles saved.");
      showToast({
        title: "Settings saved",
        description: "Shipping profiles were updated.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save shipping profiles.";

      setMessage(message);
      showToast({
        title: "Save failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-5 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">
          Shipping Profiles
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure checkout shipping prices and the manual EUR conversion rate.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <AmountField
          label="Easybox / PUDO"
          value={easyboxPrice}
          onChange={setEasyboxPrice}
        />
        <AmountField
          label="Home Address"
          value={addressPrice}
          onChange={setAddressPrice}
        />
        <AmountField
          label="Posta Romana International"
          value={internationalPrice}
          onChange={setInternationalPrice}
        />
        <AmountField
          label="Free Over"
          value={freeShippingThreshold}
          onChange={setFreeShippingThreshold}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest">
            RON to EUR Rate
          </Label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.0001"
            value={ronToEurRate}
            onChange={(event) => setRonToEurRate(event.target.value)}
            className="h-12 rounded-none border-black"
          />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Example: 0.20 means 100 RON displays as about 20 EUR.
          </p>
        </div>
      </div>

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveProfiles}
        className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Shipping Profiles"}
      </Button>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <div className="flex items-center border border-black">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-none border-0"
        />
        <span className="px-3 text-xs font-black uppercase tracking-widest">RON</span>
      </div>
    </div>
  );
}
