"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BatchBar, BatchButton } from "@/components/ui/BatchBar";
import { Checkbox } from "@/components/ui/FormControls";
import { CatPill, Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";

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
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations?status=APPROVED&limit=100`);
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
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/print`, {
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
    window.open(`/event/${eventId}/badges/print?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700"
        >
          <option value="unprinted">Non imprimés</option>
          <option value="printed">Imprimés</option>
          <option value="allaccess">All-access</option>
          <option value="all">Tous</option>
        </select>
      </div>

      <BatchBar count={selected.size}>
        <BatchButton icon="eye" onClick={openBatchPdf}>
          Aperçu PDF
        </BatchButton>
        <BatchButton icon="printer" onClick={batchPrint}>
          Marquer imprimés
        </BatchButton>
      </BatchBar>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Badge</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  {busy ? "Chargement…" : "Aucun badge."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    label={<span className="sr-only">Sélectionner {r.firstName}</span>}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {r.firstName} {r.lastName}
                </td>
                <td className="px-4 py-3">
                  <CatPill color={r.category.color} label={`#${r.category.number} ${r.category.name}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.badgePrinted ? (
                      <Tag icon="check">Imprimé</Tag>
                    ) : (
                      <span className="text-xs text-slate-400">Non imprimé</span>
                    )}
                    {r.allAccessGranted && <Tag>ALL ACCESS</Tag>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/event/${eventId}/badges/${r.id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-green-600 hover:underline"
                  >
                    <Icon name="eye" size={14} /> Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
