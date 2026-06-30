import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CatalogPagination({
  basePath,
  currentPage,
  totalPages,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
}) {
  return (
    <nav className="mt-12 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-widest">
      <Button
        asChild
        variant="outline"
        className={`rounded-none border-black text-xs font-bold uppercase tracking-widest ${
          currentPage <= 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Link href={`${basePath}?page=${Math.max(currentPage - 1, 1)}`}>
          Previous
        </Link>
      </Button>
      <span className="text-slate-500">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        asChild
        variant="outline"
        className={`rounded-none border-black text-xs font-bold uppercase tracking-widest ${
          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Link href={`${basePath}?page=${Math.min(currentPage + 1, totalPages)}`}>
          Next
        </Link>
      </Button>
    </nav>
  );
}
