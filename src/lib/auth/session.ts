import { getAuthProvider } from "@/lib/auth/provider";

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

export async function getCurrentUser(): Promise<AppUser | null> {
  if (getAuthProvider() === "neon") {
    const { getNeonAuth } = await import("@/lib/auth/neon/server");
    const { data: session } = await getNeonAuth().getSession();

    return mapNeonUser(session?.user);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
