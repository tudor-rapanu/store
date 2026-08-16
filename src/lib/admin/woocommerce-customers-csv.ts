import Papa from "papaparse";

export const WORDPRESS_ADMIN_LEGACY_USER_IDS = new Set([2]);

const CUSTOMER_HEADERS = [
  "legacy_user_id",
  "email",
  "display_name",
  "user_registered",
  "account_first_name",
  "account_last_name",
  "billing_first_name",
  "billing_last_name",
  "billing_company",
  "billing_phone",
  "billing_address_1",
  "billing_address_2",
  "billing_city",
  "billing_state",
  "billing_postcode",
  "billing_country",
  "shipping_first_name",
  "shipping_last_name",
  "shipping_company",
  "shipping_phone",
  "shipping_address_1",
  "shipping_address_2",
  "shipping_city",
  "shipping_state",
  "shipping_postcode",
  "shipping_country",
] as const;

const ORDER_MAPPING_HEADERS = [
  "woo_order_id",
  "legacy_user_id",
  "billing_email",
] as const;

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;

export type WooCommerceCustomer = {
  legacyUserId: number;
  email: string;
  displayName: string;
  registeredAt: Date | null;
  firstName: string;
  lastName: string;
  phone: string;
  address: Record<string, unknown>;
};

export type WooCommerceOrderCustomerMapping = {
  wooOrderId: number;
  legacyUserId: number;
  billingEmail: string;
};

export type WooCommerceCustomerCsvData = {
  customers: WooCommerceCustomer[];
  mappings: WooCommerceOrderCustomerMapping[];
  skippedAdminMappings: number;
  warnings: string[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function parsePositiveInteger(value: unknown, label: string, rowNumber: number) {
  const parsed = Number.parseInt(clean(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} on CSV row ${rowNumber} must be a positive integer.`);
  }

  return parsed;
}

function parseCsv<Row extends Record<string, string>>(
  text: string,
  requiredHeaders: readonly string[],
  label: string,
) {
  if (!text.trim()) {
    throw new Error(`${label} is empty.`);
  }

  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error(`${label} is larger than 5 MB.`);
  }

  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(
      `${label} could not be parsed${typeof first.row === "number" ? ` near row ${first.row + 2}` : ""}: ${first.message}`,
    );
  }

  const fields = new Set(parsed.meta.fields ?? []);
  const missingHeaders = requiredHeaders.filter((header) => !fields.has(header));

  if (missingHeaders.length > 0) {
    throw new Error(`${label} is missing columns: ${missingHeaders.join(", ")}.`);
  }

  if (parsed.data.length > MAX_ROWS) {
    throw new Error(`${label} contains more than ${MAX_ROWS.toLocaleString()} rows.`);
  }

  return parsed.data;
}

function joinStreet(address1: unknown, address2: unknown) {
  return [clean(address1), clean(address2)].filter(Boolean).join(", ");
}

function parseRegisteredAt(value: unknown) {
  const raw = clean(value);

  if (!raw || raw === "0000-00-00 00:00:00") {
    return null;
  }

  const parsed = new Date(`${raw.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstNonEmpty(...values: unknown[]) {
  return values.map(clean).find(Boolean) ?? "";
}

function addressFromRow(row: Record<string, string>) {
  const shippingStreet = joinStreet(row.shipping_address_1, row.shipping_address_2);
  const billingStreet = joinStreet(row.billing_address_1, row.billing_address_2);
  const billingAddress = {
    street: billingStreet,
    city: clean(row.billing_city),
    county: clean(row.billing_state),
    zip: clean(row.billing_postcode),
    countryCode: clean(row.billing_country),
    company: clean(row.billing_company),
  };

  return {
    street: shippingStreet || billingStreet,
    city: firstNonEmpty(row.shipping_city, row.billing_city),
    county: firstNonEmpty(row.shipping_state, row.billing_state),
    zip: firstNonEmpty(row.shipping_postcode, row.billing_postcode),
    countryCode: firstNonEmpty(row.shipping_country, row.billing_country),
    company: firstNonEmpty(row.shipping_company, row.billing_company),
    billingAddress,
  };
}

export function parseWooCommerceCustomerCsvs(
  customerCsv: string,
  orderMappingCsv: string,
): WooCommerceCustomerCsvData {
  const customerRows = parseCsv<Record<string, string>>(
    customerCsv,
    CUSTOMER_HEADERS,
    "WooCommerce customers CSV",
  );
  const mappingRows = parseCsv<Record<string, string>>(
    orderMappingCsv,
    ORDER_MAPPING_HEADERS,
    "HPOS order mapping CSV",
  );
  const customers: WooCommerceCustomer[] = [];
  const customerIds = new Set<number>();
  const customerEmails = new Set<string>();

  customerRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const legacyUserId = parsePositiveInteger(
      row.legacy_user_id,
      "legacy_user_id",
      rowNumber,
    );

    const email = normalizeEmail(row.email);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error(`email on customers CSV row ${rowNumber} is invalid.`);
    }

    if (customerIds.has(legacyUserId)) {
      throw new Error(`Duplicate legacy_user_id ${legacyUserId} in customers CSV.`);
    }

    if (customerEmails.has(email)) {
      throw new Error(`Duplicate email ${email} in customers CSV.`);
    }

    customerIds.add(legacyUserId);
    customerEmails.add(email);
    customers.push({
      legacyUserId,
      email,
      displayName: firstNonEmpty(row.display_name, row.email),
      registeredAt: parseRegisteredAt(row.user_registered),
      firstName: firstNonEmpty(
        row.shipping_first_name,
        row.billing_first_name,
        row.account_first_name,
      ),
      lastName: firstNonEmpty(
        row.shipping_last_name,
        row.billing_last_name,
        row.account_last_name,
      ),
      phone: firstNonEmpty(row.shipping_phone, row.billing_phone),
      address: addressFromRow(row),
    });
  });

  const mappings: WooCommerceOrderCustomerMapping[] = [];
  const orderIds = new Set<number>();
  const unknownCustomerIds = new Set<number>();
  let skippedAdminMappings = 0;

  mappingRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const wooOrderId = parsePositiveInteger(
      row.woo_order_id,
      "woo_order_id",
      rowNumber,
    );
    const legacyUserId = parsePositiveInteger(
      row.legacy_user_id,
      "legacy_user_id",
      rowNumber,
    );

    if (orderIds.has(wooOrderId)) {
      throw new Error(`Duplicate woo_order_id ${wooOrderId} in HPOS mapping CSV.`);
    }

    orderIds.add(wooOrderId);

    if (WORDPRESS_ADMIN_LEGACY_USER_IDS.has(legacyUserId)) {
      skippedAdminMappings += 1;
      return;
    }

    if (!customerIds.has(legacyUserId)) {
      unknownCustomerIds.add(legacyUserId);
      return;
    }

    mappings.push({
      wooOrderId,
      legacyUserId,
      billingEmail: normalizeEmail(row.billing_email),
    });
  });

  if (unknownCustomerIds.size > 0) {
    throw new Error(
      `HPOS mapping references customer IDs missing from the customers CSV: ${Array.from(unknownCustomerIds).join(", ")}.`,
    );
  }

  return {
    customers,
    mappings,
    skippedAdminMappings,
    warnings:
      skippedAdminMappings > 0
        ? [
            `${skippedAdminMappings} order mapping(s) for the legacy WordPress administrator were intentionally skipped.`,
          ]
        : [],
  };
}
