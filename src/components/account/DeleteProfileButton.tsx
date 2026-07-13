"use client";

import { useActionState, useState } from "react";

import { deleteCustomerAccount } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";

type DeleteProfileButtonProps = {
  locale: "en" | "ro";
};

export function DeleteProfileButton({ locale }: DeleteProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_previousState: unknown, formData: FormData) => {
      return await deleteCustomerAccount(formData);
    },
    null,
  );
  const errorMessage =
    state && "error" in state && typeof state.error === "string" ? state.error : "";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="h-12 rounded-none border-red-700 px-6 text-xs font-bold uppercase tracking-widest text-red-700 hover:bg-red-700 hover:text-white"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isPending ? "Deleting..." : "Delete Account"}
      </Button>
      {errorMessage && (
        <p className="max-w-xl text-sm font-bold text-red-700">{errorMessage}</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-lg border border-red-700 bg-white p-6 shadow-xl">
            <div className="space-y-3">
              <h3
                id="delete-account-title"
                className="text-xl font-black uppercase tracking-tight text-red-700"
              >
                Delete your account?
              </h3>
              <p className="text-sm text-slate-700">
                This permanently deletes your login account and saved profile details.
                You will lose access to account login, saved personal details, saved
                delivery address, account order history, and protected digital
                downloads.
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Order records are kept for legal, payment, and fulfillment history, but
                they will no longer be attached to an active account.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Keep Account
              </Button>
              <form action={formAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button
                  type="submit"
                  className="w-full rounded-none bg-red-700 text-white hover:bg-red-800 sm:w-auto"
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Yes, Delete Account"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
