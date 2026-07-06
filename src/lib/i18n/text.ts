export type Locale = "en" | "ro";

export type MaybeTranslatedText =
  | {
      en?: string | null;
      ro?: string | null;
    }
  | null
  | undefined;

export function getTranslatedText(
  value: MaybeTranslatedText,
  locale: Locale,
  fallback = "",
) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  return value[locale] || value.en || value.ro || fallback;
}
