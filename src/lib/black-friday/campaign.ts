export type BlackFridayLocale = "en" | "ro";

export type BlackFridayPhase = "teaser" | "sale";

export type BlackFridayCopy = {
  teaserTitle: string;
  teaserText: string;
  saleTitle: string;
  saleText: string;
  ctaLabel: string;
};

export type BlackFridaySettings = {
  enabled: boolean;
  // ISO timestamps. A null teaser start means the countdown shows as soon as the
  // campaign is enabled.
  teaserStartsAt: string | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  ctaHref: string;
  copy: Record<BlackFridayLocale, BlackFridayCopy>;
};

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const COPY_FIELD_MAX_LENGTH: Record<keyof BlackFridayCopy, number> = {
  teaserTitle: 80,
  teaserText: 240,
  saleTitle: 80,
  saleText: 240,
  ctaLabel: 40,
};

const CTA_HREF_MAX_LENGTH = 300;

// Pages where a full-screen takeover would get in the way of a task the visitor
// is already in the middle of (paying, signing in, managing the store).
const HIDDEN_PATH_SEGMENTS = new Set([
  "admin",
  "checkout",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "orders",
  // The dedicated sale page already shows the same countdown.
  "black-friday",
]);

export const DEFAULT_BLACK_FRIDAY_COPY: Record<BlackFridayLocale, BlackFridayCopy> = {
  en: {
    teaserTitle: "Black Friday is coming",
    teaserText: "Our biggest drop of the year starts soon. Mark the date.",
    saleTitle: "Black Friday is live",
    saleText: "Limited-time prices across the shop, while stock lasts.",
    ctaLabel: "Shop Black Friday",
  },
  ro: {
    teaserTitle: "Black Friday vine curând",
    teaserText: "Cea mai mare reducere a anului începe în curând. Notează-ți data.",
    saleTitle: "Black Friday a început",
    saleText: "Prețuri reduse pentru o perioadă limitată, în limita stocului.",
    ctaLabel: "Vezi ofertele Black Friday",
  },
};

export const BLACK_FRIDAY_UI_COPY = {
  en: {
    eyebrow: "Todd's Threads",
    startsIn: "Starts in",
    endsIn: "Ends in",
    days: "Days",
    hours: "Hours",
    minutes: "Min",
    seconds: "Sec",
    goHome: "Go to homepage",
    close: "Close",
  },
  ro: {
    eyebrow: "Todd's Threads",
    startsIn: "Începe în",
    endsIn: "Se încheie în",
    days: "Zile",
    hours: "Ore",
    minutes: "Min",
    seconds: "Sec",
    goHome: "Mergi la pagina principală",
    close: "Închide",
  },
} as const;

export function getDefaultBlackFridaySettings(): BlackFridaySettings {
  return {
    enabled: false,
    teaserStartsAt: null,
    saleStartsAt: null,
    saleEndsAt: null,
    ctaHref: "",
    copy: {
      en: { ...DEFAULT_BLACK_FRIDAY_COPY.en },
      ro: { ...DEFAULT_BLACK_FRIDAY_COPY.ro },
    },
  };
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCtaHref(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().slice(0, CTA_HREF_MAX_LENGTH);

  return trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

function normalizeCopy(value: unknown, locale: BlackFridayLocale): BlackFridayCopy {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = DEFAULT_BLACK_FRIDAY_COPY[locale];
  const fields = Object.keys(COPY_FIELD_MAX_LENGTH) as Array<keyof BlackFridayCopy>;

  return Object.fromEntries(
    fields.map((field) => {
      const raw = typeof source[field] === "string" ? source[field].trim() : "";

      return [
        field,
        raw ? raw.slice(0, COPY_FIELD_MAX_LENGTH[field]) : defaults[field],
      ];
    }),
  ) as BlackFridayCopy;
}

export function normalizeBlackFridaySettings(value: unknown): BlackFridaySettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return getDefaultBlackFridaySettings();
  }

  const source = value as Record<string, unknown>;
  const copy =
    source.copy && typeof source.copy === "object" && !Array.isArray(source.copy)
      ? (source.copy as Record<string, unknown>)
      : {};

  return {
    enabled: source.enabled === true,
    teaserStartsAt: normalizeTimestamp(source.teaserStartsAt),
    saleStartsAt: normalizeTimestamp(source.saleStartsAt),
    saleEndsAt: normalizeTimestamp(source.saleEndsAt),
    ctaHref: normalizeCtaHref(source.ctaHref),
    copy: {
      en: normalizeCopy(copy.en, "en"),
      ro: normalizeCopy(copy.ro, "ro"),
    },
  };
}

export function validateBlackFridaySettings(settings: BlackFridaySettings) {
  if (!settings.enabled) {
    return null;
  }

  if (!settings.saleStartsAt || !settings.saleEndsAt) {
    return "Set both the sale start and the sale end before enabling the campaign.";
  }

  const saleStartsAt = Date.parse(settings.saleStartsAt);
  const saleEndsAt = Date.parse(settings.saleEndsAt);

  if (saleEndsAt <= saleStartsAt) {
    return "The sale must end after it starts.";
  }

  if (settings.teaserStartsAt && Date.parse(settings.teaserStartsAt) > saleStartsAt) {
    return "The countdown must start before the sale starts.";
  }

  if (!settings.ctaHref) {
    return "Set the Black Friday page link (a path like /black-friday or a full URL).";
  }

  return null;
}

export function getBlackFridayPhase(
  settings: BlackFridaySettings,
  now: number,
): BlackFridayPhase | null {
  if (!settings.enabled || !settings.saleStartsAt || !settings.saleEndsAt) {
    return null;
  }

  const saleStartsAt = Date.parse(settings.saleStartsAt);
  const saleEndsAt = Date.parse(settings.saleEndsAt);
  const teaserStartsAt = settings.teaserStartsAt
    ? Date.parse(settings.teaserStartsAt)
    : Number.NEGATIVE_INFINITY;

  if (now >= saleEndsAt || now < teaserStartsAt) {
    return null;
  }

  return now < saleStartsAt ? "teaser" : "sale";
}

export function getBlackFridayCountdownTarget(
  settings: BlackFridaySettings,
  phase: BlackFridayPhase,
) {
  return Date.parse(
    (phase === "teaser" ? settings.saleStartsAt : settings.saleEndsAt) ?? "",
  );
}

export function getCountdownParts(target: number, now: number): CountdownParts {
  const totalSeconds = Math.max(Math.floor((target - now) / 1000), 0);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function resolveBlackFridayHref(href: string, locale: BlackFridayLocale) {
  if (!href) {
    return `/${locale}`;
  }

  if (/^https?:\/\//i.test(href) || /^\/(?:en|ro)(?:\/|$)/.test(href)) {
    return href;
  }

  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

export function isBlackFridayHiddenPath(pathname: string, ctaHref: string) {
  const [first, second] = pathname.split("/").filter(Boolean);
  const segment = first === "en" || first === "ro" ? second : first;

  if (segment && HIDDEN_PATH_SEGMENTS.has(segment)) {
    return true;
  }

  // Don't cover the sale page the takeover is pointing visitors to.
  const normalizedPath = pathname.replace(/\/+$/, "");
  const normalizedHref = ctaHref.replace(/\/+$/, "");

  return Boolean(normalizedHref) && normalizedPath === normalizedHref;
}

// Dismissals are remembered per campaign and per phase, so closing the
// countdown doesn't also hide the "sale is live" takeover when Black Friday starts.
export function getBlackFridayDismissKey(
  settings: BlackFridaySettings,
  phase: BlackFridayPhase,
) {
  return `tt-black-friday:${settings.saleStartsAt ?? "none"}:${phase}`;
}
