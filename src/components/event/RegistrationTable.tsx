"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CatPill, Tag } from "@/components/ui/Labels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import type { RegistrationListDTO } from "@/lib/registration-dto";
import { TableFrame } from "@/components/ui/TableFrame";
import { Pagination } from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, parseListPage } from "@/lib/list-query";

// createdAt est serialise en chaine par NextResponse.json : le Omit rend cette
// difference explicite au lieu de la laisser implicite.
type Row = Omit<RegistrationListDTO, "createdAt"> & { createdAt: string };

export function RegistrationTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Statut, recherche, page et taille vivent dans l'URL (rechargement et lien partageable).
  const { page, pageSize } = parseListPage(searchParams);
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(q);
  const [busy, startTransition] = useTransition();

  // Ecrit des parametres dans l'URL sans empiler l'historique ni remonter la page.
  function updateUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations?${params}`);
    const json = (await res.json()) as { registrations: Row[]; total: number };
    startTransition(() => {
      setRows(json.registrations);
      setTotal(json.total);
    });
    // La page demandee n'existe plus : derniere page non vide.
    const lastPage = Math.max(1, Math.ceil(json.total / pageSize));
    if (page > lastPage) {
      const next = new URLSearchParams(window.location.search);
      if (lastPage > 1) next.set("page", String(lastPage));
      else next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
    }
  }, [orgId, eventId, status, q, page, pageSize, router]);

  useEffect(() => {
    load();
  }, [load]);

  // La recherche n'interroge le serveur qu'une fois la frappe terminee.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === q) return;
      updateUrl({ q: next || null, page: null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  function exportCsv() {
    window.location.href = `/api/org/${orgId}/events/${eventId}/registrations/export`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher (nom, e-mail, document)…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <select
          value={status}
          aria-label="Filtrer par statut"
          onChange={(e) => updateUrl({ status: e.target.value || null, page: null })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700"
        >
          <option value="">Tous statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuvé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <Button variant="secondary" onClick={load} disabled={busy}>
          Rafraîchir
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportCsv} className="flex items-center gap-1.5">
            <Icon name="download" size={16} /> Exporter
          </Button>
          <Link
            href={`/event/${eventId}/registrations/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Icon name="plus" size={16} /> Inscription
          </Link>
        </div>
      </div>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3 hidden md:table-cell">E-mail</th>
              <th className="px-4 py-3 hidden md:table-cell">Catégorie</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 hidden md:table-cell">Badge</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucune inscription.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/event/${eventId}/registrations/${r.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-green-600"
                  >
                    {r.firstName} {r.lastName}
                  </Link>
                  {/* Sous md, l'e-mail passe sous le nom (colonne masquée) */}
                  <div className="md:hidden text-xs text-slate-400">{r.email}</div>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500 hidden md:table-cell">{r.email}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <CatPill color={r.category.color} label={r.category.name} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {r.badgePrinted ? <Tag icon="check">Imprimé</Tag> : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/event/${eventId}/registrations/${r.id}`}
                    className="text-[13px] font-medium text-green-600 hover:underline"
                  >
                    Détail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        total={total}
        pageSize={pageSize}
        onPageChange={(next) => updateUrl({ page: next > 1 ? String(next) : null })}
        onPageSizeChange={(size) =>
          updateUrl({ pageSize: size === DEFAULT_PAGE_SIZE ? null : String(size), page: null })
        }
      />
    </div>
  );
}
