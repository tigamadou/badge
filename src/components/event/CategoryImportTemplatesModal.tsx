"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Tpl = { id: string; name: string; color: string; number: number };

export function CategoryImportTemplatesModal({
  orgId,
  eventId,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/org/${orgId}/templates`)
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []))
      .catch(() => setErr("Impossible de charger les modèles."));
  }, [orgId]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Le chargement initial (GET) n'est pas une action : son erreur reste inline dans la modale.
  const { run: submit, pending: busy } = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/categories/import-templates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateIds: selected }),
      });
      if (!res.ok) throw res;
      return selected.length;
    },
    // Le toast est global : il survit à la fermeture de la modale par onDone.
    {
      error: "Échec de l'import.",
      onSuccess: (count) => {
        toastSuccess(`${count} modèle(s) importé(s).`);
        onDone();
      },
    },
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3">
        <h3 className="font-semibold">Importer des modèles de catégories</h3>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun modèle disponible pour cette organisation.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y border rounded">
            {templates.map((t) => (
              <li key={t.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                <span className="inline-block w-4 h-4 rounded" style={{ background: t.color }} />
                <span>#{t.number}</span>
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => submit()} loading={busy} disabled={selected.length === 0}>
            {`Importer (${selected.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
