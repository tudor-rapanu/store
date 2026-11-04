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

// The categories the sale page shows, in order: the ones picked in admin (dropping
// any that no longer exist), or every top-level category when none are picked.
export function selectBlackFridayCategories<C extends SliderCategory>(
  categories: C[],
  selectedIds: string[],
) {
  if (selectedIds.length === 0) {
    return categories.filter((category) => !category.parentId);
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return selectedIds
    .map((id) => categoriesById.get(id))
    .filter((category): category is C => Boolean(category));
}

// Builds one slider per given category (in the order given), each holding the
// discounted products from that category and its subcategories in the order the
// links come in. Categories with no discounted products are left out.
export function buildBlackFridaySliders<
  C extends SliderCategory,
  P extends { id: string },
>({
  sliderCategories,
  descendantIdsByCategoryId,
  links,
  discountedProductIds,
  productsPerSlider,
}: {
  sliderCategories: C[];
  descendantIdsByCategoryId: Map<string, string[]>;
  links: ProductCategoryLink<P>[];
  discountedProductIds: Set<string>;
  productsPerSlider: number;
}): BlackFridaySlider<C, P>[] {
  const discountedLinks = links.filter((link) =>
    discountedProductIds.has(link.product.id),
  );

  return sliderCategories
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
