import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { shippingProfiles, type ShippingMethod } from "@/lib/db/schema";

export type ShippingProfile = {
  id: string;
  name: string;
  method: ShippingMethod;
  price: number;
  freeShippingThreshold: number;
  enabled: boolean;
};

export const DEFAULT_SHIPPING_PROFILES: ShippingProfile[] = [
  {
    id: "local_easybox",
    name: "Easybox / PUDO",
    method: "easybox",
    price: 1500,
    freeShippingThreshold: 15000,
    enabled: true,
  },
  {
    id: "local_address",
    name: "Home Address",
    method: "address",
    price: 2500,
    freeShippingThreshold: 15000,
    enabled: true,
  },
  {
    id: "international_posta_romana",
    name: "Posta Romana International",
    method: "international",
    price: 7500,
    freeShippingThreshold: 999999999,
    enabled: true,
  },
];

function normalizeProfile(profile: typeof shippingProfiles.$inferSelect) {
  return {
    id: profile.id,
    name: profile.name,
    method: profile.method,
    price: profile.price,
    freeShippingThreshold: profile.freeShippingThreshold,
    enabled: profile.enabled,
  } satisfies ShippingProfile;
}

export async function ensureShippingProfiles() {
  for (const profile of DEFAULT_SHIPPING_PROFILES) {
    await db
      .insert(shippingProfiles)
      .values({
        ...profile,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

export async function getShippingProfiles() {
  await ensureShippingProfiles();

  const rows = await db.select().from(shippingProfiles);
  const profiles = rows.map(normalizeProfile);

  return DEFAULT_SHIPPING_PROFILES.map(
    (defaultProfile) =>
      profiles.find((profile) => profile.id === defaultProfile.id) ??
      defaultProfile,
  );
}

export async function getShippingProfileForMethod(method: ShippingMethod) {
  const profiles = await getShippingProfiles();

  return profiles.find((profile) => profile.method === method && profile.enabled);
}

export async function calculateShippingAmount(
  method: ShippingMethod,
  subtotalAmount: number,
) {
  const profile = await getShippingProfileForMethod(method);

  if (!profile) {
    throw new Error("Shipping method is not available.");
  }

  if (method === "international") {
    return profile.price;
  }

  return subtotalAmount >= profile.freeShippingThreshold ? 0 : profile.price;
}

export async function updateLocalShippingProfiles({
  easyboxPrice,
  addressPrice,
  internationalPrice,
  freeShippingThreshold,
}: {
  easyboxPrice: number;
  addressPrice: number;
  internationalPrice: number;
  freeShippingThreshold: number;
}) {
  await ensureShippingProfiles();

  await Promise.all([
    db
      .update(shippingProfiles)
      .set({
        price: easyboxPrice,
        freeShippingThreshold,
        updatedAt: new Date(),
      })
      .where(eq(shippingProfiles.id, "local_easybox")),
    db
      .update(shippingProfiles)
      .set({
        price: addressPrice,
        freeShippingThreshold,
        updatedAt: new Date(),
      })
      .where(eq(shippingProfiles.id, "local_address")),
    db
      .update(shippingProfiles)
      .set({
        price: internationalPrice,
        freeShippingThreshold: 999999999,
        updatedAt: new Date(),
      })
      .where(eq(shippingProfiles.id, "international_posta_romana")),
  ]);

  return getShippingProfiles();
}
