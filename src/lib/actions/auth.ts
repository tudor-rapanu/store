"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function login(formData: FormData) {
  // 1. Extract form values
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  // 2. Initialize the Supabase Server Client
  const supabase = await createClient();

  // 3. Attempt to authenticate
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Return errors gracefully so the frontend can display them to the user
  if (error) {
    return { error: error.message };
  }

  // Identify and track login server-side
  const posthog = getPostHogClient();
  posthog?.identify({ distinctId: email, properties: { email } });
  posthog?.capture({
    distinctId: email,
    event: "user_signed_in",
    properties: { email },
  });

  // 4. On success, wipe the cache to update the Navbar state, then redirect.
  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();

  // 5. Attempt to create the user
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Track sign-up server-side
  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: email,
    event: "user_signed_up",
    properties: { email },
  });

  // Return a success flag so the UI knows to show a "Check your email" message
  return { success: "Check your email to confirm your account." };
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email) {
    return { error: "Email is required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/api/auth/callback?next=/${locale}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Check your email for a password reset link." };
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutFromLocale(formData: FormData) {
  const locale = formData.get("locale") === "ro" ? "ro" : "en";
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
