import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  digitalProductFiles,
  orderItems,
  orders,
} from "@/lib/db/schema";
import { getDigitalProductFileObject } from "@/lib/storage/digital-products";
import { getCurrentUser } from "@/lib/auth/session";

type DownloadRouteProps = {
  params: Promise<{
    orderNumber: string;
    fileId: string;
  }>;
};

function contentDispositionFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "");
}

export async function GET(request: Request, { params }: DownloadRouteProps) {
  const { orderNumber, fileId } = await params;
  const parsedOrderNumber = Number.parseInt(orderNumber, 10);

  if (!Number.isFinite(parsedOrderNumber)) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404 });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, parsedOrderNumber))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order was not found." }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get("token");
  const user = await getCurrentUser();
  const isAccountOwner = Boolean(user?.id && order.userId === user.id);
  const hasGuestToken = Boolean(token && token === order.accessToken);

  if (!isAccountOwner && !hasGuestToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (order.paymentStatus !== "paid") {
    return NextResponse.json(
      { error: "Downloads are available after payment is confirmed." },
      { status: 403 },
    );
  }

  const [file] = await db
    .select({
      fileName: digitalProductFiles.fileName,
      storageKey: digitalProductFiles.storageKey,
      contentType: digitalProductFiles.contentType,
      fileSize: digitalProductFiles.fileSize,
    })
    .from(digitalProductFiles)
    .innerJoin(orderItems, eq(orderItems.productId, digitalProductFiles.productId))
    .where(
      and(
        eq(orderItems.orderId, order.id),
        eq(digitalProductFiles.id, fileId),
      ),
    )
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File was not found." }, { status: 404 });
  }

  const object = await getDigitalProductFileObject(file.storageKey);
  const body = object.Body;

  if (!body || !("transformToWebStream" in body)) {
    return NextResponse.json(
      { error: "File could not be loaded." },
      { status: 500 },
    );
  }

  return new Response(body.transformToWebStream(), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.fileSize),
      "Content-Disposition": `attachment; filename="${contentDispositionFileName(
        file.fileName,
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
