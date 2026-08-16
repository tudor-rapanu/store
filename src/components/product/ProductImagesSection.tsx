"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductImageSrc } from "@/lib/product-images";
import type { ProductImagesController } from "./use-product-images";

type ProductImagesSectionProps = {
  controller: ProductImagesController;
  imageSources: Record<string, string | null>;
  requireImage: boolean;
};

export function ProductImagesSection({
  controller,
  imageSources,
  requireImage,
}: ProductImagesSectionProps) {
  return (
    <section className="space-y-4 border border-black p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">Product Images</h2>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Reorder, delete, or upload more images for the gallery.
        </p>
      </div>

      {controller.paths.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {controller.paths.map((imagePath, index) => {
            const src = imageSources[imagePath] ?? getProductImageSrc(imagePath);

            return (
              <div key={imagePath} className="space-y-2">
                <div className="relative aspect-square overflow-hidden border border-slate-200 bg-white">
                  {src && (
                    <Image
                      src={src}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-2"
                    />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => controller.move(index, -1)}
                    className="rounded-none border-black"
                    aria-label="Move image up"
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => controller.move(index, 1)}
                    className="rounded-none border-black"
                    aria-label="Move image down"
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => controller.remove(imagePath)}
                    className="rounded-none border-black"
                    aria-label="Delete image"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Input
        id="images"
        name="images"
        type="file"
        accept="image/png, image/jpeg, image/webp"
        multiple
        required={requireImage && controller.paths.length === 0}
        className="rounded-none border-black"
      />
    </section>
  );
}
