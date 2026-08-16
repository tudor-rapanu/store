import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { getNeonAuth } from "@/lib/auth/neon/server";
import { db } from "@/lib/db";
import { customerProfiles, orders } from "@/lib/db/schema";
import {
  parseWooCommerceCustomerCsvs,
  type WooCommerceCustomer,
} from "@/lib/admin/woocommerce-customers-csv";

const AUTH_PAGE_SIZE = 100;
const IMPORT_CHUNK_LIMIT = 20;

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type WooCommerceCustomerImportPreview = {
  customerIds: number[];
  customers: number;
  accountsToCreate: number;
  existingAccounts: number;
  profilesToCreate: number;
  existingProfiles: number;
  orderMappings: number;
  ordersReadyToLink: number;
  ordersAlreadyLinked: number;
  missingImportedOrders: number;
  conflictingOrders: number;
  skippedAdminMappings: number;
  warnings: string[];
  canImport: boolean;
};

export type WooCommerceCustomerImportResult = {
  requested: number;
  accountsCreated: number;
  accountsReused: number;
  profilesCreated: number;
  profilesUnchanged: number;
  ordersLinked: number;
  ordersAlreadyLinked: number;
  missingImportedOrders: number;
  conflictingOrders: number;
  errors: string[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getWooOrderKey(wooOrderId: number) {
  return `woocommerce-order-${wooOrderId}`;
}

function getCustomerName(customer: WooCommerceCustomer) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    customer.displayName ||
    customer.email
  );
}

function getAuthErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "Unknown Neon Auth error";
  }

  return "Unknown Neon Auth error";
}

async function listAuthUsers(): Promise<AuthUser[]> {
  const auth = getNeonAuth();
  const users: AuthUser[] = [];
  let offset = 0;

  while (true) {
    const response = await auth.admin.listUsers({
      query: { limit: AUTH_PAGE_SIZE, offset },
    });

    if (response.error) {
      throw new Error(
        `Neon Auth admin access is required: ${getAuthErrorMessage(response.error)}. Ensure this administrator has the Neon Auth admin role.`,
      );
    }

    const page = response.data?.users ?? [];
    users.push(
      ...page.map((user) => ({ id: user.id, email: user.email, name: user.name })),
    );

    const total = response.data?.total ?? users.length;
    if (page.length === 0 || users.length >= total) {
      break;
    }

    offset += page.length;
  }

  return users;
}

function indexAuthUsers(users: AuthUser[]) {
  return new Map(users.map((user) => [normalizeEmail(user.email), user]));
}

async function findAuthUserByEmail(email: string) {
  const response = await getNeonAuth().admin.listUsers({
    query: {
      searchValue: email,
      searchField: "email",
      searchOperator: "contains",
      limit: 20,
      offset: 0,
    },
  });

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error));
  }

  return (response.data?.users ?? []).find(
    (user) => normalizeEmail(user.email) === normalizeEmail(email),
  );
}

async function createOrReuseAuthUser(
  customer: WooCommerceCustomer,
  usersByEmail: Map<string, AuthUser>,
) {
  const existing = usersByEmail.get(customer.email);
  if (existing) {
    return { user: existing, created: false };
  }

  const response = await getNeonAuth().admin.createUser({
    email: customer.email,
    name: getCustomerName(customer),
    role: "user",
    // WordPress password hashes are deliberately not imported. The password is
    // unknown to everyone and customers must use the reset-password flow.
    password: `${randomBytes(32).toString("base64url")}Aa1!`,
  });

  if (response.data?.user) {
    const user = response.data.user;
    usersByEmail.set(customer.email, user);
    return { user, created: true };
  }

  // A previous interrupted run may have created the account before local data
  // was written. Resolve that race by looking up and reusing the exact email.
  const racedUser = await findAuthUserByEmail(customer.email);
  if (racedUser) {
    usersByEmail.set(customer.email, racedUser);
    return { user: racedUser, created: false };
  }

  throw new Error(getAuthErrorMessage(response.error));
}

export async function getWooCommerceCustomerImportPreview(
  customerCsv: string,
  orderMappingCsv: string,
): Promise<WooCommerceCustomerImportPreview> {
  const parsed = parseWooCommerceCustomerCsvs(customerCsv, orderMappingCsv);
  const authUsers = await listAuthUsers();
  const usersByEmail = indexAuthUsers(authUsers);
  const existingUserIds = parsed.customers
    .map((customer) => usersByEmail.get(customer.email)?.id)
    .filter((id): id is string => Boolean(id));
  const existingProfiles =
    existingUserIds.length > 0
      ? await db
          .select({ userId: customerProfiles.userId })
          .from(customerProfiles)
          .where(inArray(customerProfiles.userId, existingUserIds))
      : [];
  const profilesByUserId = new Set(existingProfiles.map((profile) => profile.userId));
  const orderKeys = parsed.mappings.map((mapping) =>
    getWooOrderKey(mapping.wooOrderId),
  );
  const importedOrders =
    orderKeys.length > 0
      ? await db
          .select({
            checkoutIdempotencyKey: orders.checkoutIdempotencyKey,
            userId: orders.userId,
          })
          .from(orders)
          .where(inArray(orders.checkoutIdempotencyKey, orderKeys))
      : [];
  const ordersByKey = new Map(
    importedOrders.map((order) => [order.checkoutIdempotencyKey, order]),
  );
  let ordersReadyToLink = 0;
  let ordersAlreadyLinked = 0;
  let missingImportedOrders = 0;
  let conflictingOrders = 0;

  for (const mapping of parsed.mappings) {
    const order = ordersByKey.get(getWooOrderKey(mapping.wooOrderId));
    const customer = parsed.customers.find(
      (item) => item.legacyUserId === mapping.legacyUserId,
    );
    const expectedUserId = customer
      ? (usersByEmail.get(customer.email)?.id ?? null)
      : null;

    if (!order) {
      missingImportedOrders += 1;
    } else if (!order.userId) {
      ordersReadyToLink += 1;
    } else if (expectedUserId && order.userId === expectedUserId) {
      ordersAlreadyLinked += 1;
    } else {
      conflictingOrders += 1;
    }
  }

  const existingAccounts = parsed.customers.filter((customer) =>
    usersByEmail.has(customer.email),
  ).length;
  const existingProfileCount = parsed.customers.filter((customer) => {
    const userId = usersByEmail.get(customer.email)?.id;
    return userId ? profilesByUserId.has(userId) : false;
  }).length;
  const warnings = [...parsed.warnings];

  if (missingImportedOrders > 0) {
    warnings.push(
      `${missingImportedOrders} mapped order(s) are not present in the storefront and cannot be linked yet.`,
    );
  }

  if (conflictingOrders > 0) {
    warnings.push(
      `${conflictingOrders} order(s) already belong to another account and will not be changed.`,
    );
  }

  return {
    customerIds: parsed.customers.map((customer) => customer.legacyUserId),
    customers: parsed.customers.length,
    accountsToCreate: parsed.customers.length - existingAccounts,
    existingAccounts,
    profilesToCreate: parsed.customers.length - existingProfileCount,
    existingProfiles: existingProfileCount,
    orderMappings: parsed.mappings.length,
    ordersReadyToLink,
    ordersAlreadyLinked,
    missingImportedOrders,
    conflictingOrders,
    skippedAdminMappings: parsed.skippedAdminMappings,
    warnings,
    canImport: parsed.customers.length > 0,
  };
}

export async function importWooCommerceCustomers(
  customerCsv: string,
  orderMappingCsv: string,
  legacyUserIds: number[],
): Promise<WooCommerceCustomerImportResult> {
  const parsed = parseWooCommerceCustomerCsvs(customerCsv, orderMappingCsv);
  const uniqueIds = Array.from(new Set(legacyUserIds));

  if (uniqueIds.length === 0 || uniqueIds.length > IMPORT_CHUNK_LIMIT) {
    throw new Error(
      `Each import request must contain between 1 and ${IMPORT_CHUNK_LIMIT} customer IDs.`,
    );
  }

  const requestedIds = new Set(uniqueIds);
  const customers = parsed.customers.filter((customer) =>
    requestedIds.has(customer.legacyUserId),
  );

  if (customers.length !== requestedIds.size) {
    throw new Error(
      "The requested customer IDs do not match the validated customers CSV.",
    );
  }

  const mappingsByCustomer = new Map<number, typeof parsed.mappings>();
  for (const mapping of parsed.mappings) {
    const current = mappingsByCustomer.get(mapping.legacyUserId) ?? [];
    current.push(mapping);
    mappingsByCustomer.set(mapping.legacyUserId, current);
  }

  const usersByEmail = indexAuthUsers(await listAuthUsers());
  const result: WooCommerceCustomerImportResult = {
    requested: customers.length,
    accountsCreated: 0,
    accountsReused: 0,
    profilesCreated: 0,
    profilesUnchanged: 0,
    ordersLinked: 0,
    ordersAlreadyLinked: 0,
    missingImportedOrders: 0,
    conflictingOrders: 0,
    errors: [],
  };

  for (const customer of customers) {
    try {
      const authResult = await createOrReuseAuthUser(customer, usersByEmail);
      if (authResult.created) result.accountsCreated += 1;
      else result.accountsReused += 1;

      const customerMappings = mappingsByCustomer.get(customer.legacyUserId) ?? [];
      const customerResult = await db.transaction(async (transaction) => {
        const now = new Date();
        const createdProfiles = await transaction
          .insert(customerProfiles)
          .values({
            userId: authResult.user.id,
            email: customer.email,
            firstName: customer.firstName || null,
            lastName: customer.lastName || null,
            phone: customer.phone || null,
            address: customer.address,
            preferredShippingMethod: "address",
            marketingOptIn: false,
            createdAt: customer.registeredAt ?? now,
            updatedAt: now,
          })
          // A rerun must not replace profile details a customer may have edited
          // after migration.
          .onConflictDoNothing({ target: customerProfiles.userId })
          .returning({ userId: customerProfiles.userId });
        let ordersLinked = 0;
        let ordersAlreadyLinked = 0;
        let missingImportedOrders = 0;
        let conflictingOrders = 0;

        for (const mapping of customerMappings) {
          const key = getWooOrderKey(mapping.wooOrderId);
          const [order] = await transaction
            .select({ id: orders.id, userId: orders.userId })
            .from(orders)
            .where(eq(orders.checkoutIdempotencyKey, key))
            .limit(1);

          if (!order) {
            missingImportedOrders += 1;
            continue;
          }

          if (order.userId === authResult.user.id) {
            ordersAlreadyLinked += 1;
            continue;
          }

          if (order.userId) {
            conflictingOrders += 1;
            continue;
          }

          const linked = await transaction
            .update(orders)
            .set({ userId: authResult.user.id, updatedAt: now })
            .where(
              and(
                eq(orders.id, order.id),
                isNull(orders.userId),
                eq(orders.checkoutIdempotencyKey, key),
              ),
            )
            .returning({ id: orders.id });

          if (linked.length > 0) ordersLinked += 1;
          else conflictingOrders += 1;
        }

        return {
          profileCreated: createdProfiles.length > 0,
          ordersLinked,
          ordersAlreadyLinked,
          missingImportedOrders,
          conflictingOrders,
        };
      });
      if (customerResult.profileCreated) result.profilesCreated += 1;
      else result.profilesUnchanged += 1;
      result.ordersLinked += customerResult.ordersLinked;
      result.ordersAlreadyLinked += customerResult.ordersAlreadyLinked;
      result.missingImportedOrders += customerResult.missingImportedOrders;
      result.conflictingOrders += customerResult.conflictingOrders;
    } catch (error) {
      result.errors.push(
        `${customer.email}: ${error instanceof Error ? error.message : "Import failed."}`,
      );
    }
  }

  return result;
}
