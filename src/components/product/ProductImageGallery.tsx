"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProductImageGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];
  const hasMultipleImages = images.length > 1;

  function move(direction: -1 | 1) {
    setActiveIndex((current) => {
      if (images.length === 0) {
        return 0;
      }

      return (current + direction + images.length) % images.length;
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {activeImage ? (
          <div key={activeImage} className="product-gallery-image absolute inset-0">
            <Image
              src={activeImage}
              alt={title}
              fill
              priority
              unoptimized
              className="object-contain p-8"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-300">
            Image Placeholder
          </div>
        )}

        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border border-black bg-white/90 transition-colors hover:bg-black hover:text-white"
              aria-label="Previous product image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center border border-black bg-white/90 transition-colors hover:bg-black hover:text-white"
              aria-label="Next product image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {hasMultipleImages && (
        <div className="grid grid-cols-5 gap-3">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-square border bg-slate-100 transition-all duration-200 hover:border-black ${
                index === activeIndex ? "border-black" : "border-slate-200"
              }`}
              aria-label={`View product image ${index + 1}`}
            >
              <Image
                src={image}
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
