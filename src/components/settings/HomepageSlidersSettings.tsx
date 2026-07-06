"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HomepageCategorySection } from "@/lib/homepage/settings";

type CategoryOption = {
  id: string;
  label: string;
};

type HomepageSlidersSettingsProps = {
  categories: CategoryOption[];
  sections: HomepageCategorySection[];
  productsPerSlider: number;
};

function mergeSections(
  categories: CategoryOption[],
  sections: HomepageCategorySection[],
) {
  const categoryIds = new Set(categories.map((category) => category.id));
  const seen = new Set<string>();
  const ordered = sections
    .filter((section) => categoryIds.has(section.categoryId))
    .filter((section) => {
      if (seen.has(section.categoryId)) {
        return false;
      }

      seen.add(section.categoryId);
      return true;
    });
  const missing = categories
    .filter((category) => !seen.has(category.id))
    .map((category) => ({
      categoryId: category.id,
      enabled: false,
    }));

  return [...ordered, ...missing];
}

export function HomepageSlidersSettings({
  categories,
  sections,
  productsPerSlider,
}: HomepageSlidersSettingsProps) {
  const categoryLabels = useMemo(
    () => new Map(categories.map((category) => [category.id, category.label])),
    [categories],
  );
  const [draftSections, setDraftSections] = useState(() =>
    mergeSections(categories, sections),
  );
  const [draftLimit, setDraftLimit] = useState(String(productsPerSlider));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleSection(categoryId: string) {
    setDraftSections((current) =>
      current.map((section) =>
        section.categoryId === categoryId
          ? { ...section, enabled: !section.enabled }
          : section,
      ),
    );
  }

  function moveSection(categoryId: string, direction: -1 | 1) {
    setDraftSections((current) => {
      const index = current.findIndex(
        (section) => section.categoryId === categoryId,
      );
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings/homepage-sliders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySections: draftSections,
          productsPerSlider: Number(draftLimit),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save homepage sliders.");
      }

      setMessage("Homepage sliders saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save homepage sliders.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-5 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">
          Homepage Sliders
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose which categories appear on the homepage and their order.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest">
          Products Per Slider
        </Label>
        <Input
          type="number"
          min={4}
          max={24}
          step={1}
          value={draftLimit}
          onChange={(event) => setDraftLimit(event.target.value)}
          className="h-11 max-w-40 rounded-none border-black"
        />
      </div>

      <div className="divide-y divide-black border border-black">
        {draftSections.length === 0 ? (
          <div className="p-4 text-sm font-bold uppercase tracking-widest text-slate-500">
            Create categories first.
          </div>
        ) : (
          draftSections.map((section, index) => (
            <div
              key={section.categoryId}
              className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.categoryId)}
                  className="size-4"
                />
                {categoryLabels.get(section.categoryId) ?? "Unknown category"}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => moveSection(section.categoryId, -1)}
                  className="size-9 rounded-none border-black disabled:opacity-40"
                  aria-label="Move category up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === draftSections.length - 1}
                  onClick={() => moveSection(section.categoryId, 1)}
                  className="size-9 rounded-none border-black disabled:opacity-40"
                  aria-label="Move category down"
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveSettings}
        className="h-11 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Homepage Sliders"}
      </Button>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}
