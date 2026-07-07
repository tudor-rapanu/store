export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export const TOAST_EVENT = "todds-threads:toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function getFetchErrorMessage(response: Response, fallback: string) {
  if (response.status === 524) {
    return "The server took too long to respond. Please try again in a moment.";
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return "The store is temporarily busy. Please try again in a moment.";
  }

  return fallback;
}
