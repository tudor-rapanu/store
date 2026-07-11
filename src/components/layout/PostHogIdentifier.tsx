"use client";

import { useEffect } from "react";
import {
  identifyPostHog,
  POSTHOG_READY_EVENT,
} from "@/lib/analytics/posthog-client";

export function PostHogIdentifier({ email }: { email: string }) {
  useEffect(() => {
    function identify() {
      identifyPostHog(email, { email });
    }

    identify();
    window.addEventListener(POSTHOG_READY_EVENT, identify);

    return () => {
      window.removeEventListener(POSTHOG_READY_EVENT, identify);
    };
  }, [email]);

  return null;
}
