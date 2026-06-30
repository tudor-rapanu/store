"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ShippingProfile = {
  id: string;
  method: "address" | "easybox";
  price: number;
  freeShippingThreshold: number;
};

type ShippingProfilesSettingsProps = {
  profiles: ShippingProfile[];
};

function baniToRon(value: number) {
  return (value / 100).toFixed(2);
}

function ronToBani(value: string) {
  return Math.round(Number(value) * 100);
}

export function ShippingProfilesSettings({
  profiles,
}: ShippingProfilesSettingsProps) {
  const router = useRouter();
  const easyboxProfile = profiles.find((profile) => profile.method === "easybox");
  const addressProfile = profiles.find((profile) => profile.method === "address");
  const [easyboxPrice, setEasyboxPrice] = useState(
    baniToRon(easyboxProfile?.price ?? 1500),
  );
  const [addressPrice, setAddressPrice] = useState(
    baniToRon(addressProfile?.price ?? 2500),
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    baniToRon(
      easyboxProfile?.freeShippingThreshold ??
        addressProfile?.freeShippingThreshold ??
        15000,
    ),
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
          freeShippingThreshold: ronToBani(freeShippingThreshold),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save shipping profiles.");
      }

      setMessage("Shipping profiles saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save shipping profiles.",
      );
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
          Configure local shipping prices used during checkout.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
          label="Free Over"
          value={freeShippingThreshold}
          onChange={setFreeShippingThreshold}
        />
      </div>

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveProfiles}
        className="h-11 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
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
      <Label className="text-xs font-bold uppercase tracking-widest">
        {label}
      </Label>
      <div className="flex items-center border border-black">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-none border-0"
        />
        <span className="px-3 text-xs font-black uppercase tracking-widest">
          RON
        </span>
      </div>
    </div>
  );
}
