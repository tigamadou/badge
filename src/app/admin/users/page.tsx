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
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => { fetchUsers(); }, []);

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
    OPERATOR: "Opérateur",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button onClick={() => setShowForm(true)}>Nouvel utilisateur</Button>
      </div>

      {(showForm || editingUser) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <UserForm
            initialData={editingUser || undefined}
            onSubmit={editingUser ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditingUser(null); }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
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

      <Modal
        open={!!deleteId}
        title="Supprimer l'utilisateur ?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Supprimer"
        confirmVariant="danger"
      >
        <p>Cette action est irréversible.</p>
      </Modal>
    </div>
  );
}
