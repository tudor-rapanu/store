import crypto from "crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  orderItems,
  orders,
  productVariants,
  products,
  type FulfillmentStatus,
  type InvoiceStatus,
  type PaymentCurrency,
  type PaymentMethod,
  type PaymentStatus,
  type ShippingMethod,
} from "@/lib/db/schema";
import { readEnvValue } from "@/lib/env";
import { normalizeRomanianCharacters } from "@/lib/slug";

const DEFAULT_WOOCOMMERCE_SITE_URL = "https://toddsthreads.com";
const WOO_API_PER_PAGE = 100;
const DEFAULT_IMPORT_BATCH_PAGE = 1;
const DEFAULT_IMPORT_BATCH_SIZE = 100;
const IMPORT_BATCH_SIZE_OPTIONS = [100, 250, 500] as const;
const WOO_ORDER_IDEMPOTENCY_PREFIX = "woocommerce-order";

type ProductOption = {
  id: string;
  label: string;
};

export type WooCommerceOrderImportOptions = {
  batchPage?: number;
  batchSize?: number;
};

type WooMeta = {
  key?: string;
  value?: unknown;
};

type WooAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
};

type WooOrderLineItem = {
  id: number;
  name: string;
  parent_name?: string | null;
  product_id: number;
  variation_id: number;
  quantity: number;
  subtotal?: string;
  total?: string;
  price?: number;
  sku?: string;
  meta_data?: WooMeta[];
};

type WooShippingLine = {
  method_title?: string;
  method_id?: string;
  total?: string;
};

type WooOrder = {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_created?: string;
  date_modified?: string;
  date_completed?: string | null;
  date_paid?: string | null;
  billing?: WooAddress;
  shipping?: WooAddress;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_note?: string;
  discount_total?: string;
  shipping_total?: string;
  total?: string;
  meta_data?: WooMeta[];
  line_items?: WooOrderLineItem[];
  shipping_lines?: WooShippingLine[];
};

type WooTrackingItem = {
  tracking_provider?: string;
  custom_tracking_provider?: string;
  custom_tracking_link?: string;
  tracking_number?: string;
  date_shipped?: string;
};

type OrderExtra = {
  fgo?: {
    status?: string;
    series?: string;
    number?: string;
    url?: string;
    link?: string;
    invoiceUrl?: string;
    invoiceId?: string;
  };
  _fgo_invoice_status?: string;
  _fgo_invoice_series?: string;
  _fgo_invoice_number?: string;
  _fgo_invoice_link?: string;
  trackship?: {
    trackingNumber?: string;
    provider?: string;
    status?: string;
    shippingDate?: string;
    trackingUrl?: string;
  };
};

export type WooCommerceOrderExtras = Record<string, OrderExtra>;

const FGO_META_KEYS = new Set([
  "_fgo_invoice_status",
  "_fgo_invoice_series",
  "_fgo_invoice_number",
  "_fgo_invoice_link",
] as const);

type FgoMetaKey =
  | "_fgo_invoice_status"
  | "_fgo_invoice_series"
  | "_fgo_invoice_number"
  | "_fgo_invoice_link";

type RawMetaRow = {
  post_id?: unknown;
  owner_id?: unknown;
  order_id?: unknown;
  meta_key?: unknown;
  key?: unknown;
  meta_value?: unknown;
  value?: unknown;
};

export type WooCommerceOrderManualMatches = Record<
  string,
  {
    productId: string;
    variantId?: string | null;
  }
>;

type ExistingProductMatch = {
  productId: string;
  titleKey: string;
};

type ExistingVariantMatch = {
  variantId: string;
  productId: string;
};

type ManualProductMatch = {
  productId: string;
  variantId: string | null;
};

type ResolvedOrderItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
};

type ProductLookup = {
  productsByTitleKey: Map<string, ExistingProductMatch>;
  variantsBySku: Map<string, ExistingVariantMatch>;
  productIds: Set<string>;
  productOptions: ProductOption[];
};

type UnmatchedOrderItem = {
  key: string;
  name: string;
};

export type WooCommerceOrderImportPreviewItem = {
  wooId: number;
  wooNumber: string;
  customer: string;
  email: string;
  status: string;
  total: number;
  currency: string;
  duplicate: boolean;
  duplicateReason: string | null;
  importable: boolean;
  unmatchedItems: string[];
  unmatchedLineItems: UnmatchedOrderItem[];
  variantFallbackItems: string[];
  awbNumber: string | null;
  trackingProvider: string | null;
  invoiceNumber: string | null;
};

export type WooCommerceOrderImportPreview = {
  orders: WooCommerceOrderImportPreviewItem[];
  total: number;
  importable: number;
  duplicates: number;
  blocked: number;
  productOptions: ProductOption[];
  batchPage: number;
  batchSize: number;
  batchTotalPages: number;
  wooTotal: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeWooOrderIdentifier(value: unknown) {
  const raw = String(value ?? "").trim();
  const directDigits = raw.match(/^\d+$/);

  if (directDigits) {
    return directDigits[0];
  }

  const trailingDigits = raw.match(/(\d+)$/);

  return trailingDigits?.[1] ?? "";
}

function unescapeSqlString(value: string) {
  return value.replace(/\\'/g, "'").replace(/\\\\/g, "\\").replace(/''/g, "'");
}

function parseSqlDumpMetaRows(value: string): RawMetaRow[] {
  const rows: RawMetaRow[] = [];
  const tuplePattern =
    /\(\s*(\d+)\s*,\s*'((?:\\'|''|[^'])*)'\s*,\s*'((?:\\'|''|[^'])*)'\s*\)/g;

  for (const match of value.matchAll(tuplePattern)) {
    const [, postId, metaKey, metaValue] = match;

    rows.push({
      post_id: postId,
      meta_key: unescapeSqlString(metaKey ?? ""),
      meta_value: unescapeSqlString(metaValue ?? ""),
    });
  }

  return rows;
}

function asRawMetaRows(value: unknown): RawMetaRow[] {
  if (typeof value === "string") {
    return parseSqlDumpMetaRows(value);
  }

  if (Array.isArray(value)) {
    return value.filter((row): row is RawMetaRow => Boolean(asRecord(row)));
  }

  const record = asRecord(value);

  if (!record) {
    return [];
  }

  const rowCollections = [
    record.rows,
    record.data,
    record.postmeta,
    record.wpab_postmeta,
    record.wc_orders_meta,
    record.wpab_wc_orders_meta,
  ];

  return rowCollections.flatMap(asRawMetaRows);
}

function mergeFgoMetaRow(extras: WooCommerceOrderExtras, row: RawMetaRow) {
  const orderKey = normalizeWooOrderIdentifier(
    row.post_id ?? row.owner_id ?? row.order_id,
  );
  const metaKey = asString(row.meta_key ?? row.key);
  const metaValue = asString(row.meta_value ?? row.value);

  if (
    !orderKey ||
    !metaKey ||
    !metaValue ||
    !FGO_META_KEYS.has(metaKey as FgoMetaKey)
  ) {
    return;
  }

  extras[orderKey] = {
    ...extras[orderKey],
    [metaKey]: metaValue,
  };
}

function normalizeOrderExtra(value: unknown): OrderExtra | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const fgo = asRecord(record.fgo);
  const trackship = asRecord(record.trackship);
  const extra: OrderExtra = {
    ...(fgo
      ? {
          fgo: {
            status: asString(fgo.status) ?? undefined,
            series: asString(fgo.series) ?? undefined,
            number: asString(fgo.number) ?? undefined,
            url: asString(fgo.url) ?? undefined,
            link: asString(fgo.link) ?? undefined,
            invoiceUrl: asString(fgo.invoiceUrl) ?? undefined,
            invoiceId: asString(fgo.invoiceId) ?? undefined,
          },
        }
      : {}),
    ...(trackship
      ? {
          trackship: {
            trackingNumber: asString(trackship.trackingNumber) ?? undefined,
            provider: asString(trackship.provider) ?? undefined,
            status: asString(trackship.status) ?? undefined,
            shippingDate: asString(trackship.shippingDate) ?? undefined,
            trackingUrl: asString(trackship.trackingUrl) ?? undefined,
          },
        }
      : {}),
    _fgo_invoice_status: asString(record._fgo_invoice_status) ?? undefined,
    _fgo_invoice_series: asString(record._fgo_invoice_series) ?? undefined,
    _fgo_invoice_number: asString(record._fgo_invoice_number) ?? undefined,
    _fgo_invoice_link: asString(record._fgo_invoice_link) ?? undefined,
  };

  return Object.values(extra).some((value) => value !== undefined) ? extra : null;
}

export function normalizeWooCommerceOrderExtras(
  value: unknown,
): WooCommerceOrderExtras | undefined {
  const normalized: WooCommerceOrderExtras = {};
  const record = asRecord(value);

  if (record) {
    Object.entries(record).forEach(([orderKey, rawExtra]) => {
      const normalizedOrderKey = normalizeWooOrderIdentifier(orderKey);

      if (!normalizedOrderKey) {
        return;
      }

      const extra = normalizeOrderExtra(rawExtra);

      if (extra) {
        normalized[normalizedOrderKey] = {
          ...normalized[normalizedOrderKey],
          ...extra,
        };
      }
    });
  }

  asRawMetaRows(value).forEach((row) => mergeFgoMetaRow(normalized, row));

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function getWooBaseUrl() {
  return (
    process.env.WOOCOMMERCE_SITE_URL?.trim().replace(/\/+$/g, "") ||
    DEFAULT_WOOCOMMERCE_SITE_URL
  );
}

function getWooApiUrl(path: string) {
  return new URL(path.replace(/^\/+/g, ""), `${getWooBaseUrl()}/wp-json/wc/v3/`);
}

function getWooAuthHeader() {
  const key = readEnvValue(
    process.env.WOOCOMMERCE_CONSUMER_KEY,
    "WOOCOMMERCE_CONSUMER_KEY",
  );
  const secret = readEnvValue(
    process.env.WOOCOMMERCE_CONSUMER_SECRET,
    "WOOCOMMERCE_CONSUMER_SECRET",
  );

  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function fetchWooPage<T>(
  path: string,
  page: number,
  params?: Record<string, string>,
) {
  const url = getWooApiUrl(path);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set("per_page", String(WOO_API_PER_PAGE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Authorization: getWooAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `WooCommerce request failed: ${response.status} ${await response.text()}`,
    );
  }

  return {
    rows: (await response.json()) as T[],
    totalPages: Number.parseInt(response.headers.get("x-wp-totalpages") ?? "1", 10),
    totalRows: Number.parseInt(response.headers.get("x-wp-total") ?? "0", 10),
  };
}

async function fetchWooItem<T>(path: string, params?: Record<string, string>) {
  const url = getWooApiUrl(path);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      Authorization: getWooAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `WooCommerce request failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

function getImportBatchOptions(options?: WooCommerceOrderImportOptions) {
  const requestedBatchPage = Math.max(Math.floor(options?.batchPage ?? 1), 1);
  const requestedBatchSize =
    Math.floor(options?.batchSize ?? DEFAULT_IMPORT_BATCH_SIZE) ||
    DEFAULT_IMPORT_BATCH_SIZE;
  const batchSize = IMPORT_BATCH_SIZE_OPTIONS.includes(
    requestedBatchSize as (typeof IMPORT_BATCH_SIZE_OPTIONS)[number],
  )
    ? requestedBatchSize
    : DEFAULT_IMPORT_BATCH_SIZE;

  return {
    batchPage: requestedBatchPage || DEFAULT_IMPORT_BATCH_PAGE,
    batchSize,
  };
}

async function fetchWooBatch<T>(
  path: string,
  options?: WooCommerceOrderImportOptions,
  params?: Record<string, string>,
) {
  const { batchPage, batchSize } = getImportBatchOptions(options);
  const startIndex = (batchPage - 1) * batchSize;
  let wooPage = Math.floor(startIndex / WOO_API_PER_PAGE) + 1;
  let rowsToSkip = startIndex % WOO_API_PER_PAGE;
  const rows: T[] = [];
  let totalPages = 1;
  let totalRows = 0;

  do {
    const result = await fetchWooPage<T>(path, wooPage, params);
    const pageRows = rowsToSkip > 0 ? result.rows.slice(rowsToSkip) : result.rows;

    rows.push(...pageRows);
    totalPages = Number.isFinite(result.totalPages) ? result.totalPages : wooPage;
    totalRows = Number.isFinite(result.totalRows) ? result.totalRows : totalRows;
    rowsToSkip = 0;
    wooPage += 1;
  } while (wooPage <= totalPages && rows.length < batchSize);

  return {
    rows: rows.slice(0, batchSize),
    batchPage,
    batchSize,
    batchTotalPages: Math.max(Math.ceil(totalRows / batchSize), 1),
    wooTotal: totalRows,
  };
}

function parseMajorAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function toMinorUnits(value: unknown) {
  return Math.round(parseMajorAmount(value) * 100);
}

function getDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTitleKey(value?: string | null) {
  return normalizeRomanianCharacters(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LINE_ITEM_TITLE_SEPARATORS = [" - ", " – ", " — ", " | "];

function getLineItemTitleCandidates(item: WooOrderLineItem) {
  const candidates = [item.parent_name, item.name];

  for (const separator of LINE_ITEM_TITLE_SEPARATORS) {
    if (!item.name.includes(separator)) {
      continue;
    }

    candidates.push(
      item.name.slice(0, item.name.lastIndexOf(separator)),
      item.name.split(separator)[0],
    );
  }

  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeTitleKey(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    ),
  );
}

function getProductMatchForLineItem(item: WooOrderLineItem, lookup: ProductLookup) {
  for (const titleKey of getLineItemTitleCandidates(item)) {
    const match = lookup.productsByTitleKey.get(titleKey);

    if (match) {
      return match;
    }
  }

  return null;
}

function getManualMatchKey(order: WooOrder, item: WooOrderLineItem) {
  return `${order.id}:${item.id}`;
}

function getManualMatch(
  order: WooOrder,
  item: WooOrderLineItem,
  lookup: ProductLookup,
  manualMatches?: WooCommerceOrderManualMatches,
): ManualProductMatch | null {
  const match = manualMatches?.[getManualMatchKey(order, item)];

  if (!match?.productId || !lookup.productIds.has(match.productId)) {
    return null;
  }

  return {
    productId: match.productId,
    variantId: match.variantId ?? null,
  };
}

function getMetaValue(order: WooOrder, key: string) {
  return order.meta_data?.find((item) => item.key === key)?.value;
}

function getStringMetaValue(order: WooOrder, key: string) {
  const value = getMetaValue(order, key);

  return typeof value === "string" ? value.trim() : null;
}

function getOrderExtra(extras: WooCommerceOrderExtras | undefined, order: WooOrder) {
  const normalizedNumber = normalizeWooOrderIdentifier(order.number);

  return (
    extras?.[String(order.id)] ??
    (normalizedNumber ? extras?.[normalizedNumber] : undefined) ??
    extras?.[order.number]
  );
}

async function getProductLookup(): Promise<ProductLookup> {
  const [productRows, variantRows] = await Promise.all([
    db.select({ id: products.id, title: products.title }).from(products),
    db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
      })
      .from(productVariants),
  ]);
  const productsByTitleKey = new Map<string, ExistingProductMatch>();
  const variantsBySku = new Map<string, ExistingVariantMatch>();
  const productIds = new Set<string>();
  const productOptions = productRows
    .map((product) => {
      productIds.add(product.id);

      return {
        id: product.id,
        label: product.title.en || product.title.ro || product.id,
      };
    })
    .sort((first, second) => first.label.localeCompare(second.label));

  productRows.forEach((product) => {
    [product.title.en, product.title.ro].forEach((title) => {
      const titleKey = normalizeTitleKey(title);

      if (titleKey) {
        productsByTitleKey.set(titleKey, { productId: product.id, titleKey });
      }
    });
  });

  variantRows.forEach((variant) => {
    if (variant.sku) {
      variantsBySku.set(variant.sku, {
        variantId: variant.id,
        productId: variant.productId,
      });
    }
  });

  return { productsByTitleKey, variantsBySku, productIds, productOptions };
}

async function getExistingWooOrderKeys() {
  const rows = await db
    .select({ checkoutIdempotencyKey: orders.checkoutIdempotencyKey })
    .from(orders);

  return new Set(
    rows
      .map((order) => order.checkoutIdempotencyKey)
      .filter((key): key is string => Boolean(key)),
  );
}

function getWooOrderKey(wooId: number) {
  return `${WOO_ORDER_IDEMPOTENCY_PREFIX}-${wooId}`;
}

function getWooOrderNumber(order: WooOrder) {
  const parsed = Number.parseInt(order.number, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getCustomerName(order: WooOrder) {
  const firstName = order.billing?.first_name || order.shipping?.first_name || "";
  const lastName = order.billing?.last_name || order.shipping?.last_name || "";

  return `${firstName} ${lastName}`.trim() || "WooCommerce customer";
}

function getCustomerEmail(order: WooOrder) {
  return order.billing?.email?.trim() || `woocommerce-${order.id}@toddsthreads.local`;
}

function getPaymentMethod(order: WooOrder): PaymentMethod {
  return order.payment_method === "bacs" ? "bank_transfer" : "card";
}

function getPaymentStatus(order: WooOrder): PaymentStatus {
  if (order.status === "refunded") {
    return "refunded";
  }

  if (["cancelled", "failed"].includes(order.status)) {
    return "failed";
  }

  return order.date_paid || ["completed", "processing"].includes(order.status)
    ? "paid"
    : "pending";
}

function getOrderStatus(order: WooOrder): "pending" | "paid" | "failed" {
  const paymentStatus = getPaymentStatus(order);

  if (paymentStatus === "paid" || paymentStatus === "refunded") {
    return "paid";
  }

  return paymentStatus === "failed" ? "failed" : "pending";
}

function getFulfillmentStatus(order: WooOrder, extra?: OrderExtra): FulfillmentStatus {
  const status = order.status.trim().toLowerCase();
  const fulfillmentStatus = getStringMetaValue(order, "_fulfillment_status")
    ?.trim()
    .toLowerCase();
  const trackshipStatus = extra?.trackship?.status?.trim().toLowerCase();
  const shipmentStatus = [fulfillmentStatus, trackshipStatus].filter(Boolean).join(" ");

  if (
    status === "completed" ||
    order.date_completed ||
    shipmentStatus.includes("fulfilled") ||
    shipmentStatus.includes("delivered")
  ) {
    return "delivered";
  }

  if (
    shipmentStatus.includes("shipped") ||
    shipmentStatus.includes("in_transit") ||
    shipmentStatus.includes("in transit")
  ) {
    return "shipped";
  }

  if (status === "processing") {
    return "processing";
  }

  if (status === "on-hold" || status === "pending") {
    return "processing";
  }

  if (status === "refunded") {
    return "refunded";
  }

  if (["cancelled", "canceled", "failed"].includes(status)) {
    return "cancelled";
  }

  return "new";
}

function getShippingMethod(order: WooOrder): ShippingMethod {
  const country = (
    order.shipping?.country ||
    order.billing?.country ||
    "RO"
  ).toUpperCase();
  const shippingTitle = order.shipping_lines?.[0]?.method_title?.toLowerCase() ?? "";
  const shippingMethodId = order.shipping_lines?.[0]?.method_id?.toLowerCase() ?? "";

  if (country && country !== "RO") {
    return "international";
  }

  if (
    shippingTitle.includes("easybox") ||
    shippingTitle.includes("sameday point") ||
    shippingMethodId.includes("sameday")
  ) {
    return "easybox";
  }

  return "address";
}

function getShippingAddress(order: WooOrder) {
  const source = order.shipping?.address_1 ? order.shipping : order.billing;

  return {
    street: [source?.address_1, source?.address_2].filter(Boolean).join(", "),
    city: source?.city ?? "",
    county: source?.state ?? "",
    zip: source?.postcode ?? "",
    countryCode: source?.country ?? "",
    countryName: source?.country ?? "",
  };
}

function getExchangeRate(order: WooOrder) {
  const rate = parseMajorAmount(
    getMetaValue(order, "_wcpay_multi_currency_order_exchange_rate"),
  );

  return rate > 0 ? rate : null;
}

function getRonAmount(order: WooOrder, amount: unknown) {
  const currency = order.currency.toUpperCase();
  const minor = toMinorUnits(amount);

  if (currency !== "EUR") {
    return minor;
  }

  const exchangeRate = getExchangeRate(order);

  return exchangeRate ? Math.round(minor / exchangeRate) : minor;
}

function getPaymentCurrency(order: WooOrder): PaymentCurrency {
  return order.currency.toUpperCase() === "EUR" ? "EUR" : "RON";
}

function getCurrencyExchangeRate(order: WooOrder) {
  const exchangeRate = getExchangeRate(order);

  return exchangeRate ? Math.round(exchangeRate * 100) : null;
}

function getSamedayTrackingUrl(awbNumber: string) {
  return `https://sameday.ro/#awb=${encodeURIComponent(awbNumber)}`;
}

function getPostaRomanaTrackingUrl(awbNumber: string) {
  return `https://www.posta-romana.ro/track-trace.html?track=${encodeURIComponent(
    awbNumber,
  )}`;
}

function getWooTrackingItems(order: WooOrder) {
  const value = getMetaValue(order, "_wc_shipment_tracking_items");

  return Array.isArray(value) ? (value as WooTrackingItem[]) : [];
}

function getTrackingDetails(order: WooOrder, extra?: OrderExtra) {
  const trackship = extra?.trackship;
  const extraTrackingNumber = trackship?.trackingNumber?.trim();

  if (extraTrackingNumber) {
    const provider = trackship?.provider?.trim() || "trackship";

    return {
      awbNumber: extraTrackingNumber,
      provider,
      trackingUrl:
        trackship?.trackingUrl ||
        (provider === "posta-romana"
          ? getPostaRomanaTrackingUrl(extraTrackingNumber)
          : null),
      generatedAt: getDate(trackship?.shippingDate),
    };
  }

  const trackingItem = getWooTrackingItems(order).find((item) =>
    Boolean(item.tracking_number),
  );
  const awbNumber = trackingItem?.tracking_number?.trim();

  if (!awbNumber) {
    return null;
  }

  const provider =
    trackingItem?.tracking_provider?.trim() ||
    trackingItem?.custom_tracking_provider?.trim() ||
    "shipment";

  return {
    awbNumber,
    provider,
    trackingUrl:
      trackingItem?.custom_tracking_link?.trim() ||
      (provider === "sameday" ? getSamedayTrackingUrl(awbNumber) : null),
    generatedAt: trackingItem?.date_shipped
      ? new Date(Number(trackingItem.date_shipped) * 1000)
      : getDate(order.date_completed),
  };
}

function getInvoiceStatusFromFgoStatus(status?: string | null): InvoiceStatus {
  const normalized = status?.trim().toLowerCase();

  if (!normalized || ["emisa", "emis", "generated", "paid"].includes(normalized)) {
    return "generated";
  }

  if (["stornata", "anulata", "cancelled", "canceled", "failed"].includes(normalized)) {
    return "failed";
  }

  return "generated";
}

function getFgoDetails(order: WooOrder, extra?: OrderExtra) {
  const fgo = extra?.fgo;
  const series =
    fgo?.series ??
    extra?._fgo_invoice_series ??
    getStringMetaValue(order, "_fgo_invoice_series");
  const number =
    fgo?.number ??
    extra?._fgo_invoice_number ??
    getStringMetaValue(order, "_fgo_invoice_number");
  const status =
    fgo?.status ??
    extra?._fgo_invoice_status ??
    getStringMetaValue(order, "_fgo_invoice_status");
  const url =
    fgo?.url ??
    fgo?.link ??
    fgo?.invoiceUrl ??
    extra?._fgo_invoice_link ??
    getStringMetaValue(order, "_fgo_invoice_link");

  if (!number) {
    return {
      invoiceStatus: "not_generated" as InvoiceStatus,
      invoiceNumber: null,
      invoiceUrl: null,
      fgoInvoiceId: null,
    };
  }

  const invoiceNumber = `${series ?? ""}${number}`.trim();

  return {
    invoiceStatus: getInvoiceStatusFromFgoStatus(status),
    invoiceNumber,
    invoiceUrl: url ?? null,
    fgoInvoiceId: fgo?.invoiceId ?? invoiceNumber,
  };
}

function resolveOrderItems(
  order: WooOrder,
  lookup: ProductLookup,
  manualMatches?: WooCommerceOrderManualMatches,
) {
  const unmatchedItems: string[] = [];
  const unmatchedLineItems: UnmatchedOrderItem[] = [];
  const variantFallbackItems: string[] = [];
  const items: ResolvedOrderItem[] = [];

  for (const item of order.line_items ?? []) {
    const manualMatch = getManualMatch(order, item, lookup, manualMatches);
    const sku = item.sku?.trim();
    const variantMatch = sku ? lookup.variantsBySku.get(sku) : null;
    const titleMatch = getProductMatchForLineItem(item, lookup);
    const productId =
      manualMatch?.productId ?? variantMatch?.productId ?? titleMatch?.productId;
    const variantId = manualMatch
      ? manualMatch.variantId
      : (variantMatch?.variantId ?? null);

    if (!productId) {
      unmatchedItems.push(item.name);
      unmatchedLineItems.push({ key: getManualMatchKey(order, item), name: item.name });
      continue;
    }

    if ((sku || item.variation_id > 0) && !manualMatch && !variantMatch && titleMatch) {
      variantFallbackItems.push(item.name);
    }

    items.push({
      productId,
      variantId,
      quantity: item.quantity,
      unitPrice: getRonAmount(order, item.price ?? item.total),
    });
  }

  return { items, unmatchedItems, unmatchedLineItems, variantFallbackItems };
}

function getDuplicateReason(order: WooOrder, existingWooKeys: Set<string>) {
  return existingWooKeys.has(getWooOrderKey(order.id))
    ? "WooCommerce order already imported"
    : null;
}

function getPreviewItem({
  order,
  extra,
  lookup,
  existingWooKeys,
  manualMatches,
}: {
  order: WooOrder;
  extra?: OrderExtra;
  lookup: ProductLookup;
  existingWooKeys: Set<string>;
  manualMatches?: WooCommerceOrderManualMatches;
}): WooCommerceOrderImportPreviewItem {
  const duplicateReason = getDuplicateReason(order, existingWooKeys);
  const { unmatchedItems, unmatchedLineItems, variantFallbackItems } =
    resolveOrderItems(order, lookup, manualMatches);
  const tracking = getTrackingDetails(order, extra);
  const invoice = getFgoDetails(order, extra);

  return {
    wooId: order.id,
    wooNumber: order.number,
    customer: getCustomerName(order),
    email: getCustomerEmail(order),
    status: order.status,
    total: parseMajorAmount(order.total),
    currency: order.currency,
    duplicate: Boolean(duplicateReason),
    duplicateReason,
    importable: !duplicateReason && unmatchedItems.length === 0,
    unmatchedItems,
    unmatchedLineItems,
    variantFallbackItems,
    awbNumber: tracking?.awbNumber ?? null,
    trackingProvider: tracking?.provider ?? null,
    invoiceNumber: invoice.invoiceNumber,
  };
}

export async function getWooCommerceOrderImportPreview(
  extras?: WooCommerceOrderExtras,
  manualMatches?: WooCommerceOrderManualMatches,
  options?: WooCommerceOrderImportOptions,
): Promise<WooCommerceOrderImportPreview> {
  const [batch, lookup, existingWooKeys] = await Promise.all([
    fetchWooBatch<WooOrder>("orders", options, {
      status: "any",
      context: "edit",
      orderby: "date",
      order: "asc",
    }),
    getProductLookup(),
    getExistingWooOrderKeys(),
  ]);
  const previewOrders = batch.rows.map((order) =>
    getPreviewItem({
      order,
      extra: getOrderExtra(extras, order),
      lookup,
      existingWooKeys,
      manualMatches,
    }),
  );
  const orders = previewOrders.filter((order) => !order.duplicate);

  return {
    orders,
    total: orders.length,
    importable: orders.filter((order) => order.importable).length,
    duplicates: previewOrders.length - orders.length,
    blocked: orders.filter((order) => order.unmatchedItems.length > 0).length,
    productOptions: lookup.productOptions,
    batchPage: batch.batchPage,
    batchSize: batch.batchSize,
    batchTotalPages: batch.batchTotalPages,
    wooTotal: batch.wooTotal,
  };
}

function createOrderAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildAdminNotes(
  order: WooOrder,
  tracking: ReturnType<typeof getTrackingDetails>,
) {
  const parts = [
    `Imported from WooCommerce #${order.number} (${order.id}).`,
    order.payment_method_title ? `Payment: ${order.payment_method_title}.` : null,
    tracking?.provider ? `Tracking provider: ${tracking.provider}.` : null,
  ];

  return parts.filter(Boolean).join("\n");
}

async function insertWooOrder(
  order: WooOrder,
  extra: OrderExtra | undefined,
  manualMatches?: WooCommerceOrderManualMatches,
) {
  const lookup = await getProductLookup();
  const { items, unmatchedItems } = resolveOrderItems(order, lookup, manualMatches);

  if (unmatchedItems.length > 0) {
    throw new Error(
      `WooCommerce order #${order.number} has unmatched products: ${unmatchedItems.join(
        ", ",
      )}`,
    );
  }

  const tracking = getTrackingDetails(order, extra);
  const invoice = getFgoDetails(order, extra);
  const [firstName, ...lastNameParts] = getCustomerName(order).split(" ");
  const createdAt = getDate(order.date_created) ?? new Date();
  const paidAt = getDate(order.date_paid);
  const wooOrderNumber = getWooOrderNumber(order);

  await db.transaction(async (tx) => {
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        ...(wooOrderNumber ? { orderNumber: wooOrderNumber } : {}),
        userId: null,
        accessToken: createOrderAccessToken(),
        checkoutIdempotencyKey: getWooOrderKey(order.id),
        customerEmail: getCustomerEmail(order),
        customerFirstName: firstName || "WooCommerce",
        customerLastName: lastNameParts.join(" ") || "Customer",
        customerPhone: order.billing?.phone || order.shipping?.phone || "",
        shippingAddress: getShippingAddress(order),
        shippingMethod: getShippingMethod(order),
        awbNumber: tracking?.awbNumber ?? null,
        trackingUrl: tracking?.trackingUrl ?? null,
        awbGeneratedAt: tracking?.generatedAt ?? null,
        subtotalAmount:
          getRonAmount(order, order.total) -
          getRonAmount(order, order.shipping_total) +
          getRonAmount(order, order.discount_total),
        discountAmount: getRonAmount(order, order.discount_total),
        discountSnapshot: null,
        shippingAmount: getRonAmount(order, order.shipping_total),
        totalAmount: getRonAmount(order, order.total),
        paymentAmount: toMinorUnits(order.total),
        paymentCurrency: getPaymentCurrency(order),
        currencyExchangeRate: getCurrencyExchangeRate(order),
        status: getOrderStatus(order),
        paymentMethod: getPaymentMethod(order),
        paymentStatus: getPaymentStatus(order),
        fulfillmentStatus: getFulfillmentStatus(order, extra),
        netopiaTxId: order.transaction_id || null,
        adminNotes: buildAdminNotes(order, tracking),
        customerNotes: order.customer_note || null,
        invoiceStatus: invoice.invoiceStatus,
        invoiceNumber: invoice.invoiceNumber,
        invoiceUrl: invoice.invoiceUrl,
        fgoInvoiceId: invoice.fgoInvoiceId,
        createdAt,
        updatedAt: getDate(order.date_modified) ?? paidAt ?? createdAt,
      })
      .returning({ id: orders.id });

    if (!createdOrder) {
      throw new Error(`WooCommerce order #${order.number} could not be inserted.`);
    }

    await tx.insert(orderItems).values(
      items.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );

    if (wooOrderNumber) {
      await tx.execute(sql`
        select setval(
          pg_get_serial_sequence('orders', 'order_number'),
          (select greatest(coalesce(max(order_number), 1), 1) from orders)
        )
      `);
    }
  });
}

async function updateImportedWooOrderMetadata(order: WooOrder, extra?: OrderExtra) {
  const tracking = getTrackingDetails(order, extra);
  const invoice = getFgoDetails(order, extra);
  const values = {
    fulfillmentStatus: getFulfillmentStatus(order, extra),
    ...(tracking
      ? {
          awbNumber: tracking.awbNumber,
          trackingUrl: tracking.trackingUrl,
          awbGeneratedAt: tracking.generatedAt,
        }
      : {}),
    ...(invoice.invoiceStatus !== "not_generated"
      ? {
          invoiceStatus: invoice.invoiceStatus,
          invoiceNumber: invoice.invoiceNumber,
          invoiceUrl: invoice.invoiceUrl,
          fgoInvoiceId: invoice.fgoInvoiceId,
        }
      : {}),
    updatedAt: getDate(order.date_modified) ?? new Date(),
  };

  const updated = await db
    .update(orders)
    .set(values)
    .where(eq(orders.checkoutIdempotencyKey, getWooOrderKey(order.id)))
    .returning({ id: orders.id });

  return updated.length > 0;
}

export async function importWooCommerceOrderById(
  wooId: number,
  extras?: WooCommerceOrderExtras,
  manualMatches?: WooCommerceOrderManualMatches,
) {
  const [order, existingWooKeys] = await Promise.all([
    fetchWooItem<WooOrder>(`orders/${wooId}`, { context: "edit" }),
    getExistingWooOrderKeys(),
  ]);
  const duplicateReason = getDuplicateReason(order, existingWooKeys);

  if (duplicateReason) {
    const metadataUpdated = await updateImportedWooOrderMetadata(
      order,
      getOrderExtra(extras, order),
    );

    return {
      created: 0,
      skipped: [
        {
          wooId: order.id,
          number: order.number,
          reason: metadataUpdated
            ? `${duplicateReason}; metadata updated`
            : duplicateReason,
        },
      ],
      errors: [],
    };
  }

  try {
    await insertWooOrder(order, getOrderExtra(extras, order), manualMatches);

    return {
      created: 1,
      skipped: [],
      errors: [],
    };
  } catch (error) {
    return {
      created: 0,
      skipped: [],
      errors: [
        error instanceof Error
          ? error.message
          : `WooCommerce order #${order.number} could not be imported.`,
      ],
    };
  }
}

export async function updateWooCommerceImportedOrderMetadataBatch(
  extras?: WooCommerceOrderExtras,
  options?: WooCommerceOrderImportOptions,
) {
  const [batch, existingWooKeys] = await Promise.all([
    fetchWooBatch<WooOrder>("orders", options, {
      status: "any",
      context: "edit",
      orderby: "date",
      order: "asc",
    }),
    getExistingWooOrderKeys(),
  ]);
  let updated = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const order of batch.rows) {
    if (!existingWooKeys.has(getWooOrderKey(order.id))) {
      skippedCount += 1;
      continue;
    }

    try {
      if (await updateImportedWooOrderMetadata(order, getOrderExtra(extras, order))) {
        updated += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `WooCommerce order #${order.number} metadata could not be updated.`,
      );
    }
  }

  return { updated, skippedCount, errors };
}
