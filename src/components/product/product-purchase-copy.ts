export type StorefrontLocale = "en" | "ro";

const productPurchaseCopy = {
  en: {
    addToCart: "Add to Cart",
    added: "Added",
    addedConfirmation: "Product added to cart.",
    outOfStock: "Out of Stock",
    maximumInCart: "Maximum in cart",
    unavailable: "Unavailable",
    imagePlaceholder: "Image unavailable",
    previousImage: "Previous product image",
    nextImage: "Next product image",
  },
  ro: {
    addToCart: "Adaugă în coș",
    added: "Adăugat",
    addedConfirmation: "Produs adăugat în coș.",
    outOfStock: "Stoc epuizat",
    maximumInCart: "Cantitate maximă în coș",
    unavailable: "Indisponibil",
    imagePlaceholder: "Imagine indisponibilă",
    previousImage: "Imaginea anterioară a produsului",
    nextImage: "Imaginea următoare a produsului",
  },
} as const;

export function getProductPurchaseCopy(locale: StorefrontLocale) {
  return productPurchaseCopy[locale];
}

export function getSelectAttributeLabel(attribute: string, locale: StorefrontLocale) {
  return locale === "ro"
    ? `SELECTEAZĂ ${attribute.toUpperCase()}`
    : `SELECT ${attribute.toUpperCase()}`;
}

export function getProductGalleryLabel(title: string, locale: StorefrontLocale) {
  return locale === "ro"
    ? `Galerie de imagini pentru ${title}`
    : `Image gallery for ${title}`;
}

export function getProductImageLabel({
  title,
  index,
  total,
  locale,
}: {
  title: string;
  index: number;
  total: number;
  locale: StorefrontLocale;
}) {
  return locale === "ro"
    ? `${title}, imaginea ${index} din ${total}`
    : `${title}, image ${index} of ${total}`;
}

export function getViewProductImageLabel(index: number, locale: StorefrontLocale) {
  return locale === "ro"
    ? `Vezi imaginea ${index} a produsului`
    : `View product image ${index}`;
}
