"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { TableFrame } from "@/components/ui/TableFrame";

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
  const [editing, setEditing] = useState<RejectionReasonRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editScope, setEditScope] = useState<RejectionScope>("PROFILE");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editError, setEditError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<RejectionReasonRow | null>(null);

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

  function openEdit(reason: RejectionReasonRow) {
    setEditing(reason);
    setEditLabel(reason.label);
    setEditScope(reason.scope);
    setEditSortOrder(String(reason.sortOrder));
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing || busy) return;
    const label = editLabel.trim();
    if (label === "") {
      setEditError("Le libellé est obligatoire.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/platform/rejection-reasons/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        scope: editScope,
        sortOrder: Number.parseInt(editSortOrder, 10) || 0,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setEditError("Erreur de modification.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function confirmArchive() {
    if (!archiving || busy) return;
    setBusy(true);
    const res = await fetch(`/api/platform/rejection-reasons/${archiving.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Erreur d'archivage.");
    }
    setArchiving(null);
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

      <TableFrame>
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
                      onClick={() => openEdit(r)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setArchiving(r)}
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
      </TableFrame>

      <Modal
        open={editing !== null}
        title="Modifier le motif"
        confirmLabel={busy ? "Enregistrement…" : "Enregistrer"}
        onConfirm={saveEdit}
        onCancel={() => setEditing(null)}
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600">Libellé</span>
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              maxLength={200}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-slate-600">Portée</span>
              <select
                value={editScope}
                onChange={(e) => setEditScope(e.target.value as RejectionScope)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="PROFILE">Profil</option>
                <option value="REGISTRATION">Inscription</option>
                <option value="BOTH">Les deux</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Ordre</span>
              <input
                type="number"
                min={0}
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </label>
          </div>
          {editError && <p className="text-red-600">{editError}</p>}
        </div>
      </Modal>

      <Modal
        open={archiving !== null}
        title="Archiver le motif"
        confirmLabel="Archiver"
        confirmVariant="danger"
        onConfirm={confirmArchive}
        onCancel={() => setArchiving(null)}
      >
        Le motif « {archiving?.label} » ne sera plus proposé lors des refus. Les décisions déjà prises
        conservent leur libellé.
      </Modal>
    </div>
  );
}
