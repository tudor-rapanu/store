export type AuthProvider = "supabase" | "neon";

export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "neon" ? "neon" : "supabase";
}
