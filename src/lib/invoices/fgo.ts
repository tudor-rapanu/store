import crypto from "crypto";

type FgoInvoiceClient = {
  Denumire: string;
  Tip: "PF" | "PJ";
  CodUnic?: string;
  Tara: string;
  Judet?: string;
  Adresa?: string;
  Email?: string;
  Telefon?: string;
  Strain?: boolean;
};

type FgoInvoiceLine = {
  Denumire: string;
  NrProduse: number;
  UM: string;
  CotaTVA: number;
  PretTotal: number;
};

type FgoInvoiceRequest = {
  CodUnic: string;
  Hash: string;
  Serie: string;
  Valuta: string;
  TipFactura: string;
  DataEmitere?: string;
  IdExtern?: string;
  Client: FgoInvoiceClient;
  Continut: FgoInvoiceLine[];
  PlatformaUrl: string;
  VerificareDuplicat?: boolean;
};

type FgoInvoiceResponse = {
  Success?: boolean;
  Message?: string;
  Factura?: {
    Numar?: string;
    Serie?: string;
    Link?: string;
    LinkPlata?: string;
  };
};

export type FgoCreateInvoiceInput = {
  clientName: string;
  clientType?: "PF" | "PJ";
  clientTaxCode?: string;
  clientCountryCode?: string;
  clientCounty?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  invoiceExternalId?: string;
  currency?: string;
  lines: FgoInvoiceLine[];
};

export class FgoInvoiceError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new FgoInvoiceError(`${name} is required for FGO invoice generation.`);
  }

  return value;
}

function getFgoApiBaseUrl() {
  return (
    process.env.FGO_API_BASE_URL?.trim().replace(/\/+$/, "") ||
    (process.env.FGO_ENV === "production"
      ? "https://api.fgo.ro/v1"
      : "https://api-testuat.fgo.ro/v1")
  );
}

function getPlatformUrl() {
  const value =
    process.env.FGO_PLATFORMA_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    throw new FgoInvoiceError("FGO_PLATFORMA_URL or NEXT_PUBLIC_SITE_URL is required.");
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function getInvoiceDate() {
  return new Date().toISOString().slice(0, 10);
}

function getHash(codUnic: string, privateKey: string, clientName: string) {
  return crypto
    .createHash("sha1")
    .update(`${codUnic}${privateKey}${clientName}`)
    .digest("hex")
    .toUpperCase();
}

function buildFgoInvoiceRequest(input: FgoCreateInvoiceInput): FgoInvoiceRequest {
  const codUnic = getRequiredEnv("FGO_COD_UNIC");
  const privateKey = getRequiredEnv("FGO_PRIVATE_KEY");
  const serie = getRequiredEnv("FGO_INVOICE_SERIE");
  const clientCountryCode = input.clientCountryCode || "RO";

  return {
    CodUnic: codUnic,
    Hash: getHash(codUnic, privateKey, input.clientName),
    Serie: serie,
    Valuta: input.currency ?? "RON",
    TipFactura:
      clientCountryCode === "RO"
        ? (process.env.FGO_TIP_FACTURA?.trim() ?? "Factura")
        : (process.env.FGO_TIP_FACTURA_FOREIGN?.trim() ??
          process.env.FGO_TIP_FACTURA?.trim() ??
          "Factura"),
    DataEmitere: getInvoiceDate(),
    IdExtern: input.invoiceExternalId,
    Client: {
      Denumire: input.clientName,
      Tip: input.clientType ?? "PF",
      CodUnic: input.clientTaxCode,
      Tara: clientCountryCode,
      Judet: input.clientCounty,
      Adresa: input.clientAddress,
      Email: input.clientEmail,
      Telefon: input.clientPhone,
      Strain: clientCountryCode !== "RO",
    },
    Continut: input.lines,
    PlatformaUrl: getPlatformUrl(),
    VerificareDuplicat: true,
  };
}

export async function createFgoInvoice(input: FgoCreateInvoiceInput) {
  const requestBody = buildFgoInvoiceRequest(input);
  const response = await fetch(`${getFgoApiBaseUrl()}/factura/emitere`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  }).catch((error) => {
    throw new FgoInvoiceError(
      error instanceof Error ? error.message : "FGO invoice request failed.",
      true,
    );
  });
  const result = (await response.json().catch(() => null)) as FgoInvoiceResponse | null;

  if (!response.ok || !result?.Success) {
    throw new FgoInvoiceError(
      result?.Message || `FGO invoice generation failed with status ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }

  const invoiceNumber = result.Factura?.Numar;
  const invoiceSeries = result.Factura?.Serie ?? requestBody.Serie;

  if (!invoiceNumber) {
    throw new FgoInvoiceError("FGO invoice response did not include an invoice number.");
  }

  return {
    invoiceNumber,
    invoiceSeries,
    invoiceId: `${invoiceSeries}-${invoiceNumber}`,
    invoiceUrl: result.Factura?.Link ?? null,
    paymentUrl: result.Factura?.LinkPlata ?? null,
  };
}
