"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  CURRENCY_COOKIE_NAME,
  type DisplayCurrency,
  normalizeDisplayCurrency,
} from "@/lib/currency/preference";

type CurrencySelectorProps = {
  initialCurrency: DisplayCurrency;
  compact?: boolean;
};

export function CurrencySelector({
  initialCurrency,
  compact = false,
}: CurrencySelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currency, setCurrency] = useState<DisplayCurrency>(initialCurrency);

  function updateCurrency(value: string) {
    const nextCurrency = normalizeDisplayCurrency(value);

    if (!nextCurrency) {
      return;
    }

    setCurrency(nextCurrency);
    document.cookie = `${CURRENCY_COOKIE_NAME}=${nextCurrency}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label
      className={
        compact
          ? "inline-flex items-center text-xs font-bold uppercase tracking-widest"
          : "flex flex-col gap-2 text-xs font-bold uppercase tracking-widest"
      }
    >
      <span className={compact ? "sr-only" : undefined}>Currency</span>
      <span className="relative inline-flex items-center">
        <select
          value={currency}
          disabled={isPending}
          onChange={(event) => updateCurrency(event.target.value)}
          className="appearance-none bg-transparent py-2 pl-0 pr-4 text-xs font-bold uppercase tracking-widest text-current outline-none transition-colors hover:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Display currency"
        >
          <option value="RON">RON</option>
          <option value="EUR">EUR</option>
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-0 h-3 w-3"
          strokeWidth={2}
        />
      </span>
    </label>
  );
}
