"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadCloud, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type PreviewItem = {
  wooId: number;
  nameRo: string;
  nameEn: string;
  slug: string;
  type: string;
  status: string;
  visibility: string;
  duplicate: boolean;
  duplicateReason: string | null;
  isPrivate: boolean;
  price: number | null;
  imageCount: number;
  categoryPaths: string[];
  variantCount: number;
};

type Preview = {
  products: PreviewItem[];
  total: number;
  importable: number;
  duplicates: number;
};

type ImportResult = {
  ok?: boolean;
  created?: number;
  skipped?: Array<{ wooId: number; name: string; reason: string }>;
  errors?: string[];
  error?: string;
};

type ImportProgress = {
  current: number;
  total: number;
  productName: string;
};

function formatPrice(value: number | null) {
  return value ? `${value.toFixed(2)} RON` : "No price";
}

function getImportableProducts(preview: Preview | null) {
  return (
    preview?.products.filter((product) => !product.duplicate && product.price) ?? []
  );
}

export function ImportProductsWooCommerce() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [isImportPending, setIsImportPending] = useState(false);
  const importableProducts = getImportableProducts(preview);

  async function loadPreview() {
    setIsPreviewPending(true);
    setMessage(null);
    setErrors([]);
    setProgress(null);

    try {
      const response = await fetch("/api/admin/products/import/woocommerce", {
        method: "GET",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        preview?: Preview;
        error?: string;
      };

      if (!response.ok || !result.preview) {
        setErrors([result.error ?? "WooCommerce preview failed."]);
        return;
      }

      setPreview(result.preview);
      setMessage(
        `${result.preview.importable} products ready, ${result.preview.duplicates} duplicates skipped.`,
      );
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "WooCommerce preview could not be loaded.",
      ]);
    } finally {
      setIsPreviewPending(false);
    }
  }

  async function importProducts() {
    if (importableProducts.length === 0) {
      return;
    }

    setIsImportPending(true);
    setMessage(null);
    setErrors([]);
    setProgress({ current: 0, total: importableProducts.length, productName: "" });

    let created = 0;
    const skipped: NonNullable<ImportResult["skipped"]> = [];
    const importErrors: string[] = [];

    try {
      for (const [index, product] of importableProducts.entries()) {
        setProgress({
          current: index + 1,
          total: importableProducts.length,
          productName: product.nameRo,
        });

        const response = await fetch("/api/admin/products/import/woocommerce", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wooId: product.wooId }),
        });
        const result = (await response.json()) as ImportResult;

        if (!response.ok && response.status !== 207) {
          importErrors.push(
            ...(result.errors ?? [result.error ?? `${product.nameRo}: import failed.`]),
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
          : "WooCommerce import could not be completed.",
      );
    }

    setMessage(`Imported ${created} products. Skipped ${skipped.length}.`);
    setErrors(importErrors);
    setPreview(null);
    setProgress(null);
    setIsImportPending(false);
    router.refresh();
  }

  return (
    <details className="mb-8 border border-black">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-black uppercase tracking-widest">
        <span>Import Products WooCommerce</span>
        <span className="text-xs text-slate-500">Open</span>
      </summary>
      <div className="space-y-4 border-t border-black p-4">
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={loadPreview}
            disabled={isPreviewPending || isImportPending}
            className="h-12 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw size={16} />
            {isPreviewPending ? "Loading preview..." : "Preview WooCommerce"}
          </Button>
          <Button
            type="button"
            onClick={importProducts}
            disabled={importableProducts.length === 0 || isImportPending}
            className="h-12 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            <DownloadCloud size={16} />
            {isImportPending ? "Importing..." : "Import New Products"}
          </Button>
        </div>

        <p className="text-xs leading-6 text-slate-600">
          Imports products from WooCommerce once, skips products whose slug or variant
          SKU already exists, imports images into product storage, and creates
          categories/subcategories automatically. Stock is not imported. WooCommerce
          public products stay public; private, draft, or hidden products stay private.
        </p>

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
            {progress.productName && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {progress.productName}
              </p>
            )}
          </div>
        )}

        {preview && (
          <div className="grid gap-3 text-xs font-bold uppercase tracking-widest md:grid-cols-4">
            <div className="border border-black p-3">Total: {preview.total}</div>
            <div className="border border-black p-3">
              Importable: {preview.importable}
            </div>
            <div className="border border-black p-3">
              Duplicates: {preview.duplicates}
            </div>
            <div className="border border-black p-3">
              Private: {preview.products.filter((item) => item.isPrivate).length}
            </div>
          </div>
        )}

        {preview && (
          <div className="max-h-96 overflow-y-auto border border-black">
            {preview.products.slice(0, 80).map((product) => (
              <div
                key={product.wooId}
                className="grid gap-2 border-b border-slate-200 p-3 text-xs md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-black uppercase tracking-tight">
                    {product.nameRo}
                  </p>
                  <p className="font-bold uppercase tracking-widest text-slate-500">
                    {product.slug} / {formatPrice(product.price)} /{" "}
                    {product.variantCount} variants / {product.imageCount} images
                  </p>
                  <p className="mt-1 text-slate-500">EN draft: {product.nameEn}</p>
                  {product.categoryPaths.length > 0 && (
                    <p className="mt-1 text-slate-500">
                      {product.categoryPaths.join(" | ")}
                    </p>
                  )}
                </div>
                <div className="font-black uppercase tracking-widest">
                  {product.duplicate
                    ? `Skip: ${product.duplicateReason}`
                    : product.isPrivate
                      ? "Private"
                      : "Public"}
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
