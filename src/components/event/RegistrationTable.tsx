"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CatPill, Tag } from "@/components/ui/Labels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: string;
  category: { id: string; name: string; color: string; number: number };
};

export function RegistrationTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, startTransition] = useTransition();

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("page", String(page));
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations?${params}`);
    const json = await res.json();
    startTransition(() => {
      setRows(json.registrations);
      setTotal(json.total);
    });
  }, [orgId, eventId, status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    window.location.href = `/api/org/${orgId}/events/${eventId}/registrations/export`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher (nom, e-mail, document)…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Badge</th>
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
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500">{r.email}</td>
                <td className="px-4 py-3">
                  <CatPill color={r.category.color} label={r.category.name} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
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
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {total} inscription{total > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Précédent
          </Button>
          <span className="px-2 text-[13px] tabular-nums text-slate-500">Page {page}</span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 25}>
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
