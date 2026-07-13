const ROMANIA_TIME_ZONE = "Europe/Bucharest";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function parseDateTimeLocal(value: string): DateTimeParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59
  ) {
    return null;
  }

  const normalized = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );

  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() !== parts.month - 1 ||
    normalized.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function getRomaniaParts(date: Date): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROMANIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function partsToUtcMs(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

export function parseRomaniaDateTimeLocal(value: string) {
  const targetParts = parseDateTimeLocal(value);

  if (!targetParts) {
    return null;
  }

  let utcMs = partsToUtcMs(targetParts);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const romaniaParts = getRomaniaParts(new Date(utcMs));
    const offsetMs = partsToUtcMs(romaniaParts) - utcMs;
    utcMs = partsToUtcMs(targetParts) - offsetMs;
  }

  const date = new Date(utcMs);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRomaniaDateTimeLocal(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = getRomaniaParts(date);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute,
  ).padStart(2, "0")}`;
}
