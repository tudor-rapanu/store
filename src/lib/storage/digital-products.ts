import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

import { readEnvValue } from "@/lib/env";
import { r2Client } from "@/lib/storage/r2";

const MAX_DIGITAL_FILE_SIZE = 100 * 1024 * 1024;
const BLOCKED_CONTENT_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
]);

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export async function uploadDigitalProductFile(file: File, productId: string) {
  if (file.size <= 0) {
    throw new Error("Digital files cannot be empty.");
  }

  if (file.size > MAX_DIGITAL_FILE_SIZE) {
    throw new Error("Digital files must be 100 MB or smaller.");
  }

  if (file.type && BLOCKED_CONTENT_TYPES.has(file.type)) {
    throw new Error("This file type is not supported for digital products.");
  }

  const fileName = sanitizeFileName(file.name) || "download";
  const contentType = file.type || "application/octet-stream";
  const body = Buffer.from(await file.arrayBuffer());

  return uploadDigitalProductFileBuffer({
    buffer: body,
    contentType,
    fileName,
    productId,
  });
}

export async function uploadDigitalProductFileBuffer({
  buffer,
  contentType,
  fileName,
  productId,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  productId: string;
}) {
  if (buffer.byteLength <= 0) {
    throw new Error("Digital files cannot be empty.");
  }

  if (buffer.byteLength > MAX_DIGITAL_FILE_SIZE) {
    throw new Error("Digital files must be 100 MB or smaller.");
  }

  if (contentType && BLOCKED_CONTENT_TYPES.has(contentType)) {
    throw new Error("This file type is not supported for digital products.");
  }

  const safeFileName = sanitizeFileName(fileName) || "download";
  const safeContentType = contentType || "application/octet-stream";
  const storageKey = `digital-products/${productId}/${crypto.randomUUID()}-${safeFileName}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
      Key: storageKey,
      Body: buffer,
      ContentType: safeContentType,
      CacheControl: "private, no-store",
    }),
  );

  return {
    fileName: safeFileName,
    storageKey,
    contentType: safeContentType,
    fileSize: buffer.byteLength,
  };
}

export async function getDigitalProductFileObject(storageKey: string) {
  return r2Client.send(
    new GetObjectCommand({
      Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
      Key: storageKey,
    }),
  );
}

export async function deleteDigitalProductFiles(storageKeys: string[]) {
  await Promise.allSettled(
    storageKeys.map((storageKey) =>
      r2Client.send(
        new DeleteObjectCommand({
          Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
          Key: storageKey,
        }),
      ),
    ),
  );
}
