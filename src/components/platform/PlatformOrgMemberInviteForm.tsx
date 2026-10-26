"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// v4 Task 4.2 : le staff invite un membre d'org (role choisi) sans entrer dans /org.
// POST vers l'endpoint plateforme owners (generalise a tous les roles org).
export function PlatformOrgMemberInviteForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "AUDITOR">("OWNER");

  const invite = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${orgId}/owners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Invitation envoyée.",
      error: "Échec de l'invitation.",
      onSuccess: () => {
        setEmail("");
        setName("");
        setRole("OWNER");
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
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "OWNER" | "MANAGER" | "AUDITOR")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        >
          <option value="OWNER">Propriétaire (OWNER)</option>
          <option value="MANAGER">Gestionnaire (MANAGER)</option>
          <option value="AUDITOR">Auditeur (AUDITOR)</option>
        </select>
      </div>
      <Button type="submit" loading={invite.pending}>
        Inviter
      </Button>
    </form>
  );
}
