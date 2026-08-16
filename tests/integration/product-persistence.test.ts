import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import type { ParsedProductForm } from "../../src/lib/admin/product-form";

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

function createProductForm({
  slug,
  sku,
  title = "Integration product",
  categoryNames = [],
}: {
  slug: string;
  sku: string;
  title?: string;
  categoryNames?: string[];
}): ParsedProductForm {
  return {
    titleEn: title,
    titleRo: title,
    descriptionEn: "Created by the product persistence integration test.",
    descriptionRo: "Created by the product persistence integration test.",
    slug,
    price: 100,
    basePrice: 10_000,
    salePrice: null,
    saleEnabled: false,
    saleStartsAt: null,
    saleEndsAt: null,
    productionMinDays: 1,
    productionMaxDays: 3,
    preorderEnabled: false,
    preorderShipDate: null,
    publishAt: null,
    isDigital: true,
    sizeGuideId: null,
    trackStock: false,
    stock: 0,
    isPrivate: true,
    categoryNames,
    variants: [
      {
        name: "Test variant",
        sku,
        attributes: { Test: "Integration" },
        price: 100,
        salePrice: null,
        saleEnabled: false,
        saleStartsAt: null,
        saleEndsAt: null,
        trackStock: true,
        stock: 1,
      },
    ],
    detailBlocks: [
      {
        icon: "package",
        label: { en: "Test", ro: "Test" },
        value: { en: "Original", ro: "Original" },
        enabled: true,
      },
    ],
    shouldWaitForPublishRevalidation: false,
  };
}

test(
  "product create and update operations roll back all related records on failure",
  { skip: skipReason, timeout: 90_000 },
  async () => {
    if (
      !databaseWritesEnabled ||
      !testDatabaseUrl ||
      testDatabaseUrl === configuredDatabaseUrl
    ) {
      throw new Error(
        "Explicit write permission and a separate TEST_DATABASE_URL are required.",
      );
    }

    process.env.DATABASE_URL = getPostgresJsConnectionString(testDatabaseUrl);
    process.env.DATABASE_MAX_CONNECTIONS = "1";

    const [{ eq, inArray, sql }, { db }, schema, persistence] = await Promise.all([
      import("drizzle-orm"),
      import("../../src/lib/db"),
      import("../../src/lib/db/schema"),
      import("../../src/lib/admin/product-persistence"),
    ]);
    const existingProductId = crypto.randomUUID();
    const blockerProductId = crypto.randomUUID();
    const failedProductId = crypto.randomUUID();
    const suffix = crypto.randomUUID();
    const duplicateSku = `integration-${suffix}`;
    const blockerSku = `integration-blocker-${suffix}`;
    const failedCreateCategory = `Integration failed create ${suffix}`;
    const failedUpdateCategory = `Integration failed update ${suffix}`;
    const failedCategorySlugs = [
      `integration-failed-create-${suffix}`,
      `integration-failed-update-${suffix}`,
    ];
    let connected = false;

    try {
      console.info("[integration] Connecting to the isolated test database...");
      await withTimeout(
        db.execute(sql`select 1`),
        15_000,
        "The test database did not accept a connection within 15 seconds.",
      );
      connected = true;
      console.info("[integration] Connection succeeded; testing create rollback...");

      await persistence.createProductRecord({
        productId: existingProductId,
        productForm: createProductForm({
          slug: `integration-existing-${suffix}`,
          sku: duplicateSku,
        }),
        imageUrl: "/integration/existing.webp",
        digitalFiles: [
          {
            fileName: "existing.txt",
            storageKey: `integration/${suffix}/existing.txt`,
            contentType: "text/plain",
            fileSize: 8,
          },
        ],
      });
      await assert.rejects(
        persistence.createProductRecord({
          productId: failedProductId,
          productForm: createProductForm({
            slug: `integration-failed-${suffix}`,
            sku: duplicateSku,
            categoryNames: [failedCreateCategory],
          }),
          imageUrl: "/integration/failed.webp",
          digitalFiles: [
            {
              fileName: "failed.txt",
              storageKey: `integration/${suffix}/failed.txt`,
              contentType: "text/plain",
              fileSize: 6,
            },
          ],
        }),
      );

      const [failedProduct, failedDigitalFile, failedDetailBlock, failedCategory] =
        await Promise.all([
          db
            .select({ id: schema.products.id })
            .from(schema.products)
            .where(eq(schema.products.id, failedProductId)),
          db
            .select({ id: schema.digitalProductFiles.id })
            .from(schema.digitalProductFiles)
            .where(eq(schema.digitalProductFiles.productId, failedProductId)),
          db
            .select({ id: schema.productDetailBlocks.id })
            .from(schema.productDetailBlocks)
            .where(eq(schema.productDetailBlocks.productId, failedProductId)),
          db
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(eq(schema.categories.slug, failedCategorySlugs[0])),
        ]);

      assert.deepEqual(failedProduct, []);
      assert.deepEqual(failedDigitalFile, []);
      assert.deepEqual(failedDetailBlock, []);
      assert.deepEqual(failedCategory, []);
      console.info("[integration] Create rollback passed; testing update rollback...");

      await persistence.createProductRecord({
        productId: blockerProductId,
        productForm: createProductForm({
          slug: `integration-blocker-${suffix}`,
          sku: blockerSku,
        }),
        imageUrl: "/integration/blocker.webp",
        digitalFiles: [],
      });

      await assert.rejects(
        persistence.updateProductRecord({
          productId: existingProductId,
          productForm: createProductForm({
            slug: `integration-changed-${suffix}`,
            sku: blockerSku,
            title: "This update must roll back",
            categoryNames: [failedUpdateCategory],
          }),
          imageUrl: "/integration/changed.webp",
          digitalFiles: [
            {
              fileName: "changed.txt",
              storageKey: `integration/${suffix}/changed.txt`,
              contentType: "text/plain",
              fileSize: 7,
            },
          ],
        }),
      );

      const [persistedProduct] = await db
        .select({
          imageUrl: schema.products.imageUrl,
          slug: schema.products.slug,
          title: schema.products.title,
        })
        .from(schema.products)
        .where(eq(schema.products.id, existingProductId));
      const persistedDigitalFiles = await db
        .select({ storageKey: schema.digitalProductFiles.storageKey })
        .from(schema.digitalProductFiles)
        .where(eq(schema.digitalProductFiles.productId, existingProductId));
      const persistedDetails = await db
        .select({ value: schema.productDetailBlocks.value })
        .from(schema.productDetailBlocks)
        .where(eq(schema.productDetailBlocks.productId, existingProductId));
      const failedUpdateCategories = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.slug, failedCategorySlugs[1]));

      assert.ok(persistedProduct);
      assert.equal(persistedProduct.slug, `integration-existing-${suffix}`);
      assert.equal(persistedProduct.imageUrl, "/integration/existing.webp");
      assert.deepEqual(persistedProduct.title, {
        en: "Integration product",
        ro: "Integration product",
      });
      assert.deepEqual(persistedDigitalFiles, [
        { storageKey: `integration/${suffix}/existing.txt` },
      ]);
      assert.deepEqual(persistedDetails, [
        { value: { en: "Original", ro: "Original" } },
      ]);
      assert.deepEqual(failedUpdateCategories, []);
      console.info("[integration] Update rollback passed; cleaning up test records...");
    } finally {
      try {
        if (connected) {
          await withTimeout(
            (async () => {
              await Promise.allSettled([
                db
                  .delete(schema.products)
                  .where(eq(schema.products.id, existingProductId)),
                db
                  .delete(schema.products)
                  .where(eq(schema.products.id, blockerProductId)),
                db
                  .delete(schema.products)
                  .where(eq(schema.products.id, failedProductId)),
              ]);
              await db
                .delete(schema.categories)
                .where(inArray(schema.categories.slug, failedCategorySlugs));
            })(),
            15_000,
            "Timed out while cleaning up integration-test records.",
          );
        }
      } finally {
        await db.$client.end({ timeout: 1 });
      }
    }
  },
);
