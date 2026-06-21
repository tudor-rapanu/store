"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode, Suspense } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (typeof window !== "undefined" && posthogKey && !posthog.__loaded) {
  posthog.init(posthogKey, {
    api_host: `${window.location.origin}/ingest`,
    ui_host: "https://eu.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <PostHogReactProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogReactProvider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthogKey || !posthog.__loaded || !pathname) {
      return;
    }

    const queryString = searchParams.toString();
    const path = queryString ? `${pathname}?${queryString}` : pathname;

    posthog.capture("$pageview", {
      $current_url: window.location.origin + path,
    });
  }, [pathname, searchParams]);

  return null;
}
