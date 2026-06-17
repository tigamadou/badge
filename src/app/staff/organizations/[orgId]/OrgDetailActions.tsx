"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgDetailActions({
  org,
  canDelete,
}: {
  org: { id: string; slug: string; archived: boolean };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/archive`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation archivee.");
      router.refresh();
    } else {
      setMsg("Echec de l'archivage.");
    }
  }

  async function restore() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/restore`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation restauree.");
      router.refresh();
    } else {
      setMsg("Echec de la restauration.");
    }
  }

  async function destroy() {
    const typed = window.prompt(
      `Suppression definitive. Pour confirmer, tapez le slug "${org.slug}".`,
    );
    if (typed !== org.slug) {
      setMsg("Confirmation invalide.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-confirm": `delete-${org.slug}`,
      },
      body: JSON.stringify({ confirmSlug: org.slug }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/staff/organizations");
    } else {
      setMsg("Echec de la suppression.");
    }
  }

  return (
    <section className="border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Zone de risque</h2>
      {msg && (
        <div className="mb-2 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
          {msg}
        </div>
      )}
      <div className="flex gap-2">
        {!org.archived && (
          <button
            onClick={archive}
            disabled={busy}
            className="rounded border border-amber-400 text-amber-700 px-3 py-1.5 text-sm hover:bg-amber-50 disabled:opacity-50"
          >
            Archiver
          </button>
        )}
        {org.archived && (
          <button
            onClick={restore}
            disabled={busy}
            className="rounded border border-emerald-500 text-emerald-700 px-3 py-1.5 text-sm hover:bg-emerald-50 disabled:opacity-50"
          >
            Restaurer
          </button>
        )}
        {canDelete && (
          <button
            onClick={destroy}
            disabled={busy}
            className="rounded border border-red-500 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer definitivement
          </button>
        )}
      </div>
      {!canDelete && (
        <p className="mt-2 text-xs text-slate-500">
          La suppression definitive est reservee aux SUPER_ADMIN.
        </p>
      )}
    </section>
  );
}
