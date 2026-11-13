"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { defaultRoleId, readOrThrow } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

// v4 Task 4.2 : le staff invite un membre d'org (role choisi) sans entrer dans /org.
// POST vers l'endpoint plateforme owners (generalise a tous les roles org).
// Les rôles attribuables sont relus par l'API (la page appelante ne passe que `orgId`) ; `roles` les précalcule si connus.
export function PlatformOrgMemberInviteForm({ orgId, roles: initialRoles }: { orgId: string; roles?: AssignableRoleRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<AssignableRoleRow[]>(initialRoles ?? []);
  const [roleId, setRoleId] = useState(initialRoles ? defaultRoleId(initialRoles, "OWNER") : "");

  useEffect(() => {
    if (initialRoles) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/platform/roles/assignable?scope=ORG&orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok || cancelled) return;
      const list = ((await res.json()) as { roles: AssignableRoleRow[] }).roles;
      setRoles(list);
      setRoleId(defaultRoleId(list, "OWNER"));
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, initialRoles]);

  const invite = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${orgId}/owners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, roleId }),
      });
      await readOrThrow(res);
    },
    {
      success: "Invitation envoyée.",
      error: "Échec de l'invitation.",
      onSuccess: () => {
        setEmail("");
        setName("");
        setRoleId(defaultRoleId(roles, "OWNER"));
        router.refresh();
      },
    },
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void invite.run();
      }}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-slate-800">Inviter un membre</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          type="email"
          placeholder="email@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <RoleSelect name="roleId" label="Rôle" roles={roles} value={roleId} onChange={setRoleId} />
      </div>
      <Button type="submit" loading={invite.pending} disabled={!roleId}>
        Inviter
      </Button>
    </form>
  );
}
