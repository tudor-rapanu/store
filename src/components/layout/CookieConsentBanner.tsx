"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getStoredCookieConsent,
  setStoredCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

type CookieConsentBannerProps = {
  locale: "en" | "ro";
};

export function CookieConsentBanner({ locale }: CookieConsentBannerProps) {
  const [consent, setConsent] = useState<CookieConsentValue | null>("declined");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setConsent(getStoredCookieConsent());
      setIsReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  function chooseConsent(value: CookieConsentValue) {
    setStoredCookieConsent(value);
    setConsent(value);
  }

  if (!isReady || consent) {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-black bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] sm:px-6"
    >
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest">
            Cookie preferences
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            We use essential cookies for login, cart and checkout. With your
            consent, we also use analytics cookies to understand site usage and
            improve Todd&apos;s Threads.
          </p>
          <Link
            href={`/${locale}/legal/privacy`}
            className="text-xs font-bold uppercase tracking-widest underline underline-offset-4"
          >
            Privacy policy
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:min-w-72">
          <Button
            type="button"
            variant="outline"
            onClick={() => chooseConsent("declined")}
            className="h-11 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            Decline
          </Button>
          <Button
            type="button"
            onClick={() => chooseConsent("accepted")}
            className="h-11 rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
          >
            Accept
          </Button>
        </div>
      </div>
    </section>
  );
}
