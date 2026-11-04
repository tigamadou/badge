"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PAGE_SIZE_OPTIONS, withListParams } from "@/lib/list-query";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always include first page
  pages.push(1);

  // Pages around current page: current-1, current, current+1
  const rangeStart = Math.max(2, page - 1);
  const rangeEnd = Math.min(totalPages - 1, page + 1);

  if (rangeStart > 2) {
    pages.push("...");
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < totalPages - 1) {
    pages.push("...");
  }

  // Always include last page
  pages.push(totalPages);

  return pages;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (total === 0) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap gap-y-3 justify-between items-center">
      {/* Left: total count */}
      <span className="text-sm text-slate-500">
        {total} résultat{total > 1 ? "s" : ""}
      </span>

      {/* Center: page navigation */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            page <= 1
              ? "opacity-50 cursor-not-allowed text-slate-600"
              : "text-slate-600 hover:bg-mist cursor-pointer"
          }`}
          aria-label="Page précédente"
        >
          &lt;
        </button>

        {/* Page numbers */}
        {pageNumbers.map((p, index) =>
          p === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="px-3 py-1.5 text-sm text-slate-400 select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
                p === page
                  ? "bg-navy text-white cursor-pointer"
                  : "text-slate-600 hover:bg-mist cursor-pointer"
              }`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Next button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            page >= totalPages
              ? "opacity-50 cursor-not-allowed text-slate-600"
              : "text-slate-600 hover:bg-mist cursor-pointer"
          }`}
          aria-label="Page suivante"
        >
          &gt;
        </button>
      </div>

      {/* Right: page size select */}
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
          aria-label="Nombre de résultats par page"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} par page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface UrlPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
}

// Pagination pilotee par l'URL (page / pageSize), pour les listes rendues cote serveur.
export function UrlPagination(props: UrlPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (patch: { page?: number; pageSize?: number }) =>
    router.push(`${pathname}?${withListParams(searchParams.toString(), patch)}`);

  return (
    <Pagination
      {...props}
      onPageChange={(page) => go({ page })}
      onPageSizeChange={(pageSize) => go({ pageSize, page: 1 })}
    />
  );
}
