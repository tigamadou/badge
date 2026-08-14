"use client";

import { useState } from "react";
import { OrgMemberForm } from "@/components/admin/OrgMemberForm";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { RoleBadge } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

const ORG_ROLES = ["OWNER", "MANAGER", "AUDITOR"] as const;

export function MembersClient({
  orgId,
  initial,
  canManageRoles = false,
}: {
  orgId: string;
  initial: Member[];
  // Seul un OWNER peut changer les roles : sinon le role reste en lecture seule.
  canManageRoles?: boolean;
}) {
  const [members, setMembers] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/org/${orgId}/members`);
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
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, { method: "DELETE" });
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

  async function changeRole(userId: string, role: string) {
    setErr(null);
    setBusyUserId(userId);
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyUserId(null);
    if (res.status === 409) {
      setErr("Impossible : c'est le dernier OWNER.");
      refresh();
      return;
    }
    if (!res.ok) {
      setErr("Échec du changement de rôle.");
      refresh();
      return;
    }
    refresh();
  }

  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Membres</h1>
        <p className="mt-0.5 text-sm text-slate-400">Les membres de votre organisation et leurs rôles</p>
      </div>
      {err && <Alert tone="err">{err}</Alert>}

      {/* Inviter est OWNER-only : on masque le formulaire pour les autres roles. */}
      {canManageRoles && <OrgMemberForm orgId={orgId} onAdded={refresh} />}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Invité le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isLastOwner = m.role === "OWNER" && ownerCount === 1;
              return (
                <tr key={m.userId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {initials(m.name)}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-400">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManageRoles ? (
                      <select
                        aria-label={`Rôle de ${m.email}`}
                        value={m.role}
                        disabled={busyUserId === m.userId}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge tone={m.role === "OWNER" ? "green" : "slate"}>{m.role}</RoleBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500">
                    {new Date(m.invitedAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isLastOwner ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Icon name="lock" size={12} /> Dernier OWNER
                      </span>
                    ) : (
                      <Button variant="secondary" onClick={() => remove(m.userId)}>
                        Retirer
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
