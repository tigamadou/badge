"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CategoryTemplateForm } from "@/components/admin/CategoryTemplateForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { CatPill } from "@/components/ui/Labels";
import { Tag } from "@/components/ui/Labels";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";

type Tpl = {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
  createdAt: string;
};

export function TemplatesClient({
  orgId,
  rows: templates,
  footer,
  canManage,
}: {
  orgId: string;
  rows: Tpl[];
  footer?: ReactNode;
  /** `org.templates.manage` : sans elle, la liste est en lecture seule. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [adding, setAdding] = useState(false);

  // Les lignes viennent de la page serveur (tranche de l'URL) : on la relit apres chaque mutation.
  async function refresh() {
    router.refresh();
    setEditing(null);
    setAdding(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/org/${orgId}/templates/${id}`, { method: "DELETE" });
    if (!res.ok) throw res;
  }

  const modalOpen = adding || editing !== null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy">Modèles de catégories</h1>
          <p className="mt-0.5 text-sm text-slate-400">Catégories réutilisables lors de la création d&apos;événements</p>
        </div>
        {canManage && (
          <Button onClick={() => setAdding(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="plus" size={16} /> Ajouter
            </span>
          </Button>
        )}
      </div>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
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
              <tr key={t.id} className="border-t border-slate-100 hover:bg-mist">
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
                  {canManage && (
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      aria-label="Éditer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-slate-600"
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                    <ActionButton
                      variant="link"
                      confirm="Supprimer ce modèle ?"
                      action={() => remove(t.id)}
                      success="Modèle supprimé."
                      error="Échec de la suppression du modèle."
                      onSuccess={() => void refresh()}
                      aria-label="Supprimer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:no-underline"
                    >
                      <Icon name="trash-2" size={15} />
                    </ActionButton>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      {footer}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-base font-semibold text-navy">
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
