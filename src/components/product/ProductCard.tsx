import Link from "next/link";
import Image from "next/image";
import { formatEur, formatRon } from "@/lib/currency/format";
import { getProductImageSrc } from "@/lib/product-images";

interface TranslatedText {
  en: string;
  ro: string;
}

interface Product {
  id: string;
  slug: string;
  title: TranslatedText;
  basePrice: number;
  imageUrl?: string | null;
}

export function ProductCard({
  product,
  locale,
  eager = false,
  displayCurrency = "RON",
  ronToEurRate = 0.2,
}: {
  product: Product;
  locale: "en" | "ro";
  eager?: boolean;
  displayCurrency?: "RON" | "EUR";
  ronToEurRate?: number;
}) {
  const displayTitle = product.title[locale] || product.title.en;
  const imageSrc = getProductImageSrc(product.imageUrl, "card");
  const displayPrice =
    displayCurrency === "EUR"
      ? formatEur(product.basePrice, ronToEurRate)
      : formatRon(product.basePrice);

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
        <h3 className="font-bold uppercase tracking-tight text-sm">
          {displayTitle}
        </h3>
        <p className="text-sm text-slate-500">{displayPrice}</p>
      </div>
    </Link>
  );
}
