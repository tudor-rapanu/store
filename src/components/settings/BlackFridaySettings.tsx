"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  BlackFridayCopy,
  BlackFridayLocale,
  BlackFridaySettings as BlackFridaySettingsValue,
} from "@/lib/black-friday/campaign";
import { getFetchErrorMessage, showToast } from "@/lib/client/toast";
import { formatRomaniaDateTimeLocal } from "@/lib/dates/romania";

type BlackFridaySettingsProps = {
  settings: BlackFridaySettingsValue;
};

type DateField = "teaserStartsAt" | "saleStartsAt" | "saleEndsAt";

const DATE_FIELDS: Array<{ field: DateField; label: string; hint: string }> = [
  {
    field: "teaserStartsAt",
    label: "Countdown Starts At",
    hint: "Optional. Leave empty to show the countdown as soon as the campaign is enabled.",
  },
  {
    field: "saleStartsAt",
    label: "Sale Starts At",
    hint: "The takeover switches from countdown to the sale link at this moment.",
  },
  {
    field: "saleEndsAt",
    label: "Sale Ends At",
    hint: "The takeover disappears after this moment.",
  },
];

const COPY_FIELDS: Array<{
  field: keyof BlackFridayCopy;
  label: string;
  multiline?: boolean;
}> = [
  { field: "teaserTitle", label: "Countdown Title" },
  { field: "teaserText", label: "Countdown Text", multiline: true },
  { field: "saleTitle", label: "Sale Title" },
  { field: "saleText", label: "Sale Text", multiline: true },
  { field: "ctaLabel", label: "Sale Button Label" },
];

const LOCALES: Array<{ locale: BlackFridayLocale; label: string }> = [
  { locale: "en", label: "English" },
  { locale: "ro", label: "Romanian" },
];

export function BlackFridaySettings({ settings }: BlackFridaySettingsProps) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [dates, setDates] = useState<Record<DateField, string>>(() => ({
    teaserStartsAt: formatRomaniaDateTimeLocal(settings.teaserStartsAt),
    saleStartsAt: formatRomaniaDateTimeLocal(settings.saleStartsAt),
    saleEndsAt: formatRomaniaDateTimeLocal(settings.saleEndsAt),
  }));
  const [ctaHref, setCtaHref] = useState(settings.ctaHref);
  const [copy, setCopy] = useState(settings.copy);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateCopy(
    locale: BlackFridayLocale,
    field: keyof BlackFridayCopy,
    value: string,
  ) {
    setCopy((current) => ({
      ...current,
      [locale]: { ...current[locale], [field]: value },
    }));
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/settings/black-friday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, ...dates, ctaHref, copy }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ??
            getFetchErrorMessage(response, "Could not save Black Friday settings."),
        );
      }

      setMessage("Black Friday settings saved.");
      showToast({
        title: "Settings saved",
        description: "The Black Friday takeover was updated.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save Black Friday settings.";

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
    <div className="space-y-6">
      <section className="space-y-5 border border-black p-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">Campaign</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visitors see a full-screen countdown before the sale and a link to the sale
            page while it runs. Each visitor sees each stage once. Times are Romania
            time.
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4"
          />{" "}
          Enable Black Friday takeover
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          {DATE_FIELDS.map(({ field, label, hint }) => (
            <div key={field} className="space-y-2">
              <Label
                htmlFor={`black-friday-${field}`}
                className="text-xs font-bold uppercase tracking-widest"
              >
                {label}
              </Label>
              <Input
                id={`black-friday-${field}`}
                type="datetime-local"
                value={dates[field]}
                onChange={(event) =>
                  setDates((current) => ({ ...current, [field]: event.target.value }))
                }
                className="h-12 rounded-none border-black"
              />
              <p className="text-xs text-slate-500">{hint}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="black-friday-cta-href"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Black Friday Page Link
          </Label>
          <Input
            id="black-friday-cta-href"
            value={ctaHref}
            onChange={(event) => setCtaHref(event.target.value)}
            placeholder="/category/black-friday"
            className="h-12 rounded-none border-black"
          />
          <p className="text-xs text-slate-500">
            A path without the language prefix (it is added automatically) or a full
            URL.
          </p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {LOCALES.map(({ locale, label }) => (
          <section key={locale} className="space-y-4 border border-black p-4">
            <h2 className="text-sm font-black uppercase tracking-widest">
              {label} Copy
            </h2>
            {COPY_FIELDS.map(({ field, label: fieldLabel, multiline }) => {
              const id = `black-friday-${locale}-${field}`;

              return (
                <div key={field} className="space-y-2">
                  <Label
                    htmlFor={id}
                    className="text-xs font-bold uppercase tracking-widest"
                  >
                    {fieldLabel}
                  </Label>
                  {multiline ? (
                    <textarea
                      id={id}
                      rows={3}
                      value={copy[locale][field]}
                      onChange={(event) =>
                        updateCopy(locale, field, event.target.value)
                      }
                      className="w-full rounded-none border border-black px-3 py-2 text-sm"
                    />
                  ) : (
                    <Input
                      id={id}
                      value={copy[locale][field]}
                      onChange={(event) =>
                        updateCopy(locale, field, event.target.value)
                      }
                      className="h-12 rounded-none border-black"
                    />
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <Button
        type="button"
        disabled={isSaving}
        onClick={saveSettings}
        className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Black Friday Settings"}
      </Button>

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </div>
  );
}
