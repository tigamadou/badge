"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations?${params}`);
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
    window.location.href = `/api/admin/${orgId}/events/${eventId}/registrations/export`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Rechercher (nom, email, document)"
          className="border rounded px-2 py-1 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Tous statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuvé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <Button variant="secondary" onClick={load} disabled={busy}>
          Rafraîchir
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            Exporter CSV
          </Button>
          <Link href={`/admin/${orgId}/events/${eventId}/registrations/new`}>
            <Button>Nouvelle inscription</Button>
          </Link>
        </div>
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Badge</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                Aucune inscription.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 font-medium">
                <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="hover:underline">
                  {r.firstName} {r.lastName}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{r.email}</td>
              <td className="px-3 py-2">
                <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: r.category.color }} />
                {r.category.name}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2">{r.badgePrinted ? "Imprimé" : "—"}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="text-sm text-green-600 hover:underline">
                  Détail
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">
          {total} inscription{total > 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Précédent
          </Button>
          <span className="px-2 py-1">Page {page}</span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 25}>
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const c =
    status === "APPROVED"
      ? "bg-green-100 text-green-800"
      : status === "REJECTED"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";
  const l = status === "APPROVED" ? "Approuvé" : status === "REJECTED" ? "Rejeté" : "En attente";
  return <span className={`px-2 py-0.5 rounded text-xs ${c}`}>{l}</span>;
}
