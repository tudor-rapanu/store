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
  | "new"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";
export type ShippingMethod = "address" | "easybox" | "international";
export type InvoiceStatus = "not_generated" | "generated" | "failed";

// -------------------------------------------------------------------------
// 1. PRODUCTS TABLE
// -------------------------------------------------------------------------
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  // Title and description are stored as JSONB objects: { en: "...", ro: "..." }
  title: jsonb("title").$type<TranslatedText>().notNull(),
  description: jsonb("description").$type<TranslatedText>(),
  basePrice: integer("base_price").notNull(), // Stored in Bani (e.g., 4500 = 45.00 RON)
  imageUrl: text("image_url"),
  isSimple: boolean("is_simple").default(true).notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("products_is_private_idx").on(table.isPrivate),
  index("products_created_at_idx").on(table.createdAt),
]);

// -------------------------------------------------------------------------
// 2. PRODUCT VARIANTS TABLE (For Size / Color variations)
// -------------------------------------------------------------------------
export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  sku: text("sku").unique().notNull(),
  // Attributes store configurations like: { size: "M", color: "Black" }
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull(),
  price: integer("price"),
  priceAdjustment: integer("price_adjustment").default(0).notNull(), // Added to basePrice
  stock: integer("stock").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("product_variants_product_id_idx").on(table.productId),
]);

// -------------------------------------------------------------------------
// 3. CATEGORIES TABLE
// -------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  name: jsonb("name").$type<TranslatedText>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

// -------------------------------------------------------------------------
// 4. ORDERS TABLE (Wired for Netopia tracking)
// -------------------------------------------------------------------------
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: serial("order_number").unique().notNull(),
  userId: text("user_id"),
  accessToken: text("access_token").unique().notNull(),
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
  samedayPickupPointId: text("sameday_pickup_point_id"),
  samedayContactPersonId: text("sameday_contact_person_id"),
  samedayServiceId: text("sameday_service_id"),
  samedayPackageType: text("sameday_package_type"),
  samedayAwbCost: integer("sameday_awb_cost"),
  samedayRawResponse: jsonb("sameday_raw_response"),
  subtotalAmount: integer("subtotal_amount").default(0).notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("orders_user_id_created_at_idx").on(table.userId, table.createdAt),
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_payment_status_idx").on(table.paymentStatus),
  index("orders_fulfillment_status_idx").on(table.fulfillmentStatus),
  index("orders_payment_method_idx").on(table.paymentMethod),
  index("orders_customer_email_idx").on(table.customerEmail),
  index("orders_awb_number_idx").on(table.awbNumber),
]);

export const shippingProfiles = pgTable("shipping_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").$type<ShippingMethod>().notNull(),
  price: integer("price").notNull(),
  freeShippingThreshold: integer("free_shipping_threshold")
    .default(15000)
    .notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("shipping_profiles_method_enabled_idx").on(table.method, table.enabled),
]);

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerProfiles = pgTable("customer_profiles", {
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
}, (table) => [
  index("customer_profiles_email_idx").on(table.email),
]);

// -------------------------------------------------------------------------
// 5. ORDER ITEMS TABLE
// -------------------------------------------------------------------------
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // Price at time of purchase in Bani
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_product_id_idx").on(table.productId),
  index("order_items_variant_id_idx").on(table.variantId),
]);

// -------------------------------------------------------------------------
// 6. SHIPPING PROVIDER CACHE TABLES
// -------------------------------------------------------------------------
export const shippingProviderTokens = pgTable("shipping_provider_tokens", {
  provider: text("provider").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const samedayCounties = pgTable("sameday_counties", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  rawData: jsonb("raw_data"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("sameday_counties_name_idx").on(table.name),
]);

export const samedayCities = pgTable("sameday_cities", {
  id: integer("id").primaryKey(),
  countyId: integer("county_id")
    .references(() => samedayCounties.id)
    .notNull(),
  name: text("name").notNull(),
  postalCode: text("postal_code"),
  rawData: jsonb("raw_data"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("sameday_cities_county_id_name_idx").on(table.countyId, table.name),
  index("sameday_cities_postal_code_idx").on(table.postalCode),
]);

// -------------------------------------------------------------------------
// RELATIONS DEFINITIONS (Enables clean relational queries via Drizzle)
// -------------------------------------------------------------------------
export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  productCategories: many(productCategories),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  }),
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  productCategories: many(productCategories),
}));

export const productCategoriesRelations = relations(
  productCategories,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategories.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategories.categoryId],
      references: [categories.id],
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
