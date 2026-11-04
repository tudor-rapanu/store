"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  BLACK_FRIDAY_UI_COPY,
  type BlackFridayLocale,
  type CountdownParts,
  getCountdownParts,
} from "@/lib/black-friday/campaign";

type CountdownGridProps = {
  locale: BlackFridayLocale;
  parts: CountdownParts | null;
};

export function CountdownGrid({ locale, parts }: CountdownGridProps) {
  const copy = BLACK_FRIDAY_UI_COPY[locale];
  const units: Array<{ label: string; value: number | undefined }> = [
    { label: copy.days, value: parts?.days },
    { label: copy.hours, value: parts?.hours },
    { label: copy.minutes, value: parts?.minutes },
    { label: copy.seconds, value: parts?.seconds },
  ];

  return (
    <div className="grid max-w-2xl grid-cols-4 border border-white/40" role="timer">
      {units.map((unit, index) => (
        <div
          key={unit.label}
          className={`px-2 py-4 text-center sm:py-6 ${index > 0 ? "border-l border-white/40" : ""}`}
        >
          <div className="text-3xl font-black tabular-nums sm:text-5xl">
            {unit.value === undefined ? "--" : String(unit.value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">
            {unit.label}
          </div>
        </div>
      ))}
    </div>
  );
}

type BlackFridayCountdownProps = {
  locale: BlackFridayLocale;
  target: number;
};

// Ticks on the client only (so server and client markup agree) and re-renders the
// page from the server when it reaches zero, e.g. to swap the countdown for the sale.
export function BlackFridayCountdown({ locale, target }: BlackFridayCountdownProps) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    const tick = () => {
      const current = Date.now();

      setNow(current);

      if (current >= target && !hasRefreshed.current) {
        hasRefreshed.current = true;
        router.refresh();
      }
    };
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [router, target]);

  return (
    <CountdownGrid
      locale={locale}
      parts={now === null ? null : getCountdownParts(target, now)}
    />
  );
}
