"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MemberInviteForm } from "./MemberInviteForm";

type Member = {
  id: string;
  role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER";
  createdAt: string;
  user: { id: string; email: string; name: string; isStaff: boolean };
};

export function MemberTable({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Member[];
}) {
  const [members, setMembers] = useState(initial);
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/members`);
    const json = await res.json();
    setMembers(json.members);
    setInviting(false);
  }

  async function setRole(m: Member, role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER") {
    await fetch(`/api/admin/${orgId}/events/${eventId}/members/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  async function remove(m: Member) {
    if (!confirm(`Retirer ${m.user.email} ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/members/${m.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Membres</h1>
        {!inviting && <Button onClick={() => setInviting(true)}>Inviter</Button>}
      </div>
      {inviting && <MemberInviteForm orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setInviting(false)} />}
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Rôle</th>
            <th className="px-3 py-2">Depuis</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                Aucun membre. Invitez le premier opérateur.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="px-3 py-2 font-medium">{m.user.name}</td>
              <td className="px-3 py-2">{m.user.email}</td>
              <td className="px-3 py-2">
                <select
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER")}
                  className="border rounded px-2 py-1 text-xs"
                >
                  <option value="ADMIN">Administrateur</option>
                  <option value="OPERATOR">Opérateur</option>
                  <option value="PRINTER">Imprimeur</option>
                  <option value="VIEWER">Observateur</option>
                </select>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(m.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(m)}>
                  Retirer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
