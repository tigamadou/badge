"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { OrgMemberForm } from "@/components/admin/OrgMemberForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import Link from "next/link";
import { RoleBadge } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { readOrThrow } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

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
  role: { id: string; name: string; systemKey: string | null };
  // Rôle non modifiable par l'acteur (soi-même, autre propriétaire).
  roleLocked: boolean;
  // Retrait permis à l'acteur (droit de gestion, et pas un autre propriétaire).
  removable: boolean;
  invitedAt: string;
  // Lien vers l'ajustement des permissions ; absent si l'acteur n'y a pas droit pour ce membre.
  permissionsHref?: string | null;
};

export function MembersClient({
  orgId,
  rows: members,
  ownerCount,
  footer,
  canManageRoles = false,
  roles,
}: {
  orgId: string;
  rows: Member[];
  // Nombre d'OWNER de toute l'organisation (la liste est paginee : on ne peut pas le deduire des lignes).
  ownerCount: number;
  footer?: ReactNode;
  // `org.members.manage` : inviter, changer les rôles et retirer ; sinon la liste reste en lecture seule.
  canManageRoles?: boolean;
  // Rôles attribuables par l'acteur (précalculés par la page).
  roles: AssignableRoleRow[];
}) {
  const router = useRouter();

  // Les lignes viennent de la page serveur (tranche de l'URL) : on la relit apres chaque mutation.
  async function refresh() {
    router.refresh();
  }

  // Le dernier OWNER ne peut ni changer de rôle ni être retiré (409).
  async function removeMember(userId: string) {
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, { method: "DELETE" });
    if (res.status === 409) throw new ActionError("Impossible : c'est le dernier OWNER.");
    await readOrThrow(res);
  }

  async function changeRole(userId: string, roleId: string) {
    const res = await fetch(`/api/org/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    await readOrThrow(res);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Membres</h1>
        <p className="mt-0.5 text-sm text-slate-400">Les membres de votre organisation et leurs rôles</p>
      </div>

      {/* Inviter exige `org.members.manage` : formulaire masqué sinon. */}
      {canManageRoles && <OrgMemberForm orgId={orgId} onAdded={refresh} roles={roles} />}

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
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
                isLastOwner={m.role.systemKey === "OWNER" && ownerCount === 1}
                canManageRoles={canManageRoles}
                roles={roles}
                changeRole={changeRole}
                removeMember={removeMember}
                refresh={refresh}
              />
            ))}
          </tbody>
        </table>
      </TableFrame>
      {footer}
    </div>
  );
}

function MemberRow({
  member: m,
  isLastOwner,
  canManageRoles,
  roles,
  changeRole,
  removeMember,
  refresh,
}: {
  member: Member;
  isLastOwner: boolean;
  canManageRoles: boolean;
  roles: AssignableRoleRow[];
  changeRole: (userId: string, roleId: string) => Promise<void>;
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
    <tr className="border-t border-slate-100 hover:bg-mist">
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
        {canManageRoles && !m.roleLocked ? (
          <RoleSelect
            compact
            name={`role-${m.userId}`}
            label={`Rôle de ${m.email}`}
            roles={roles.some((r) => r.id === m.role.id) ? roles : [{ ...m.role, scope: "ORG", description: null, assignable: false }, ...roles]}
            value={m.role.id}
            disabled={role.pending}
            onChange={(value) => role.run(value)}
          />
        ) : (
          <RoleBadge tone={m.role.systemKey === "OWNER" ? "green" : "slate"}>{m.role.name}</RoleBadge>
        )}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-500">
        {new Date(m.invitedAt).toLocaleDateString("fr-FR")}
      </td>
      <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
        {m.permissionsHref ? (
          <Link href={m.permissionsHref} className="text-[13px] font-medium text-navy hover:underline">
            Permissions
          </Link>
        ) : null}
        {!m.removable ? null : isLastOwner ? (
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
