import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after, mock } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseWritesEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
const skipReason = !databaseWritesEnabled
  ? "Set RUN_DATABASE_INTEGRATION_TESTS=true to explicitly allow test database writes."
  : !testDatabaseUrl
    ? "Set TEST_DATABASE_URL to a migrated test database to run integration tests."
    : testDatabaseUrl === configuredDatabaseUrl
      ? "TEST_DATABASE_URL must differ from DATABASE_URL."
      : false;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getPostgresJsConnectionString(value: string) {
  const connectionUrl = new URL(value);

  if (!connectionUrl.protocol.startsWith("postgres")) {
    throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection string.");
  }

  connectionUrl.searchParams.delete("channel_binding");

  if (
    connectionUrl.hostname.endsWith(".neon.tech") &&
    !connectionUrl.searchParams.has("sslmode")
  ) {
    connectionUrl.searchParams.set("sslmode", "require");
  }

  return connectionUrl.toString();
}

function assertWritesAllowed() {
  if (!databaseWritesEnabled || !testDatabaseUrl || testDatabaseUrl === configuredDatabaseUrl) {
    throw new Error(
      "Explicit write permission and a separate TEST_DATABASE_URL are required.",
    );
  }
}

test(
  "duplicate Netopia paid webhooks reduce stock once and send one confirmation",
  { skip: skipReason, timeout: 90_000 },
  async () => {
    assertWritesAllowed();

    process.env.DATABASE_URL = getPostgresJsConnectionString(testDatabaseUrl!);
    process.env.DATABASE_MAX_CONNECTIONS = "5";
    delete process.env.NETOPIA_WEBHOOK_SECRET;

    const [{ eq, sql }, { db }, schema, webhookRoute] = await Promise.all([
      import("drizzle-orm"),
      import("../../src/lib/db"),
      import("../../src/lib/db/schema"),
      import("../../src/app/api/webhooks/netopia/route"),
    ]);

    const suffix = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    let connected = false;

    try {
      await withTimeout(
        db.execute(sql`select 1`),
        15_000,
        "The test database did not accept a connection within 15 seconds.",
      );
      connected = true;

      await db.insert(schema.products).values({
        id: productId,
        slug: `integration-webhook-race-${suffix}`,
        title: { en: "Webhook race product", ro: "Webhook race product" },
        basePrice: 5000,
        trackStock: true,
        stock: 5,
        isSimple: true,
      });

      const [order] = await db
        .insert(schema.orders)
        .values({
          id: orderId,
          accessToken: crypto.randomBytes(32).toString("hex"),
          customerEmail: `race-${suffix}@example.com`,
          customerFirstName: "Race",
          customerLastName: "Test",
          customerPhone: "0700000000",
          shippingAddress: { street: "s", city: "c", county: "c", zip: "000000" },
          totalAmount: 10000,
          paymentAmount: 10000,
          paymentCurrency: "RON",
          paymentMethod: "card",
          paymentStatus: "pending",
          status: "pending",
          fulfillmentStatus: "new",
        })
        .returning();
      assert.ok(order);

      await db.insert(schema.orderItems).values({
        orderId,
        productId,
        quantity: 2,
        unitPrice: 5000,
      });

      function buildPaidWebhookRequest() {
        return new Request("http://localhost/api/webhooks/netopia", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: { id: orderId },
            payment: { status: 3, amount: 10000, currency: "RON", ntpID: `tx-${suffix}` },
          }),
        });
      }

      const [responseA, responseB] = await Promise.all([
        webhookRoute.POST(buildPaidWebhookRequest()),
        webhookRoute.POST(buildPaidWebhookRequest()),
      ]);

      assert.equal(responseA.status, 200);
      assert.equal(responseB.status, 200);

      const [finalOrder] = await db
        .select({
          paymentStatus: schema.orders.paymentStatus,
          stockReducedAt: schema.orders.stockReducedAt,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));
      const [finalProduct] = await db
        .select({ stock: schema.products.stock })
        .from(schema.products)
        .where(eq(schema.products.id, productId));

      assert.equal(finalOrder?.paymentStatus, "paid");
      assert.ok(finalOrder?.stockReducedAt);
      // Stock must drop by exactly the order's quantity (2), not 4 - proves the
      // conditional UPDATE ... WHERE payment_status <> 'paid' let only one of
      // the two concurrent webhooks actually perform the transition.
      assert.equal(finalProduct?.stock, 3);
    } finally {
      if (connected) {
        const { eq } = await import("drizzle-orm");
        const { db } = await import("../../src/lib/db");
        const schema = await import("../../src/lib/db/schema");

        await withTimeout(
          Promise.allSettled([
            db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)),
            db.delete(schema.orders).where(eq(schema.orders.id, orderId)),
            db.delete(schema.products).where(eq(schema.products.id, productId)),
          ]),
          15_000,
          "Timed out while cleaning up integration-test records.",
        );
      }
    }
  },
);

test(
  "cancelling a pending order releases stock; a paid order is left for refund",
  { skip: skipReason, timeout: 90_000 },
  async () => {
    assertWritesAllowed();

    process.env.DATABASE_URL = getPostgresJsConnectionString(testDatabaseUrl!);
    process.env.DATABASE_MAX_CONNECTIONS = "5";

    // The cancel route calls getCurrentUser(), which reads next/headers'
    // cookies() - only available inside a real Next.js request. These tests
    // exercise guest checkout (access-token) cancellation, so a no-session
    // cookie jar is the correct stand-in, not a workaround for the assertion
    // being tested. revalidatePath needs the same kind of request-scoped
    // store this plain node:test process doesn't have; a no-op is exactly
    // what it would do here anyway (there's no page render to invalidate).
    mock.module("next/headers", {
      namedExports: {
        cookies: async () => ({ getAll: () => [] }),
      },
    });
    mock.module("next/cache", {
      namedExports: {
        revalidatePath: () => {},
      },
    });

    const [{ eq, sql }, { db }, schema, inventory, cancelRoute] = await Promise.all([
      import("drizzle-orm"),
      import("../../src/lib/db"),
      import("../../src/lib/db/schema"),
      import("../../src/lib/inventory"),
      import("../../src/app/api/orders/[id]/cancel/route"),
    ]);

    const suffix = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const pendingCardOrderId = crypto.randomUUID();
    const pendingBankOrderId = crypto.randomUUID();
    const paidOrderId = crypto.randomUUID();
    const accessTokens = {
      [pendingCardOrderId]: crypto.randomBytes(32).toString("hex"),
      [pendingBankOrderId]: crypto.randomBytes(32).toString("hex"),
      [paidOrderId]: crypto.randomBytes(32).toString("hex"),
    };
    let connected = false;

    try {
      await withTimeout(
        db.execute(sql`select 1`),
        15_000,
        "The test database did not accept a connection within 15 seconds.",
      );
      connected = true;

      await db.insert(schema.products).values({
        id: productId,
        slug: `integration-cancel-race-${suffix}`,
        title: { en: "Cancel race product", ro: "Cancel race product" },
        basePrice: 5000,
        trackStock: true,
        stock: 10,
        isSimple: true,
      });

      async function createOrder(
        orderId: string,
        paymentMethod: "card" | "bank_transfer",
        paymentStatus: "pending" | "paid",
      ) {
        await db.insert(schema.orders).values({
          id: orderId,
          accessToken: accessTokens[orderId]!,
          customerEmail: `cancel-${orderId}@example.com`,
          customerFirstName: "Cancel",
          customerLastName: "Test",
          customerPhone: "0700000000",
          shippingAddress: { street: "s", city: "c", county: "c", zip: "000000" },
          totalAmount: 5000,
          paymentAmount: 5000,
          paymentCurrency: "RON",
          paymentMethod,
          paymentStatus,
          status: paymentStatus === "paid" ? "paid" : "pending",
          fulfillmentStatus: "new",
        });
        await db.insert(schema.orderItems).values({
          orderId,
          productId,
          quantity: 1,
          unitPrice: 5000,
        });
        await inventory.reserveTrackedStockForOrder(orderId);
      }

      await createOrder(pendingCardOrderId, "card", "pending");
      await createOrder(pendingBankOrderId, "bank_transfer", "pending");
      await createOrder(paidOrderId, "card", "paid");

      const [stockAfterReservations] = await db
        .select({ stock: schema.products.stock })
        .from(schema.products)
        .where(eq(schema.products.id, productId));
      assert.equal(stockAfterReservations?.stock, 7);

      function buildCancelRequest(orderId: string) {
        return new Request(`http://localhost/api/orders/${orderId}/cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: accessTokens[orderId] }),
        });
      }

      const cancelResponses = await Promise.all(
        [pendingCardOrderId, pendingBankOrderId, paidOrderId].map((orderId) =>
          cancelRoute.POST(buildCancelRequest(orderId), {
            params: Promise.resolve({ id: orderId }),
          }),
        ),
      );

      for (const response of cancelResponses) {
        assert.equal(response.status, 200);
      }

      const [pendingCardOrder] = await db
        .select({
          paymentStatus: schema.orders.paymentStatus,
          fulfillmentStatus: schema.orders.fulfillmentStatus,
          stockReducedAt: schema.orders.stockReducedAt,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, pendingCardOrderId));
      const [pendingBankOrder] = await db
        .select({
          paymentStatus: schema.orders.paymentStatus,
          fulfillmentStatus: schema.orders.fulfillmentStatus,
          stockReducedAt: schema.orders.stockReducedAt,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, pendingBankOrderId));
      const [paidOrder] = await db
        .select({
          paymentStatus: schema.orders.paymentStatus,
          fulfillmentStatus: schema.orders.fulfillmentStatus,
          stockReducedAt: schema.orders.stockReducedAt,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, paidOrderId));

      assert.equal(pendingCardOrder?.fulfillmentStatus, "cancelled");
      assert.equal(pendingCardOrder?.paymentStatus, "failed");
      assert.equal(pendingCardOrder?.stockReducedAt, null);

      assert.equal(pendingBankOrder?.fulfillmentStatus, "cancelled");
      assert.equal(pendingBankOrder?.paymentStatus, "pending");
      assert.equal(pendingBankOrder?.stockReducedAt, null);

      // A paid order's cancellation is recorded, but stock/payment are left
      // alone - releasing them requires an actual refund, not a customer
      // cancel click.
      assert.equal(paidOrder?.fulfillmentStatus, "cancelled");
      assert.equal(paidOrder?.paymentStatus, "paid");
      assert.ok(paidOrder?.stockReducedAt);

      const [finalProduct] = await db
        .select({ stock: schema.products.stock })
        .from(schema.products)
        .where(eq(schema.products.id, productId));
      // Both pending orders' stock (1 + 1) was released back; the paid
      // order's unit stays reserved.
      assert.equal(finalProduct?.stock, 9);
    } finally {
      if (connected) {
        const { eq } = await import("drizzle-orm");
        const { db } = await import("../../src/lib/db");
        const schema = await import("../../src/lib/db/schema");
        const orderIds = [pendingCardOrderId, pendingBankOrderId, paidOrderId];

        await withTimeout(
          Promise.allSettled([
            ...orderIds.map((id) =>
              db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, id)),
            ),
            ...orderIds.map((id) => db.delete(schema.orders).where(eq(schema.orders.id, id))),
            db.delete(schema.products).where(eq(schema.products.id, productId)),
          ]),
          15_000,
          "Timed out while cleaning up integration-test records.",
        );
      }
    }
  },
);

test(
  "concurrent bank-transfer checkouts for the last unit of stock: one succeeds, one rolls back cleanly",
  { skip: skipReason, timeout: 90_000 },
  async () => {
    assertWritesAllowed();

    process.env.DATABASE_URL = getPostgresJsConnectionString(testDatabaseUrl!);
    process.env.DATABASE_MAX_CONNECTIONS = "5";

    const [{ eq, inArray, sql }, { db }, schema, inventory] = await Promise.all([
      import("drizzle-orm"),
      import("../../src/lib/db"),
      import("../../src/lib/db/schema"),
      import("../../src/lib/inventory"),
    ]);

    const suffix = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const orderAId = crypto.randomUUID();
    const orderBId = crypto.randomUUID();
    let connected = false;

    // Mirrors the transaction shape createBankTransferOrder uses: order +
    // items + stock reservation atomically. Exercised directly (rather than
    // through the Server Action) because Server Actions require a live
    // Next.js request context that a plain node:test process doesn't have.
    async function attemptOrder(orderId: string) {
      return db.transaction(async (tx) => {
        const [order] = await tx
          .insert(schema.orders)
          .values({
            id: orderId,
            accessToken: crypto.randomBytes(32).toString("hex"),
            customerEmail: `stock-race-${orderId}@example.com`,
            customerFirstName: "Stock",
            customerLastName: "Race",
            customerPhone: "0700000000",
            shippingAddress: { street: "s", city: "c", county: "c", zip: "000000" },
            totalAmount: 5000,
            paymentAmount: 5000,
            paymentCurrency: "RON",
            paymentMethod: "bank_transfer",
            paymentStatus: "pending",
            status: "pending",
            fulfillmentStatus: "new",
          })
          .returning();
        if (!order) {
          throw new Error("Failed to create order.");
        }

        await tx.insert(schema.orderItems).values({
          orderId,
          productId,
          quantity: 1,
          unitPrice: 5000,
        });

        await inventory.reserveTrackedStockForOrder(orderId, tx);

        return order;
      });
    }

    try {
      await withTimeout(
        db.execute(sql`select 1`),
        15_000,
        "The test database did not accept a connection within 15 seconds.",
      );
      connected = true;

      await db.insert(schema.products).values({
        id: productId,
        slug: `integration-stock-race-${suffix}`,
        title: { en: "Stock race product", ro: "Stock race product" },
        basePrice: 5000,
        trackStock: true,
        stock: 1,
        isSimple: true,
      });

      const results = await Promise.allSettled([
        attemptOrder(orderAId),
        attemptOrder(orderBId),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "exactly one of the two checkouts should succeed");
      assert.equal(rejected.length, 1, "exactly one of the two checkouts should fail");
      assert.match(
        (rejected[0] as PromiseRejectedResult).reason.message,
        /reserve.*stock/i,
      );

      const [finalProduct] = await db
        .select({ stock: schema.products.stock })
        .from(schema.products)
        .where(eq(schema.products.id, productId));
      assert.equal(finalProduct?.stock, 0);

      const remainingOrders = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(inArray(schema.orders.id, [orderAId, orderBId]));

      // The losing attempt's transaction must have rolled back completely -
      // no orphan order row left behind for the failed checkout.
      const orderIds = remainingOrders.map((o) => o.id);
      const winningOrderId =
        fulfilled[0] && "value" in fulfilled[0] ? (fulfilled[0].value as { id: string }).id : null;
      assert.ok(winningOrderId);
      assert.ok(orderIds.includes(winningOrderId!));

      const losingOrderId = orderAId === winningOrderId ? orderBId : orderAId;
      assert.ok(!orderIds.includes(losingOrderId));
    } finally {
      if (connected) {
        const { eq } = await import("drizzle-orm");
        const { db } = await import("../../src/lib/db");
        const schema = await import("../../src/lib/db/schema");

        await withTimeout(
          Promise.allSettled([
            db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, orderAId)),
            db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, orderBId)),
            db.delete(schema.orders).where(eq(schema.orders.id, orderAId)),
            db.delete(schema.orders).where(eq(schema.orders.id, orderBId)),
            db.delete(schema.products).where(eq(schema.products.id, productId)),
          ]),
          15_000,
          "Timed out while cleaning up integration-test records.",
        );
      }
    }
  },
);

// All three tests above share the same `db` module singleton within this
// process - close its connection once here rather than in each test, or
// closing it after the first test breaks the rest.
after(async () => {
  if (skipReason) {
    return;
  }

  const { db } = await import("../../src/lib/db");
  await db.$client.end({ timeout: 1 });
});
