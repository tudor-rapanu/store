import { PaginationControls } from "@/components/ui/pagination-controls";

export function CatalogPagination({
  basePath,
  currentPage,
  totalPages,
  pageSize,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  pageSize?: number;
}) {
  const hrefForPage = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));

    if (pageSize) {
      params.set("pageSize", String(pageSize));
    }

    return `${basePath}?${params.toString()}`;
  };

  return (
    <PaginationControls
      className="mt-12"
      currentPage={currentPage}
      totalPages={totalPages}
      hrefForPage={hrefForPage}
    />
  );
}
