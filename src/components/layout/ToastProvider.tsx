"use client";

import { useEffect, useState } from "react";

import { TOAST_EVENT, type ToastPayload } from "@/lib/client/toast";

type ToastState = ToastPayload & {
  id: number;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    function handleToast(event: Event) {
      const customEvent = event as CustomEvent<ToastPayload>;

      setToast({
        id: Date.now(),
        variant: "info",
        ...customEvent.detail,
      });
    }

    window.addEventListener(TOAST_EVENT, handleToast);

    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 5200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] max-w-sm border border-black bg-white p-4 text-sm shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div
              className={
                toast.variant === "error"
                  ? "mt-1 size-2 shrink-0 bg-destructive"
                  : toast.variant === "success"
                    ? "mt-1 size-2 shrink-0 bg-emerald-600"
                    : "mt-1 size-2 shrink-0 bg-black"
              }
            />
            <div>
              <p className="font-black uppercase tracking-widest">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-slate-600">{toast.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
