"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TableFrame } from "@/components/ui/TableFrame";
import { useAsyncAction } from "@/hooks/useAsyncAction";

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
  const [editing, setEditing] = useState<RejectionReasonRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editScope, setEditScope] = useState<RejectionScope>("PROFILE");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editError, setEditError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<RejectionReasonRow | null>(null);

  const create = useAsyncAction(
    async () => {
      const res = await fetch("/api/platform/rejection-reasons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, scope, sortOrder: Number.parseInt(sortOrder, 10) || 0 }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Motif créé.",
      error: "Erreur de création.",
      onSuccess: () => {
        setLabel("");
        setScope("PROFILE");
        setSortOrder("0");
        router.refresh();
      },
    },
  );

  function openEdit(reason: RejectionReasonRow) {
    setEditing(reason);
    setEditLabel(reason.label);
    setEditScope(reason.scope);
    setEditSortOrder(String(reason.sortOrder));
    setEditError(null);
  }

  const saveEdit = useAsyncAction(
    async () => {
      if (!editing) return;
      const res = await fetch(`/api/platform/rejection-reasons/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          scope: editScope,
          sortOrder: Number.parseInt(editSortOrder, 10) || 0,
        }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Motif modifié.",
      error: "Erreur de modification.",
      onSuccess: () => {
        setEditing(null);
        router.refresh();
      },
    },
  );

  function submitEdit() {
    // Erreur de champ : affichée sous le libellé, sans requête.
    if (editLabel.trim() === "") {
      setEditError("Le libellé est obligatoire.");
      return;
    }
    setEditError(null);
    void saveEdit.run();
  }

  const archive = useAsyncAction(
    async () => {
      if (!archiving) return;
      const res = await fetch(`/api/platform/rejection-reasons/${archiving.id}`, { method: "DELETE" });
      if (!res.ok) throw res;
    },
    {
      success: "Motif archivé.",
      error: "Erreur d'archivage.",
      onSuccess: () => {
        setArchiving(null);
        router.refresh();
      },
    },
  );
  const busy = create.pending || saveEdit.pending || archive.pending;

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create.run();
          }}
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
          <Button type="submit" loading={create.pending} disabled={busy}>
            Ajouter
          </Button>
        </form>
      )}

      <TableFrame className="border-0">
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
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-mist disabled:opacity-50"
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
        confirmLabel="Enregistrer"
        confirmLoading={saveEdit.pending}
        onConfirm={submitEdit}
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
        confirmLoading={archive.pending}
        onConfirm={archive.run}
        onCancel={() => setArchiving(null)}
      >
        Le motif « {archiving?.label} » ne sera plus proposé lors des refus. Les décisions déjà prises
        conservent leur libellé.
      </Modal>
    </div>
  );
}
