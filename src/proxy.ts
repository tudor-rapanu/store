import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getAuthProvider } from "@/lib/auth/provider";
import { isAdminUserRecord } from "@/lib/auth/roles";
import { readEnvValue } from "@/lib/env";

// 1. Initialize the i18n middleware
const intlMiddleware = createMiddleware({
  locales: ["en", "ro"],
  defaultLocale: "en",
});

export async function proxy(request: NextRequest) {
  // 2. Run i18n middleware first to handle redirects (e.g., / -> /en)
  const response = intlMiddleware(request);
  let user = null;

  if (getAuthProvider() === "supabase") {
    // Keep Supabase auth cookies in sync for every page request. This lets the
    // server-rendered navbar reflect expired sessions on the next navigation.
    const supabase = createServerClient(
      readEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        "NEXT_PUBLIC_SUPABASE_URL",
      ),
      readEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const result = await supabase.auth.getUser();
    user = result.data.user;
  }

  // 3. Extract the pathname to check for admin routes
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.match(/^\/(en|ro)\/admin/);

  if (isAdminRoute && getAuthProvider() === "supabase") {
    const adminEmail = readEnvValue(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");

    if (!isAdminUserRecord(user, adminEmail)) {
      const locale = pathname.split("/")[1] || "en";
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/(en|ro)/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
