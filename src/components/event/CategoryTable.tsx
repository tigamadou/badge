"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryForm } from "./CategoryForm";
import { CategoryReassignModal } from "./CategoryReassignModal";
import { CategoryImportTemplatesModal } from "./CategoryImportTemplatesModal";

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
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Cat[];
}) {
  const [cats, setCats] = useState(initial);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reassign, setReassign] = useState<Cat | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories`);
    const json = await res.json();
    setCats(json.categories);
    setEditing(null);
    setAdding(false);
    setImporting(false);
    setReassign(null);
  }

  async function remove(c: Cat) {
    if (c._count.registrations > 0) {
      setReassign(c);
      return;
    }
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.code === "CATEGORY_HAS_REGISTRATIONS") {
        setReassign(c);
        return;
      }
      alert("Échec de la suppression.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <div className="space-x-2">
          {!adding && !editing && (
            <>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Importer un modèle
              </Button>
              <Button onClick={() => setAdding(true)}>Nouvelle catégorie</Button>
            </>
          )}
        </div>
      </div>

      {adding && <CategoryForm orgId={orgId} eventId={eventId} onSaved={refresh} />}
      {editing && <CategoryForm orgId={orgId} eventId={eventId} initial={editing} onSaved={refresh} />}
      {importing && (
        <CategoryImportTemplatesModal orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setImporting(false)} />
      )}
      {reassign && (
        <CategoryReassignModal
          orgId={orgId}
          eventId={eventId}
          fromCategory={reassign}
          candidates={cats.filter((c) => c.id !== reassign.id)}
          onDone={refresh}
          onCancel={() => setReassign(null)}
        />
      )}

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Couleur</th>
            <th className="px-3 py-2">Neutre</th>
            <th className="px-3 py-2">Anonyme</th>
            <th className="px-3 py-2">Inscriptions</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {cats.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                Aucune catégorie. Créez la première.
              </td>
            </tr>
          )}
          {cats.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-3 py-2">{c.number}</td>
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2">
                <span className="inline-block w-4 h-4 rounded mr-1 align-middle" style={{ background: c.color }} />
                {c.color}
              </td>
              <td className="px-3 py-2">{c.neutralBadge ? "oui" : "non"}</td>
              <td className="px-3 py-2">{c.anonymous ? "oui" : "non"}</td>
              <td className="px-3 py-2">{c._count.registrations}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <Button variant="secondary" onClick={() => setEditing(c)}>
                  Éditer
                </Button>
                <Button variant="secondary" onClick={() => remove(c)}>
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
