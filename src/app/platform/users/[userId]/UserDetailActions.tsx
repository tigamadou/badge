"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRoleStr>(
    user.staffRole ?? "STAFF_OBSERVER",
  );

  async function resetPwd() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/platform/users/${user.id}/reset-password`, {
      method: "POST",
    });
    setBusy(false);
    setMsg(res.ok ? "Lien d'invitation regenere." : "Echec de la reinitialisation.");
  }

  async function changeRole() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/platform/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffRole }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Role mis a jour.");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(json.error ?? "Echec du changement de role.");
    }
  }

  async function archive() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/platform/users/${user.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setMsg("Utilisateur archive.");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(json.error ?? "Echec de l'archivage.");
    }
  }

  return (
    <Card>
      <CardHead title="Actions" />
      <CardBody className="space-y-3">
        {msg && <Alert tone="info">{msg}</Alert>}

        {canResetPassword && !user.archived && (
          <Button variant="secondary" onClick={resetPwd} disabled={busy}>
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
            <Button onClick={changeRole} disabled={busy}>
              Changer le rôle
            </Button>
          </div>
        )}

        {canAdmin && !user.archived && !isSelf && (
          <Button variant="danger" onClick={archive} disabled={busy}>
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
