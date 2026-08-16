"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadCloud, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type PreviewItem = {
  wooId: number;
  wooNumber: string;
  customer: string;
  email: string;
  status: string;
  total: number;
  currency: string;
  duplicate: boolean;
  duplicateReason: string | null;
  importable: boolean;
  unmatchedItems: string[];
  unmatchedLineItems: Array<{ key: string; name: string }>;
  variantFallbackItems: string[];
  awbNumber: string | null;
  trackingProvider: string | null;
  invoiceNumber: string | null;
};

type Preview = {
  orders: PreviewItem[];
  total: number;
  importable: number;
  duplicates: number;
  blocked: number;
  productOptions: Array<{ id: string; label: string }>;
  batchPage: number;
  batchSize: number;
  batchTotalPages: number;
  wooTotal: number;
};

type ImportResult = {
  ok?: boolean;
  created?: number;
  updated?: number;
  skipped?: Array<{ wooId: number; number: string; reason: string }>;
  skippedCount?: number;
  errors?: string[];
  error?: string;
};

type ImportProgress = {
  current: number;
  total: number;
  orderNumber: string;
};

type ManualMatches = Record<string, { productId: string; variantId?: string | null }>;

const WOO_ORDER_BATCH_SIZE_OPTIONS = [100, 250, 500] as const;
const WOO_ORDER_IMPORT_CHUNK_SIZE = 10;

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isOrderImportable(order: PreviewItem, manualMatches: ManualMatches) {
  if (order.importable) {
    return true;
  }

  if (order.duplicate || order.unmatchedLineItems.length === 0) {
    return false;
  }

  return order.unmatchedLineItems.every((item) => manualMatches[item.key]?.productId);
}

function getImportableOrders(preview: Preview | null, manualMatches: ManualMatches) {
  return (
    preview?.orders.filter((order) => isOrderImportable(order, manualMatches)) ?? []
  );
}

function getRunnableOrders(preview: Preview | null, manualMatches: ManualMatches) {
  return (
    preview?.orders.filter((order) => isOrderImportable(order, manualMatches)) ?? []
  );
}

function parseExtras(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return trimmed;
  }
}

export function ImportOrdersWooCommerce() {
  const router = useRouter();
  const [extrasText, setExtrasText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [manualMatches, setManualMatches] = useState<ManualMatches>({});
  const [batchPage, setBatchPage] = useState(1);
  const [batchSize, setBatchSize] = useState(100);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [isImportPending, setIsImportPending] = useState(false);
  const [isRepairPending, setIsRepairPending] = useState(false);
  const importableOrders = getImportableOrders(preview, manualMatches);
  const runnableOrders = getRunnableOrders(preview, manualMatches);
  const blockedOrders =
    preview?.orders.filter(
      (order) => !order.duplicate && !isOrderImportable(order, manualMatches),
    ) ?? [];

  async function loadPreview() {
    setIsPreviewPending(true);
    setMessage(null);
    setErrors([]);
    setProgress(null);

    try {
      const response = await fetch("/api/admin/orders/import/woocommerce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extras: parseExtras(extrasText),
          manualMatches,
          options: { batchPage, batchSize },
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        preview?: Preview;
        error?: string;
      };

      if (!response.ok || !result.preview) {
        setErrors([result.error ?? "WooCommerce order preview failed."]);
        return;
      }

      setPreview(result.preview);
      setMessage(
        `${result.preview.importable} orders ready, ${result.preview.duplicates} already imported omitted, ${result.preview.blocked} blocked.`,
      );
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "WooCommerce order preview could not be loaded.",
      ]);
    } finally {
      setIsPreviewPending(false);
    }
  }

  async function importOrders() {
    if (runnableOrders.length === 0) {
      return;
    }

    setIsImportPending(true);
    setMessage(null);
    setErrors([]);
    setProgress({
      current: 0,
      total: runnableOrders.length,
      orderNumber: "Preparing import",
    });

    let created = 0;
    const skipped: NonNullable<ImportResult["skipped"]> = [];
    const importErrors: string[] = [];
    let processed = 0;

    try {
      const extras = parseExtras(extrasText);

      for (const chunk of chunkItems(runnableOrders, WOO_ORDER_IMPORT_CHUNK_SIZE)) {
        const firstOrderNumber = chunk[0]?.wooNumber;
        const lastOrderNumber = chunk.at(-1)?.wooNumber;

        setProgress({
          current: processed,
          total: runnableOrders.length,
          orderNumber:
            firstOrderNumber && lastOrderNumber
              ? `WooCommerce #${firstOrderNumber}-${lastOrderNumber}`
              : "Importing orders",
        });

        const response = await fetch("/api/admin/orders/import/woocommerce", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wooIds: chunk.map((order) => order.wooId),
            extras,
            manualMatches,
          }),
        });
        const result = (await response.json()) as ImportResult;

        processed += chunk.length;
        setProgress({
          current: processed,
          total: runnableOrders.length,
          orderNumber:
            firstOrderNumber && lastOrderNumber
              ? `WooCommerce #${firstOrderNumber}-${lastOrderNumber}`
              : "Imported orders",
        });

        if (!response.ok && response.status !== 207) {
          importErrors.push(
            ...(result.errors ?? [result.error ?? "WooCommerce order import failed."]),
          );
          break;
        }

        created += result.created ?? 0;
        skipped.push(...(result.skipped ?? []));
        importErrors.push(...(result.errors ?? []));
      }
    } catch (error) {
      importErrors.push(
        error instanceof Error
          ? error.message
          : "WooCommerce order import could not be completed.",
      );
    }

    setMessage(`Imported ${created} orders. Skipped ${skipped.length}.`);
    setErrors(importErrors);
    setPreview(null);
    setProgress(null);
    setIsImportPending(false);
    router.refresh();
  }

  async function repairImportedMetadata() {
    setIsRepairPending(true);
    setMessage(null);
    setErrors([]);

    try {
      const response = await fetch("/api/admin/orders/import/woocommerce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repairImported: true,
          extras: parseExtras(extrasText),
          options: { batchPage, batchSize },
        }),
      });
      const result = (await response.json()) as ImportResult;

      if (!response.ok && response.status !== 207) {
        setErrors(result.errors ?? [result.error ?? "WooCommerce repair failed."]);
        return;
      }

      setMessage(
        `Updated ${result.updated ?? 0} already imported orders. Skipped ${
          result.skippedCount ?? 0
        }.`,
      );
      setErrors(result.errors ?? []);
      router.refresh();
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "WooCommerce repair could not be completed.",
      ]);
    } finally {
      setIsRepairPending(false);
    }
  }

  function updateManualMatch(key: string, productId: string) {
    setManualMatches((current) => {
      if (!productId) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return {
        ...current,
        [key]: { productId, variantId: null },
      };
    });
  }

  function updateBatchPage(page: number) {
    setBatchPage(Math.max(Math.floor(page), 1));
    setPreview(null);
    setMessage(null);
    setErrors([]);
  }

  function updateBatchSize(value: string) {
    setBatchSize(Number.parseInt(value, 10) || 100);
    setBatchPage(1);
    setPreview(null);
    setMessage(null);
    setErrors([]);
  }

  return (
    <details className="mb-8 border border-black">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-black uppercase tracking-widest">
        <span>Import Orders WooCommerce</span>
        <span className="text-xs text-slate-500">Open</span>
      </summary>
      <div className="space-y-4 border-t border-black p-4">
        <p className="text-xs leading-6 text-slate-600">
          Imports historical WooCommerce orders without sending emails, reducing stock,
          generating invoices, or creating AWBs. Reruns skip orders already imported.
          Orders with unmatched products are blocked. Variant lines can fall back to the
          generic product when the product title matches.
        </p>

        <label className="block text-xs font-black uppercase tracking-widest">
          Extras / FGO Postmeta{" "}
          <textarea
            value={extrasText}
            onChange={(event) => setExtrasText(event.target.value)}
            placeholder="Paste JSON rows, per-order JSON, or a phpMyAdmin SQL dump with INSERT INTO `wpab_postmeta` rows for _fgo_invoice_* fields."
            className="mt-2 min-h-32 w-full rounded-none border border-black p-3 font-mono text-xs normal-case tracking-normal"
          />
        </label>

        <div className="grid gap-3 border border-black p-3 text-xs font-bold uppercase tracking-widest md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Batch Page{" "}
              <input
                type="number"
                min={1}
                value={batchPage}
                onChange={(event) =>
                  updateBatchPage(Number.parseInt(event.target.value, 10) || 1)
                }
                className="mt-1 h-10 w-full rounded-none border border-black px-3 text-sm font-bold normal-case tracking-normal"
              />
            </label>
            <label>
              Batch Size{" "}
              <select
                value={batchSize}
                onChange={(event) => updateBatchSize(event.target.value)}
                className="mt-1 h-10 w-full rounded-none border border-black bg-white px-3 text-sm font-bold normal-case tracking-normal"
              >
                {WOO_ORDER_BATCH_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateBatchPage(1)}
              disabled={batchPage <= 1 || isPreviewPending || isImportPending}
              className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              First
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => updateBatchPage(batchPage - 1)}
              disabled={batchPage <= 1 || isPreviewPending || isImportPending}
              className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => updateBatchPage(batchPage + 1)}
              disabled={
                Boolean(preview && batchPage >= preview.batchTotalPages) ||
                isPreviewPending ||
                isImportPending
              }
              className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              Next
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => preview && updateBatchPage(preview.batchTotalPages)}
              disabled={
                !preview ||
                batchPage >= preview.batchTotalPages ||
                isPreviewPending ||
                isImportPending
              }
              className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              Last
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={loadPreview}
            disabled={isPreviewPending || isImportPending || isRepairPending}
            className="h-12 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw size={16} />
            {isPreviewPending ? "Loading preview..." : "Preview WooCommerce"}
          </Button>
          <Button
            type="button"
            onClick={importOrders}
            disabled={runnableOrders.length === 0 || isImportPending || isRepairPending}
            className="h-12 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            <DownloadCloud size={16} />
            {isImportPending ? "Importing..." : "Import Orders"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={repairImportedMetadata}
            disabled={isPreviewPending || isImportPending || isRepairPending}
            title="Backfill AWB, invoice, and status fields on WooCommerce orders that were already imported."
            className="h-12 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw size={16} />
            {isRepairPending ? "Repairing..." : "Repair Imported Metadata"}
          </Button>
        </div>

        {progress && (
          <div className="space-y-2 border border-black p-3">
            <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest">
              <span>
                Importing {progress.current} of {progress.total}
              </span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 border border-black">
              <div
                className="h-full bg-black transition-all"
                style={{
                  width: `${Math.round((progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
            {progress.orderNumber && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {progress.orderNumber}
              </p>
            )}
          </div>
        )}

        {preview && (
          <div className="grid gap-3 text-xs font-bold uppercase tracking-widest md:grid-cols-5">
            <div className="border border-black p-3">
              Batch: {preview.batchPage} / {preview.batchTotalPages}
            </div>
            <div className="border border-black p-3">
              Shown: {preview.total} / {preview.wooTotal}
            </div>
            <div className="border border-black p-3">
              Importable: {importableOrders.length}
            </div>
            <div className="border border-black p-3">
              Duplicates: {preview.duplicates}
            </div>
            <div className="border border-black p-3">
              Blocked: {blockedOrders.length}
            </div>
          </div>
        )}

        {preview && (
          <div className="max-h-96 overflow-y-auto border border-black">
            {preview.orders.map((order) => (
              <div
                key={order.wooId}
                className="grid gap-2 border-b border-slate-200 p-3 text-xs md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-black uppercase tracking-tight">
                    #{order.wooNumber} / {order.customer}
                  </p>
                  <p className="font-bold uppercase tracking-widest text-slate-500">
                    {order.email} / {order.status} / {order.total.toFixed(2)}{" "}
                    {order.currency}
                  </p>
                  {(order.awbNumber || order.invoiceNumber) && (
                    <p className="mt-1 text-slate-500">
                      {order.awbNumber
                        ? `AWB ${order.awbNumber} (${order.trackingProvider})`
                        : ""}
                      {order.awbNumber && order.invoiceNumber ? " / " : ""}
                      {order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : ""}
                    </p>
                  )}
                  {order.unmatchedItems.length > 0 && (
                    <p className="mt-1 text-destructive">
                      Unmatched: {order.unmatchedItems.join(" | ")}
                    </p>
                  )}
                  {order.unmatchedLineItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {order.unmatchedLineItems.map((item) => (
                        <label
                          key={item.key}
                          className="block text-xs font-black uppercase tracking-widest"
                        >
                          Match {item.name}
                          <select
                            value={manualMatches[item.key]?.productId ?? ""}
                            onChange={(event) =>
                              updateManualMatch(item.key, event.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-none border border-black bg-white px-2 text-xs font-bold normal-case tracking-normal"
                          >
                            <option value="">Select product...</option>
                            {preview.productOptions.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                  {(order.variantFallbackItems?.length ?? 0) > 0 && (
                    <p className="mt-1 text-amber-700">
                      Generic product fallback: {order.variantFallbackItems.join(" | ")}
                    </p>
                  )}
                </div>
                <div className="font-black uppercase tracking-widest">
                  {order.duplicate
                    ? `Skip: ${order.duplicateReason}`
                    : isOrderImportable(order, manualMatches)
                      ? order.importable
                        ? "Ready"
                        : "Ready: manual"
                      : "Blocked"}
                </div>
              </div>
            ))}
          </div>
        )}

        {message && (
          <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
            {message}
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-2 border border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {errors.slice(0, 8).map((error) => (
              <div key={error}>{error}</div>
            ))}
            {errors.length > 8 && <div>And {errors.length - 8} more errors.</div>}
          </div>
        )}
      </div>
    </details>
  );
}
