export type FulfillmentProduct = {
  productionMinDays?: number | null;
  productionMaxDays?: number | null;
  preorderEnabled?: boolean | null;
  preorderShipDate?: Date | string | null;
};

export type FulfillmentEstimate = {
  start: Date;
  end: Date;
};

const FIXED_ROMANIAN_NON_WORKING_DAYS = new Set([
  "01-01",
  "01-02",
  "01-24",
  "05-01",
  "06-01",
  "08-15",
  "11-30",
  "12-01",
  "12-25",
  "12-26",
]);

function toDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function atStartOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFixedHolidayKey(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isBusinessDay(date: Date) {
  const day = date.getDay();

  if (day === 0 || day === 6) {
    return false;
  }

  return !FIXED_ROMANIAN_NON_WORKING_DAYS.has(getFixedHolidayKey(date));
}

export function addBusinessDays(from: Date, days: number) {
  const targetDays = Math.max(Math.floor(days), 0);
  const date = atStartOfDay(from);
  let added = 0;

  while (added < targetDays) {
    date.setDate(date.getDate() + 1);

    if (isBusinessDay(date)) {
      added += 1;
    }
  }

  return date;
}

export function normalizeProductionRange(product: FulfillmentProduct) {
  const minDays =
    Number.isInteger(product.productionMinDays) && product.productionMinDays! > 0
      ? product.productionMinDays!
      : 1;
  const maxDays =
    Number.isInteger(product.productionMaxDays) &&
    product.productionMaxDays! >= minDays
      ? product.productionMaxDays!
      : Math.max(minDays, 3);

  return { minDays, maxDays };
}

export function getProductFulfillmentEstimate(
  product: FulfillmentProduct,
  now: Date = new Date(),
) {
  const { minDays, maxDays } = normalizeProductionRange(product);
  const preorderDate =
    product.preorderEnabled ? toDate(product.preorderShipDate) : null;
  const startBase =
    preorderDate && preorderDate > now ? preorderDate : now;

  return {
    start: addBusinessDays(startBase, minDays),
    end: addBusinessDays(startBase, maxDays),
  };
}

export function getCartFulfillmentEstimate(
  products: FulfillmentProduct[],
  now: Date = new Date(),
): FulfillmentEstimate | null {
  if (products.length === 0) {
    return null;
  }

  return products
    .map((product) => getProductFulfillmentEstimate(product, now))
    .reduce<FulfillmentEstimate | null>((latest, estimate) => {
      if (!latest) {
        return estimate;
      }

      return {
        start: estimate.start > latest.start ? estimate.start : latest.start,
        end: estimate.end > latest.end ? estimate.end : latest.end,
      };
    }, null);
}

export function formatFulfillmentDate(date: Date, locale: "en" | "ro" = "en") {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatFulfillmentEstimate(
  estimate?: FulfillmentEstimate | null,
  locale: "en" | "ro" = "en",
) {
  if (!estimate) {
    return null;
  }

  const start = formatFulfillmentDate(estimate.start, locale);
  const end = formatFulfillmentDate(estimate.end, locale);

  return start === end ? start : `${start} - ${end}`;
}
