type RoleUser = {
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

export function hasAdminRole(user: RoleUser | null | undefined) {
  const role = user?.app_metadata?.role;
  const roles = user?.app_metadata?.roles;

  return (
    (typeof role === "string" && role.toUpperCase() === "ADMIN") ||
    (Array.isArray(roles) &&
      roles.some(
        (item) => typeof item === "string" && item.toUpperCase() === "ADMIN",
      ))
  );
}

export function isAdminUserRecord(
  user: RoleUser | null | undefined,
  adminEmail?: string,
) {
  const normalizedAdminEmail = adminEmail?.toLowerCase();

  return Boolean(
    hasAdminRole(user) ||
      (normalizedAdminEmail &&
        user?.email?.toLowerCase() === normalizedAdminEmail),
  );
}
