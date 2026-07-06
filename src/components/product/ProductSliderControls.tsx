"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type ProductSliderControlsProps = {
  targetId: string;
  className?: string;
};

export function ProductSliderControls({
  targetId,
  className = "",
}: ProductSliderControlsProps) {
  function scroll(direction: -1 | 1) {
    const scroller = document.getElementById(targetId);

    if (!scroller) {
      return;
    }

    scroller.scrollBy({
      left: direction * Math.max(scroller.clientWidth * 0.85, 280),
      behavior: "smooth",
    });
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll(-1)}
        className="size-10 rounded-none border-black"
        aria-label="Previous products"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll(1)}
        className="size-10 rounded-none border-black"
        aria-label="Next products"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
