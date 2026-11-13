"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { readOrThrow } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

type Props = {
  user: {
    id: string;
    isStaff: boolean;
    platformRoleId: string | null;
    archived: boolean;
  };
  // Rôles plateforme attribuables par l'acteur (précalculés par la page).
  platformRoles: AssignableRoleRow[];
  canAssignRole: boolean;
  canArchive: boolean;
  canResetPassword: boolean;
  isSelf: boolean;
};

export function UserDetailActions({ user, platformRoles, canAssignRole, canArchive, canResetPassword, isSelf }: Props) {
  const router = useRouter();
  const [platformRoleId, setPlatformRoleId] = useState(user.platformRoleId ?? "");

  const resetPwd = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}/reset-password`, { method: "POST" });
      await readOrThrow(res);
    },
    { success: "Lien d'invitation régénéré.", error: "Échec de la réinitialisation." },
  );

  const changeRole = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platformRoleId }),
      });
      await readOrThrow(res);
    },
    { success: "Rôle mis à jour.", error: "Échec du changement de rôle.", onSuccess: () => router.refresh() },
  );

  const archive = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/users/${user.id}`, { method: "DELETE" });
      await readOrThrow(res);
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

        {canAssignRole && user.isStaff && !isSelf && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <RoleSelect
                name="platformRoleId"
                label="Rôle plateforme"
                roles={platformRoles}
                value={platformRoleId}
                onChange={setPlatformRoleId}
                disabled={busy}
              />
            </div>
            <Button
              className="mb-4"
              onClick={changeRole.run}
              loading={changeRole.pending}
              disabled={busy || platformRoleId === "" || platformRoleId === user.platformRoleId}
            >
              Changer le rôle
            </Button>
          </div>
        )}

        {canArchive && !user.archived && !isSelf && (
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
