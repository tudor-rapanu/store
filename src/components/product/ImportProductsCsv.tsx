"use client";

import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type ImportProductRow = {
  titleEn?: string;
  titleRo?: string;
  descriptionEn?: string;
  descriptionRo?: string;
  slug?: string;
  price?: string;
  imageUrl?: string;
  imageUrls?: string;
  categories?: string;
  productionMinDays?: string;
  productionMaxDays?: string;
  publishAt?: string;
  isDigital?: string;
  trackStock?: string;
  stock?: string;
  digitalFileUrl?: string;
  digitalFileUrls?: string;
  isPrivate?: string;
  variants?: string;
  variantType1?: string;
  variantValues1?: string;
  variantType2?: string;
  variantValues2?: string;
  variantType3?: string;
  variantValues3?: string;
  variantPrice?: string;
  variantTrackStock?: string;
  variantStock?: string;
};

const sampleCsv = Papa.unparse([
  {
    titleEn: "Smooth Operator Patch",
    titleRo: "Smooth Operator Patch",
    descriptionEn: "Embroidered patch",
    descriptionRo: "Patch brodat",
    slug: "smooth-operator-patch",
    price: "25",
    imageUrls: "https://example.com/image.webp",
    categories: "Patches > F1|Patches > Embroidered",
    productionMinDays: "1",
    productionMaxDays: "3",
    publishAt: "",
    isDigital: "false",
    trackStock: "false",
    stock: "",
    digitalFileUrls: "",
    isPrivate: "true",
    variants: "",
    variantType1: "Model",
    variantValues1: "Red|Blue",
    variantType2: "Size",
    variantValues2: "Small|Large",
    variantType3: "",
    variantValues3: "",
    variantPrice: "",
    variantTrackStock: "true",
    variantStock: "10",
  },
]);

export function ImportProductsCsv() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportProductRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const sampleHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`,
    [],
  );

  function parseCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setRows([]);
    setMessage(null);
    setErrors([]);
    setFileName(file?.name ?? "");

    if (!file) {
      return;
    }

    Papa.parse<ImportProductRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const parseErrors = result.errors.map(
          (error) => `Row ${error.row ?? "unknown"}: ${error.message}`,
        );

        if (parseErrors.length > 0) {
          setErrors(parseErrors);
          return;
        }

        setRows(result.data);
        setMessage(`${result.data.length} rows ready to import.`);
      },
      error: (error) => {
        setErrors([error.message]);
      },
    });
  }

  async function importRows() {
    setIsPending(true);
    setMessage(null);
    setErrors([]);

    try {
      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        created?: number;
        errors?: string[];
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setErrors(result.errors ?? [result.error ?? "Import failed."]);
        return;
      }

      setRows([]);
      setFileName("");
      setMessage(`Imported ${result.created ?? 0} products.`);
      router.refresh();
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "The import could not be completed.",
      ]);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <details className="mb-8 border border-black">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-black uppercase tracking-widest">
        <span>Import Products CSV</span>
        <span className="text-xs text-slate-500">Open</span>
      </summary>
      <div className="space-y-4 border-t border-black p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-black px-4 text-xs font-bold uppercase tracking-widest">
            <FileUp size={16} />
            <span>{fileName || "Choose CSV"}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={parseCsv}
              className="sr-only"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            asChild
            className="h-12 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <a href={sampleHref} download="product-import-template.csv">
              Template
            </a>
          </Button>
          <Button
            type="button"
            disabled={rows.length === 0 || isPending}
            onClick={importRows}
            className="h-12 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            {isPending ? "Importing..." : `Import ${rows.length || ""}`}
          </Button>
        </div>

        <div className="text-xs leading-6 text-slate-600">
          Required columns: <code>titleEn</code>, <code>price</code>,{" "}
          <code>imageUrl</code> or <code>imageUrls</code>. Optional:{" "}
          <code>titleRo</code>, <code>descriptionEn</code>, <code>descriptionRo</code>,{" "}
          <code>slug</code>, <code>categories</code>, <code>productionMinDays</code>,{" "}
          <code>productionMaxDays</code>, <code>publishAt</code>, <code>isDigital</code>
          , <code>trackStock</code>, <code>stock</code>, <code>digitalFileUrl</code>,{" "}
          <code>digitalFileUrls</code>, <code>isPrivate</code>, <code>variants</code>,{" "}
          <code>variantType1</code>, <code>variantValues1</code>,{" "}
          <code>variantType2</code>, <code>variantValues2</code>,{" "}
          <code>variantType3</code>, <code>variantValues3</code>,{" "}
          <code>variantPrice</code>, <code>variantTrackStock</code>,{" "}
          <code>variantStock</code>. Use <code>|</code> between multiple image URLs,
          categories, or variant values. Use <code>&gt;</code> inside a category value
          to create a subcategory path, for example <code>Patches &gt; F1</code>. Use
          Romanian local time for <code>publishAt</code>, for example{" "}
          <code>2026-07-20T10:00</code>. For digital products, set{" "}
          <code>isDigital</code> to <code>true</code> and provide protected file URLs in{" "}
          <code>digitalFileUrl</code> or <code>digitalFileUrls</code>. Imported products
          are private unless <code>isPrivate</code> is set to <code>false</code>. Leave{" "}
          <code>variantPrice</code> blank to use the product base price for every
          variant. Duplicate slugs are imported as copy products.
        </div>

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
