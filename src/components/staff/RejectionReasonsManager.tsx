"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RejectionScope = "PROFILE" | "REGISTRATION" | "BOTH";
export type RejectionReasonRow = {
  id: string;
  label: string;
  scope: RejectionScope;
  sortOrder: number;
};

function fmtScope(s: RejectionScope): string {
  return s === "PROFILE" ? "Profil" : s === "REGISTRATION" ? "Inscription" : "Les deux";
}

export function RejectionReasonsManager({
  initial,
  canManage,
}: {
  initial: RejectionReasonRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<RejectionScope>("PROFILE");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/platform/rejection-reasons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, scope, sortOrder: Number.parseInt(sortOrder, 10) || 0 }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Erreur de création.");
      return;
    }
    setLabel("");
    setScope("PROFILE");
    setSortOrder("0");
    router.refresh();
  }

  async function rename(reason: RejectionReasonRow) {
    const next = window.prompt("Nouveau libellé", reason.label);
    if (!next || next.trim() === "" || next === reason.label) return;
    setBusy(true);
    await fetch(`/api/platform/rejection-reasons/${reason.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: next.trim() }),
    });
    setBusy(false);
    router.refresh();
  }

  async function archive(reason: RejectionReasonRow) {
    if (!window.confirm(`Archiver le motif « ${reason.label} » ?`)) return;
    setBusy(true);
    await fetch(`/api/platform/rejection-reasons/${reason.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={create}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-slate-600">Libellé</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Portée</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as RejectionScope)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="PROFILE">Profil</option>
              <option value="REGISTRATION">Inscription</option>
              <option value="BOTH">Les deux</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Ordre</span>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Ajouter
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Libellé</th>
            <th className="py-2">Portée</th>
            <th className="py-2">Ordre</th>
            {canManage && <th className="py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {initial.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 font-medium text-slate-900">{r.label}</td>
              <td className="py-2">{fmtScope(r.scope)}</td>
              <td className="py-2 tabular-nums">{r.sortOrder}</td>
              {canManage && (
                <td className="py-2 text-right">
                  <span className="inline-flex gap-2">
                    <button
                      onClick={() => rename(r)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => archive(r)}
                      disabled={busy}
                      className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Archiver
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
          {initial.length === 0 && (
            <tr>
              <td colSpan={canManage ? 4 : 3} className="py-6 text-center text-slate-400">
                Aucun motif.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
