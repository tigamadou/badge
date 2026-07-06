"use client";

import { useState } from "react";
import { CategoryTemplateForm } from "@/components/admin/CategoryTemplateForm";
import { Button } from "@/components/ui/Button";
import { CatPill } from "@/components/ui/Labels";
import { Tag } from "@/components/ui/Labels";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

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

  const modalOpen = adding || editing !== null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Modèles de catégories</h1>
          <p className="mt-0.5 text-sm text-slate-400">Catégories réutilisables lors de la création d&apos;événements</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="plus" size={16} /> Ajouter
          </span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Options</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon="tags" title="Aucun modèle" description="Ajoutez un modèle de catégorie réutilisable." />
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{t.number}</td>
                <td className="px-4 py-3">
                  <CatPill color={t.color} label={t.name} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.neutralBadge && <Tag>Neutre</Tag>}
                    {t.anonymous && <Tag icon="lock">Anonyme</Tag>}
                    {!t.neutralBadge && !t.anonymous && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      aria-label="Éditer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Supprimer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Icon name="trash-2" size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? "Modifier le modèle" : "Nouveau modèle"}
              </h3>
            </div>
            <div className="px-6 py-5">
              <CategoryTemplateForm
                orgId={orgId}
                initial={editing ?? undefined}
                onSaved={refresh}
                onCancel={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
