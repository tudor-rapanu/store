"use client";

import posthog from "posthog-js";

type PostHogProperties = Record<string, unknown>;

export const POSTHOG_READY_EVENT = "tt-posthog-ready";

export function isPostHogReady() {
  return posthog.__loaded && !posthog.has_opted_out_capturing();
}

export function capturePostHog(eventName: string, properties?: PostHogProperties) {
  if (!isPostHogReady()) {
    return;
  }

  posthog.capture(eventName, properties);
}

export function identifyPostHog(distinctId: string, properties?: PostHogProperties) {
  if (!isPostHogReady()) {
    return;
  }

  posthog.identify(distinctId, properties);
}
