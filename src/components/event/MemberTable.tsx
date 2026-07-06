"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { MemberInviteForm } from "./MemberInviteForm";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Membres</h1>
          <p className="mt-0.5 text-sm text-slate-400">L&apos;équipe de l&apos;événement et ses rôles</p>
        </div>
        <Button onClick={() => setInviting(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="plus" size={16} /> Inviter
          </span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Depuis</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon="users" title="Aucun membre" description="Invitez le premier opérateur." />
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {initials(m.user.name)}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{m.user.name}</div>
                      <div className="text-xs text-slate-400">{m.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={m.role}
                    onChange={(e) => setRole(m, e.target.value as "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER")}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700"
                  >
                    <option value="ADMIN">Administrateur</option>
                    <option value="OPERATOR">Opérateur</option>
                    <option value="PRINTER">Imprimeur</option>
                    <option value="VIEWER">Observateur</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-400">
                  {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(m)}
                    aria-label="Retirer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon name="trash-2" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-base font-semibold text-slate-900">Inviter un membre</h3>
            </div>
            <div className="px-6 py-5">
              <MemberInviteForm orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setInviting(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
