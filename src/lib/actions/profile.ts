"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CustomerProfileAddress,
  upsertCustomerProfile,
} from "@/lib/customer-profile";
import { getCurrentUser } from "@/lib/auth/session";
import { getNeonAuth } from "@/lib/auth/neon/server";
import { db } from "@/lib/db";
import { customerProfiles } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateCustomerProfile(formData: FormData) {
  const locale = readString(formData, "locale") === "ro" ? "ro" : "en";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const address: CustomerProfileAddress = {
    street: readString(formData, "street"),
    city: readString(formData, "city"),
    county: readString(formData, "county"),
    zip: readString(formData, "zip"),
    samedayCityId: readString(formData, "samedayCityId"),
    samedayCountyId: readString(formData, "samedayCountyId"),
  };

  await upsertCustomerProfile({
    userId: user.id,
    email: readString(formData, "email") || user.email || "",
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    phone: readString(formData, "phone"),
    address,
    preferredShippingMethod:
      readString(formData, "preferredShippingMethod") === "easybox"
        ? "easybox"
        : "address",
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });

  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/checkout`);
  redirect(`/${locale}/account?saved=1`);
}

export async function deleteCustomerProfile(formData: FormData) {
  const locale = readString(formData, "locale") === "ro" ? "ro" : "en";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  await db
    .delete(customerProfiles)
    .where(eq(customerProfiles.userId, user.id));

  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/checkout`);
  redirect(`/${locale}/account?profileDeleted=1`);
}

export async function deleteCustomerAccount(formData: FormData) {
  const locale = readString(formData, "locale") === "ro" ? "ro" : "en";
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const result = await getNeonAuth().deleteUser({
    callbackURL: `/${locale}`,
  });

  if (result.error && !isDisabledNeonDeleteUserError(result.error.message)) {
    return {
      error:
        result.error.message ??
        "Neon could not delete this account. Try logging in again and retrying.",
    };
  }

  if (result.error) {
    await db.transaction(async (tx) => {
      await tx
        .delete(customerProfiles)
        .where(eq(customerProfiles.userId, user.id));
      await tx.execute(sql`delete from neon_auth."user" where id = ${user.id}`);
    });
  } else {
    await db
      .delete(customerProfiles)
      .where(eq(customerProfiles.userId, user.id));
  }

  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/checkout`);
  redirect(`/${locale}`);
}

function isDisabledNeonDeleteUserError(message?: string) {
  const normalizedMessage = (message ?? "").toLowerCase();

  return (
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("delete user is disabled")
  );
}
