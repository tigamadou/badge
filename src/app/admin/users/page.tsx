"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "@/components/admin/UserForm";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [contactsConfigured, setContactsConfigured] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => {
    fetchUsers();
    fetch("/api/settings").then((r) => r.json()).then((settings) => {
      if (settings) {
        setContactsConfigured(!!(settings.contactEmail && settings.contactPhone));
      } else {
        setContactsConfigured(false);
      }
    });
  }, []);

  async function handleCreate(data: { email: string; name: string; role: string; password?: string }) {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchUsers();
  }

  async function handleEdit(data: { email: string; name: string; role: string; password?: string }) {
    if (!editingUser) return;
    await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingUser(null);
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchUsers();
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    OPERATOR: "Operateur",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Utilisateurs</h1>
        <div className="flex items-center gap-3">
          {!contactsConfigured && (
            <span className="text-xs text-amber-600">Contacts non configurés</span>
          )}
          <Button onClick={() => setShowForm(true)} disabled={!contactsConfigured}>Nouvel utilisateur</Button>
        </div>
      </div>

      {(showForm || editingUser) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <UserForm
            initialData={editingUser || undefined}
            onSubmit={editingUser ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditingUser(null); }}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Role</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{roleLabels[user.role] || user.role}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="secondary" onClick={() => setEditingUser(user)}>Modifier</Button>
                    <Button variant="danger" onClick={() => setDeleteId(user.id)}>Supprimer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3 p-4">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{user.name}</span>
                <span className="text-xs text-slate-500 bg-slate-50/50 px-2 py-1 rounded-xl">{roleLabels[user.role] || user.role}</span>
              </div>
              <div className="text-sm text-slate-500">{user.email}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingUser(user)}>Modifier</Button>
                <Button variant="danger" onClick={() => setDeleteId(user.id)}>Supprimer</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!deleteId}
        title="Supprimer l'utilisateur ?"
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
