import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  ],
};
