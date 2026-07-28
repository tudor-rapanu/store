import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { readEnvValue } from "@/lib/env";

let neonAuth: NeonAuth | null = null;

export function getNeonAuth() {
  if (!neonAuth) {
    neonAuth = createNeonAuth({
      baseUrl: readEnvValue(process.env.NEON_AUTH_BASE_URL, "NEON_AUTH_BASE_URL"),
      cookies: {
        secret: readEnvValue(
          process.env.NEON_AUTH_COOKIE_SECRET,
          "NEON_AUTH_COOKIE_SECRET",
        ),
        sameSite: "lax",
      },
    });
  }

  return neonAuth;
}
