import { readEnvValue } from "@/lib/env";
import { isAdminUserRecord } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";

export async function isAdminUser() {
  const user = await getCurrentUser();
  const adminEmail = readEnvValue(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");

  return isAdminUserRecord(user, adminEmail);
}
