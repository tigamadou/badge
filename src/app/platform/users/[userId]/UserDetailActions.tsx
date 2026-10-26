"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

type Props = {
  user: {
    id: string;
    isStaff: boolean;
    staffRole: StaffRoleStr | null;
    archived: boolean;
  };
  canAdmin: boolean;
  canEditTopRoles: boolean;
  canResetPassword: boolean;
  isSelf: boolean;
};

export function UserDetailActions({
  user,
  canAdmin,
  canEditTopRoles,
  canResetPassword,
  isSelf,
}: Props) {
  const router = useRouter();
  const [staffRole, setStaffRole] = useState<StaffRoleStr>(
    user.staffRole ?? "STAFF_OBSERVER",
  );

  const resetPwd = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}/reset-password`, { method: "POST" });
      if (!res.ok) throw res;
    },
    { success: "Lien d'invitation régénéré.", error: "Échec de la réinitialisation." },
  );

  const changeRole = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ staffRole }),
      });
      if (!res.ok) throw res;
    },
    { success: "Rôle mis à jour.", error: "Échec du changement de rôle.", onSuccess: () => router.refresh() },
  );

  const archive = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw res;
    },
    { success: "Utilisateur archivé.", error: "Échec de l'archivage.", onSuccess: () => router.refresh() },
  );
  const busy = resetPwd.pending || changeRole.pending || archive.pending;

  return (
    <Card>
      <CardHead title="Actions" />
      <CardBody className="space-y-3">
        {canResetPassword && !user.archived && (
          <Button variant="secondary" onClick={resetPwd.run} loading={resetPwd.pending} disabled={busy}>
            Renvoyer un lien de configuration de mot de passe
          </Button>
        )}

        {canAdmin && user.isStaff && !isSelf && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as StaffRoleStr)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
              <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
              {canEditTopRoles && <option value="STAFF_ADMIN">STAFF_ADMIN</option>}
              {canEditTopRoles && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
            </select>
            <Button onClick={changeRole.run} loading={changeRole.pending} disabled={busy}>
              Changer le rôle
            </Button>
          </div>
        )}

        {canAdmin && !user.archived && !isSelf && (
          <Button variant="danger" onClick={archive.run} loading={archive.pending} disabled={busy}>
            Archiver l&apos;utilisateur
          </Button>
        )}

        {isSelf && (
          <p className="text-xs text-slate-400">
            Vous ne pouvez ni archiver votre compte ni modifier votre propre rôle.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
