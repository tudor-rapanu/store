"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductCategoriesField } from "./ProductCategoriesField";
import { ProductDetailsSection } from "./ProductDetailsSection";
import { ProductDigitalSection } from "./ProductDigitalSection";
import { ProductFulfillmentSection } from "./ProductFulfillmentSection";
import { ProductIdentitySection } from "./ProductIdentitySection";
import { ProductImagesSection } from "./ProductImagesSection";
import { ProductPricingSection } from "./ProductPricingSection";
import { ProductPublishingSettings } from "./ProductPublishingSettings";
import { ProductStockSection } from "./ProductStockSection";
import { ProductVariantsSection } from "./ProductVariantsSection";
import type { AdminProductFormProps } from "./admin-product-form.types";
import { toProductDateTimeInputValue } from "./admin-product-form-utils";
import { useProductCategories } from "./use-product-categories";
import { useProductCommerce } from "./use-product-commerce";
import { useProductDetails } from "./use-product-details";
import { useProductFormSubmission } from "./use-product-form-submission";
import { useProductIdentity } from "./use-product-identity";
import { useProductImages } from "./use-product-images";
import { useProductVariants } from "./use-product-variants";

function createId() {
  return crypto.randomUUID();
}

export function AdminProductForm({
  locale,
  product,
  inventorySummary,
  variants = [],
  imagePaths = [],
  imageSources = {},
  categories = [],
  availableCategories = [],
  availableSizeGuides = [],
  digitalFiles = [],
  detailBlocks = [],
}: AdminProductFormProps) {
  const [publishAt, setPublishAt] = useState(
    toProductDateTimeInputValue(product?.publishAt),
  );
  const categoryEditor = useProductCategories(categories, availableCategories);
  const commerceEditor = useProductCommerce(product);
  const identityEditor = useProductIdentity(product);
  const imageEditor = useProductImages(imagePaths);
  const variantEditor = useProductVariants({
    initialVariants: variants,
    productSlug: identityEditor.slug,
    existingProductBasePrice: product ? product.basePrice / 100 : undefined,
    matrixDefaultPrice: Number(commerceEditor.state.basePrice) || 0,
    createId,
  });
  const detailEditor = useProductDetails({
    initialDetails: detailBlocks,
    createId,
  });
  const submission = useProductFormSubmission({
    productId: product?.id,
    onCreated: resetNewProductForm,
  });

  function resetNewProductForm() {
    imageEditor.reset();
    categoryEditor.reset();
    identityEditor.reset();
    commerceEditor.reset();
    setPublishAt("");
    variantEditor.reset();
    detailEditor.reset();
  }

  function generateVariantMatrix() {
    const feedback = variantEditor.generateMatrix();

    submission.showFeedback(feedback);
  }

  function handleTitleChange(value: string) {
    identityEditor.updateFromEnglishTitle(value, variantEditor.syncGeneratedSkus);
  }

  function handleSlugChange(value: string) {
    identityEditor.updateSlug(value, variantEditor.syncGeneratedSkus);
  }

  return (
    <Card className="rounded-none border-black shadow-none">
      <form
        onSubmit={(event) =>
          submission.submit(event, {
            existingImages: imageEditor.payload,
            variants: variantEditor.payload,
            categories: categoryEditor.payload,
            productDetails: detailEditor.payload,
          })
        }
      >
        <input type="hidden" name="variants" value={variantEditor.payload} readOnly />
        <input
          type="hidden"
          name="productDetails"
          value={detailEditor.payload}
          readOnly
        />
        <input
          type="hidden"
          name="categories"
          value={categoryEditor.payload}
          readOnly
        />
        <input
          type="hidden"
          name="existingImages"
          value={imageEditor.payload}
          readOnly
        />
        <CardContent className="space-y-8 pt-8">
          <ProductIdentitySection
            product={product}
            onEnglishTitleChange={handleTitleChange}
          />

          <ProductPricingSection
            slug={identityEditor.slug}
            onSlugChange={handleSlugChange}
            controller={commerceEditor}
          />

          <ProductDigitalSection
            digitalFiles={digitalFiles}
            controller={commerceEditor}
          />

          {!variantEditor.enabled && (
            <ProductStockSection
              inventorySummary={inventorySummary}
              controller={commerceEditor}
            />
          )}

          <ProductFulfillmentSection controller={commerceEditor} />

          <ProductDetailsSection controller={detailEditor} />

          <ProductCategoriesField
            locale={locale}
            availableCategories={availableCategories}
            controller={categoryEditor}
          />

          <ProductPublishingSettings
            isPrivate={product?.isPrivate ?? false}
            publishAt={publishAt}
            onPublishAtChange={setPublishAt}
            sizeGuideId={product?.sizeGuideId ?? ""}
            availableSizeGuides={availableSizeGuides}
          />

          <ProductImagesSection
            controller={imageEditor}
            imageSources={imageSources}
            requireImage={!product}
          />

          <ProductVariantsSection
            controller={variantEditor}
            onGenerateMatrix={generateVariantMatrix}
          />

          {submission.error && (
            <div className="text-sm font-bold text-destructive bg-destructive/10 p-4 border border-destructive uppercase tracking-wider">
              {submission.error}
            </div>
          )}
          {submission.success && (
            <div className="text-sm font-bold text-emerald-700 bg-emerald-50 p-4 border border-emerald-700 uppercase tracking-wider">
              {submission.success}{" "}
              {!product && (
                <a href={`/${locale}`} className="underline">
                  View storefront
                </a>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={submission.isPending}
            className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm transition-colors"
          >
            {submission.isPending
              ? "Saving..."
              : product
                ? "Save Changes"
                : "Save Product"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
