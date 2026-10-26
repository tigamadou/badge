"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";

// Enveloppe de ui/Pagination : navigue en conservant les filtres de l'URL.
export function JobsPagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`/platform/jobs?${params.toString()}`);
  }

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      onPageChange={(p) => go({ page: String(p) })}
      onPageSizeChange={(size) => go({ pageSize: String(size), page: "1" })}
    />
  );
}
