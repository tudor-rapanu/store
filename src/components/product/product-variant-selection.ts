export type SelectableVariant = {
  attributes: Record<string, string> | string;
  trackStock?: boolean | null;
  stock?: number | null;
};

export type VariantOptionAvailability = {
  isAvailable: boolean;
  reason: "outOfStock" | "unavailable" | null;
  stock: number | null;
};

export function getVariantAttributes(variant: SelectableVariant) {
  if (typeof variant.attributes !== "string") {
    return variant.attributes;
  }

  try {
    const parsed = JSON.parse(variant.attributes) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function selectVariantAttribute({
  selectedAttributes,
  attributeKeys,
  attributeKey,
  value,
}: {
  selectedAttributes: Record<string, string>;
  attributeKeys: string[];
  attributeKey: string;
  value: string;
}) {
  const currentIndex = attributeKeys.indexOf(attributeKey);

  if (currentIndex < 0) {
    return selectedAttributes;
  }

  return Object.fromEntries([
    ...attributeKeys
      .slice(0, currentIndex)
      .filter((key) => Boolean(selectedAttributes[key]))
      .map((key) => [key, selectedAttributes[key]]),
    [attributeKey, value],
  ]);
}

export function getVariantOptionAvailability({
  variants,
  selectedAttributes,
  attributeKeys,
  attributeKey,
  value,
}: {
  variants: SelectableVariant[];
  selectedAttributes: Record<string, string>;
  attributeKeys: string[];
  attributeKey: string;
  value: string;
}): VariantOptionAvailability {
  const currentIndex = attributeKeys.indexOf(attributeKey);
  const precedingKeys = attributeKeys.slice(0, Math.max(currentIndex, 0));
  const matchingVariants = variants.filter((variant) => {
    const attributes = getVariantAttributes(variant);

    return (
      attributes[attributeKey] === value &&
      precedingKeys.every(
        (key) =>
          !selectedAttributes[key] || attributes[key] === selectedAttributes[key],
      )
    );
  });

  if (matchingVariants.length === 0) {
    return { isAvailable: false, reason: "unavailable", stock: null };
  }

  if (matchingVariants.some((variant) => !variant.trackStock)) {
    return { isAvailable: true, reason: null, stock: null };
  }

  const stock = matchingVariants.reduce(
    (total, variant) => total + Math.max(variant.stock ?? 0, 0),
    0,
  );

  return stock > 0
    ? { isAvailable: true, reason: null, stock }
    : { isAvailable: false, reason: "outOfStock", stock: 0 };
}
