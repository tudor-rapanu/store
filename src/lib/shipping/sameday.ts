import { and, count, eq, ilike } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  samedayCities,
  samedayCounties,
  shippingProviderTokens,
} from "@/lib/db/schema";
import { readEnvValue } from "@/lib/env";

const PROVIDER = "sameday";
const TOKEN_REFRESH_BUFFER_MS = 30 * 60 * 1000;

type SamedayTokenResponse = {
  token?: string;
  expire_at?: string;
  expire_at_utc?: string;
};

type UnknownRecord = Record<string, unknown>;

export type SamedayPickupPoint = {
  id: string;
  name: string;
  address?: string;
  contactPersons: SamedayContactPerson[];
};

export type SamedayContactPerson = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type SamedayCounty = {
  id: number;
  name: string;
};

export type SamedayCity = {
  id: number;
  countyId: number;
  name: string;
  postalCode?: string;
};

export type CreateSamedayAwbInput = {
  orderId: string;
  orderNumber: number;
  pickupPointId: string;
  contactPersonId: string;
  serviceId: string;
  packageType: string;
  packageWeight: string;
  packageWidth: string;
  packageLength: string;
  packageHeight: string;
  countyId: string;
  cityId: string;
  oohLastMile?: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientAddress: string;
  recipientPostalCode?: string;
  observation?: string;
  personalEasyboxLoad?: boolean;
};

export type SamedayAwbResult = {
  awbNumber: string;
  awbCost: number | null;
  pdfLink: string | null;
  raw: unknown;
};

type PagedResponse = {
  pages?: number;
  currentPage?: number;
  total?: number;
  data?: unknown[];
};

type ParsedResponse = {
  body: unknown;
  rawText: string;
};

class SamedayRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "SamedayRequestError";
  }
}

function getBaseUrl() {
  return readEnvValue(
    process.env.SAMEDAY_API_URL ?? "https://api.sameday.ro",
    "SAMEDAY_API_URL",
  ).replace(/\/+$/, "");
}

function parseSamedayDate(value: string | undefined) {
  if (!value) {
    return new Date(Date.now() + 11 * 60 * 60 * 1000);
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime())
    ? new Date(Date.now() + 11 * 60 * 60 * 1000)
    : parsed;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  if (Array.isArray(record.results)) {
    return record.results;
  }

  const nestedData = asRecord(record.data);
  if (Array.isArray(nestedData.data)) {
    return nestedData.data;
  }
  if (Array.isArray(nestedData.items)) {
    return nestedData.items;
  }

  return [];
}

function getPageCount(value: unknown) {
  const record = asRecord(value);
  const pages = Number(record.pages);

  return Number.isFinite(pages) && pages > 0 ? pages : 1;
}

function getTotalCount(value: unknown) {
  const record = asRecord(value);
  const total = Number(record.total);

  return Number.isFinite(total) && total >= 0 ? total : null;
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function readNumber(record: UnknownRecord, keys: string[]) {
  const value = readString(record, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNestedString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    const nested = asRecord(value);
    const nestedValue = readString(nested, ["id", "value", "code", "name"]);
    if (nestedValue) {
      return nestedValue;
    }
  }

  return "";
}

function looksLikePdoTax(record: UnknownRecord) {
  const searchableValues = [
    readString(record, ["taxCode", "tax_code", "code", "abbreviation"]),
    readString(record, ["name", "label", "description"]),
  ];

  return searchableValues.some((value) => value.toUpperCase().includes("PDO"));
}

function matchesPackageType(record: UnknownRecord, packageType: string) {
  const taxPackageType = readNestedString(record, [
    "packageType",
    "package_type",
    "parcelType",
    "parcel_type",
  ]);

  return !taxPackageType || taxPackageType === packageType;
}

function readServiceId(record: UnknownRecord) {
  return readString(record, [
    "id",
    "serviceId",
    "service_id",
    "samedayServiceId",
    "sameday_service_id",
  ]);
}

function findServiceById(value: unknown, serviceId: string): UnknownRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findServiceById(item, serviceId);
      if (match) {
        return match;
      }
    }

    return null;
  }

  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return null;
  }

  if (readServiceId(record) === serviceId) {
    return record;
  }

  for (const child of Object.values(record)) {
    const match = findServiceById(child, serviceId);
    if (match) {
      return match;
    }
  }

  return null;
}

function findPdoServiceTaxId(value: unknown, packageType: string): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findPdoServiceTaxId(item, packageType);
      if (match) {
        return match;
      }
    }

    return null;
  }

  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return null;
  }

  const id = readString(record, [
    "id",
    "serviceTaxId",
    "service_tax_id",
    "serviceOptionalTaxId",
    "service_optional_tax_id",
  ]);

  if (looksLikePdoTax(record) && id && matchesPackageType(record, packageType)) {
    return id;
  }

  for (const child of Object.values(record)) {
    const match = findPdoServiceTaxId(child, packageType);
    if (match) {
      return match;
    }
  }

  return null;
}

function getServiceOptionalTaxes(service: UnknownRecord) {
  const sources = [
    service.serviceOptionalTaxes,
    service.service_optional_taxes,
    service.optionalTaxes,
    service.optional_taxes,
    service.taxes,
  ];

  return sources.flatMap((source) =>
    Array.isArray(source) ? source : source ? [source] : [],
  );
}

async function authenticateSameday() {
  const url = new URL(`${getBaseUrl()}/api/authenticate`);
  url.searchParams.set("remember_me", "1");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-AUTH-USERNAME": readEnvValue(process.env.SAMEDAY_USERNAME, "SAMEDAY_USERNAME"),
      "X-AUTH-PASSWORD": readEnvValue(process.env.SAMEDAY_PASSWORD, "SAMEDAY_PASSWORD"),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const rawText = await response.text();
  const body = parseResponseBody(rawText) as SamedayTokenResponse;

  if (!response.ok || !body.token) {
    throw new Error(
      `Sameday authentication failed with status ${response.status}: ${formatErrorBody(body, rawText)}`,
    );
  }

  const expiresAt = parseSamedayDate(body.expire_at_utc ?? body.expire_at);

  await db
    .insert(shippingProviderTokens)
    .values({
      provider: PROVIDER,
      token: body.token,
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: shippingProviderTokens.provider,
      set: {
        token: body.token,
        expiresAt,
        updatedAt: new Date(),
      },
    });

  return body.token;
}

function parseResponseBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function formatErrorBody(body: unknown, rawText: string) {
  const record = asRecord(body);
  const message = readString(record, ["message", "error", "detail"]);
  const validationDetails = [
    record.errors,
    record.violations,
    record.validationErrors,
    record.errorDetails,
  ].find(Boolean);

  if (message) {
    return validationDetails
      ? `${message}: ${JSON.stringify(validationDetails).slice(0, 500)}`
      : message;
  }

  if (validationDetails) {
    return JSON.stringify(validationDetails).slice(0, 500);
  }

  return rawText.slice(0, 1000) || "empty response";
}

export async function getSamedayToken() {
  const [savedToken] = await db
    .select()
    .from(shippingProviderTokens)
    .where(eq(shippingProviderTokens.provider, PROVIDER))
    .limit(1);

  if (
    savedToken &&
    savedToken.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS
  ) {
    return savedToken.token;
  }

  return authenticateSameday();
}

async function samedayRequest<T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | undefined> } = {},
) {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const token = await getSamedayToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-AUTH-TOKEN": token,
      ...options.headers,
    },
    cache: "no-store",
  });
  const text = await response.text();
  const parsed: ParsedResponse = {
    body: parseResponseBody(text),
    rawText: text,
  };

  if (!response.ok) {
    throw new SamedayRequestError(
      `Sameday ${path} failed with status ${response.status}: ${formatErrorBody(parsed.body, parsed.rawText)}`,
      response.status,
      path,
    );
  }

  if (text && parsed.body === null) {
    throw new Error(
      `Sameday ${path} returned a non-JSON response: ${text.slice(0, 500)}`,
    );
  }

  return parsed.body as T;
}

function normalizeContactPerson(value: unknown): SamedayContactPerson | null {
  const record = asRecord(value);
  const id = readString(record, [
    "id",
    "contactPersonId",
    "contact_person_id",
    "customerContactPersonId",
    "customer_contact_person_id",
  ]);
  const firstName = readString(record, ["firstName", "first_name"]);
  const lastName = readString(record, ["lastName", "last_name"]);
  const name =
    readString(record, [
      "name",
      "fullName",
      "full_name",
      "contactPerson",
      "contact_person",
    ]) || [firstName, lastName].filter(Boolean).join(" ");

  if (!id) {
    return null;
  }

  return {
    id,
    name: name || `Contact ${id}`,
    isDefault:
      record.isDefault === true ||
      record.isDefault === 1 ||
      record.isDefault === "1" ||
      record.default === true ||
      record.default === 1 ||
      record.default === "1" ||
      record.is_default === true ||
      record.is_default === 1 ||
      record.is_default === "1" ||
      record.defaultContactPerson === true ||
      record.defaultContactPerson === 1 ||
      record.defaultContactPerson === "1",
  };
}

function getPickupPointContactPersons(record: UnknownRecord) {
  const sources = [
    record.contactPersons,
    record.contact_persons,
    record.contacts,
    record.pickupPointContactPerson,
    record.pickup_point_contact_person,
    record.pickupPointContactPersons,
    record.pickup_point_contact_persons,
    record.customerContactPersons,
    record.customer_contact_persons,
    record.contactPerson,
    record.contact_person,
    record.defaultContactPerson,
    record.default_contact_person,
  ];
  const contactPersons = sources.flatMap((source) =>
    Array.isArray(source) ? source : source ? [source] : [],
  );

  if (contactPersons.length === 0) {
    return [];
  }

  return contactPersons
    .map(normalizeContactPerson)
    .filter(Boolean) as SamedayContactPerson[];
}

function normalizePickupPoint(value: unknown): SamedayPickupPoint | null {
  const record = asRecord(value);
  const id = readString(record, ["id", "pickupPointId"]);
  const name = readString(record, ["name", "alias", "contactName"]);

  if (!id) {
    return null;
  }

  const contactPersons = getPickupPointContactPersons(record);

  return {
    id,
    name: name || `Pickup point ${id}`,
    address: readString(record, ["address", "pickupPointAddress"]),
    contactPersons,
  };
}

function normalizeCounty(value: unknown): SamedayCounty | null {
  const record = asRecord(value);
  const id = readNumber(record, ["id", "countyId"]);
  const name = readString(record, ["name", "county"]);

  return id !== null && name ? { id, name } : null;
}

function normalizeCity(value: unknown, fallbackCountyId?: number): SamedayCity | null {
  const record = asRecord(value);
  const cityRecord = asRecord(record.city);
  const localityRecord = asRecord(record.locality);
  const id =
    readNumber(record, ["id", "cityId", "localityId"]) ??
    readNumber(cityRecord, ["id", "cityId"]) ??
    readNumber(localityRecord, ["id", "localityId"]);
  const parsedCountyId =
    readNumber(record, ["countyId", "county_id"]) ??
    readNumber(asRecord(record.county), ["id", "countyId"]);
  const countyId =
    parsedCountyId && parsedCountyId > 0 ? parsedCountyId : fallbackCountyId;
  const name =
    readString(record, ["name", "city", "locality"]) ||
    readString(cityRecord, ["name", "city"]) ||
    readString(localityRecord, ["name", "locality"]);
  const postalCode = readString(record, ["postalCode", "postal_code", "zip"]);

  return id !== null && countyId !== null && countyId !== undefined && name
    ? { id, countyId, name, postalCode }
    : null;
}

export async function getSamedayPickupPoints() {
  const response = await samedayRequest<unknown>("/api/client/pickup-points");

  return asArray(response)
    .map(normalizePickupPoint)
    .filter(Boolean) as SamedayPickupPoint[];
}

export async function debugSamedayPickupPoints() {
  const response = await samedayRequest<unknown>("/api/client/pickup-points");
  const rows = asArray(response);

  return {
    topLevelKeys: Object.keys(asRecord(response)),
    rowCount: rows.length,
    pickupPoints: rows.slice(0, 5).map((row) => {
      const record = asRecord(row);
      const contactEntries = Object.entries(record).filter(([key]) =>
        key.toLowerCase().includes("contact"),
      );

      return {
        id: readString(record, ["id", "pickupPointId"]),
        name: readString(record, ["name", "alias", "contactName"]),
        keys: Object.keys(record),
        contactKeys: contactEntries.map(([key]) => key),
        contactPreview: Object.fromEntries(
          contactEntries.map(([key, value]) => [
            key,
            JSON.stringify(value).slice(0, 700),
          ]),
        ),
        normalized: normalizePickupPoint(row),
      };
    }),
  };
}

export async function getSamedayPdoServiceTaxId(
  packageType: string,
  serviceId: string,
) {
  const response = await samedayRequest<unknown>("/api/client/services");
  const service = findServiceById(response, serviceId);
  const serviceTaxId = service
    ? findPdoServiceTaxId(getServiceOptionalTaxes(service), packageType)
    : null;

  if (!serviceTaxId) {
    console.error("Sameday PDO optional tax lookup failed:", {
      packageType,
      serviceId,
      serviceFound: Boolean(service),
      serviceKeys: service ? Object.keys(service) : [],
      ...summarizeSamedayServices(response),
    });
    throw new Error(
      `Sameday PDO optional tax was not found for service ${serviceId} and package type ${packageType}.`,
    );
  }

  console.log("Sameday PDO optional tax selected:", {
    packageType,
    serviceId,
    serviceTaxId,
  });

  return serviceTaxId;
}

function summarizeSamedayServices(value: unknown) {
  const rows = asArray(value);
  const optionalTaxes = rows.flatMap((row) => {
    const record = asRecord(row);
    return asArray(record.serviceOptionalTaxes ?? record.service_optional_taxes);
  });

  return {
    topLevelKeys: Object.keys(asRecord(value)),
    serviceCount: rows.length,
    firstServiceKeys: Object.keys(asRecord(rows[0])),
    optionalTaxCount: optionalTaxes.length,
    optionalTaxPreview: optionalTaxes.slice(0, 20).map((tax) => {
      const record = asRecord(tax);
      return {
        keys: Object.keys(record),
        id: readString(record, [
          "id",
          "serviceTaxId",
          "service_tax_id",
          "serviceOptionalTaxId",
          "service_optional_tax_id",
        ]),
        code: readString(record, ["taxCode", "tax_code", "code", "abbreviation"]),
        name: readString(record, ["name", "label", "description"]),
        packageType: readNestedString(record, [
          "packageType",
          "package_type",
          "parcelType",
          "parcel_type",
        ]),
      };
    }),
  };
}

export async function syncSamedayCounties() {
  const response = await samedayRequest<unknown>("/api/geolocation/county");
  const items = asArray(response)
    .map(normalizeCounty)
    .filter(Boolean) as SamedayCounty[];

  if (items.length > 0) {
    for (const county of items) {
      await db
        .insert(samedayCounties)
        .values({
          id: county.id,
          name: county.name,
          rawData: county,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: samedayCounties.id,
          set: {
            name: county.name,
            rawData: county,
            updatedAt: new Date(),
          },
        });
    }
  }

  return sortByName(items);
}

export async function getCachedOrSyncSamedayCounties() {
  const cached = await db.select().from(samedayCounties);
  if (cached.length > 0) {
    return sortByName(cached.map((county) => ({ id: county.id, name: county.name })));
  }

  return syncSamedayCounties();
}

export async function syncSamedayCities(countyId: number, name?: string) {
  const [county] = await db
    .select()
    .from(samedayCounties)
    .where(eq(samedayCounties.id, countyId))
    .limit(1);

  if (!county) {
    await syncSamedayCounties();
  }

  const [freshCounty] = await db
    .select()
    .from(samedayCounties)
    .where(eq(samedayCounties.id, countyId))
    .limit(1);

  if (!freshCounty) {
    throw new Error("Sameday county was not found.");
  }

  const items: SamedayCity[] = [];
  let totalPages = 1;
  const cityQueryVariants: Record<string, string>[] = [
    { county: String(freshCounty.id) },
  ];
  let activeCityQuery: Record<string, string> | null = null;

  for (let page = 1; page <= totalPages; page += 1) {
    let response: PagedResponse | unknown;

    if (activeCityQuery) {
      response = await fetchSamedayCityPage(activeCityQuery, page, name);
    } else {
      const errors: string[] = [];
      let emptyResponse: PagedResponse | unknown;

      for (const cityQuery of cityQueryVariants) {
        try {
          const candidateResponse = await fetchSamedayCityPage(cityQuery, page, name);
          const candidateCities = extractSamedayCities(candidateResponse, countyId);

          if (candidateCities.length > 0 || name) {
            response = candidateResponse;
            activeCityQuery = cityQuery;
            break;
          }

          emptyResponse = candidateResponse;
        } catch (error) {
          if (error instanceof SamedayRequestError && error.status === 400) {
            errors.push(error.message);
            continue;
          }

          throw error;
        }
      }

      if (!activeCityQuery && emptyResponse !== undefined) {
        response = emptyResponse;
        activeCityQuery = cityQueryVariants[0];
      }

      if (!activeCityQuery || response === undefined) {
        throw new Error(errors.join(" | "));
      }
    }

    totalPages = getPageCount(response);
    items.push(...extractSamedayCities(response, countyId));
  }

  for (const city of items) {
    await db
      .insert(samedayCities)
      .values({
        id: city.id,
        countyId: city.countyId,
        name: city.name,
        postalCode: city.postalCode || null,
        rawData: city,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: samedayCities.id,
        set: {
          countyId: city.countyId,
          name: city.name,
          postalCode: city.postalCode || null,
          rawData: city,
          updatedAt: new Date(),
        },
      });
  }

  return sortByName(items);
}

export async function getSamedayCityCacheStatus(countyId: number) {
  const [cached] = await db
    .select({ value: count() })
    .from(samedayCities)
    .where(eq(samedayCities.countyId, countyId));
  const response = await fetchSamedayCityPage(
    { county: String(countyId) },
    1,
    undefined,
    "1",
  );
  const remoteTotal = getTotalCount(response);

  return {
    cached: cached?.value ?? 0,
    remoteTotal,
    isComplete:
      (cached?.value ?? 0) > 0 && remoteTotal !== null && remoteTotal > 0
        ? (cached?.value ?? 0) >= remoteTotal
        : false,
  };
}

function extractSamedayCities(response: unknown, countyId: number) {
  return asArray(response)
    .map((item) => normalizeCity(item, countyId))
    .filter(Boolean) as SamedayCity[];
}

function describeSamedayResponse(response: unknown, countyId: number) {
  const record = asRecord(response);
  const rows = asArray(response);
  const firstRow = rows[0];

  return {
    topLevelKeys: Object.keys(record),
    rowCount: rows.length,
    normalizedCityCount: extractSamedayCities(response, countyId).length,
    firstRowKeys: Object.keys(asRecord(firstRow)),
    firstRowPreview: firstRow ? JSON.stringify(firstRow).slice(0, 500) : null,
  };
}

async function fetchSamedayCityPage(
  cityQuery: Record<string, string>,
  page: number,
  name?: string,
  countPerPage = "500",
) {
  return samedayRequest<PagedResponse | unknown>("/api/geolocation/city", {
    query: {
      ...cityQuery,
      name,
      page: String(page),
      countPerPage,
    },
  });
}

export async function syncAllSamedayLocations() {
  const counties = await syncSamedayCounties();
  let cityCount = 0;
  const failures: { countyId: number; countyName: string; error: string }[] = [];

  for (const county of counties) {
    try {
      const cities = await syncSamedayCities(county.id);
      cityCount += cities.length;
    } catch (error) {
      failures.push({
        countyId: county.id,
        countyName: county.name,
        error:
          error instanceof Error ? error.message : "Unknown Sameday city sync error.",
      });
    }
  }

  return {
    counties: counties.length,
    cities: cityCount,
    failures,
  };
}

export async function debugSamedayCityQueries(countyId: number) {
  const [county] = await db
    .select()
    .from(samedayCounties)
    .where(eq(samedayCounties.id, countyId))
    .limit(1);

  if (!county) {
    throw new Error("Sameday county was not found in the local cache.");
  }

  const variants: Record<string, string>[] = [
    { county: String(county.id) },
    { county: county.name },
    { countyId: String(county.id) },
  ];
  const results = [];

  for (const query of variants) {
    try {
      const response = await fetchSamedayCityPage(query, 1);
      results.push({
        query,
        ok: true,
        ...describeSamedayResponse(response, countyId),
      });
    } catch (error) {
      results.push({
        query,
        ok: false,
        error:
          error instanceof Error ? error.message : "Unknown Sameday city debug error.",
      });
    }
  }

  return {
    county: {
      id: county.id,
      name: county.name,
    },
    results,
  };
}

export async function searchSamedayCities(countyId: number, name?: string) {
  const filters = [eq(samedayCities.countyId, countyId)];

  if (name) {
    filters.push(ilike(samedayCities.name, `%${name}%`));
  }

  const cached = await db
    .select()
    .from(samedayCities)
    .where(and(...filters))
    .limit(100);

  if (cached.length > 0) {
    return sortByName(
      cached.map((city) => ({
        id: city.id,
        countyId: city.countyId,
        name: city.name,
        postalCode: city.postalCode ?? undefined,
      })),
    );
  }

  return syncSamedayCities(countyId, name);
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((first, second) =>
    first.name.localeCompare(second.name, "ro", { sensitivity: "base" }),
  );
}

export async function createSamedayAwb(input: CreateSamedayAwbInput) {
  const isPickupPointDelivery = Boolean(input.oohLastMile);
  const awbRecipient: Record<string, string | undefined> = {
    county: input.countyId,
    city: input.cityId,
    postalCode: input.recipientPostalCode,
    personType: "0",
    name: input.recipientName,
    phoneNumber: input.recipientPhone,
    email: input.recipientEmail,
  };

  if (!isPickupPointDelivery) {
    awbRecipient.address = input.recipientAddress;
  }

  const payload: Record<string, unknown> = {
    packageType: input.packageType,
    insuredValue: "0.00",
    cashOnDelivery: "0.00",
    cashOnDeliveryReturns: "0.00",
    observation: input.observation ?? "",
    priceObservation: "",
    clientObservation: "",
    awbPayment: "1",
    thirdPartyPickup: "0",
    pickupPoint: input.pickupPointId,
    service: input.serviceId,
    awbRecipient,
    packageWeight: input.packageWeight,
    parcels: [
      {
        weight: input.packageWeight,
        width: input.packageWidth,
        length: input.packageLength,
        height: input.packageHeight,
      },
    ],
    packageNumber: "1",
    clientInternalReference: `TT-${input.orderNumber}`,
  };

  payload.contactPerson = input.contactPersonId;

  console.log("Sameday AWB base payload:", sanitizeAwbPayload(payload));

  if (input.personalEasyboxLoad) {
    console.log("Sameday AWB personal dropoff requested:", {
      packageType: input.packageType,
      service: input.serviceId,
    });
    payload.serviceTaxes = ["PDO"];
  }

  if (input.oohLastMile) {
    payload.oohLastMile = input.oohLastMile;
  }

  console.log("Sameday AWB payload:", sanitizeAwbPayload(payload));

  let response: unknown;

  try {
    response = await samedayRequest<unknown>("/api/awb", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Sameday AWB payload rejected:", sanitizeAwbPayload(payload));
    throw error;
  }
  const record = asRecord(response);
  const awbNumber = readString(record, ["awbNumber", "awb_number"]);

  if (!awbNumber) {
    throw new Error("Sameday did not return an AWB number.");
  }

  const awbCost = readNumber(record, ["awbCost", "awb_cost"]);

  return {
    awbNumber,
    awbCost,
    pdfLink: readString(record, ["pdfLink", "pdf_link"]) || null,
    raw: response,
  } satisfies SamedayAwbResult;
}

export async function downloadSamedayAwbLabel(awbNumber: string) {
  const cleanedAwbNumber = awbNumber.trim();

  if (!cleanedAwbNumber) {
    throw new Error("AWB number is required.");
  }

  const token = await getSamedayToken();
  const response = await fetch(
    `${getBaseUrl()}/api/awb/download/${encodeURIComponent(cleanedAwbNumber)}/A6`,
    {
      headers: {
        Accept: "application/pdf",
        "X-AUTH-TOKEN": token,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new SamedayRequestError(
      `Sameday label download failed with status ${response.status}: ${text.slice(0, 500)}`,
      response.status,
      "/api/awb/download",
    );
  }

  return {
    body: response.body,
    contentType: response.headers.get("content-type") ?? "application/pdf",
  };
}

function sanitizeAwbPayload(payload: Record<string, unknown>) {
  const recipient = asRecord(payload.awbRecipient);

  return {
    ...payload,
    awbRecipient: {
      county: recipient.county,
      city: recipient.city,
      postalCode: recipient.postalCode,
      personType: recipient.personType,
      hasAddress: Boolean(recipient.address),
      hasName: Boolean(recipient.name),
      hasPhoneNumber: Boolean(recipient.phoneNumber),
    },
  };
}

export function getSamedayTrackingUrl(awbNumber: string) {
  return `https://sameday.ro/#awb=${encodeURIComponent(awbNumber)}`;
}
