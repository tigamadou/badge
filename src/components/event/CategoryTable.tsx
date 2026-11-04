"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { CatPill, Tag } from "@/components/ui/Labels";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { CategoryForm } from "./CategoryForm";
import { CategoryReassignModal } from "./CategoryReassignModal";
import { CategoryImportTemplatesModal } from "./CategoryImportTemplatesModal";
import { TableFrame } from "@/components/ui/TableFrame";
import { toastSuccess } from "@/lib/toast";

type Cat = {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
  _count: { registrations: number };
};

export function CategoryTable({
  orgId,
  eventId,
  rows: cats,
  allCategories,
  footer,
}: {
  orgId: string;
  eventId: string;
  rows: Cat[];
  // Toutes les categories de l'evenement (cibles de reaffectation), pas seulement la page affichee.
  allCategories: { id: string; name: string; number: number }[];
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reassign, setReassign] = useState<Cat | null>(null);

  // Les lignes viennent de la page serveur (tranche de l'URL) : on la relit apres chaque mutation.
  async function refresh() {
    router.refresh();
    setEditing(null);
    setAdding(false);
    setImporting(false);
    setReassign(null);
  }

  // Renvoie true si la catégorie est supprimée ; sinon la modale de réaffectation s'ouvre (pas de toast).
  async function remove(c: Cat): Promise<boolean> {
    if (c._count.registrations > 0) {
      setReassign(c);
      return false;
    }
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.clone().json().catch(() => ({}));
      if (json.code === "CATEGORY_HAS_REGISTRATIONS") {
        setReassign(c);
        return false;
      }
      throw res;
    }
    return true;
  }

  const modalOpen = adding || editing !== null;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy">Catégories</h1>
          <p className="mt-0.5 text-sm text-slate-400">Catégories de participation de l&apos;événement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Importer un modèle
          </Button>
          <Button onClick={() => setAdding(true)}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="plus" size={16} /> Ajouter
            </span>
          </Button>
        </div>
      </div>

      {importing && (
        <CategoryImportTemplatesModal orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setImporting(false)} />
      )}
      {reassign && (
        <CategoryReassignModal
          orgId={orgId}
          eventId={eventId}
          fromCategory={reassign}
          candidates={allCategories.filter((c) => c.id !== reassign.id)}
          onDone={refresh}
          onCancel={() => setReassign(null)}
        />
      )}

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Options</th>
              <th className="px-4 py-3">Inscriptions</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cats.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon="tags" title="Aucune catégorie" description="Créez la première catégorie." />
                </td>
              </tr>
            )}
            {cats.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-mist">
                <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{c.number}</td>
                <td className="px-4 py-3">
                  <CatPill color={c.color} label={c.name} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.neutralBadge && <Tag>Neutre</Tag>}
                    {c.anonymous && <Tag icon="lock">Anonyme</Tag>}
                    {!c.neutralBadge && !c.anonymous && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{c._count.registrations}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => setEditing(c)}
                      aria-label="Éditer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-slate-600"
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                    <ActionButton
                      variant="link"
                      confirm={c._count.registrations > 0 ? undefined : `Supprimer la catégorie « ${c.name} » ?`}
                      action={() => remove(c)}
                      error="Échec de la suppression."
                      onSuccess={(deleted) => {
                        if (!deleted) return;
                        toastSuccess("Catégorie supprimée.");
                        void refresh();
                      }}
                      aria-label="Supprimer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:no-underline"
                    >
                      <Icon name="trash-2" size={15} />
                    </ActionButton>
                  </div>
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
                {editing ? "Modifier la catégorie" : "Nouvelle catégorie"}
              </h3>
            </div>
            <div className="px-6 py-5">
              <CategoryForm
                orgId={orgId}
                eventId={eventId}
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
