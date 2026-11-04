import { parseRomaniaDateTimeLocal } from "@/lib/dates/romania";
import type { DiscountScope } from "@/lib/db/schema";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DISCOUNT_TARGETS = 500;

// The admin form sends datetime-local values entered in Romania time.
function readRomaniaDateTime(value: unknown, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return null;
  }

  const date = parseRomaniaDateTimeLocal(raw);

  if (!date) {
    throw new Error(`Invalid ${label}.`);
  }

  return date;
}

export function readDiscountSchedule(body: Record<string, unknown>) {
  const startsAt = readRomaniaDateTime(body.startsAt, "start date");
  const expiresAt = readRomaniaDateTime(body.expiresAt, "end date");

  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new Error("The discount must end after it starts.");
  }

  return { startsAt, expiresAt };
}

function readIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => UUID_PATTERN.test(item)),
    ),
  ).slice(0, MAX_DISCOUNT_TARGETS);
}

// Always clears the legacy single-id columns; targets live in the id lists.
export function readDiscountTargets(
  scope: DiscountScope,
  body: Record<string, unknown>,
) {
  const productIds = scope === "product" ? readIdList(body.productIds) : [];
  const categoryIds = scope === "category" ? readIdList(body.categoryIds) : [];

  if (scope === "product" && productIds.length === 0) {
    throw new Error("Select at least one product.");
  }

  if (scope === "category" && categoryIds.length === 0) {
    throw new Error("Select at least one category.");
  }

  return { productId: null, categoryId: null, productIds, categoryIds };
}
