"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AvailableSizeGuide } from "./admin-product-form.types";

type ProductPublishingSettingsProps = {
  isPrivate: boolean;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  sizeGuideId: string;
  availableSizeGuides: AvailableSizeGuide[];
};

export function ProductPublishingSettings({
  isPrivate,
  publishAt,
  onPublishAtChange,
  sizeGuideId,
  availableSizeGuides,
}: ProductPublishingSettingsProps) {
  return (
    <>
      <label className="flex items-center gap-3 border border-black p-4 text-sm font-black uppercase tracking-widest">
        <input
          type="checkbox"
          name="isPrivate"
          defaultChecked={isPrivate}
          className="size-4"
        />{" "}
        Private product
      </label>

      <section className="space-y-3 border border-black p-4">
        <div>
          <Label
            htmlFor="publishAt"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Publish Date
          </Label>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
            Romanian time. Leave empty to publish immediately unless private.
          </p>
        </div>
        <Input
          id="publishAt"
          name="publishAt"
          type="datetime-local"
          value={publishAt}
          onChange={(event) => onPublishAtChange(event.target.value)}
          className="rounded-none border-black h-12"
        />
      </section>

      <section className="space-y-3 border border-black p-4">
        <div>
          <Label
            htmlFor="sizeGuideId"
            className="uppercase text-xs font-bold tracking-widest"
          >
            Size Guide
          </Label>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
            Optional reusable measurement table for clothing products.
          </p>
        </div>
        <select
          id="sizeGuideId"
          name="sizeGuideId"
          defaultValue={sizeGuideId}
          className="h-12 w-full rounded-none border border-black bg-white px-3 text-sm"
        >
          <option value="">No size guide</option>
          {availableSizeGuides.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.title}
            </option>
          ))}
        </select>
      </section>
    </>
  );
}
