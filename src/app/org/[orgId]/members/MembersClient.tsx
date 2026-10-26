"use client";

import { useState } from "react";
import { OrgMemberForm } from "@/components/admin/OrgMemberForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleBadge } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";

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

  // Le dernier OWNER ne peut ni changer de rôle ni être retiré (409).
  async function removeMember(userId: string) {
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, { method: "DELETE" });
    if (res.status === 409) throw new ActionError("Impossible : c'est le dernier OWNER.");
    if (!res.ok) throw res;
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.status === 409) throw new ActionError("Impossible : c'est le dernier OWNER.");
    if (!res.ok) throw res;
  }

  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Membres</h1>
        <p className="mt-0.5 text-sm text-slate-400">Les membres de votre organisation et leurs rôles</p>
      </div>

      {/* Inviter est OWNER-only : on masque le formulaire pour les autres roles. */}
      {canManageRoles && <OrgMemberForm orgId={orgId} onAdded={refresh} />}

      <TableFrame>
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
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                isLastOwner={m.role === "OWNER" && ownerCount === 1}
                canManageRoles={canManageRoles}
                changeRole={changeRole}
                removeMember={removeMember}
                refresh={refresh}
              />
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}

function MemberRow({
  member: m,
  isLastOwner,
  canManageRoles,
  changeRole,
  removeMember,
  refresh,
}: {
  member: Member;
  isLastOwner: boolean;
  canManageRoles: boolean;
  changeRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  // La liste est rechargée aussi en cas d'échec : le select retrouve la valeur serveur.
  const role = useAsyncAction(
    async (value: string) => {
      try {
        await changeRole(m.userId, value);
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    { success: "Rôle mis à jour.", error: "Échec du changement de rôle.", onSuccess: () => void refresh() },
  );

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
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
            disabled={role.pending}
            onChange={(e) => role.run(e.target.value)}
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
          <ActionButton
            confirm="Retirer ce membre ?"
            action={() => removeMember(m.userId)}
            success="Membre retiré."
            error="Échec du retrait du membre."
            onSuccess={() => void refresh()}
          >
            Retirer
          </ActionButton>
        )}
      </td>
    </tr>
  );
}
