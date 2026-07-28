export function getCronSecret() {
  return (
    process.env.CATALOG_REVALIDATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function isAuthorizedCronRequest(request: Request) {
  const secret = getCronSecret();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const queryToken = new URL(request.url).searchParams.get("secret")?.trim();

  return bearerToken === secret || queryToken === secret;
}
