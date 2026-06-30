import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!token) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    token,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com",
  });
}
