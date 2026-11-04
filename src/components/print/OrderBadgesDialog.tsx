"use client";

import { useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { TableFrame } from "@/components/ui/TableFrame";
import { DEFAULT_PAGE_SIZE } from "@/lib/list-query";
import { OrderModal } from "./OrderModal";

type Row = {
  registrationId: string;
  position: number;
  firstName: string;
  lastName: string;
  categoryName: string;
  status: string;
  badgePrinted: boolean;
};
type Result = { items: Row[]; total: number; page: number; pageSize: number };

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approuvée",
  PENDING: "En attente",
  REJECTED: "Refusée",
};

// Liste paginée des badges d'une commande ; la pagination reste locale (pas d'URL).
export function OrderBadgesDialog({ open, onClose, fetchUrl }: { open: boolean; onClose: () => void; fetchUrl: string }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set("q", search);
    const separator = fetchUrl.includes("?") ? "&" : "?";
    fetch(`${fetchUrl}${separator}${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<Result>) : Promise.reject(res)))
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchUrl, page, pageSize, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <OrderModal open={open} onClose={onClose} title="Badges de la commande" size="xl">
      <div className="space-y-3">
        <label className="block">
          <span className="sr-only">Rechercher un badge</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>
        {failed ? (
          <p className="text-rose-600">La liste n&apos;a pas pu être chargée.</p>
        ) : data === null ? (
          <p className="text-slate-400">Chargement…</p>
        ) : (
          <>
            <TableFrame>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5">Nom</th>
                    <th className="px-4 py-2.5">Catégorie</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5">Imprimé</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.registrationId} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.firstName} {row.lastName}
                      </td>
                      <td className="px-4 py-2.5">{row.categoryName}</td>
                      <td className="px-4 py-2.5">{STATUS_LABELS[row.status] ?? row.status}</td>
                      <td className="px-4 py-2.5">{row.badgePrinted ? "Oui" : "Non"}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        Aucun badge
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableFrame>
            <Pagination
              page={data.page}
              totalPages={totalPages}
              total={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </OrderModal>
  );
}
