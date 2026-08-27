import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { checkRequestRateLimit } from "@/lib/rate-limit";

// 1. Initialize the i18n middleware
const intlMiddleware = createMiddleware({
  locales: ["en", "ro"],
  defaultLocale: "en",
});

// Leftover WooCommerce/WordPress URLs still crawled by bots after the migration to
// this app. None of them match a real route, but letting them fall through to the
// app router still burns a request (and, for /product(s)-shaped paths, a DB lookup);
// short-circuit with 410 to save the hop and signal crawlers to stop retrying.
const DEAD_PATH_PATTERN =
  /^\/(?:en\/|ro\/)?(?:produs|categorie-produs|product|product-category|wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|wp-cron\.php|xmlrpc\.php)(?:\/.*)?$/;
const DEAD_EXACT_PATHS = new Set(["/.env"]);

// Vulnerability-scanner sweeps have hit 1,000-1,900+ requests/minute from a single
// IP. Real browsing can still be bursty -- Next.js prefetches a request for every
// link that scrolls into view, so one visitor scrolling a product listing can fire
// dozens of requests in seconds. Keep the limit far below the observed scanner rate
// but well above that, and skip prefetch requests entirely since they're inherent
// to normal navigation, not attacker-controlled volume. Falls back to an in-memory
// bucket per Cloud Run instance when Upstash isn't configured -- not perfectly
// accurate across instances, but still meaningfully throttles a burst.
const REQUEST_RATE_LIMIT = { keyPrefix: "proxy", limit: 200, windowMs: 60_000 };

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce when Cloudflare has attached the real visitor IP. Requests
  // without it (the raw *.run.app URL, used only by deploy tooling/smoke tests,
  // never by real customers) would otherwise share a weak fallback identifier
  // and risk tripping the limit on unrelated callers instead of one bad actor.
  if (request.headers.get("cf-connecting-ip") && !request.headers.get("next-router-prefetch")) {
    const rateLimit = await checkRequestRateLimit(request, REQUEST_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "Cache-Control": "no-store",
        },
      });
    }
  }

  if (DEAD_PATH_PATTERN.test(pathname) || DEAD_EXACT_PATHS.has(pathname)) {
    return new NextResponse("Gone", {
      status: 410,
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  // 2. Run i18n middleware first to handle redirects (e.g., / -> /en)
  const response = intlMiddleware(request);

  return response;
}

export const config = {
  matcher: [
    "/",
    "/(en|ro)/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // The pattern above excludes image-extension paths so real asset requests skip
    // the i18n middleware, but that also hides WP asset-probe URLs (e.g.
    // /wp-content/uploads/x.png) from the dead-path check above. Match those
    // prefixes explicitly, extension or not, so they still get a 410.
    "/wp-admin/:path*",
    "/wp-content/:path*",
    "/wp-includes/:path*",
    "/wp-json/:path*",
  ],
};
