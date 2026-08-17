#!/usr/bin/env node
// Post-deploy smoke test: hits a handful of critical routes on a deployed
// environment and fails loudly if any come back broken. Run after every
// deploy so a schema-drift-style bug (5xx status, or a 200 that still
// contains Next.js's generic error page) is caught immediately instead of
// silently shipping.

const args = process.argv.slice(2);
const urlArg = args.find((arg) => arg.startsWith("--url="));
const baseUrl = urlArg?.slice("--url=".length)?.replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-test.mjs --url=https://example.com");
  process.exit(2);
}

const CHECKS = [
  { path: "/", expect: [200, 307, 308] },
  { path: "/en", expect: [200] },
  { path: "/en/account", expect: [200] }, // logged out -> renders the login page, not a crash
  { path: "/api/healthz", expect: [200] },
  { path: "/api/readyz", expect: [200] },
];

const ERROR_MARKERS = [
  "This page couldn't load",
  "Application error: a server-side exception has occurred",
];

let failures = 0;

for (const check of CHECKS) {
  const url = `${baseUrl}${check.path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = check.expect.includes(res.status);
    let bodyHasError = false;

    if (res.status < 300) {
      const text = await res.text();
      bodyHasError = ERROR_MARKERS.some((marker) => text.includes(marker));
    }

    if (!ok || bodyHasError) {
      failures += 1;
      console.error(
        `FAIL  ${check.path}  status=${res.status}${bodyHasError ? "  (error page markers found in body)" : ""}`,
      );
    } else {
      console.log(`OK    ${check.path}  status=${res.status}`);
    }
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${check.path}  ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures > 0) {
  console.error(`\nSmoke test failed: ${failures} of ${CHECKS.length} checks failed against ${baseUrl}`);
  process.exit(1);
}

console.log(`\nSmoke test passed: all ${CHECKS.length} checks OK against ${baseUrl}`);
