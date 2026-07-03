type MaybeDate = Date | string | null | undefined;

export type SalePriceFields = {
  salePrice?: number | null;
  saleEnabled?: boolean | null;
  saleStartsAt?: MaybeDate;
  saleEndsAt?: MaybeDate;
};

export type ProductPriceFields = SalePriceFields & {
  basePrice: number;
};

export type VariantPriceFields = SalePriceFields & {
  price?: number | null;
  priceAdjustment?: number | null;
};

function toDate(value: MaybeDate) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSaleWindowActive(
  item: SalePriceFields,
  now: Date = new Date(),
) {
  if (!item.saleEnabled || !item.salePrice || item.salePrice <= 0) {
    return false;
  }

  const startsAt = toDate(item.saleStartsAt);
  const endsAt = toDate(item.saleEndsAt);

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

export function getRegularVariantPrice(
  product: ProductPriceFields,
  variant?: VariantPriceFields | null,
) {
  if (!variant) {
    return product.basePrice;
  }

  return variant.price ?? product.basePrice + (variant.priceAdjustment ?? 0);
}

export function getEffectiveProductPrice(
  product: ProductPriceFields,
  now: Date = new Date(),
) {
  const salePrice =
    isSaleWindowActive(product, now) && product.salePrice
      ? product.salePrice
      : null;

  return salePrice && salePrice < product.basePrice
    ? salePrice
    : product.basePrice;
}

export function getEffectiveVariantPrice(
  product: ProductPriceFields,
  variant: VariantPriceFields,
  now: Date = new Date(),
) {
  const regularPrice = getRegularVariantPrice(product, variant);

  if (
    isSaleWindowActive(variant, now) &&
    variant.salePrice &&
    variant.salePrice < regularPrice
  ) {
    return variant.salePrice;
  }

  if (
    isSaleWindowActive(product, now) &&
    product.salePrice &&
    product.salePrice < regularPrice
  ) {
    return product.salePrice;
  }

  return regularPrice;
}

export function getProductPricePresentation(
  product: ProductPriceFields,
  now: Date = new Date(),
) {
  const regularPrice = product.basePrice;
  const effectivePrice = getEffectiveProductPrice(product, now);

  return {
    regularPrice,
    effectivePrice,
    isOnSale: effectivePrice < regularPrice,
  };
}

export function getVariantPricePresentation(
  product: ProductPriceFields,
  variant: VariantPriceFields,
  now: Date = new Date(),
) {
  const regularPrice = getRegularVariantPrice(product, variant);
  const effectivePrice = getEffectiveVariantPrice(product, variant, now);

  return {
    regularPrice,
    effectivePrice,
    isOnSale: effectivePrice < regularPrice,
  };
}
