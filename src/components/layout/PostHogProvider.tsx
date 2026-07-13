"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode, Suspense } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";
import {
  COOKIE_CONSENT_EVENT,
  getStoredCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { POSTHOG_READY_EVENT } from "@/lib/analytics/posthog-client";

type PostHogRuntimeConfig = {
  enabled?: boolean;
  token?: string;
  host?: string;
  uiHost?: string;
};

let posthogInitPromise: Promise<boolean> | null = null;

async function initializePostHog() {
  if (posthog.__loaded) {
    posthog.opt_in_capturing();
    return true;
  }

  if (!posthogInitPromise) {
    posthogInitPromise = fetch("/api/analytics/posthog-config", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        const config = (await response.json()) as PostHogRuntimeConfig;

        if (!config.enabled || !config.token) {
          return false;
        }

        posthog.init(config.token, {
          api_host: config.host || "https://v.toddsthreads.com",
          ui_host: config.uiHost || "https://eu.posthog.com",
          defaults: "2026-05-30",
          capture_pageview: false,
          capture_pageleave: true,
          person_profiles: "identified_only",
        });

        return true;
      })
      .catch(() => false);
  }

  return posthogInitPromise;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    function applyConsent(value: CookieConsentValue | null) {
      const isAccepted = value === "accepted";

      if (isAccepted) {
        void initializePostHog().then((initialized) => {
          setAnalyticsEnabled(initialized);
          if (initialized) {
            window.dispatchEvent(new Event(POSTHOG_READY_EVENT));
          }
        });
        return;
      }

      setAnalyticsEnabled(false);
      if (posthog.__loaded) {
        posthog.opt_out_capturing();
      }
    }

    applyConsent(getStoredCookieConsent());

    function handleConsentChange(event: Event) {
      applyConsent((event as CustomEvent<CookieConsentValue>).detail);
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    };
  }, []);

  if (!analyticsEnabled || !posthog.__loaded) {
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView analyticsEnabled={analyticsEnabled} />
      </Suspense>
      {children}
    </PostHogReactProvider>
  );
}

function PostHogPageView({ analyticsEnabled }: { analyticsEnabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!analyticsEnabled || !posthog.__loaded || !pathname) {
      return;
    }

    const queryString = searchParams.toString();
    const path = queryString ? `${pathname}?${queryString}` : pathname;

    posthog.capture("$pageview", {
      $current_url: window.location.origin + path,
    });
  }, [analyticsEnabled, pathname, searchParams]);

  return null;
}
