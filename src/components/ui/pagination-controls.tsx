import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  className?: string;
};

export function PaginationControls({
  currentPage,
  totalPages,
  hrefForPage,
  className,
}: PaginationControlsProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav
      className={`mt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-bold uppercase tracking-widest ${
        className ?? ""
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <PaginationButton disabled={isFirstPage} href={hrefForPage(1)}>
          First
        </PaginationButton>
        <PaginationButton
          disabled={isFirstPage}
          href={hrefForPage(Math.max(currentPage - 1, 1))}
        >
          Previous
        </PaginationButton>
      </div>
      <span className="text-slate-500">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex flex-wrap gap-2">
        <PaginationButton
          disabled={isLastPage}
          href={hrefForPage(Math.min(currentPage + 1, totalPages))}
        >
          Next
        </PaginationButton>
        <PaginationButton disabled={isLastPage} href={hrefForPage(totalPages)}>
          Last
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({
  disabled,
  href,
  children,
}: {
  disabled: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={`rounded-none border-black text-xs font-bold uppercase tracking-widest ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <Link href={href} aria-disabled={disabled}>
        {children}
      </Link>
    </Button>
  );
}
