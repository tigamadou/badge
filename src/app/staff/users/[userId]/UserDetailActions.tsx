"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    const res = await fetch(`/api/staff/users/${user.id}/reset-password`, {
      method: "POST",
    });
    setBusy(false);
    setMsg(res.ok ? "Lien d'invitation regenere." : "Echec de la reinitialisation.");
  }

  async function changeRole() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/users/${user.id}`, {
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
    const res = await fetch(`/api/staff/users/${user.id}`, { method: "DELETE" });
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
    <section className="border-t pt-4 space-y-3">
      <h2 className="text-lg font-semibold">Actions</h2>
      {msg && (
        <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {canResetPassword && !user.archived && (
        <button
          onClick={resetPwd}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Renvoyer un lien de configuration de mot de passe
        </button>
      )}

      {canAdmin && user.isStaff && !isSelf && (
        <div className="flex gap-2 items-center">
          <select
            value={staffRole}
            onChange={(e) => setStaffRole(e.target.value as StaffRoleStr)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
            <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
            {canEditTopRoles && <option value="STAFF_ADMIN">STAFF_ADMIN</option>}
            {canEditTopRoles && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
          </select>
          <button
            onClick={changeRole}
            disabled={busy}
            className="rounded bg-green-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
          >
            Changer le role
          </button>
        </div>
      )}

      {canAdmin && !user.archived && !isSelf && (
        <button
          onClick={archive}
          disabled={busy}
          className="rounded border border-amber-400 text-amber-700 px-3 py-1.5 text-sm hover:bg-amber-50 disabled:opacity-50"
        >
          Archiver l&apos;utilisateur
        </button>
      )}

      {isSelf && (
        <p className="text-xs text-slate-500">
          Vous ne pouvez ni archiver votre compte ni modifier votre propre role.
        </p>
      )}
    </section>
  );
}
