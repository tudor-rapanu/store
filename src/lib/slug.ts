const ROMANIAN_DIACRITICS: Record<string, string> = {
  ă: "a",
  Ă: "A",
  â: "a",
  Â: "A",
  î: "i",
  Î: "I",
  ș: "s",
  Ș: "S",
  ş: "s",
  Ş: "S",
  ț: "t",
  Ț: "T",
  ţ: "t",
  Ţ: "T",
};

export function normalizeRomanianCharacters(value: string) {
  return value.replace(
    /[ăĂâÂîÎșȘşŞțȚţŢ]/g,
    (char) => ROMANIAN_DIACRITICS[char] ?? char,
  );
}

export function slugify(value: string) {
  return normalizeRomanianCharacters(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
