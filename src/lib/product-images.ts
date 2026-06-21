export function getProductImageSrc(imageUrl?: string | null) {
  return getProductImageSrcs(imageUrl)[0] ?? null;
}

export function getProductImageSrcs(imageUrl?: string | null) {
  return getProductImagePaths(imageUrl)
    .map((path) => getSingleProductImageSrc(path))
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
