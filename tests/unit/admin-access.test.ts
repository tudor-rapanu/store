import assert from "node:assert/strict";
import test from "node:test";

import { hasAdminRole, isAdminUserRecord } from "../../src/lib/auth/roles";
import { parseEnabledFlag } from "../../src/lib/admin/woocommerce-migration-access";

test("admin access accepts a role regardless of case", () => {
  assert.equal(hasAdminRole({ app_metadata: { role: "admin" } }), true);
  assert.equal(hasAdminRole({ app_metadata: { roles: ["customer", "ADMIN"] } }), true);
});

test("admin access accepts the configured fallback email regardless of case", () => {
  assert.equal(
    isAdminUserRecord({ email: "Admin@Example.com" }, "admin@example.com"),
    true,
  );
});

test("admin access rejects ordinary and missing users", () => {
  assert.equal(
    isAdminUserRecord(
      { email: "customer@example.com", app_metadata: { role: "customer" } },
      "admin@example.com",
    ),
    false,
  );
  assert.equal(isAdminUserRecord(null, "admin@example.com"), false);
});

test("WooCommerce migration is opt-in", () => {
  assert.equal(parseEnabledFlag(undefined), false);
  assert.equal(parseEnabledFlag("false"), false);
  assert.equal(parseEnabledFlag("1"), false);
  assert.equal(parseEnabledFlag(" TRUE "), true);
});
