export function getTaskSecret() {
  return (
    process.env.CLOUD_TASKS_SECRET?.trim() ||
    process.env.TASKS_AUTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function isAuthorizedTaskRequest(request: Request) {
  const secret = getTaskSecret();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  return bearerToken === secret;
}
