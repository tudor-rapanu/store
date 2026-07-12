"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getNeonAuth } from "@/lib/auth/neon/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function login(formData: FormData) {
  // 1. Extract form values
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error } = await getNeonAuth().signIn.email({
    email,
    password,
  });

  // Return errors gracefully so the frontend can display them to the user
  if (error) {
    const errorMessage = error.message ?? "Login failed.";
    const verificationRequired = isEmailVerificationError(errorMessage);

    return {
      error: errorMessage,
      email: verificationRequired ? email : undefined,
      verificationRequired,
    };
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

function isEmailVerificationError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("verification") ||
    normalizedMessage.includes("verify") ||
    normalizedMessage.includes("not verified")
  );
}

export async function register(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error } = await getNeonAuth().signUp.email({
    email,
    password,
    name: email,
    callbackURL: `${getSiteUrl()}/${locale}/login`,
  });

  if (error) {
    return { error: error.message ?? "Registration failed." };
  }

  const verificationEmail = await getNeonAuth().emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

  if (verificationEmail.error) {
    return {
      success:
        "Account created, but the verification code could not be sent automatically.",
      warning: verificationEmail.error.message ?? "Verification code failed.",
      email,
    };
  }

  // Track sign-up server-side
  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: email,
    event: "user_signed_up",
    properties: { email },
  });

  // Return a success flag so the UI knows to show a "Check your email" message
  return {
    success: "Check your email for the verification code.",
    email,
  };
}

function getSiteUrl() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

  return /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function requestPasswordReset(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email) {
    return { error: "Email is required" };
  }

  const resetUrl = `${getSiteUrl()}/${locale}/reset-password`;
  const { error } = await getNeonAuth().requestPasswordReset({
    email,
    redirectTo: resetUrl,
  });

  if (error) {
    return { error: error.message ?? "Password reset email could not be sent." };
  }

  return { success: "Check your email for a password reset link." };
}

export async function resendVerificationEmail(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const locale = formData.get("locale") === "ro" ? "ro" : "en";

  if (!email) {
    return { error: "Email is required" };
  }

  const { error } = await getNeonAuth().emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

  if (error) {
    return { error: error.message ?? "Verification code could not be sent." };
  }

  return { success: "Verification code sent." };
}

export async function verifyEmailCode(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const locale = formData.get("locale") === "ro" ? "ro" : "en";
  const otp =
    typeof formData.get("code") === "string"
      ? (formData.get("code") as string).trim()
      : "";

  if (!email || !otp) {
    return { error: "Email and verification code are required." };
  }

  const { error } = await getNeonAuth().emailOtp.verifyEmail({
    email,
    otp,
  });

  if (error) {
    return { error: error.message ?? "Verification code is invalid." };
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const locale = formData.get("locale") === "ro" ? "ro" : "en";
  const token = formData.get("token");
  const passwordResetToken =
    typeof token === "string" && token.trim().length > 0
      ? token.trim()
      : undefined;

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const { error } = await getNeonAuth().resetPassword({
    newPassword: password,
    token: passwordResetToken,
  });

  if (error) {
    return { error: error.message ?? "Password could not be updated." };
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}

export async function logout() {
  await getNeonAuth().signOut();

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutFromLocale(formData: FormData) {
  const locale = formData.get("locale") === "ro" ? "ro" : "en";
  await getNeonAuth().signOut();

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
