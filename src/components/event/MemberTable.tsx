"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { MemberInviteForm } from "./MemberInviteForm";
import { TableFrame } from "@/components/ui/TableFrame";
import { useAsyncAction } from "@/hooks/useAsyncAction";

function initials(name: string | null): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type MemberRole = "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER";

type Member = {
  id: string;
  role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER";
  createdAt: string;
  user: { id: string; email: string; name: string; isStaff: boolean };
};

export function MemberTable({
  orgId,
  eventId,
  rows: members,
  footer,
}: {
  orgId: string;
  eventId: string;
  rows: Member[];
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    router.refresh();
    setInviting(false);
  }

  async function setRole(m: Member, role: MemberRole) {
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/members/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw res;
  }

  async function remove(m: Member) {
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/members/${m.id}`, { method: "DELETE" });
    if (!res.ok) throw res;
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

      <TableFrame>
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
              <MemberRow key={m.id} member={m} setRole={setRole} remove={remove} refresh={refresh} />
            ))}
          </tbody>
        </table>
      </TableFrame>
      {footer}

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

function MemberRow({
  member: m,
  setRole,
  remove,
  refresh,
}: {
  member: Member;
  setRole: (m: Member, role: MemberRole) => Promise<void>;
  remove: (m: Member) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  // La liste est rechargée aussi en cas d'échec : le select retrouve la valeur serveur.
  const role = useAsyncAction(
    async (value: MemberRole) => {
      try {
        await setRole(m, value);
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
          disabled={role.pending}
          onChange={(e) => role.run(e.target.value as MemberRole)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 disabled:opacity-50"
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
        <ActionButton
          variant="link"
          confirm={`Retirer ${m.user.email} ?`}
          action={() => remove(m)}
          success="Membre retiré."
          error="Échec du retrait du membre."
          onSuccess={() => void refresh()}
          aria-label="Retirer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:no-underline"
        >
          <Icon name="trash-2" size={15} />
        </ActionButton>
      </td>
    </tr>
  );
}
