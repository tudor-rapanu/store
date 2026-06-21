"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogIdentifier({ email }: { email: string }) {
  useEffect(() => {
    if (!posthog.__loaded) {
      return;
    }

    posthog.identify(email, { email });
  }, [email]);

  return null;
}
