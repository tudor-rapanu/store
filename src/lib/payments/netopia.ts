import { Netopia } from "netopia-card";
import { readEnvValue } from "@/lib/env";

function normalizeAbsoluteUrl(value: string) {
  const cleaned = value.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function getSiteUrl() {
  return normalizeAbsoluteUrl(
    readEnvValue(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "NEXT_PUBLIC_SITE_URL",
    ),
  );
}

function getNetopiaUrl(value: string | undefined, path: string) {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");

  if (cleaned) {
    return normalizeAbsoluteUrl(cleaned);
  }

  return `${getSiteUrl()}${path}`;
}

function getNetopiaNotifyUrl(value: string | undefined, path: string) {
  const notifyUrl = getNetopiaUrl(value, path);
  const webhookSecret = process.env.NETOPIA_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return notifyUrl;
  }

  const url = new URL(notifyUrl);
  url.searchParams.set("token", webhookSecret);

  return url.toString();
}

function getNetopiaReturnUrl(
  value: string | undefined,
  path: string,
  orderId?: string,
) {
  const returnUrl = getNetopiaUrl(value, path);

  if (!orderId) {
    return returnUrl;
  }

  const url = new URL(returnUrl);
  url.searchParams.set("orderId", orderId);

  return url.toString();
}

function isNetopiaSandbox() {
  return process.env.NETOPIA_SANDBOX?.trim().toLowerCase() !== "false";
}

export function createNetopiaClient(redirectPath = "/en", orderId?: string) {
  return new Netopia({
    apiBaseUrl: getSiteUrl(),
    apiKey: readEnvValue(process.env.NETOPIA_API_KEY, "NETOPIA_API_KEY"),
    notifyUrl: getNetopiaNotifyUrl(
      process.env.NETOPIA_CONFIRM_URL,
      "/api/webhooks/netopia",
    ),
    posSignature: readEnvValue(
      process.env.NETOPIA_SIGNATURE,
      "NETOPIA_SIGNATURE",
    ),
    redirectUrl: getNetopiaReturnUrl(
      process.env.NETOPIA_RETURN_URL,
      redirectPath,
      orderId,
    ),
    sandbox: isNetopiaSandbox(),
  });
}
