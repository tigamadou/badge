"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TeamForm } from "@/components/admin/TeamForm";

interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
  _count: { registrations: number };
}

export default function CategoriesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    setTeams(await res.json());
  }

  useEffect(() => { fetchTeams(); }, []);

  async function handleCreate(data: { name: string; color: string; number: number }) {
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchTeams();
  }

  async function handleEdit(data: { name: string; color: string; number: number }) {
    if (!editingTeam) return;
    await fetch(`/api/teams/${editingTeam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingTeam(null);
    fetchTeams();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/teams/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchTeams();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Categories</h1>
        <Button onClick={() => setShowForm(true)}>Nouvelle categorie</Button>
      </div>

      {(showForm || editingTeam) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <TeamForm
            initialData={editingTeam || undefined}
            onSubmit={editingTeam ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditingTeam(null); }}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Couleur</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Numero</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Inscriptions</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: team.color }} />
                  </td>
                  <td className="px-4 py-3 font-mono">{team.number}</td>
                  <td className="px-4 py-3 font-medium">{team.name}</td>
                  <td className="px-4 py-3">{team._count.registrations}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="secondary" onClick={() => setEditingTeam(team)}>Modifier</Button>
                    <Button variant="danger" onClick={() => setDeleteId(team.id)}>Supprimer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3 p-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: team.color }} />
                  <span className="font-medium text-slate-700">{team.name}</span>
                </div>
                <span className="font-mono text-slate-500 text-sm">#{team.number}</span>
              </div>
              <div className="text-sm text-slate-500">
                {team._count.registrations} inscription(s)
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingTeam(team)}>Modifier</Button>
                <Button variant="danger" onClick={() => setDeleteId(team.id)}>Supprimer</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!deleteId}
        title="Supprimer la categorie ?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Supprimer"
        confirmVariant="danger"
      >
        <p>Cette action est irreversible.</p>
      </Modal>
    </div>
  );
}
