"use server";

import crypto from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "@/lib/db";
import { orderItems, orders, products, productVariants } from "@/lib/db/schema";
import { createNetopiaClient } from "@/lib/payments/netopia";
import { sendAdminOrderEmail, sendOrderEmail } from "@/lib/email";
import {
  isRomaniaCountry,
  normalizeCheckoutCountry,
} from "@/lib/geo/checkout-countries";
import { getPostHogClient } from "@/lib/posthog-server";
import { calculateShippingAmount } from "@/lib/shipping/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  upsertCustomerProfile,
  upsertCustomerProfileContact,
} from "@/lib/customer-profile";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { formatEur, formatRon, normalizePaymentCurrency } from "@/lib/currency/format";
import { getCurrencySettings } from "@/lib/currency/settings";
import { recordVoucherUsage, resolveBestDiscount } from "@/lib/discounts";
import { publicProductWhere, revalidateCatalogCache } from "@/lib/catalog/cache";
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from "@/lib/product-pricing";
import { getCartFulfillmentEstimate } from "@/lib/fulfillment/estimate";
import { enqueueOrderEmailTask } from "@/lib/tasks/order-email";
import {
  failPendingOrderPayment,
  InsufficientStockError,
  reserveTrackedStockForOrder,
} from "@/lib/inventory";

// 1. Define strict types for the incoming customer data
export interface CheckoutAddress {
  street: string;
  city: string;
  county: string;
  zip: string;
  countryCode?: string;
  countryName?: string;
  samedayCityId?: string;
  samedayCountyId?: string;
  samedayLockerId?: string;
  samedayLockerName?: string;
  samedayLockerAddress?: string;
  samedayLockerCityId?: string;
  samedayLockerCity?: string;
  samedayLockerCountyId?: string;
  samedayLockerCounty?: string;
  samedayLockerPostalCode?: string;
  samedayLockerOohType?: number;
}

export interface CheckoutCustomerData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: CheckoutAddress;
  shippingMethod: "address" | "easybox" | "international";
  paymentCurrency?: "RON" | "EUR";
  voucherCode?: string;
  saveProfileAddress?: boolean;
  checkoutIdempotencyKey?: string;
}

export interface CheckoutCartItem {
  productId?: string;
  variantId: string;
  price: number;
  quantity: number;
}

type ResolvedOrderItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
};

type CreatedOrder = typeof orders.$inferSelect;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getValidatedString(
  value: unknown,
  fieldName: string,
  { min = 1, max }: { min?: number; max: number },
) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min || trimmed.length > max) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return trimmed;
}

function getOptionalValidatedString(value: unknown, fieldName: string, max: number) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return getValidatedString(value, fieldName, { min: 1, max });
}

function getOptionalNumericId(value: unknown, fieldName: string) {
  const stringValue = getOptionalValidatedString(value, fieldName, 32);

  if (!stringValue) {
    return undefined;
  }

  if (!NUMERIC_ID_PATTERN.test(stringValue)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return stringValue;
}

function getOptionalUuid(value: unknown, fieldName: string) {
  const stringValue = getOptionalValidatedString(value, fieldName, 80);

  if (!stringValue) {
    return undefined;
  }

  if (!UUID_PATTERN.test(stringValue)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return stringValue;
}

function isCheckoutIdempotencyConflict(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  const constraint = error.constraint;
  const message = error.message;

  return (
    error.code === "23505" &&
    ((typeof constraint === "string" &&
      constraint === "orders_checkout_idempotency_key_uidx") ||
      (typeof message === "string" &&
        message.includes("orders_checkout_idempotency_key_uidx")))
  );
}

function validateShippingMethod(
  shippingMethod: unknown,
): asserts shippingMethod is "address" | "easybox" | "international" {
  if (
    shippingMethod !== "address" &&
    shippingMethod !== "easybox" &&
    shippingMethod !== "international"
  ) {
    throw new Error("Select a valid shipping method.");
  }
}

function validateShippingCountryMatch(
  isDigitalOnly: boolean,
  countryCode: string,
  shippingMethod: string,
): void {
  if (!isDigitalOnly && countryCode === "RO" && shippingMethod === "international") {
    throw new Error("Select a valid Romanian shipping method.");
  }

  if (!isDigitalOnly && countryCode !== "RO" && shippingMethod !== "international") {
    throw new Error("International orders must use international shipping.");
  }
}

function validateCheckoutCustomerData(
  customerData: CheckoutCustomerData,
  options: { isDigitalOnly?: boolean } = {},
): CheckoutCustomerData {
  if (!isRecord(customerData) || !isRecord(customerData.address)) {
    throw new Error("Checkout details are invalid.");
  }
  const isDigitalOnly = options.isDigitalOnly === true;

  const email = getValidatedString(customerData.email, "Email", {
    max: 254,
  }).toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const shippingMethod = customerData.shippingMethod;
  validateShippingMethod(shippingMethod);

  const countryCode = normalizeCheckoutCountry(customerData.address.countryCode);
  const paymentCurrency = normalizePaymentCurrency(customerData.paymentCurrency);

  validateShippingCountryMatch(isDigitalOnly, countryCode, shippingMethod);

  const firstName = getValidatedString(customerData.firstName, "First name", {
    max: 80,
  });
  const lastName = getValidatedString(customerData.lastName, "Last name", {
    max: 80,
  });
  const phone = getValidatedString(customerData.phone, "Phone number", {
    max: 32,
  });
  const street = isDigitalOnly
    ? (getOptionalValidatedString(customerData.address.street, "Address", 240) ??
      "Digital delivery")
    : getValidatedString(customerData.address.street, "Address", {
        max: 240,
      });
  const city = isDigitalOnly
    ? (getOptionalValidatedString(customerData.address.city, "City", 120) ?? "Digital")
    : getValidatedString(customerData.address.city, "City", {
        max: 120,
      });
  const county = isDigitalOnly
    ? (getOptionalValidatedString(customerData.address.county, "County", 120) ??
      "Digital")
    : getValidatedString(customerData.address.county, "County", {
        max: 120,
      });
  const zip = isDigitalOnly
    ? (getOptionalValidatedString(customerData.address.zip, "Postal code", 20) ??
      "000000")
    : getValidatedString(customerData.address.zip, "Postal code", {
        max: 20,
      });

  return {
    email,
    firstName,
    lastName,
    phone,
    shippingMethod,
    paymentCurrency,
    voucherCode: getOptionalValidatedString(
      customerData.voucherCode,
      "Voucher code",
      64,
    ),
    saveProfileAddress: customerData.saveProfileAddress === true,
    checkoutIdempotencyKey: getOptionalUuid(
      customerData.checkoutIdempotencyKey,
      "Checkout attempt",
    ),
    address: {
      street,
      city,
      county,
      zip,
      countryCode,
      countryName:
        getOptionalValidatedString(customerData.address.countryName, "Country", 120) ??
        (countryCode === "RO" ? "Romania" : countryCode),
      samedayCityId:
        !isDigitalOnly && isRomaniaCountry(countryCode)
          ? getOptionalNumericId(customerData.address.samedayCityId, "Sameday city")
          : undefined,
      samedayCountyId:
        !isDigitalOnly && isRomaniaCountry(countryCode)
          ? getOptionalNumericId(customerData.address.samedayCountyId, "Sameday county")
          : undefined,
      samedayLockerId: getOptionalNumericId(
        customerData.address.samedayLockerId,
        "Sameday locker",
      ),
      samedayLockerName: getOptionalValidatedString(
        customerData.address.samedayLockerName,
        "Sameday locker name",
        160,
      ),
      samedayLockerAddress: getOptionalValidatedString(
        customerData.address.samedayLockerAddress,
        "Sameday locker address",
        240,
      ),
      samedayLockerCityId: getOptionalNumericId(
        customerData.address.samedayLockerCityId,
        "Sameday locker city",
      ),
      samedayLockerCity: getOptionalValidatedString(
        customerData.address.samedayLockerCity,
        "Sameday locker city name",
        120,
      ),
      samedayLockerCountyId: getOptionalNumericId(
        customerData.address.samedayLockerCountyId,
        "Sameday locker county",
      ),
      samedayLockerCounty: getOptionalValidatedString(
        customerData.address.samedayLockerCounty,
        "Sameday locker county name",
        120,
      ),
      samedayLockerPostalCode: getOptionalValidatedString(
        customerData.address.samedayLockerPostalCode,
        "Sameday locker postal code",
        20,
      ),
      samedayLockerOohType:
        customerData.address.samedayLockerOohType === 0 ||
        customerData.address.samedayLockerOohType === 1
          ? customerData.address.samedayLockerOohType
          : undefined,
    },
  };
}

function resolvePaymentAmount(orderTotalRonBani: number) {
  return {
    paymentAmount: orderTotalRonBani,
    paymentCurrency: "RON" as const,
    currencyExchangeRate: null,
  };
}

async function getNetopiaDescription(
  orderNumber: number,
  orderTotalRonBani: number,
  displayCurrency: "RON" | "EUR",
) {
  if (displayCurrency !== "EUR") {
    return `Todd's Threads - Order TT-${orderNumber} - ${formatRon(orderTotalRonBani)}`;
  }

  const settings = await getCurrencySettings();
  if (!settings?.ronToEurRate) {
    console.error("Invalid currency settings:", settings);
    return `Todd's Threads - Order TT-${orderNumber} - ${formatRon(orderTotalRonBani)}`;
  }

  return `Todd's Threads - Order TT-${orderNumber} - ${formatEur(orderTotalRonBani, settings.ronToEurRate)} / ${formatRon(orderTotalRonBani)}`;
}

// 2. Define a custom interface to patch the missing Netopia types
interface NetopiaClientWorkaround {
  setOrderData(orderData: {
    amount: number;
    billing: {
      city: string;
      details: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      postalCode: string;
      state: string;
    };
    currency: string;
    description: string;
    orderID: string;
  }): void;
  startPayment(): Promise<{
    payment?: { paymentURL?: string };
  }>;
}

function createOrderAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function getCurrentUserId() {
  const user = await getCurrentUser();

  return user?.id ?? null;
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function getOrderAccessUrl(
  locale: "en" | "ro",
  orderNumber: number,
  accessToken: string,
) {
  const siteUrl = getSiteUrl();
  const path = `/${locale}/orders/${orderNumber}?token=${accessToken}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

function getAdminOrderUrl(locale: "en" | "ro", orderId: string) {
  const siteUrl = getSiteUrl();
  const path = `/${locale}/admin/orders/${orderId}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

async function getExistingCheckoutOrder(
  idempotencyKey: string | undefined,
  paymentMethod: "card" | "bank_transfer",
) {
  if (!idempotencyKey) {
    return null;
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      paymentUrl: orders.paymentUrl,
    })
    .from(orders)
    .where(
      and(
        eq(orders.checkoutIdempotencyKey, idempotencyKey),
        eq(orders.paymentMethod, paymentMethod),
      ),
    )
    .limit(1);

  return order ?? null;
}

function getExistingCardCheckoutResponse(
  order: Awaited<ReturnType<typeof getExistingCheckoutOrder>>,
) {
  if (!order) {
    return null;
  }

  if (order.paymentStatus === "paid") {
    return { error: "This checkout attempt was already paid." };
  }

  if (order.paymentStatus === "failed") {
    return { error: "This checkout attempt already failed. Please try again." };
  }

  return order.paymentUrl
    ? { url: order.paymentUrl }
    : { error: "This checkout attempt is already being prepared. Please wait." };
}

function getExistingBankTransferCheckoutResponse(
  order: Awaited<ReturnType<typeof getExistingCheckoutOrder>>,
  locale: "en" | "ro",
) {
  if (!order) {
    return null;
  }

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderUrl: getOrderAccessUrl(locale, order.orderNumber, order.accessToken),
  };
}

function getCartQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
    throw new Error("Cart contains an invalid quantity.");
  }

  return quantity;
}

function normalizeCartItem(item: unknown): {
  productId: string;
  variantId: string;
  quantity: number;
} {
  if (!isRecord(item)) {
    throw new Error("Cart contents are invalid.");
  }

  const productId =
    typeof item.productId === "string" ? item.productId.trim() : undefined;
  const variantId =
    typeof item.variantId === "string" ? item.variantId.trim() : undefined;
  const resolvedProductId = productId ?? variantId;

  if (
    !resolvedProductId ||
    !variantId ||
    !UUID_PATTERN.test(resolvedProductId) ||
    !UUID_PATTERN.test(variantId)
  ) {
    throw new Error("Cart contains an invalid product.");
  }

  return {
    productId: resolvedProductId,
    variantId,
    quantity: getCartQuantity(item.quantity),
  };
}

function validateProductIds(
  product: typeof products.$inferSelect | undefined,
  isSimpleProduct: boolean,
): asserts product is typeof products.$inferSelect {
  if (!product) {
    throw new Error("One of the products in your cart is no longer available.");
  }

  if (isSimpleProduct && !product.isSimple) {
    throw new Error("Select a valid product variant.");
  }
}

function resolveVariantDetails(
  product: typeof products.$inferSelect,
  isSimpleProduct: boolean,
  variantId: string,
  variantById: Map<string, typeof productVariants.$inferSelect>,
) {
  if (isSimpleProduct) {
    return {
      variantId: null as string | null,
      unitPrice: getEffectiveProductPrice(product),
      stock: product.trackStock ? product.stock : null,
    };
  }

  const variant = variantById.get(variantId);

  if (variant?.productId !== product.id) {
    throw new Error("One of the selected variants is no longer available.");
  }

  return {
    variantId: variant.id,
    unitPrice: getEffectiveVariantPrice(product, variant),
    stock: variant.trackStock ? variant.stock : null,
  };
}

function validateItemPrice(unitPrice: number) {
  if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
    throw new Error("One of the products in your cart has an invalid price.");
  }
}

function validateItemStock(stock: number | null, nextQuantity: number) {
  if (stock !== null && nextQuantity > stock) {
    throw new Error("One of the products in your cart is no longer in stock.");
  }
}

async function resolveCheckoutCart(cartItems: CheckoutCartItem[]) {
  if (!Array.isArray(cartItems) || cartItems.length > 50) {
    throw new Error("Cart contents are invalid.");
  }

  const normalizedItems = cartItems.map(normalizeCartItem);

  if (normalizedItems.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const productIds = Array.from(new Set(normalizedItems.map((item) => item.productId)));
  const variantIds = Array.from(
    new Set(
      normalizedItems
        .filter((item) => item.variantId !== item.productId)
        .map((item) => item.variantId),
    ),
  );

  const productRows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, productIds), publicProductWhere()));
  const productById = new Map(productRows.map((product) => [product.id, product]));

  const variantRows =
    variantIds.length > 0
      ? await db
          .select()
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : [];
  const variantById = new Map(variantRows.map((variant) => [variant.id, variant]));
  const resolvedByKey = new Map<string, ResolvedOrderItem>();

  for (const item of normalizedItems) {
    const product = productById.get(item.productId);
    const isSimpleProduct = item.variantId === item.productId;

    validateProductIds(product, isSimpleProduct);

    const { variantId, unitPrice, stock } = resolveVariantDetails(
      product,
      isSimpleProduct,
      item.variantId,
      variantById,
    );

    validateItemPrice(unitPrice);

    const key = `${product.id}:${variantId ?? product.id}`;
    const existing = resolvedByKey.get(key);
    const nextQuantity = (existing?.quantity ?? 0) + item.quantity;

    validateItemStock(stock, nextQuantity);

    resolvedByKey.set(key, {
      productId: product.id,
      variantId,
      quantity: nextQuantity,
      unitPrice,
    });
  }

  const items = Array.from(resolvedByKey.values());
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const fulfillmentProducts = Array.from(
    new Set(items.map((item) => item.productId)),
  ).flatMap((productId) => {
    const product = productById.get(productId);

    return product ? [product] : [];
  });
  const physicalFulfillmentProducts = fulfillmentProducts.filter(
    (product) => !product.isDigital,
  );
  const hasPhysicalItems = physicalFulfillmentProducts.length > 0;
  const fulfillmentEstimate = hasPhysicalItems
    ? getCartFulfillmentEstimate(physicalFulfillmentProducts)
    : null;

  return { items, subtotal, fulfillmentEstimate, hasPhysicalItems };
}

async function saveCheckoutProfile(
  userId: string | null,
  customerData: CheckoutCustomerData,
) {
  if (!userId) {
    return;
  }

  if (!customerData.saveProfileAddress || customerData.shippingMethod === "easybox") {
    await upsertCustomerProfileContact({
      userId,
      email: customerData.email,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
    });
    return;
  }

  await upsertCustomerProfile({
    userId,
    email: customerData.email,
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    phone: customerData.phone,
    address: {
      street: customerData.address.street,
      city: customerData.address.city,
      county: customerData.address.county,
      zip: customerData.address.zip,
      countryCode: customerData.address.countryCode,
      countryName: customerData.address.countryName,
      samedayCityId: customerData.address.samedayCityId,
      samedayCountyId: customerData.address.samedayCountyId,
    },
    preferredShippingMethod: "address",
  });
}

async function createCardOrder(
  tx: DbTransaction,
  userId: string | null,
  customerData: CheckoutCustomerData,
  resolvedCart: Awaited<ReturnType<typeof resolveCheckoutCart>>,
  discount: Awaited<ReturnType<typeof resolveBestDiscount>>,
  shippingAmount: number,
  analyticsConsent?: "accepted" | "declined",
) {
  const discountedSubtotal = Math.max(
    resolvedCart.subtotal - discount.discountAmount,
    0,
  );
  const orderTotal = discountedSubtotal + shippingAmount;
  const payment = resolvePaymentAmount(orderTotal);

  const [createdOrder] = await tx
    .insert(orders)
    .values({
      userId,
      accessToken: createOrderAccessToken(),
      checkoutIdempotencyKey: customerData.checkoutIdempotencyKey,
      customerEmail: customerData.email,
      customerFirstName: customerData.firstName,
      customerLastName: customerData.lastName,
      customerPhone: customerData.phone,
      shippingAddress: customerData.address,
      shippingMethod: resolvedCart.hasPhysicalItems
        ? customerData.shippingMethod
        : "address",
      subtotalAmount: resolvedCart.subtotal,
      discountAmount: discount.discountAmount,
      discountSnapshot: discount.discountSnapshot,
      shippingAmount,
      totalAmount: orderTotal,
      estimatedShippingStart: resolvedCart.fulfillmentEstimate?.start ?? null,
      estimatedShippingEnd: resolvedCart.fulfillmentEstimate?.end ?? null,
      paymentAmount: payment.paymentAmount,
      paymentCurrency: payment.paymentCurrency,
      currencyExchangeRate: payment.currencyExchangeRate,
      status: "pending",
      paymentMethod: "card",
      paymentStatus: "pending",
      fulfillmentStatus: "new",
      analyticsConsent: analyticsConsent ?? null,
    })
    .returning();

  if (!createdOrder) {
    throw new Error("Failed to create order.");
  }

  return { order: createdOrder, orderTotal, payment };
}

async function handleIdempotentCardOrderCreation(
  checkoutIdempotencyKey: string | undefined,
) {
  const existingCheckout = await getExistingCheckoutOrder(
    checkoutIdempotencyKey,
    "card",
  );
  return getExistingCardCheckoutResponse(existingCheckout);
}

async function initializeNetopiaPayment(
  newOrder: CreatedOrder,
  customerData: CheckoutCustomerData,
  payment: ReturnType<typeof resolvePaymentAmount>,
  orderTotal: number,
  locale: "en" | "ro",
) {
  const client = createNetopiaClient(
    `/${locale}`,
    newOrder.id,
  ) as NetopiaClientWorkaround;
  const netopiaDescription = await getNetopiaDescription(
    newOrder.orderNumber,
    orderTotal,
    customerData.paymentCurrency ?? "RON",
  );

  client.setOrderData({
    amount: payment.paymentAmount / 100,
    billing: {
      city: customerData.address.city,
      details: customerData.address.street,
      email: customerData.email,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      postalCode: customerData.address.zip,
      state: customerData.address.county,
    },
    currency: payment.paymentCurrency,
    description: netopiaDescription,
    orderID: newOrder.id,
  });

  return client.startPayment();
}

async function processNetopiaPayment({
  newOrder,
  customerData,
  payment,
  orderTotal,
  locale,
  resolvedCart,
  discount,
  shippingAmount,
  analyticsConsent,
}: {
  newOrder: CreatedOrder;
  customerData: CheckoutCustomerData;
  payment: ReturnType<typeof resolvePaymentAmount>;
  orderTotal: number;
  locale: "en" | "ro";
  resolvedCart: Awaited<ReturnType<typeof resolveCheckoutCart>>;
  discount: Awaited<ReturnType<typeof resolveBestDiscount>>;
  shippingAmount: number;
  analyticsConsent?: "accepted" | "declined";
}) {
  try {
    const result = await initializeNetopiaPayment(
      newOrder,
      customerData,
      payment,
      orderTotal,
      locale,
    );

    const paymentUrl = result?.payment?.paymentURL;

    if (!paymentUrl) {
      throw new Error("Unable to initialize Netopia payment.");
    }

    return await handleSuccessfulPayment({
      newOrder,
      paymentUrl,
      customerData,
      orderTotal,
      resolvedCart,
      discount,
      shippingAmount,
      payment,
      locale,
      analyticsConsent,
    });
  } catch (error) {
    // Clean up: mark order as failed and release reserved stock
    console.error(
      "Netopia payment initialization failed for orderId:",
      newOrder.id,
      error,
    );
    await failPendingOrderPayment(newOrder.id);
    // Re-throw so the caller knows an error occurred but doesn't duplicate cleanup
    throw new Error("Payment initialization failed");
  }
}

async function handleSuccessfulPayment({
  newOrder,
  paymentUrl,
  customerData,
  orderTotal,
  resolvedCart,
  discount,
  shippingAmount,
  payment,
  locale,
  analyticsConsent,
}: {
  newOrder: CreatedOrder;
  paymentUrl: string;
  customerData: CheckoutCustomerData;
  orderTotal: number;
  resolvedCart: Awaited<ReturnType<typeof resolveCheckoutCart>>;
  discount: Awaited<ReturnType<typeof resolveBestDiscount>>;
  shippingAmount: number;
  payment: ReturnType<typeof resolvePaymentAmount>;
  locale: "en" | "ro";
  analyticsConsent?: "accepted" | "declined";
}) {
  await db
    .update(orders)
    .set({
      paymentUrl,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, newOrder.id));

  void enqueueOrderEmailTask({ orderId: newOrder.id, type: "admin", locale }, () =>
    sendAdminOrderEmail({
      orderId: `TT-${newOrder.orderNumber}`,
      customerName: `${customerData.firstName} ${customerData.lastName}`,
      customerEmail: customerData.email,
      totalAmount: orderTotal,
      paymentMethod: "card",
      adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
    }),
  ).catch((error) => {
    console.error(
      "Failed to enqueue admin card payment email for orderId:",
      newOrder.id,
      error,
    );
  });

  const posthog = getPostHogClient();
  // Only capture analytics if consent is provided
  if (posthog && analyticsConsent === "accepted") {
    // Use anonymized distinctId instead of email
    const distinctId = crypto
      .createHash("sha256")
      .update(customerData.email)
      .digest("hex");

    posthog.capture({
      distinctId,
      event: "checkout_initiated",
      properties: {
        order_id: newOrder.id,
        order_number: newOrder.orderNumber,
        payment_method: "netopia",
        cart_total: resolvedCart.subtotal,
        discount_amount: discount.discountAmount,
        discount: discount.discountSnapshot,
        shipping_amount: shippingAmount,
        order_total: orderTotal,
        payment_amount: payment.paymentAmount,
        currency: payment.paymentCurrency,
        order_currency: "RON",
        locale,
      },
    });
  }

  return { url: paymentUrl };
}

export async function initiateCheckout(
  _cartSubtotal: number,
  customerData: CheckoutCustomerData,
  locale: "en" | "ro" = "en",
  cartItems: CheckoutCartItem[] = [],
  analyticsConsent?: "accepted" | "declined",
): Promise<{ url: string } | { error: string }> {
  try {
    const rateLimit = await checkServerActionRateLimit({
      keyPrefix: "checkout:netopia",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return { error: "Too many checkout attempts. Please try again shortly." };
    }

    const userId = await getCurrentUserId();
    const resolvedCart = await resolveCheckoutCart(cartItems);
    customerData = validateCheckoutCustomerData(customerData, {
      isDigitalOnly: !resolvedCart.hasPhysicalItems,
    });

    const existingCheckoutResponse = await handleIdempotentCardOrderCreation(
      customerData.checkoutIdempotencyKey,
    );
    if (existingCheckoutResponse) {
      return existingCheckoutResponse;
    }

    const discount = await resolveBestDiscount({
      items: resolvedCart.items,
      email: customerData.email,
      userId,
      voucherCode: customerData.voucherCode,
    });

    let newOrder: CreatedOrder;
    let orderTotal: number;
    let payment: ReturnType<typeof resolvePaymentAmount>;
    const discountedSubtotal = Math.max(
      resolvedCart.subtotal - discount.discountAmount,
      0,
    );
    const shippingAmount = resolvedCart.hasPhysicalItems
      ? await calculateShippingAmount(customerData.shippingMethod, discountedSubtotal)
      : 0;

    // Create the order, its items, the stock reservation, and the voucher usage
    // record in one transaction so a failure anywhere rolls back the whole checkout
    // instead of leaving an orphan order behind.
    try {
      const result = await db.transaction(async (tx) => {
        const created = await createCardOrder(
          tx,
          userId,
          customerData,
          resolvedCart,
          discount,
          shippingAmount,
          analyticsConsent,
        );

        await tx.insert(orderItems).values(
          resolvedCart.items.map((item) => ({
            orderId: created.order.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        );

        await reserveTrackedStockForOrder(created.order.id, tx);

        await recordVoucherUsage(
          {
            discountSnapshot: discount.discountSnapshot,
            orderId: created.order.id,
            userId,
            email: customerData.email,
          },
          tx,
        );

        return created;
      });

      newOrder = result.order;
      orderTotal = result.orderTotal;
      payment = result.payment;
      revalidateCatalogCache();
    } catch (error: unknown) {
      if (error instanceof InsufficientStockError) {
        return { error: "One of the products in your cart is no longer in stock." };
      }

      if (isCheckoutIdempotencyConflict(error)) {
        const existingCheckoutResponse = await handleIdempotentCardOrderCreation(
          customerData.checkoutIdempotencyKey,
        );

        if (existingCheckoutResponse) {
          return existingCheckoutResponse;
        }
      }

      throw error;
    }

    // Best-effort: a profile save failure shouldn't invalidate an already-persisted order.
    try {
      await saveCheckoutProfile(userId, customerData);
    } catch (error) {
      console.error("Failed to save checkout profile for orderId:", newOrder.id, error);
    }

    return await processNetopiaPayment({
      newOrder,
      customerData,
      payment,
      orderTotal,
      locale,
      resolvedCart,
      discount,
      shippingAmount,
      analyticsConsent,
    });
  } catch (error: unknown) {
    console.error("Checkout Order Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create order.";
    return { error: errorMessage };
  }
}

export async function createBankTransferOrder(
  _cartSubtotal: number,
  customerData: CheckoutCustomerData,
  locale: "en" | "ro" = "en",
  cartItems: CheckoutCartItem[] = [],
  analyticsConsent?: "accepted" | "declined",
) {
  try {
    const rateLimit = await checkServerActionRateLimit({
      keyPrefix: "checkout:bank-transfer",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return { error: "Too many checkout attempts. Please try again shortly." };
    }

    const userId = await getCurrentUserId();
    const resolvedCart = await resolveCheckoutCart(cartItems);
    customerData = validateCheckoutCustomerData(customerData, {
      isDigitalOnly: !resolvedCart.hasPhysicalItems,
    });
    const existingCheckout = await getExistingCheckoutOrder(
      customerData.checkoutIdempotencyKey,
      "bank_transfer",
    );
    const existingCheckoutResponse = getExistingBankTransferCheckoutResponse(
      existingCheckout,
      locale,
    );

    if (existingCheckoutResponse) {
      return existingCheckoutResponse;
    }

    const discount = await resolveBestDiscount({
      items: resolvedCart.items,
      email: customerData.email,
      userId,
      voucherCode: customerData.voucherCode,
    });
    const discountedSubtotal = Math.max(
      resolvedCart.subtotal - discount.discountAmount,
      0,
    );
    const shippingAmount = resolvedCart.hasPhysicalItems
      ? await calculateShippingAmount(customerData.shippingMethod, discountedSubtotal)
      : 0;
    const orderTotal = discountedSubtotal + shippingAmount;
    const payment = resolvePaymentAmount(orderTotal);
    let newOrder: CreatedOrder;

    // Create the order, its items, the stock reservation, and the voucher usage
    // record in one transaction so a failure anywhere rolls back the whole checkout
    // instead of leaving an orphan order behind.
    try {
      newOrder = await db.transaction(async (tx) => {
        const [createdOrder] = await tx
          .insert(orders)
          .values({
            userId,
            accessToken: createOrderAccessToken(),
            checkoutIdempotencyKey: customerData.checkoutIdempotencyKey,
            customerEmail: customerData.email,
            customerFirstName: customerData.firstName,
            customerLastName: customerData.lastName,
            customerPhone: customerData.phone,
            // If a locker is selected, it will be passed inside the street/city fields
            shippingAddress: customerData.address,
            shippingMethod: resolvedCart.hasPhysicalItems
              ? customerData.shippingMethod
              : "address",
            subtotalAmount: resolvedCart.subtotal,
            discountAmount: discount.discountAmount,
            discountSnapshot: discount.discountSnapshot,
            shippingAmount,
            totalAmount: orderTotal,
            estimatedShippingStart: resolvedCart.fulfillmentEstimate?.start ?? null,
            estimatedShippingEnd: resolvedCart.fulfillmentEstimate?.end ?? null,
            paymentAmount: payment.paymentAmount,
            paymentCurrency: payment.paymentCurrency,
            currencyExchangeRate: payment.currencyExchangeRate,
            status: "pending", // You can track this manually until the wire hits your bank
            paymentMethod: "bank_transfer",
            paymentStatus: "pending",
            fulfillmentStatus: "new",
            analyticsConsent: analyticsConsent ?? null,
          })
          .returning();

        if (!createdOrder) {
          throw new Error("Failed to create order.");
        }

        await tx.insert(orderItems).values(
          resolvedCart.items.map((item) => ({
            orderId: createdOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        );

        await reserveTrackedStockForOrder(createdOrder.id, tx);

        await recordVoucherUsage(
          {
            discountSnapshot: discount.discountSnapshot,
            orderId: createdOrder.id,
            userId,
            email: customerData.email,
          },
          tx,
        );

        return createdOrder;
      });
      revalidateCatalogCache();
    } catch (error: unknown) {
      if (error instanceof InsufficientStockError) {
        return { error: "One of the products in your cart is no longer in stock." };
      }

      if (isCheckoutIdempotencyConflict(error)) {
        const existingCheckoutResponse = getExistingBankTransferCheckoutResponse(
          await getExistingCheckoutOrder(
            customerData.checkoutIdempotencyKey,
            "bank_transfer",
          ),
          locale,
        );

        if (existingCheckoutResponse) {
          return existingCheckoutResponse;
        }
      }

      throw error;
    }

    // Best-effort: a profile save failure shouldn't invalidate an already-persisted order.
    try {
      await saveCheckoutProfile(userId, customerData);
    } catch (error) {
      console.error("Failed to save checkout profile for orderId:", newOrder.id, error);
    }

    void enqueueOrderEmailTask({ orderId: newOrder.id, type: "admin", locale }, () =>
      sendAdminOrderEmail({
        orderId: `TT-${newOrder.orderNumber}`,
        customerName: `${customerData.firstName} ${customerData.lastName}`,
        customerEmail: customerData.email,
        totalAmount: orderTotal,
        paymentMethod: "bank_transfer",
        adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
      }),
    ).catch((error) => {
      console.error(
        "Failed to enqueue admin bank transfer email for orderId:",
        newOrder.id,
        error,
      );
    });

    // Fire the email async without awaiting so it doesn't block the UI redirect
    void enqueueOrderEmailTask({ orderId: newOrder.id, type: "customer", locale }, () =>
      sendOrderEmail(
        customerData.email,
        customerData.firstName,
        `TT-${newOrder.orderNumber}`,
        orderTotal,
        true, // isBankTransfer = true
        getOrderAccessUrl(locale, newOrder.orderNumber, newOrder.accessToken),
        resolvedCart.fulfillmentEstimate,
        locale,
      ),
    ).catch((error) => {
      console.error(
        "Failed to enqueue customer bank transfer email for orderId:",
        newOrder.id,
        error,
      );
    });

    const posthog = getPostHogClient();
    // Only capture analytics if consent is provided
    if (posthog && analyticsConsent === "accepted") {
      // Use anonymized distinctId instead of email
      const distinctId = crypto
        .createHash("sha256")
        .update(customerData.email)
        .digest("hex");

      posthog.capture({
        distinctId,
        event: "bank_transfer_order_created",
        properties: {
          order_id: newOrder.id,
          order_number: newOrder.orderNumber,
          payment_method: "bank_transfer",
          cart_total: resolvedCart.subtotal,
          discount_amount: discount.discountAmount,
          discount: discount.discountSnapshot,
          shipping_amount: shippingAmount,
          order_total: orderTotal,
          payment_amount: payment.paymentAmount,
          currency: payment.paymentCurrency,
          order_currency: "RON",
        },
      });
    }

    return {
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      orderUrl: getOrderAccessUrl(locale, newOrder.orderNumber, newOrder.accessToken),
    };
  } catch (error: unknown) {
    console.error("Bank Transfer Order Error:", error);
    return { error: "Failed to create order." };
  }
}
