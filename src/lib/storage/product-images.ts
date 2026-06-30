import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import sharp from "sharp";

import { readEnvValue } from "@/lib/env";
import { getProductImageStorageKeys } from "@/lib/product-images";
import { r2Client } from "@/lib/storage/r2";

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const PRODUCT_IMAGE_VARIANTS = [
  { name: "large", size: 1600, quality: 86 },
  { name: "card", size: 800, quality: 82 },
  { name: "thumb", size: 240, quality: 76 },
] as const;

export async function uploadProductImage(image: File, slug: string) {
  if (image.size > MAX_IMAGE_SIZE) {
    throw new Error("Product images must be 25 MB or smaller.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }

  const sourceBuffer = Buffer.from(await image.arrayBuffer());
  const baseKey = `catalog/normalized/${slug}-${crypto.randomUUID()}`;

  await Promise.all(
    PRODUCT_IMAGE_VARIANTS.map(async (variant) => {
      const body = await sharp(sourceBuffer)
        .rotate()
        .resize(variant.size, variant.size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality })
        .toBuffer();

      await r2Client.send(
        new PutObjectCommand({
          Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
          Key: `${baseKey}/${variant.name}.webp`,
          Body: body,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    }),
  );

  return `/${baseKey}/large.webp`;
}

export async function deleteProductImages(imagePaths: string[]) {
  const storageKeys = imagePaths.flatMap((imagePath) =>
    getProductImageStorageKeys(imagePath),
  );

  await Promise.allSettled(
    storageKeys.map((key) =>
      r2Client.send(
        new DeleteObjectCommand({
          Bucket: readEnvValue(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
          Key: key,
        }),
      ),
    ),
  );
}
