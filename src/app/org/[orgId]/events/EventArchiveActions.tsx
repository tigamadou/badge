"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Archive / restaure un evenement depuis la liste de l'organisation.
// L'action est reservee a MANAGER+ : la page ne rend ce controle que dans ce cas
// (la route API garde de son cote). L'erreur eventuelle est affichee sur place.
export function EventArchiveActions({
  orgId,
  eventId,
  archived,
}: {
  orgId: string;
  eventId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    if (!archived && !window.confirm("Archiver cet événement ?")) return;
    setBusy(true);
    const res = await fetch(
      `/api/org/${orgId}/events/${eventId}/${archived ? "restore" : "archive"}`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data?.error === "ORG_FORBIDDEN" ? "Action non autorisée." : "Action impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="text-[13px] font-medium text-slate-600 hover:underline disabled:opacity-50"
      >
        {archived ? "Restaurer" : "Archiver"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
