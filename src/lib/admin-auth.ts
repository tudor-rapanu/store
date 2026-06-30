import { readEnvValue } from "@/lib/env";
import { isAdminUserRecord } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function isAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = readEnvValue(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");

  return isAdminUserRecord(user, adminEmail);
}
