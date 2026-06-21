import { createBrowserClient } from "@supabase/ssr";
import { readEnvValue } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    readEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    readEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  );
}
