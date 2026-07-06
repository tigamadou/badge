"use client";

import { useState } from "react";
import { OrgMemberForm } from "@/components/admin/OrgMemberForm";
import { Button } from "@/components/ui/Button";

type Member = {
  userId: string;
  email: string;
  name: string;
  archived: boolean;
  role: string;
  invitedAt: string;
};

type MemberApi = {
  userId: string;
  email: string;
  name: string;
  archived: boolean;
  role: string;
  invitedAt: string;
};

export function MembersClient({ orgId, initial }: { orgId: string; initial: Member[] }) {
  const [members, setMembers] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/members`);
    const json = (await res.json()) as { members: MemberApi[] };
    setMembers(
      json.members.map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.name,
        archived: m.archived,
        role: m.role,
        invitedAt: new Date(m.invitedAt).toISOString(),
      })),
    );
  }

  async function remove(userId: string) {
    setErr(null);
    if (!confirm("Retirer ce membre ?")) return;
    const res = await fetch(`/api/admin/${orgId}/members/${userId}`, { method: "DELETE" });
    if (res.status === 409) {
      setErr("Impossible : c'est le dernier OWNER.");
      return;
    }
    if (!res.ok) {
      setErr("Échec.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Membres</h1>
      {err && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <OrgMemberForm orgId={orgId} onAdded={refresh} />

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Rôle</th>
            <th className="px-3 py-2">Invité le</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t">
              <td className="px-3 py-2">{m.name}</td>
              <td className="px-3 py-2">{m.email}</td>
              <td className="px-3 py-2">{m.role}</td>
              <td className="px-3 py-2">{new Date(m.invitedAt).toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(m.userId)}>
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
