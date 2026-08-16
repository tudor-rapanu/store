import {
  pgTable,
  uuid,
  text,
  integer,
  serial,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -------------------------------------------------------------------------
// TypeScript Types for strict compiler safety on JSONB Translation Objects
// -------------------------------------------------------------------------
export type TranslatedText = {
  en: string;
  ro: string;
};

export type PaymentMethod = "card" | "bank_transfer";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentCurrency = "RON" | "EUR";
export type FulfillmentStatus =
  "new" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type ShippingMethod = "address" | "easybox" | "international";
export type InvoiceStatus = "not_generated" | "generated" | "failed";
export type DiscountKind = "automatic" | "voucher";
export type DiscountType = "percentage" | "fixed";
export type DiscountScope = "storewide" | "category" | "product";
export type SizeGuideRow = {
  label: string;
  values: string[];
};

export const sizeGuides = pgTable(
  "size_guides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").unique().notNull(),
    title: jsonb("title").$type<TranslatedText>().notNull(),
    description: jsonb("description").$type<TranslatedText>(),
    imageUrl: text("image_url"),
    columns: jsonb("columns").$type<string[]>().default([]).notNull(),
    rows: jsonb("rows").$type<SizeGuideRow[]>().default([]).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("size_guides_enabled_idx").on(table.enabled),
    index("size_guides_slug_idx").on(table.slug),
  ],
);

// -------------------------------------------------------------------------
// 1. PRODUCTS TABLE
// -------------------------------------------------------------------------
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").unique().notNull(),
    // Title and description are stored as JSONB objects: { en: "...", ro: "..." }
    title: jsonb("title").$type<TranslatedText>().notNull(),
    description: jsonb("description").$type<TranslatedText>(),
    basePrice: integer("base_price").notNull(), // Stored in Bani (e.g., 4500 = 45.00 RON)
    salePrice: integer("sale_price"),
    saleEnabled: boolean("sale_enabled").default(false).notNull(),
    saleStartsAt: timestamp("sale_starts_at"),
    saleEndsAt: timestamp("sale_ends_at"),
    productionMinDays: integer("production_min_days").default(1).notNull(),
    productionMaxDays: integer("production_max_days").default(3).notNull(),
    preorderEnabled: boolean("preorder_enabled").default(false).notNull(),
    preorderShipDate: timestamp("preorder_ship_date"),
    publishAt: timestamp("publish_at"),
    publishRevalidatedAt: timestamp("publish_revalidated_at"),
    imageUrl: text("image_url"),
    isDigital: boolean("is_digital").default(false).notNull(),
    sizeGuideId: uuid("size_guide_id").references(() => sizeGuides.id, {
      onDelete: "set null",
    }),
    trackStock: boolean("track_stock").default(false).notNull(),
    stock: integer("stock").default(0).notNull(),
    isSimple: boolean("is_simple").default(true).notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("products_is_private_idx").on(table.isPrivate),
    index("products_publish_at_idx").on(table.publishAt),
    index("products_created_at_idx").on(table.createdAt),
    index("products_sale_enabled_idx").on(table.saleEnabled),
    index("products_is_digital_idx").on(table.isDigital),
    index("products_size_guide_id_idx").on(table.sizeGuideId),
    index("products_track_stock_idx").on(table.trackStock),
  ],
);

// -------------------------------------------------------------------------
// 2. PRODUCT VARIANTS TABLE (For Size / Color variations)
// -------------------------------------------------------------------------
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name"),
    sku: text("sku").unique().notNull(),
    // Attributes store configurations like: { size: "M", color: "Black" }
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull(),
    price: integer("price"),
    salePrice: integer("sale_price"),
    saleEnabled: boolean("sale_enabled").default(false).notNull(),
    saleStartsAt: timestamp("sale_starts_at"),
    saleEndsAt: timestamp("sale_ends_at"),
    priceAdjustment: integer("price_adjustment").default(0).notNull(), // Added to basePrice
    trackStock: boolean("track_stock").default(false).notNull(),
    stock: integer("stock").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_sale_enabled_idx").on(table.saleEnabled),
    index("product_variants_track_stock_idx").on(table.trackStock),
  ],
);

// -------------------------------------------------------------------------
// 3. CATEGORIES TABLE
// -------------------------------------------------------------------------
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    slug: text("slug").unique().notNull(),
    name: jsonb("name").$type<TranslatedText>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("categories_parent_id_idx").on(table.parentId),
    index("categories_created_at_idx").on(table.createdAt),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("product_categories_category_id_idx").on(table.categoryId),
  ],
);

export const digitalProductFiles = pgTable(
  "digital_product_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("digital_product_files_product_id_idx").on(table.productId)],
);

export const productDetailBlocks = pgTable(
  "product_detail_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    icon: text("icon").notNull(),
    label: jsonb("label").$type<TranslatedText>().notNull(),
    value: jsonb("value").$type<TranslatedText>().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_detail_blocks_product_id_sort_idx").on(
      table.productId,
      table.sortOrder,
    ),
    index("product_detail_blocks_enabled_idx").on(table.enabled),
  ],
);

// -------------------------------------------------------------------------
// 4. ORDERS TABLE (Wired for Netopia tracking)
// -------------------------------------------------------------------------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: serial("order_number").unique().notNull(),
    userId: text("user_id"),
    accessToken: text("access_token").unique().notNull(),
    checkoutIdempotencyKey: text("checkout_idempotency_key"),
    customerEmail: text("customer_email").notNull(),
    customerFirstName: text("customer_first_name").notNull(),
    customerLastName: text("customer_last_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: jsonb("shipping_address").notNull(), // Stores street, city, county, zip
    shippingMethod: text("shipping_method")
      .$type<ShippingMethod>()
      .default("address")
      .notNull(),
    awbNumber: text("awb_number"),
    trackingUrl: text("tracking_url"),
    awbLabelUrl: text("awb_label_url"),
    awbGeneratedAt: timestamp("awb_generated_at"),
    estimatedShippingStart: timestamp("estimated_shipping_start"),
    estimatedShippingEnd: timestamp("estimated_shipping_end"),
    samedayPickupPointId: text("sameday_pickup_point_id"),
    samedayContactPersonId: text("sameday_contact_person_id"),
    samedayServiceId: text("sameday_service_id"),
    samedayPackageType: text("sameday_package_type"),
    samedayAwbCost: integer("sameday_awb_cost"),
    samedayRawResponse: jsonb("sameday_raw_response"),
    subtotalAmount: integer("subtotal_amount").default(0).notNull(),
    discountAmount: integer("discount_amount").default(0).notNull(),
    discountSnapshot: jsonb("discount_snapshot"),
    shippingAmount: integer("shipping_amount").default(0).notNull(),
    totalAmount: integer("total_amount").notNull(), // Stored in Bani
    paymentAmount: integer("payment_amount"),
    paymentCurrency: text("payment_currency")
      .$type<PaymentCurrency>()
      .default("RON")
      .notNull(),
    currencyExchangeRate: integer("currency_exchange_rate"),
    status: text("status", { enum: ["pending", "paid", "failed"] })
      .default("pending")
      .notNull(),
    paymentMethod: text("payment_method")
      .$type<PaymentMethod>()
      .default("card")
      .notNull(),
    paymentStatus: text("payment_status")
      .$type<PaymentStatus>()
      .default("pending")
      .notNull(),
    paymentUrl: text("payment_url"),
    fulfillmentStatus: text("fulfillment_status")
      .$type<FulfillmentStatus>()
      .default("new")
      .notNull(),
    netopiaTxId: text("netopia_tx_id"), // Filled automatically when Netopia webhook fires
    adminNotes: text("admin_notes"),
    customerNotes: text("customer_notes"),
    invoiceStatus: text("invoice_status")
      .$type<InvoiceStatus>()
      .default("not_generated")
      .notNull(),
    invoiceNumber: text("invoice_number"),
    invoiceUrl: text("invoice_url"),
    fgoInvoiceId: text("fgo_invoice_id"),
    cancelRequestedAt: timestamp("cancel_requested_at"),
    stockReducedAt: timestamp("stock_reduced_at"),
    // The browser's cookie-consent choice at checkout time, persisted so the
    // async Netopia webhook can honor it when reporting payment analytics.
    analyticsConsent: text("analytics_consent").$type<"accepted" | "declined">(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("orders_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_payment_status_idx").on(table.paymentStatus),
    index("orders_fulfillment_status_idx").on(table.fulfillmentStatus),
    index("orders_payment_method_idx").on(table.paymentMethod),
    index("orders_customer_email_idx").on(table.customerEmail),
    index("orders_awb_number_idx").on(table.awbNumber),
    uniqueIndex("orders_checkout_idempotency_key_uidx").on(
      table.checkoutIdempotencyKey,
    ),
  ],
);

export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").unique(),
    kind: text("kind").$type<DiscountKind>().default("automatic").notNull(),
    type: text("type").$type<DiscountType>().notNull(),
    scope: text("scope").$type<DiscountScope>().default("storewide").notNull(),
    value: integer("value").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("discounts_kind_enabled_idx").on(table.kind, table.enabled),
    index("discounts_code_idx").on(table.code),
    index("discounts_product_id_idx").on(table.productId),
    index("discounts_category_id_idx").on(table.categoryId),
  ],
);

export const discountUsages = pgTable(
  "discount_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discountId: uuid("discount_id")
      .references(() => discounts.id, { onDelete: "cascade" })
      .notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id"),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("discount_usages_discount_email_idx").on(table.discountId, table.email),
    index("discount_usages_discount_user_idx").on(table.discountId, table.userId),
    index("discount_usages_order_id_idx").on(table.orderId),
  ],
);

export const shippingProfiles = pgTable(
  "shipping_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    method: text("method").$type<ShippingMethod>().notNull(),
    price: integer("price").notNull(),
    freeShippingThreshold: integer("free_shipping_threshold").default(15000).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("shipping_profiles_method_enabled_idx").on(table.method, table.enabled),
  ],
);

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    address: jsonb("address").$type<Record<string, unknown>>().default({}).notNull(),
    preferredShippingMethod: text("preferred_shipping_method")
      .$type<ShippingMethod>()
      .default("address")
      .notNull(),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("customer_profiles_email_idx").on(table.email)],
);

// -------------------------------------------------------------------------
// 5. ORDER ITEMS TABLE
// -------------------------------------------------------------------------
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(), // Price at time of purchase in Bani
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
    index("order_items_variant_id_idx").on(table.variantId),
  ],
);

// -------------------------------------------------------------------------
// 6. SHIPPING PROVIDER CACHE TABLES
// -------------------------------------------------------------------------
export const shippingProviderTokens = pgTable("shipping_provider_tokens", {
  provider: text("provider").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const samedayCounties = pgTable(
  "sameday_counties",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    rawData: jsonb("raw_data"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("sameday_counties_name_idx").on(table.name)],
);

export const samedayCities = pgTable(
  "sameday_cities",
  {
    id: integer("id").primaryKey(),
    countyId: integer("county_id")
      .references(() => samedayCounties.id)
      .notNull(),
    name: text("name").notNull(),
    postalCode: text("postal_code"),
    rawData: jsonb("raw_data"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sameday_cities_county_id_name_idx").on(table.countyId, table.name),
    index("sameday_cities_postal_code_idx").on(table.postalCode),
  ],
);

// -------------------------------------------------------------------------
// RELATIONS DEFINITIONS (Enables clean relational queries via Drizzle)
// -------------------------------------------------------------------------
export const productsRelations = relations(products, ({ many, one }) => ({
  variants: many(productVariants),
  productCategories: many(productCategories),
  digitalFiles: many(digitalProductFiles),
  detailBlocks: many(productDetailBlocks),
  sizeGuide: one(sizeGuides, {
    fields: [products.sizeGuideId],
    references: [sizeGuides.id],
  }),
}));

export const sizeGuidesRelations = relations(sizeGuides, ({ many }) => ({
  products: many(products),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, {
    relationName: "category_parent",
  }),
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const digitalProductFilesRelations = relations(
  digitalProductFiles,
  ({ one }) => ({
    product: one(products, {
      fields: [digitalProductFiles.productId],
      references: [products.id],
    }),
  }),
);

export const productDetailBlocksRelations = relations(
  productDetailBlocks,
  ({ one }) => ({
    product: one(products, {
      fields: [productDetailBlocks.productId],
      references: [products.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
