"use server";

import crypto from "crypto";

import { and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
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
import { upsertCustomerProfile } from "@/lib/customer-profile";
import { checkServerActionRateLimit } from "@/lib/rate-limit";
import { formatEur, formatRon, normalizePaymentCurrency } from "@/lib/currency/format";
import { getCurrencySettings } from "@/lib/currency/settings";
import { recordVoucherUsage, resolveBestDiscount } from "@/lib/discounts";
import { publicProductWhere } from "@/lib/catalog/cache";
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
} from "@/lib/product-pricing";
import { getCartFulfillmentEstimate } from "@/lib/fulfillment/estimate";

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
    throw new Error(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(`${fieldName} is invalid.`);
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

  if (
    shippingMethod !== "address" &&
    shippingMethod !== "easybox" &&
    shippingMethod !== "international"
  ) {
    throw new Error("Select a valid shipping method.");
  }
  const countryCode = normalizeCheckoutCountry(customerData.address.countryCode);
  const paymentCurrency = normalizePaymentCurrency(customerData.paymentCurrency);

  if (!isDigitalOnly && countryCode === "RO" && shippingMethod === "international") {
    throw new Error("Select a valid Romanian shipping method.");
  }

  if (!isDigitalOnly && countryCode !== "RO" && shippingMethod !== "international") {
    throw new Error("International orders must use international shipping.");
  }

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

  const { ronToEurRate } = await getCurrencySettings();

  return `Todd's Threads - Order TT-${orderNumber} - ${formatEur(orderTotalRonBani, ronToEurRate)} / ${formatRon(orderTotalRonBani)}`;
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

async function createOrderItems(orderId: string, items: ResolvedOrderItem[]) {
  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  );
}

function getCartQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
    throw new Error("Cart contains an invalid quantity.");
  }

  return quantity;
}

async function resolveCheckoutCart(cartItems: CheckoutCartItem[]) {
  if (!Array.isArray(cartItems) || cartItems.length > 50) {
    throw new Error("Cart contents are invalid.");
  }

  const normalizedItems = cartItems.map((item) => {
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
  });

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

    if (!product) {
      throw new Error("One of the products in your cart is no longer available.");
    }

    const isSimpleProduct = item.variantId === item.productId;
    let variantId: string | null = null;
    let unitPrice = getEffectiveProductPrice(product);
    let stock = product.trackStock ? product.stock : null;

    if (!isSimpleProduct) {
      const variant = variantById.get(item.variantId);

      if (!variant || variant.productId !== product.id) {
        throw new Error("One of the selected variants is no longer available.");
      }

      variantId = variant.id;
      unitPrice = getEffectiveVariantPrice(product, variant);
      stock = variant.trackStock ? variant.stock : null;
    }

    if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
      throw new Error("One of the products in your cart has an invalid price.");
    }

    const key = `${product.id}:${variantId ?? product.id}`;
    const existing = resolvedByKey.get(key);
    const nextQuantity = (existing?.quantity ?? 0) + item.quantity;

    if (stock !== null && nextQuantity > stock) {
      throw new Error("One of the products in your cart is no longer in stock.");
    }

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
    preferredShippingMethod: customerData.shippingMethod,
  });
}

export async function initiateCheckout(
  _cartSubtotal: number,
  customerData: CheckoutCustomerData,
  locale: "en" | "ro" = "en",
  cartItems: CheckoutCartItem[] = [],
) {
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
    const [newOrder] = await db
      .insert(orders)
      .values({
        userId,
        accessToken: createOrderAccessToken(),
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
      })
      .returning();

    await saveCheckoutProfile(userId, customerData);
    await createOrderItems(newOrder.id, resolvedCart.items);
    await recordVoucherUsage({
      discountSnapshot: discount.discountSnapshot,
      orderId: newOrder.id,
      userId,
      email: customerData.email,
    });
    sendAdminOrderEmail({
      orderId: `TT-${newOrder.orderNumber}`,
      customerName: `${customerData.firstName} ${customerData.lastName}`,
      customerEmail: customerData.email,
      totalAmount: orderTotal,
      paymentMethod: "card",
      adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
    });

    try {
      // The Netopia SDK is stateful: set the order first, then start payment.
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

      const paymentResponse = await client.startPayment();

      if (paymentResponse?.payment?.paymentURL) {
        const posthog = getPostHogClient();
        posthog?.capture({
          distinctId: customerData.email,
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
            customer_email: customerData.email,
            locale,
          },
        });
        return { url: paymentResponse.payment.paymentURL };
      } else {
        console.error("Netopia returned an unexpected response:", paymentResponse);
        return { error: "Failed to generate Netopia payment link." };
      }
    } catch (error: unknown) {
      // 4. Safely handle the 'unknown' error type
      console.error("Netopia Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Payment initiation failed.";
      return { error: errorMessage };
    }
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
    const [newOrder] = await db
      .insert(orders)
      .values({
        userId,
        accessToken: createOrderAccessToken(),
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
      })
      .returning();
    await saveCheckoutProfile(userId, customerData);
    await createOrderItems(newOrder.id, resolvedCart.items);
    await recordVoucherUsage({
      discountSnapshot: discount.discountSnapshot,
      orderId: newOrder.id,
      userId,
      email: customerData.email,
    });
    sendAdminOrderEmail({
      orderId: `TT-${newOrder.orderNumber}`,
      customerName: `${customerData.firstName} ${customerData.lastName}`,
      customerEmail: customerData.email,
      totalAmount: orderTotal,
      paymentMethod: "bank_transfer",
      adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
    });

    // Fire the email async without awaiting so it doesn't block the UI redirect
    sendOrderEmail(
      customerData.email,
      customerData.firstName,
      `TT-${newOrder.orderNumber}`,
      orderTotal,
      true, // isBankTransfer = true
      getOrderAccessUrl(locale, newOrder.orderNumber, newOrder.accessToken),
      resolvedCart.fulfillmentEstimate,
      locale,
    );

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: customerData.email,
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
        customer_email: customerData.email,
      },
    });

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
