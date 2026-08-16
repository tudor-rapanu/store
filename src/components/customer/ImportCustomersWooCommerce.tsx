"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadCloud, RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

type Preview = {
  customerIds: number[];
  customers: number;
  accountsToCreate: number;
  existingAccounts: number;
  profilesToCreate: number;
  existingProfiles: number;
  orderMappings: number;
  ordersReadyToLink: number;
  ordersAlreadyLinked: number;
  missingImportedOrders: number;
  conflictingOrders: number;
  skippedAdminMappings: number;
  warnings: string[];
  canImport: boolean;
};

type ImportResult = {
  requested: number;
  accountsCreated: number;
  accountsReused: number;
  profilesCreated: number;
  profilesUnchanged: number;
  ordersLinked: number;
  ordersAlreadyLinked: number;
  missingImportedOrders: number;
  conflictingOrders: number;
  errors: string[];
};

type Totals = Omit<ImportResult, "errors">;

const IMPORT_CHUNK_SIZE = 20;
const EMPTY_TOTALS: Totals = {
  requested: 0,
  accountsCreated: 0,
  accountsReused: 0,
  profilesCreated: 0,
  profilesUnchanged: 0,
  ordersLinked: 0,
  ordersAlreadyLinked: 0,
  missingImportedOrders: 0,
  conflictingOrders: 0,
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function addResult(total: Totals, result: ImportResult): Totals {
  return {
    requested: total.requested + result.requested,
    accountsCreated: total.accountsCreated + result.accountsCreated,
    accountsReused: total.accountsReused + result.accountsReused,
    profilesCreated: total.profilesCreated + result.profilesCreated,
    profilesUnchanged: total.profilesUnchanged + result.profilesUnchanged,
    ordersLinked: total.ordersLinked + result.ordersLinked,
    ordersAlreadyLinked: total.ordersAlreadyLinked + result.ordersAlreadyLinked,
    missingImportedOrders: total.missingImportedOrders + result.missingImportedOrders,
    conflictingOrders: total.conflictingOrders + result.conflictingOrders,
  };
}

async function readJson(response: Response) {
  const body = (await response.json()) as {
    error?: string;
    preview?: Preview;
    result?: ImportResult;
  };

  if (!response.ok && response.status !== 207) {
    throw new Error(body.error || "The customer import request failed.");
  }

  return body;
}

export function ImportCustomersWooCommerce() {
  const router = useRouter();
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

  function resetPreview() {
    setPreview(null);
    setConfirmed(false);
    setMessage(null);
    setErrors([]);
    setTotals(null);
  }

  async function readFiles() {
    if (!customerFile || !mappingFile) {
      throw new Error("Select both CSV exports before continuing.");
    }

    const [customerCsv, orderMappingCsv] = await Promise.all([
      customerFile.text(),
      mappingFile.text(),
    ]);
    return { customerCsv, orderMappingCsv };
  }

  async function previewImport() {
    setIsPending(true);
    setMessage(null);
    setErrors([]);
    setTotals(null);

    try {
      const files = await readFiles();
      const response = await fetch("/api/admin/customers/import/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", ...files }),
      });
      const body = await readJson(response);

      if (!body.preview) throw new Error("The preview response was incomplete.");
      setPreview(body.preview);
      setConfirmed(false);
      setMessage(
        `Validated ${body.preview.customers} customers and ${body.preview.orderMappings} registered-customer order mappings.`,
      );
    } catch (error) {
      setPreview(null);
      setErrors([error instanceof Error ? error.message : "Preview failed."]);
    } finally {
      setIsPending(false);
    }
  }

  async function runImport() {
    if (!preview?.canImport || !confirmed) return;

    setIsPending(true);
    setMessage(null);
    setErrors([]);
    setTotals(null);

    try {
      const files = await readFiles();
      const batches = chunk(preview.customerIds, IMPORT_CHUNK_SIZE);
      let imported = 0;
      let nextTotals = { ...EMPTY_TOTALS };
      const nextErrors: string[] = [];

      for (const legacyUserIds of batches) {
        setProgress({ current: imported, total: preview.customers });
        const response = await fetch("/api/admin/customers/import/woocommerce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "import",
            ...files,
            legacyUserIds,
            confirmation: "IMPORT_WOOCOMMERCE_CUSTOMERS",
          }),
        });
        const body = await readJson(response);

        if (!body.result) throw new Error("The import response was incomplete.");
        nextTotals = addResult(nextTotals, body.result);
        nextErrors.push(...body.result.errors);
        imported += legacyUserIds.length;
        setTotals(nextTotals);
        setErrors([...nextErrors]);
      }

      setProgress({ current: preview.customers, total: preview.customers });
      setTotals(nextTotals);
      setErrors(nextErrors);
      setMessage(
        nextErrors.length > 0
          ? `Import completed with ${nextErrors.length} customer error(s). It is safe to preview and run it again.`
          : `Created ${nextTotals.profilesCreated} customer profiles and linked ${nextTotals.ordersLinked} orders.`,
      );
      router.refresh();
    } catch (error) {
      setErrors((current) => [
        ...current,
        error instanceof Error ? error.message : "Import failed.",
      ]);
    } finally {
      setIsPending(false);
      setProgress(null);
    }
  }

  return (
    <section className="space-y-6 border border-black p-5">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">
            WooCommerce customers
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Creates Neon Auth accounts, saves customer profiles, and assigns only the
            orders listed in the HPOS mapping export. Password hashes are not migrated;
            customers must use Forgot password before signing in.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block border border-slate-300 p-4">
          <span className="block text-xs font-black uppercase tracking-widest">
            1. Customers CSV
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            woocommerce-customers.csv
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-4 block w-full text-sm file:mr-3 file:border file:border-black file:bg-white file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase"
            onChange={(event) => {
              setCustomerFile(event.target.files?.[0] ?? null);
              resetPreview();
            }}
          />
        </label>

        <label className="block border border-slate-300 p-4">
          <span className="block text-xs font-black uppercase tracking-widest">
            2. HPOS mapping CSV
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            HPOS-order-to-customer-mapping.csv
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-4 block w-full text-sm file:mr-3 file:border file:border-black file:bg-white file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase"
            onChange={(event) => {
              setMappingFile(event.target.files?.[0] ?? null);
              resetPreview();
            }}
          />
        </label>
      </div>

      <Button
        type="button"
        variant="outline"
        className="rounded-none border-black text-xs font-black uppercase tracking-widest"
        disabled={isPending || !customerFile || !mappingFile}
        onClick={previewImport}
      >
        {isPending && !progress ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <DownloadCloud className="mr-2 h-4 w-4" />
        )}
        Validate &amp; Preview
      </Button>

      {preview && (
        <div className="space-y-4 border-t border-black pt-5">
          <div className="grid gap-px bg-black sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Customers", preview.customers],
              ["Accounts to create", preview.accountsToCreate],
              ["Existing accounts", preview.existingAccounts],
              ["Existing profiles kept", preview.existingProfiles],
              ["Orders ready", preview.ordersReadyToLink],
              ["Already linked", preview.ordersAlreadyLinked],
              ["Missing orders", preview.missingImportedOrders],
              ["Ownership conflicts", preview.conflictingOrders],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <div className="text-2xl font-black">{value}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="space-y-1 border border-amber-400 bg-amber-50 p-4 text-sm">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-black"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I reviewed the preview and understand that imported customers need to
              reset their password. Existing order owners will never be overwritten.
            </span>
          </label>

          <Button
            type="button"
            className="rounded-none bg-black text-xs font-black uppercase tracking-widest text-white"
            disabled={isPending || !preview.canImport || !confirmed}
            onClick={runImport}
          >
            {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import customers &amp; link orders
          </Button>
        </div>
      )}

      {progress && (
        <div className="text-sm font-bold uppercase tracking-widest">
          Processing {progress.current} / {progress.total}
        </div>
      )}

      {totals && (
        <div className="border border-emerald-600 bg-emerald-50 p-4 text-sm">
          Created {totals.accountsCreated} accounts, reused {totals.accountsReused},
          created {totals.profilesCreated} profiles, kept {totals.profilesUnchanged}
          existing profiles unchanged, linked {totals.ordersLinked} orders, and left{" "}
          {totals.ordersAlreadyLinked} already-correct links unchanged.
        </div>
      )}

      {message && <p className="text-sm font-semibold">{message}</p>}
      {errors.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-auto border border-red-500 bg-red-50 p-4 text-sm text-red-900">
          {errors.map((error, index) => (
            <li key={`${index}-${error}`}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
