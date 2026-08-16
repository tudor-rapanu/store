import { getVariantSku } from "./product-identifiers";
import type {
  ParsedProductForm,
  ProductDetailBlockInput,
  VariantInput,
} from "./product-form";

export function getProductWriteValues(productForm: ParsedProductForm) {
  return {
    slug: productForm.slug,
    title: { en: productForm.titleEn, ro: productForm.titleRo },
    description:
      productForm.descriptionEn || productForm.descriptionRo
        ? {
            en: productForm.descriptionEn,
            ro: productForm.descriptionRo || productForm.descriptionEn,
          }
        : null,
    basePrice: productForm.basePrice,
    salePrice: productForm.saleEnabled ? productForm.salePrice : null,
    saleEnabled: productForm.saleEnabled,
    saleStartsAt: productForm.saleEnabled ? productForm.saleStartsAt : null,
    saleEndsAt: productForm.saleEnabled ? productForm.saleEndsAt : null,
    productionMinDays: productForm.productionMinDays,
    productionMaxDays: productForm.productionMaxDays,
    preorderEnabled: productForm.preorderEnabled,
    preorderShipDate: productForm.preorderEnabled ? productForm.preorderShipDate : null,
    publishAt: productForm.publishAt,
    publishRevalidatedAt: productForm.shouldWaitForPublishRevalidation
      ? null
      : new Date(),
    isDigital: productForm.isDigital,
    sizeGuideId: productForm.sizeGuideId,
    trackStock: productForm.variants.length === 0 ? productForm.trackStock : false,
    stock:
      productForm.variants.length === 0 && productForm.trackStock
        ? productForm.stock
        : 0,
    isSimple: productForm.variants.length === 0,
    isPrivate: productForm.isPrivate,
  };
}

export function getVariantWriteValues(
  variant: VariantInput,
  productSlug: string,
  index: number,
) {
  return {
    name: variant.name,
    sku: getVariantSku(variant, productSlug, index),
    attributes: variant.attributes,
    price: Math.round((variant.price ?? 0) * 100),
    salePrice:
      variant.saleEnabled && variant.salePrice
        ? Math.round(variant.salePrice * 100)
        : null,
    saleEnabled: variant.saleEnabled ?? false,
    saleStartsAt: variant.saleEnabled ? variant.saleStartsAt : null,
    saleEndsAt: variant.saleEnabled ? variant.saleEndsAt : null,
    priceAdjustment: 0,
    trackStock: variant.trackStock ?? false,
    stock: variant.trackStock ? Math.max(Math.floor(variant.stock ?? 0), 0) : 0,
  };
}

export function getProductDetailWriteValues(
  detail: ProductDetailBlockInput,
  index: number,
) {
  return {
    icon: detail.icon,
    label: detail.label,
    value: detail.value,
    sortOrder: index,
    enabled: detail.enabled,
  };
}
