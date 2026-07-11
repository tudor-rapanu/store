"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CustomerProfileAddress,
  upsertCustomerProfile,
} from "@/lib/customer-profile";
import { getCurrentUser } from "@/lib/auth/session";

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
