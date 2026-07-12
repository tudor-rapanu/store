import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

// 1. Initialize the i18n middleware
const intlMiddleware = createMiddleware({
  locales: ["en", "ro"],
  defaultLocale: "en",
});

export async function proxy(request: NextRequest) {
  // 2. Run i18n middleware first to handle redirects (e.g., / -> /en)
  const response = intlMiddleware(request);

  return response;
}

export const config = {
  matcher: [
    "/",
    "/(en|ro)/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
