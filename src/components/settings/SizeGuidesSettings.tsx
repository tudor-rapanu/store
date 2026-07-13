"use client";

import Image from "next/image";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFetchErrorMessage, showToast } from "@/lib/client/toast";
import type { SizeGuideRow, TranslatedText } from "@/lib/db/schema";

type SizeGuideDraft = {
  id?: string;
  slug: string;
  title: TranslatedText;
  description: TranslatedText;
  imageUrl: string;
  columns: string[];
  rows: SizeGuideRow[];
  enabled: boolean;
};

type SizeGuidesSettingsProps = {
  sizeGuides: Array<{
    id: string;
    slug: string;
    title: TranslatedText;
    description?: TranslatedText | null;
    imageUrl?: string | null;
    columns: string[];
    rows: SizeGuideRow[];
    enabled: boolean;
  }>;
};

function createBlankSizeGuide(): SizeGuideDraft {
  return {
    slug: "",
    title: {
      en: "",
      ro: "",
    },
    description: {
      en: "",
      ro: "",
    },
    imageUrl: "",
    columns: ["S", "M", "L", "XL"],
    rows: [
      {
        label: "A",
        values: ["", "", "", ""],
      },
    ],
    enabled: true,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRenderableImageSrc(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function normalizeInitialGuide(
  guide: SizeGuidesSettingsProps["sizeGuides"][number],
): SizeGuideDraft {
  return {
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    description: guide.description ?? { en: "", ro: "" },
    imageUrl: guide.imageUrl ?? "",
    columns: guide.columns.length > 0 ? guide.columns : ["S", "M", "L", "XL"],
    rows:
      guide.rows.length > 0
        ? guide.rows
        : [
            {
              label: "A",
              values: ["", "", "", ""],
            },
          ],
    enabled: guide.enabled,
  };
}

export function SizeGuidesSettings({ sizeGuides }: SizeGuidesSettingsProps) {
  const [draftGuides, setDraftGuides] = useState<SizeGuideDraft[]>(() =>
    sizeGuides.map(normalizeInitialGuide),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateGuide(
    index: number,
    updater: (guide: SizeGuideDraft) => SizeGuideDraft,
  ) {
    setDraftGuides((current) =>
      current.map((guide, guideIndex) =>
        guideIndex === index ? updater(guide) : guide,
      ),
    );
  }

  function updateColumns(index: number, value: string) {
    const columns = value
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);

    updateGuide(index, (guide) => ({
      ...guide,
      columns,
      rows: guide.rows.map((row) => ({
        ...row,
        values: columns.map((_, columnIndex) => row.values[columnIndex] ?? ""),
      })),
    }));
  }

  function updateRow(
    guideIndex: number,
    rowIndex: number,
    field: "label" | "values",
    value: string,
  ) {
    updateGuide(guideIndex, (guide) => ({
      ...guide,
      rows: guide.rows.map((row, currentRowIndex) => {
        if (currentRowIndex !== rowIndex) {
          return row;
        }

        return field === "label"
          ? { ...row, label: value }
          : {
              ...row,
              values: value.split(",").map((item) => item.trim()),
            };
      }),
    }));
  }

  async function saveSizeGuides() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings/size-guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeGuides: draftGuides }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ?? getFetchErrorMessage(response, "Could not save size guides."),
        );
      }

      setMessage("Size guides saved.");
      showToast({
        title: "Settings saved",
        description: "Size guides were updated.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save size guides.";

      setMessage(message);
      showToast({
        title: "Save failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-5 border border-black p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">Size Guides</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create reusable measurement tables and assign them to clothing products.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraftGuides((current) => [...current, createBlankSizeGuide()])
          }
          className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Plus size={14} /> Size Guide
        </Button>
      </div>

      {draftGuides.length === 0 ? (
        <div className="border border-dashed border-slate-300 p-4 text-sm font-bold uppercase tracking-widest text-slate-500">
          No size guides yet.
        </div>
      ) : (
        <div className="space-y-4">
          {draftGuides.map((guide, index) => (
            <details
              key={guide.id ?? index}
              className="border border-black"
              open={index === 0}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-3 text-sm font-black uppercase tracking-widest">
                <span>{guide.title.en || "Untitled size guide"}</span>
                <span className="text-xs text-slate-500">Edit</span>
              </summary>
              <div className="space-y-4 border-t border-black p-4">
                <label className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                  <input
                    type="checkbox"
                    checked={guide.enabled}
                    onChange={(event) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="size-4"
                  />
                  Enabled
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Title English"
                    value={guide.title.en}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        title: { ...current.title, en: value },
                        slug: current.slug || slugify(value),
                      }))
                    }
                  />
                  <TextField
                    label="Title Romanian"
                    value={guide.title.ro}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        title: { ...current.title, ro: value },
                      }))
                    }
                  />
                  <TextField
                    label="Slug"
                    value={guide.slug}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        slug: slugify(value),
                      }))
                    }
                  />
                  <TextField
                    label="Diagram Image URL"
                    value={guide.imageUrl}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        imageUrl: value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextAreaField
                    label="Description English"
                    value={guide.description.en}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        description: { ...current.description, en: value },
                      }))
                    }
                  />
                  <TextAreaField
                    label="Description Romanian"
                    value={guide.description.ro}
                    onChange={(value) =>
                      updateGuide(index, (current) => ({
                        ...current,
                        description: { ...current.description, ro: value },
                      }))
                    }
                  />
                </div>

                <TextField
                  label="Size Columns"
                  value={guide.columns.join(", ")}
                  onChange={(value) => updateColumns(index, value)}
                  placeholder="XXS, XS, S, M, L, XL"
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs font-bold uppercase tracking-widest">
                      Measurement Rows
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateGuide(index, (current) => ({
                          ...current,
                          rows: [
                            ...current.rows,
                            {
                              label: "",
                              values: current.columns.map(() => ""),
                            },
                          ],
                        }))
                      }
                      className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
                    >
                      <Plus size={14} /> Row
                    </Button>
                  </div>
                  {guide.rows.map((row, rowIndex) => (
                    <div
                      key={`${row.label}-${rowIndex}`}
                      className="grid gap-2 md:grid-cols-[120px_1fr_auto]"
                    >
                      <Input
                        value={row.label}
                        onChange={(event) =>
                          updateRow(index, rowIndex, "label", event.target.value)
                        }
                        placeholder="A"
                        className="h-10 rounded-none border-black"
                      />
                      <Input
                        value={row.values.join(", ")}
                        onChange={(event) =>
                          updateRow(index, rowIndex, "values", event.target.value)
                        }
                        placeholder="49.5, 53.5, 56.5"
                        className="h-10 rounded-none border-black"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          updateGuide(index, (current) => ({
                            ...current,
                            rows: current.rows.filter(
                              (_, currentRowIndex) => currentRowIndex !== rowIndex,
                            ),
                          }))
                        }
                        className="rounded-none border-black"
                        aria-label="Delete measurement row"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                <SizeGuidePreview guide={guide} />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraftGuides((current) =>
                      current.filter((_, guideIndex) => guideIndex !== index),
                    )
                  }
                  className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
                >
                  <Trash2 size={14} /> Delete Size Guide
                </Button>
              </div>
            </details>
          ))}
        </div>
      )}

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveSizeGuides}
        className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Size Guides"}
      </Button>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}

function SizeGuidePreview({ guide }: { guide: SizeGuideDraft }) {
  return (
    <div className="space-y-3 border border-slate-200 p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        Preview
      </p>
      {isRenderableImageSrc(guide.imageUrl) && (
        <div className="relative aspect-[16/7] overflow-hidden border border-slate-200 bg-white">
          <Image
            src={guide.imageUrl}
            alt=""
            fill
            unoptimized
            className="object-contain p-2"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="px-3 py-2 text-left font-black uppercase">Sizes</th>
              {guide.columns.map((column) => (
                <th key={column} className="px-3 py-2 text-center font-black uppercase">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`} className="border-b">
                <td className="px-3 py-2 text-left font-bold">{row.label}</td>
                {guide.columns.map((column, columnIndex) => (
                  <td key={column} className="px-3 py-2 text-center">
                    {row.values[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 rounded-none border-black"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}
