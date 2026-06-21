"use server";

import crypto from "crypto";

import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { createNetopiaClient } from "@/lib/payments/netopia";
import { sendAdminOrderEmail, sendOrderEmail } from "@/lib/email";
import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

// 1. Define strict types for the incoming customer data
export interface CheckoutAddress {
  street: string;
  city: string;
  county: string;
  zip: string;
}

export interface CheckoutCustomerData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: CheckoutAddress;
  shippingMethod: "address" | "easybox";
}

export interface CheckoutCartItem {
  productId?: string;
  variantId: string;
  price: number;
  quantity: number;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

function getOrderAccessUrl(
  locale: "en" | "ro",
  orderNumber: number,
  accessToken: string,
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const path = `/${locale}/orders/${orderNumber}?token=${accessToken}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

function getAdminOrderUrl(locale: "en" | "ro", orderId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const path = `/${locale}/admin/orders/${orderId}`;

  return siteUrl ? `${siteUrl}${path}` : path;
}

async function createOrderItems(orderId: string, items: CheckoutCartItem[]) {
  const validItems = items.filter(
    (item) =>
      item.variantId &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0,
  );

  if (validItems.length === 0) {
    return;
  }

  await db.insert(orderItems).values(
    validItems.map((item) => {
      const productId = item.productId ?? item.variantId;
      const variantId =
        item.productId && item.variantId !== item.productId
          ? item.variantId
          : null;

      return {
        orderId,
        productId,
        variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      };
    }),
  );
}

export async function initiateCheckout(
  cartTotal: number,
  customerData: CheckoutCustomerData,
  locale: "en" | "ro" = "en",
  cartItems: CheckoutCartItem[] = [],
) {
  const userId = await getCurrentUserId();
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
      shippingMethod: customerData.shippingMethod,
      totalAmount: cartTotal,
      status: "pending",
      paymentMethod: "card",
      paymentStatus: "pending",
      fulfillmentStatus: "new",
    })
    .returning();
  await createOrderItems(newOrder.id, cartItems);
  sendAdminOrderEmail({
    orderId: `TT-${newOrder.orderNumber}`,
    customerName: `${customerData.firstName} ${customerData.lastName}`,
    customerEmail: customerData.email,
    totalAmount: cartTotal,
    paymentMethod: "card",
    adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
  });

  try {
    // The Netopia SDK is stateful: set the order first, then start payment.
    const client = createNetopiaClient(
      `/${locale}`,
      newOrder.id,
    ) as NetopiaClientWorkaround;

    client.setOrderData({
      amount: cartTotal / 100,
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
      currency: "RON",
      description: `Todd's Threads - Order TT-${newOrder.orderNumber}`,
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
          cart_total: cartTotal,
          currency: "RON",
          customer_email: customerData.email,
          locale,
        },
      });
      return { url: paymentResponse.payment.paymentURL };
    } else {
      console.error(
        "Netopia returned an unexpected response:",
        paymentResponse,
      );
      return { error: "Failed to generate Netopia payment link." };
    }
  } catch (error: unknown) {
    // 4. Safely handle the 'unknown' error type
    console.error("Netopia Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Payment initiation failed.";
    return { error: errorMessage };
  }
}

export async function createBankTransferOrder(
  cartTotal: number,
  customerData: CheckoutCustomerData,
  locale: "en" | "ro" = "en",
  cartItems: CheckoutCartItem[] = [],
) {
  try {
    const userId = await getCurrentUserId();
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
        shippingMethod: customerData.shippingMethod,
        totalAmount: cartTotal,
        status: "pending", // You can track this manually until the wire hits your bank
        paymentMethod: "bank_transfer",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      })
      .returning();
    await createOrderItems(newOrder.id, cartItems);
    sendAdminOrderEmail({
      orderId: `TT-${newOrder.orderNumber}`,
      customerName: `${customerData.firstName} ${customerData.lastName}`,
      customerEmail: customerData.email,
      totalAmount: cartTotal,
      paymentMethod: "bank_transfer",
      adminOrderUrl: getAdminOrderUrl(locale, newOrder.id),
    });

    // Fire the email async without awaiting so it doesn't block the UI redirect
    sendOrderEmail(
      customerData.email,
      customerData.firstName,
      `TT-${newOrder.orderNumber}`,
      cartTotal,
      true, // isBankTransfer = true
      getOrderAccessUrl(locale, newOrder.orderNumber, newOrder.accessToken),
    );

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: customerData.email,
      event: "bank_transfer_order_created",
      properties: {
        order_id: newOrder.id,
        order_number: newOrder.orderNumber,
        payment_method: "bank_transfer",
        cart_total: cartTotal,
        currency: "RON",
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
