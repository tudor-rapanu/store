import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  GenerateAwbError,
  generateOrderAwb,
  type GenerateAwbBody,
} from "@/lib/orders/generate-awb";
import { isAuthorizedTaskRequest } from "@/lib/tasks/auth";
import type { AwbGenerationTaskPayload } from "@/lib/tasks/awb-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePayload(value: unknown): AwbGenerationTaskPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<AwbGenerationTaskPayload>;

  if (
    typeof payload.orderId !== "string" ||
    !payload.body ||
    typeof payload.body !== "object" ||
    Array.isArray(payload.body)
  ) {
    return null;
  }

  return {
    orderId: payload.orderId,
    body: payload.body as GenerateAwbBody,
  };
}

export async function POST(request: Request) {
  if (!isAuthorizedTaskRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  }

  try {
    const result = await generateOrderAwb(payload.orderId, payload.body);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Queued AWB generation failed:", error);

    if (error instanceof GenerateAwbError) {
      if (error.message === "This order already has an AWB.") {
        return NextResponse.json({ ok: true, alreadyGenerated: true });
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate AWB." },
      { status: 500 },
    );
  }
}
