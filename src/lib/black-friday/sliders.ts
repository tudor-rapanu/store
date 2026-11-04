type SliderCategory = {
  id: string;
  parentId: string | null;
};

type ProductCategoryLink<P extends { id: string }> = {
  categoryId: string;
  product: P;
};

export type BlackFridaySlider<C, P> = {
  category: C;
  products: P[];
};

// Builds one slider per top-level category (in the order given), each holding the
// discounted products from that category and its subcategories in the order the
// links come in. Categories with no discounted products are left out.
export function buildBlackFridaySliders<
  C extends SliderCategory,
  P extends { id: string },
>({
  categories,
  descendantIdsByCategoryId,
  links,
  discountedProductIds,
  productsPerSlider,
}: {
  categories: C[];
  descendantIdsByCategoryId: Map<string, string[]>;
  links: ProductCategoryLink<P>[];
  discountedProductIds: Set<string>;
  productsPerSlider: number;
}): BlackFridaySlider<C, P>[] {
  const discountedLinks = links.filter((link) =>
    discountedProductIds.has(link.product.id),
  );

  return categories
    .filter((category) => !category.parentId)
    .map((category) => {
      const categoryIds = new Set(
        descendantIdsByCategoryId.get(category.id) ?? [category.id],
      );
      const seen = new Set<string>();
      const sliderProducts: P[] = [];

      for (const link of discountedLinks) {
        if (sliderProducts.length >= productsPerSlider) {
          break;
        }

        if (categoryIds.has(link.categoryId) && !seen.has(link.product.id)) {
          seen.add(link.product.id);
          sliderProducts.push(link.product);
        }
      }

      return { category, products: sliderProducts };
    })
    .filter((slider) => slider.products.length > 0);
}
