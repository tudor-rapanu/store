"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { getProductImageSrc } from "@/lib/product-images";
import {
  getProductGalleryLabel,
  getProductImageLabel,
  getProductPurchaseCopy,
  getViewProductImageLabel,
  type StorefrontLocale,
} from "./product-purchase-copy";

export function ProductImageGallery({
  images,
  title,
  locale,
}: {
  images: string[];
  title: string;
  locale: StorefrontLocale;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];
  const hasMultipleImages = images.length > 1;
  const copy = getProductPurchaseCopy(locale);

  function move(direction: -1 | 1) {
    setActiveIndex((current) => {
      if (images.length === 0) {
        return 0;
      }

      return (current + direction + images.length) % images.length;
    });
  }

  return (
    <div
      className="min-w-0 space-y-4"
      role="region"
      aria-label={getProductGalleryLabel(title, locale)}
    >
      <div className="relative aspect-square overflow-hidden border border-slate-200 bg-white">
        {activeImage ? (
          <div key={activeImage} className="product-gallery-image absolute inset-0">
            <Image
              src={activeImage}
              alt={getProductImageLabel({
                title,
                index: activeIndex + 1,
                total: images.length,
                locale,
              })}
              fill
              priority
              unoptimized
              className="object-contain p-6 sm:p-8"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-300">
            {copy.imagePlaceholder}
          </div>
        )}

        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border border-black bg-white/90 transition-colors hover:bg-black hover:text-white"
              aria-label={copy.previousImage}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border border-black bg-white/90 transition-colors hover:bg-black hover:text-white"
              aria-label={copy.nextImage}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {hasMultipleImages && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-square border bg-white transition-all duration-200 hover:border-black ${
                index === activeIndex ? "border-black" : "border-slate-200"
              }`}
              aria-label={getViewProductImageLabel(index + 1, locale)}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <Image
                src={getProductImageSrc(image, "thumb") ?? image}
                alt=""
                fill
                unoptimized
                className="object-contain p-2"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
