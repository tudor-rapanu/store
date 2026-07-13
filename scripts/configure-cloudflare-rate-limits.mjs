const zoneId = process.env.CF_ZONE_ID;
const token = process.env.CF_AUTH_TOKEN;

if (!zoneId || !token) {
  console.error("CF_ZONE_ID and CF_AUTH_TOKEN are required.");
  process.exit(1);
}

const apiBase = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

// Optional coarse edge shield for Cloudflare Free plan.
// Redis-backed app rate limiting remains the primary limiter because it supports
// per-route limits and dynamic paths across all Cloud Run instances.
const rules = [
  {
    description: "TT Storefront - sensitive public endpoint rate limit",
    expression:
      '((http.request.method eq "POST" and http.request.uri.path in {"/en/checkout" "/en/checkout/" "/ro/checkout" "/ro/checkout/" "/api/webhooks/netopia"}) or (http.request.method eq "GET" and http.request.uri.path in {"/api/shipping/sameday/cities" "/api/shipping/profiles" "/api/shipping/sameday/counties" "/api/shipping/sameday/locker-config"}))',
    action: "block",
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period: 10,
      requests_per_period: 20,
      mitigation_timeout: 60,
      requests_to_origin: true,
    },
  },
];

async function cloudflareFetch(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    const message = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Cloudflare API failed for ${path}: ${message}`);
  }

  return json.result;
}

async function getEntrypointRuleset() {
  const response = await fetch(`${apiBase}/rulesets/phases/http_ratelimit/entrypoint`, {
    headers,
  });
  const json = await response.json();

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !json.success) {
    const message = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Could not fetch rate-limit entrypoint: ${message}`);
  }

  return json.result;
}

async function createEntrypointRuleset() {
  return cloudflareFetch("/rulesets", {
    method: "POST",
    body: JSON.stringify({
      name: "TT Storefront rate limiting",
      kind: "zone",
      phase: "http_ratelimit",
      rules,
    }),
  });
}

async function appendMissingRules(ruleset) {
  const existingDescriptions = new Set(
    (ruleset.rules ?? []).map((rule) => rule.description),
  );
  const missingRules = rules.filter(
    (rule) => !existingDescriptions.has(rule.description),
  );

  for (const rule of missingRules) {
    await cloudflareFetch(`/rulesets/${ruleset.id}/rules`, {
      method: "POST",
      body: JSON.stringify(rule),
    });
    console.log(`Added: ${rule.description}`);
  }

  if (missingRules.length === 0) {
    console.log("All TT Storefront rate limit rules already exist.");
  }
}

const ruleset = await getEntrypointRuleset();

if (!ruleset) {
  await createEntrypointRuleset();
  console.log("Created rate-limit entrypoint ruleset with TT Storefront rules.");
} else {
  await appendMissingRules(ruleset);
}
