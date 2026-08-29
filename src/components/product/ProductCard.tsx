import Link from "next/link";
import Image from "next/image";
import { formatEur, formatRon } from "@/lib/currency/format";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductImageSrc } from "@/lib/product-images";
import { getProductPricePresentation } from "@/lib/product-pricing";

interface TranslatedText {
  en: string;
  ro: string;
}

interface Product {
  id: string;
  slug: string;
  title?: TranslatedText | null;
  basePrice: number;
  salePrice?: number | null;
  saleEnabled?: boolean | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  imageUrl?: string | null;
  trackStock?: boolean | null;
  stock?: number | null;
}

function getStockLabel(product: Product, locale: "en" | "ro") {
  if (!product.trackStock) {
    return null;
  }

  const availableStock = Math.max(product.stock ?? 0, 0);

  if (availableStock <= 0) {
    return locale === "ro" ? "Stoc epuizat" : "Out of stock";
  }

  return locale === "ro"
    ? `${availableStock} in stoc`
    : `${availableStock} in stock`;
}

export function ProductCard({
  product,
  locale,
  eager = false,
  displayCurrency = "RON",
  ronToEurRate = 0.2,
  catalogDiscount,
}: {
  product: Product;
  locale: "en" | "ro";
  eager?: boolean;
  displayCurrency?: "RON" | "EUR";
  ronToEurRate?: number;
  catalogDiscount?: {
    discountName: string;
    discountedPrice: number;
  };
}) {
  const displayTitle = getTranslatedText(product.title, locale, product.slug);
  const imageSrc = getProductImageSrc(product.imageUrl, "large");
  const price = getProductPricePresentation(product);
  const stockLabel = getStockLabel(product, locale);
  const isOutOfStock = Boolean(product.trackStock) && (product.stock ?? 0) <= 0;
  const finalPrice = catalogDiscount?.discountedPrice ?? price.effectivePrice;
  const comparisonPrice = price.isOnSale ? price.regularPrice : price.effectivePrice;
  const isDiscounted = finalPrice < comparisonPrice;
  const displayPrice =
    displayCurrency === "EUR"
      ? formatEur(finalPrice, ronToEurRate)
      : formatRon(finalPrice);
  const regularDisplayPrice =
    displayCurrency === "EUR"
      ? formatEur(comparisonPrice, ronToEurRate)
      : formatRon(comparisonPrice);

  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="group flex flex-col gap-4"
    >
      <div className="relative aspect-square w-full overflow-hidden border border-slate-200 bg-white">
        <div className="absolute inset-0 bg-black/[0.03] opacity-0 transition-opacity group-hover:opacity-100 z-10" />
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={displayTitle}
            fill
            unoptimized
            loading={eager ? "eager" : "lazy"}
            className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.03] sm:p-6"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-xs">
            Image Placeholder
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <h3 className="break-words font-bold uppercase tracking-tight text-sm">{displayTitle}</h3>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {(price.isOnSale || isDiscounted) && (
            <span className="text-xs line-through">{regularDisplayPrice}</span>
          )}
          <span
            className={
              price.isOnSale || isDiscounted ? "font-black text-destructive" : ""
            }
          >
            {displayPrice}
          </span>
        </div>
        {catalogDiscount && (
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-destructive">
            {catalogDiscount.discountName}
          </p>
        )}
        {stockLabel && (
          <p className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span
              className={`size-1.5 rounded-full ${
                isOutOfStock ? "bg-destructive" : "bg-emerald-500"
              }`}
              aria-hidden="true"
            />
            {stockLabel}
          </p>
        )}
      </div>
    </Link>
  );
}
