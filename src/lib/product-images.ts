export type ProductImageVariant = "large" | "card" | "thumb";

export function getProductImageSrc(
  imageUrl?: string | null,
  variant: ProductImageVariant = "large",
) {
  return getProductImageSrcs(imageUrl, variant)[0] ?? null;
}

export function getProductImageSrcs(
  imageUrl?: string | null,
  variant: ProductImageVariant = "large",
) {
  return getProductImagePaths(imageUrl)
    .map((path) =>
      getSingleProductImageSrc(getProductImageVariantPath(path, variant)),
    )
    .filter((src): src is string => Boolean(src));
}

export function getProductImagePaths(imageUrl?: string | null) {
  const imagePath = imageUrl?.trim();

  if (!imagePath) {
    return [];
  }

  try {
    const parsed = JSON.parse(imagePath) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .filter((path): path is string => typeof path === "string")
        .map((path) => path.trim())
        .filter(Boolean);
    }
  } catch {
    // Older products store one plain image path.
  }

  return [imagePath];
}

export function getProductImageStorageKeys(imagePath: string) {
  const storageKey = getStorageKey(imagePath);
  const match = storageKey.match(/^(catalog\/normalized\/[^/]+)\/large\.webp$/);

  if (!match) {
    return [storageKey];
  }

  return [
    `${match[1]}/large.webp`,
    `${match[1]}/card.webp`,
    `${match[1]}/thumb.webp`,
  ];
}

function getProductImageVariantPath(
  imagePath: string,
  variant: ProductImageVariant,
) {
  const trimmedPath = imagePath.trim();
  const match = trimmedPath.match(
    /^(.*\/catalog\/normalized\/[^/]+)\/large\.webp$/,
  );

  if (!match) {
    return trimmedPath;
  }

  return `${match[1]}/${variant}.webp`;
}

function getStorageKey(imagePath: string) {
  try {
    return new URL(imagePath).pathname.replace(/^\/+/, "");
  } catch {
    return imagePath.replace(/^\/+/, "");
  }
}

function getSingleProductImageSrc(imagePath: string) {
  const trimmedPath = imagePath.trim();

  if (!trimmedPath) {
    return null;
  }

  try {
    return new URL(trimmedPath).toString();
  } catch {
    const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\/+$/, "");

    if (!baseUrl) {
      return null;
    }

    const normalizedPath = trimmedPath.startsWith("/")
      ? trimmedPath
      : `/${trimmedPath}`;

    return `${baseUrl}${normalizedPath}`;
  }
}
