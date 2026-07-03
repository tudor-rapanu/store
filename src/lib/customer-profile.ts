import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { customerProfiles, type ShippingMethod } from "@/lib/db/schema";

export type CustomerProfileAddress = {
  street?: string;
  city?: string;
  county?: string;
  zip?: string;
  countryCode?: string;
  countryName?: string;
  samedayCityId?: string;
  samedayCountyId?: string;
};

export type CustomerProfileInput = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: CustomerProfileAddress;
  preferredShippingMethod?: ShippingMethod;
  marketingOptIn?: boolean;
};

export async function getCustomerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function upsertCustomerProfile(input: CustomerProfileInput) {
  const now = new Date();

  await db
    .insert(customerProfiles)
    .values({
      userId: input.userId,
      email: input.email,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address ?? {},
      preferredShippingMethod: input.preferredShippingMethod ?? "address",
      marketingOptIn: input.marketingOptIn ?? false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: customerProfiles.userId,
      set: {
        email: input.email,
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address ?? {},
        preferredShippingMethod: input.preferredShippingMethod ?? "address",
        marketingOptIn: input.marketingOptIn ?? false,
        updatedAt: now,
      },
    });
}
