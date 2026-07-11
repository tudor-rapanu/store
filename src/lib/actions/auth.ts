"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { getNeonAuth } from "@/lib/auth/neon/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function login(formData: FormData) {
  // 1. Extract form values
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const error =
    getAuthProvider() === "neon"
      ? (
          await getNeonAuth().signIn.email({
            email,
            password,
          })
        ).error
      : (
          await (async () => {
            const supabase = await createClient();

            return supabase.auth.signInWithPassword({
              email,
              password,
            });
          })()
        ).error;

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

  const error =
    getAuthProvider() === "neon"
      ? (
          await getNeonAuth().signUp.email({
            email,
            password,
            name: email,
          })
        ).error
      : (
          await (async () => {
            const supabase = await createClient();

            return supabase.auth.signUp({
              email,
              password,
            });
          })()
        ).error;

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

  const resetUrl =
    getAuthProvider() === "neon"
      ? `${getSiteUrl()}/${locale}/reset-password`
      : `${getSiteUrl()}/api/auth/callback?next=/${locale}/reset-password`;
  const error =
    getAuthProvider() === "neon"
      ? (
          await getNeonAuth().requestPasswordReset({
            email,
            redirectTo: resetUrl,
          })
        ).error
      : (
          await (async () => {
            const supabase = await createClient();

            return supabase.auth.resetPasswordForEmail(email, {
              redirectTo: resetUrl,
            });
          })()
        ).error;

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

  const error =
    getAuthProvider() === "neon"
      ? (await getNeonAuth().resetPassword({ newPassword: password })).error
      : (
          await (async () => {
            const supabase = await createClient();

            return supabase.auth.updateUser({ password });
          })()
        ).error;

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}

export async function logout() {
  if (getAuthProvider() === "neon") {
    await getNeonAuth().signOut();
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutFromLocale(formData: FormData) {
  const locale = formData.get("locale") === "ro" ? "ro" : "en";
  if (getAuthProvider() === "neon") {
    await getNeonAuth().signOut();
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
