import { cache } from "react";

import { readEnvValue } from "@/lib/env";

export type AppUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  app_metadata?: Record<string, unknown>;
};

function mapNeonUser(user: unknown): AppUser | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const record = user as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;

  if (!id) {
    return null;
  }

  const role = record.role;
  const createdAt =
    typeof record.created_at === "string"
      ? record.created_at
      : typeof record.createdAt === "string"
        ? record.createdAt
        : undefined;

  return {
    id,
    email: typeof record.email === "string" ? record.email : null,
    created_at: createdAt,
    app_metadata:
      typeof role === "string" || Array.isArray(role)
        ? { role, roles: Array.isArray(role) ? role : [role] }
        : {},
  };
}

// Memoized per-request: without this, every caller on a page (Navbar, the
// page itself, admin auth guards, ...) independently re-hits the external
// Neon Auth endpoint, multiplying the chance that one flaky/slow call makes
// an otherwise-logged-in admin look logged out mid-navigation.
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await getReadonlyNeonSession();

  return mapNeonUser(session?.user);
});

async function getReadonlyNeonSession(): Promise<{ user?: unknown } | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .filter((cookie) => isNeonAuthCookie(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (!cookieHeader.includes("neon-auth.session_token")) {
    return null;
  }

  const baseUrl = readEnvValue(process.env.NEON_AUTH_BASE_URL, "NEON_AUTH_BASE_URL");
  const sessionUrl = new URL("get-session", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  // One retry: a single timed-out or dropped connection to the external
  // auth endpoint shouldn't be enough to bounce an admin to the homepage.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(sessionUrl, {
        headers: { Cookie: cookieHeader },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json().catch(() => null)) as
        { user?: unknown } | { data?: { user?: unknown } } | null;

      if (payload && "data" in payload) {
        return payload.data ?? null;
      }

      if (payload && "user" in payload) {
        return payload;
      }

      return null;
    } catch (error) {
      if (attempt === 1) {
        console.error("Neon Auth session check failed after retry:", error);
        return null;
      }
    }
  }

  return null;
}

function isNeonAuthCookie(name: string) {
  return (
    name.startsWith("__Secure-neon-auth") ||
    name.startsWith("neon-auth")
  );
}
