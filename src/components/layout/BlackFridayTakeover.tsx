"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";

import { capturePostHog } from "@/lib/analytics/posthog-client";
import {
  BLACK_FRIDAY_UI_COPY,
  type BlackFridayLocale,
  type BlackFridayPhase,
  type BlackFridaySettings,
  getBlackFridayCountdownTarget,
  getBlackFridayDismissKey,
  getBlackFridayPhase,
  getCountdownParts,
  isBlackFridayHiddenPath,
  resolveBlackFridayHref,
} from "@/lib/black-friday/campaign";

type BlackFridayTakeoverProps = {
  locale: BlackFridayLocale;
  settings: BlackFridaySettings;
};

function readDismissed(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the takeover
    // then simply shows again on the next visit.
  }
}

type DismissMethod = "close" | "escape" | "homepage" | "cta";

function recordDismissal(key: string, phase: BlackFridayPhase, method: DismissMethod) {
  writeDismissed(key);
  capturePostHog(
    method === "cta" ? "black_friday_cta_clicked" : "black_friday_takeover_dismissed",
    { phase, method },
  );
}

export function BlackFridayTakeover({ locale, settings }: BlackFridayTakeoverProps) {
  const pathname = usePathname();
  // Time is only known after mount, so the server render and first client render
  // agree (nothing shown) and the countdown can't cause a hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const copy = BLACK_FRIDAY_UI_COPY[locale];
  const campaignCopy = settings.copy[locale];
  const ctaHref = resolveBlackFridayHref(settings.ctaHref, locale);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const phase = now === null ? null : getBlackFridayPhase(settings, now);
  const dismissKey = phase ? getBlackFridayDismissKey(settings, phase) : null;
  const isVisible =
    phase !== null &&
    dismissKey !== null &&
    !dismissedKeys.has(dismissKey) &&
    !readDismissed(dismissKey) &&
    !isBlackFridayHiddenPath(pathname, ctaHref);

  function dismiss(method: DismissMethod) {
    if (!phase || !dismissKey) {
      return;
    }

    recordDismissal(dismissKey, phase, method);
    setDismissedKeys((current) => new Set(current).add(dismissKey));
  }

  useEffect(() => {
    if (!isVisible || !phase || !dismissKey) {
      return;
    }

    capturePostHog("black_friday_takeover_viewed", { phase });
    dialogRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && phase && dismissKey) {
        recordDismissal(dismissKey, phase, "escape");
        setDismissedKeys((current) => new Set(current).add(dismissKey));
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissKey, isVisible, phase]);

  if (!isVisible || now === null || !phase) {
    return null;
  }

  const countdown = getCountdownParts(
    getBlackFridayCountdownTarget(settings, phase),
    now,
  );
  const countdownUnits: Array<{ label: string; value: number }> = [
    { label: copy.days, value: countdown.days },
    { label: copy.hours, value: countdown.hours },
    { label: copy.minutes, value: countdown.minutes },
    { label: copy.seconds, value: countdown.seconds },
  ];
  const title = phase === "teaser" ? campaignCopy.teaserTitle : campaignCopy.saleTitle;
  const text = phase === "teaser" ? campaignCopy.teaserText : campaignCopy.saleText;
  const isExternalCta = /^https?:\/\//i.test(ctaHref);

  return (
    // Sits below the cookie banner (z-70) so consent stays reachable, but above
    // the sticky navbar (z-50).
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="black-friday-title"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black text-white outline-none"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/20 px-4 py-3 sm:px-6">
        <Link
          href={`/${locale}`}
          onClick={() => dismiss("homepage")}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {copy.goHome}
        </Link>
        {/* <button
          type="button"
          onClick={() => dismiss("close")}
          aria-label={copy.close}
          className="inline-flex size-10 items-center justify-center border border-white/40 transition-colors hover:bg-white hover:text-black"
        >
          <X className="size-5" aria-hidden="true" />
        </button> */}
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-6">
        <div className="space-y-4">
          {/* <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            {copy.eyebrow}
          </p> */}
          <h2
            id="black-friday-title"
            className="text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl"
          >
            {title}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            {text}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            {phase === "teaser" ? copy.startsIn : copy.endsIn}
          </p>
          <div
            className="grid max-w-2xl grid-cols-4 border border-white/40"
            role="timer"
            aria-live="off"
          >
            {countdownUnits.map((unit, index) => (
              <div
                key={unit.label}
                className={`px-2 py-4 text-center sm:py-6 ${index > 0 ? "border-l border-white/40" : ""}`}
              >
                <div className="text-3xl font-black tabular-nums sm:text-5xl">
                  {String(unit.value).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {phase === "sale" && (
          <Link
            href={ctaHref}
            onClick={() => dismiss("cta")}
            {...(isExternalCta ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex h-14 w-full items-center justify-center bg-white px-8 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-slate-200 sm:w-auto sm:self-start"
          >
            {campaignCopy.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
