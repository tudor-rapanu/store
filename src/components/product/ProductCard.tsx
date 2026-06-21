import Link from "next/link";
import Image from "next/image";
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
}: {
  product: Product;
  locale: "en" | "ro";
  eager?: boolean;
}) {
  const displayTitle = product.title[locale] || product.title.en;
  const imageSrc = getProductImageSrc(product.imageUrl);

  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="group flex flex-col gap-4"
    >
      <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={displayTitle}
            fill
            unoptimized
            loading={eager ? "eager" : "lazy"}
            className="object-contain p-6 transition-transform duration-700 group-hover:scale-105"
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
        <p className="text-sm text-slate-500">
          {(product.basePrice / 100).toFixed(2)} RON
        </p>
      </div>
    </Link>
  );
}
