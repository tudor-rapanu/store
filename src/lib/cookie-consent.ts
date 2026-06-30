export type CookieConsentValue = "accepted" | "declined";

export const COOKIE_CONSENT_STORAGE_KEY = "tt_cookie_consent";
export const COOKIE_CONSENT_EVENT = "tt-cookie-consent-change";

export function getStoredCookieConsent() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);

  return value === "accepted" || value === "declined" ? value : null;
}

export function setStoredCookieConsent(value: CookieConsentValue) {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(
    new CustomEvent<CookieConsentValue>(COOKIE_CONSENT_EVENT, {
      detail: value,
    }),
  );
}
