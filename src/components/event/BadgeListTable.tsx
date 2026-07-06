"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  category: { name: string; color: string; number: number };
};

type Filter = "all" | "printed" | "unprinted" | "allaccess";

export function BadgeListTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("unprinted");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations?status=APPROVED&limit=100`);
    const json = await res.json();
    let r: Row[] = json.registrations ?? [];
    if (filter === "printed") r = r.filter((x) => x.badgePrinted);
    else if (filter === "unprinted") r = r.filter((x) => !x.badgePrinted);
    else if (filter === "allaccess") r = r.filter((x) => x.allAccessGranted);
    setRows(r);
    setBusy(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function batchPrint() {
    if (selected.size === 0) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/print`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    load();
  }

  function openBatchPdf() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    window.open(`/admin/${orgId}/events/${eventId}/badges/print?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="unprinted">Non imprimés</option>
          <option value="printed">Imprimés</option>
          <option value="allaccess">All-access</option>
          <option value="all">Tous</option>
        </select>
        <div className="space-x-2">
          <Button variant="secondary" onClick={openBatchPdf} disabled={selected.size === 0}>
            Aperçu PDF batch
          </Button>
          <Button onClick={batchPrint} disabled={selected.size === 0 || busy}>
            Marquer comme imprimés ({selected.size})
          </Button>
        </div>
      </div>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Imprimé</th>
            <th className="px-3 py-2">All access</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              </td>
              <td className="px-3 py-2 font-medium">
                {r.firstName} {r.lastName}
              </td>
              <td className="px-3 py-2">
                <span
                  className="inline-block w-3 h-3 rounded mr-1 align-middle"
                  style={{ background: r.category.color }}
                />
                #{r.category.number} {r.category.name}
              </td>
              <td className="px-3 py-2">{r.badgePrinted ? "oui" : "non"}</td>
              <td className="px-3 py-2">{r.allAccessGranted ? "oui" : "—"}</td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/${orgId}/events/${eventId}/badges/${r.id}`}
                  className="text-sm text-green-600 hover:underline"
                >
                  Voir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
