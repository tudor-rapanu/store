"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFetchErrorMessage, showToast } from "@/lib/client/toast";
import type {
  HomepageContentSection,
  HomepageSectionType,
} from "@/lib/homepage/settings";

type ProductOption = {
  id: string;
  title: string;
};

type HomepageSectionsSettingsProps = {
  sections: HomepageContentSection[];
  products: ProductOption[];
};

const sectionTypes: Array<{ value: HomepageSectionType; label: string }> = [
  { value: "promoStrip", label: "Promo Strip" },
  { value: "heroBanner", label: "Hero Banner" },
  { value: "bannerSlider", label: "Banner Slider" },
  { value: "featuredProduct", label: "Featured Product" },
  { value: "textImage", label: "Text + Image" },
];

function createId() {
  return crypto.randomUUID();
}

function createSection(type: HomepageSectionType): HomepageContentSection {
  return {
    id: createId(),
    type,
    enabled: true,
    content:
      type === "bannerSlider"
        ? {
            slides: [
              {
                titleEn: "",
                titleRo: "",
                bodyEn: "",
                bodyRo: "",
                imageUrl: "",
                ctaEn: "",
                ctaRo: "",
                href: "",
              },
            ],
          }
        : {},
  };
}

function getString(content: Record<string, unknown>, key: string) {
  const value = content[key];

  return typeof value === "string" ? value : "";
}

function getSlides(content: Record<string, unknown>) {
  return Array.isArray(content.slides)
    ? content.slides.filter((slide): slide is Record<string, unknown> =>
        Boolean(slide && typeof slide === "object" && !Array.isArray(slide)),
      )
    : [];
}

export function HomepageSectionsSettings({
  sections,
  products,
}: HomepageSectionsSettingsProps) {
  const [draftSections, setDraftSections] = useState(sections);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateSection(
    sectionId: string,
    updater: (section: HomepageContentSection) => HomepageContentSection,
  ) {
    setDraftSections((current) =>
      current.map((section) =>
        section.id === sectionId ? updater(section) : section,
      ),
    );
  }

  function updateContent(sectionId: string, key: string, value: unknown) {
    updateSection(sectionId, (section) => ({
      ...section,
      content: {
        ...section.content,
        [key]: value,
      },
    }));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setDraftSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async function saveSections() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings/homepage-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentSections: draftSections }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ??
            getFetchErrorMessage(response, "Could not save homepage sections."),
        );
      }

      setMessage("Homepage sections saved.");
      showToast({
        title: "Settings saved",
        description: "Homepage sections were updated.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save homepage sections.";

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
          <h2 className="text-sm font-black uppercase tracking-widest">
            Homepage Sections
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Add banners, editorial blocks, product features, and promo strips.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectionTypes.map((type) => (
            <Button
              key={type.value}
              type="button"
              variant="outline"
              onClick={() =>
                setDraftSections((current) => [
                  ...current,
                  createSection(type.value),
                ])
              }
              className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              <Plus size={14} /> {type.label}
            </Button>
          ))}
        </div>
      </div>

      {draftSections.length === 0 ? (
        <div className="border border-dashed border-slate-300 p-4 text-sm font-bold uppercase tracking-widest text-slate-500">
          No custom homepage sections yet.
        </div>
      ) : (
        <div className="space-y-4">
          {draftSections.map((section, index) => (
            <details
              key={section.id}
              className="border border-black"
              open={index === 0}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-3 text-sm font-black uppercase tracking-widest">
                <span>
                  {sectionTypes.find((type) => type.value === section.type)
                    ?.label ?? section.type}
                </span>
                <span className="text-xs text-slate-500">Edit</span>
              </summary>
              <div className="space-y-4 border-t border-black p-4">
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Type
                    </span>
                    <select
                      value={section.type}
                      onChange={(event) =>
                        updateSection(section.id, (current) => ({
                          ...current,
                          type: event.target.value as HomepageSectionType,
                        }))
                      }
                      className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm"
                    >
                      {sectionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) =>
                        updateSection(section.id, (current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                      className="size-4"
                    />
                    Enabled
                  </label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => moveSection(section.id, -1)}
                      className="rounded-none border-black"
                      aria-label="Move section up"
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === draftSections.length - 1}
                      onClick={() => moveSection(section.id, 1)}
                      className="rounded-none border-black"
                      aria-label="Move section down"
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setDraftSections((current) =>
                          current.filter((item) => item.id !== section.id),
                        )
                      }
                      className="rounded-none border-black"
                      aria-label="Delete section"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <SectionFields
                  section={section}
                  products={products}
                  onChange={(key, value) =>
                    updateContent(section.id, key, value)
                  }
                  onReplaceContent={(content) =>
                    updateSection(section.id, (current) => ({
                      ...current,
                      content,
                    }))
                  }
                />
              </div>
            </details>
          ))}
        </div>
      )}

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveSections}
        className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Homepage Sections"}
      </Button>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}

function SectionFields({
  section,
  products,
  onChange,
  onReplaceContent,
}: {
  section: HomepageContentSection;
  products: ProductOption[];
  onChange: (key: string, value: unknown) => void;
  onReplaceContent: (content: Record<string, unknown>) => void;
}) {
  if (section.type === "featuredProduct") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Product"
          value={getString(section.content, "productId")}
          onChange={(value) => onChange("productId", value)}
          options={products.map((product) => ({
            value: product.id,
            label: product.title,
          }))}
        />
        <TextField
          label="Image URL Override"
          value={getString(section.content, "imageUrl")}
          onChange={(value) => onChange("imageUrl", value)}
        />
        <TextField
          label="Title English"
          value={getString(section.content, "titleEn")}
          onChange={(value) => onChange("titleEn", value)}
        />
        <TextField
          label="Title Romanian"
          value={getString(section.content, "titleRo")}
          onChange={(value) => onChange("titleRo", value)}
        />
        <TextAreaField
          label="Text English"
          value={getString(section.content, "bodyEn")}
          onChange={(value) => onChange("bodyEn", value)}
        />
        <TextAreaField
          label="Text Romanian"
          value={getString(section.content, "bodyRo")}
          onChange={(value) => onChange("bodyRo", value)}
        />
      </div>
    );
  }

  if (section.type === "bannerSlider") {
    const slides = getSlides(section.content);

    return (
      <div className="space-y-4">
        {slides.map((slide, index) => (
          <div key={index} className="space-y-3 border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest">
                Slide {index + 1}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  onChange(
                    "slides",
                    slides.filter((_, slideIndex) => slideIndex !== index),
                  )
                }
                className="rounded-none border-black"
                aria-label="Delete slide"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {["titleEn", "titleRo", "imageUrl", "href", "ctaEn", "ctaRo"].map(
                (key) => (
                  <TextField
                    key={key}
                    label={key}
                    value={getString(slide, key)}
                    onChange={(value) =>
                      onChange(
                        "slides",
                        slides.map((currentSlide, slideIndex) =>
                          slideIndex === index
                            ? { ...currentSlide, [key]: value }
                            : currentSlide,
                        ),
                      )
                    }
                  />
                ),
              )}
              <TextAreaField
                label="bodyEn"
                value={getString(slide, "bodyEn")}
                onChange={(value) =>
                  onChange(
                    "slides",
                    slides.map((currentSlide, slideIndex) =>
                      slideIndex === index
                        ? { ...currentSlide, bodyEn: value }
                        : currentSlide,
                    ),
                  )
                }
              />
              <TextAreaField
                label="bodyRo"
                value={getString(slide, "bodyRo")}
                onChange={(value) =>
                  onChange(
                    "slides",
                    slides.map((currentSlide, slideIndex) =>
                      slideIndex === index
                        ? { ...currentSlide, bodyRo: value }
                        : currentSlide,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onReplaceContent({
              ...section.content,
              slides: [
                ...slides,
                {
                  titleEn: "",
                  titleRo: "",
                  bodyEn: "",
                  bodyRo: "",
                  imageUrl: "",
                  ctaEn: "",
                  ctaRo: "",
                  href: "",
                },
              ],
            })
          }
          className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Plus size={14} /> Slide
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {section.type !== "promoStrip" && (
        <TextField
          label="Image URL"
          value={getString(section.content, "imageUrl")}
          onChange={(value) => onChange("imageUrl", value)}
        />
      )}
      <TextField
        label="Title English"
        value={getString(section.content, "titleEn")}
        onChange={(value) => onChange("titleEn", value)}
      />
      <TextField
        label="Title Romanian"
        value={getString(section.content, "titleRo")}
        onChange={(value) => onChange("titleRo", value)}
      />
      <TextField
        label="CTA English"
        value={getString(section.content, "ctaEn")}
        onChange={(value) => onChange("ctaEn", value)}
      />
      <TextField
        label="CTA Romanian"
        value={getString(section.content, "ctaRo")}
        onChange={(value) => onChange("ctaRo", value)}
      />
      <TextField
        label="Link"
        value={getString(section.content, "href")}
        onChange={(value) => onChange("href", value)}
      />
      <TextAreaField
        label="Text English"
        value={getString(section.content, "bodyEn")}
        onChange={(value) => onChange("bodyEn", value)}
      />
      <TextAreaField
        label="Text Romanian"
        value={getString(section.content, "bodyRo")}
        onChange={(value) => onChange("bodyRo", value)}
      />
    </div>
  );
}

function TextField({
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
      <Label className="text-xs font-bold uppercase tracking-widest">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-none border-black"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">
        {label}
      </Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm"
      >
        <option value="">Select product</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
      <Label className="text-xs font-bold uppercase tracking-widest">
        {label}
      </Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}
