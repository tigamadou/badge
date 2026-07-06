"use client";

import { useState } from "react";
import { CategoryTemplateForm } from "@/components/admin/CategoryTemplateForm";
import { Button } from "@/components/ui/Button";

type Tpl = {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
  createdAt: string;
};

type TplApi = Omit<Tpl, "createdAt"> & { createdAt: string };

export function TemplatesClient({ orgId, initial }: { orgId: string; initial: Tpl[] }) {
  const [templates, setTemplates] = useState(initial);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/templates`);
    const json = (await res.json()) as { templates: TplApi[] };
    setTemplates(json.templates.map((t) => ({ ...t, createdAt: t.createdAt })));
    setEditing(null);
    setAdding(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce modèle ?")) return;
    await fetch(`/api/admin/${orgId}/templates/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Modèles de catégories</h1>
        {!adding && !editing && <Button onClick={() => setAdding(true)}>Nouveau modèle</Button>}
      </div>

      {adding && <CategoryTemplateForm orgId={orgId} onSaved={refresh} />}
      {editing && <CategoryTemplateForm orgId={orgId} initial={editing} onSaved={refresh} />}

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Couleur</th>
            <th className="px-3 py-2">Neutre</th>
            <th className="px-3 py-2">Anonyme</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-3 py-2">{t.number}</td>
              <td className="px-3 py-2">{t.name}</td>
              <td className="px-3 py-2">
                <span
                  className="inline-block w-4 h-4 rounded mr-1 align-middle"
                  style={{ background: t.color }}
                />
                {t.color}
              </td>
              <td className="px-3 py-2">{t.neutralBadge ? "oui" : "non"}</td>
              <td className="px-3 py-2">{t.anonymous ? "oui" : "non"}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <Button variant="secondary" onClick={() => setEditing(t)}>
                  Éditer
                </Button>
                <Button variant="secondary" onClick={() => remove(t.id)}>
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
