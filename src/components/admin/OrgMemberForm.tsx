"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export function OrgMemberForm({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "AUDITOR">("MANAGER");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/org/${orgId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr("Échec de l'invitation.");
      return;
    }
    setEmail("");
    setName("");
    setRole("MANAGER");
    onAdded();
  }

  return (
    <Card>
      <CardHead title="Inviter un membre" subtitle="Un e-mail d'invitation sera envoyé au rôle choisi." />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          {err && (
            <Alert tone="err">
              <Icon name="alert-triangle" size={16} /> {err}
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              type="email"
              placeholder="email@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Rôle</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "OWNER" | "MANAGER" | "AUDITOR")}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="OWNER">Propriétaire (OWNER) — pleins pouvoirs sur l&apos;organisation</option>
              <option value="MANAGER">Gestionnaire (MANAGER) — gère les événements</option>
              <option value="AUDITOR">Auditeur (AUDITOR) — lecture seule</option>
            </select>
          </label>
          <Button type="submit" className="flex items-center justify-center gap-2" disabled={loading}>
            {loading ? (
              <>
                <Spinner size={16} /> Envoi…
              </>
            ) : (
              <>
                <Icon name="send" size={16} /> Inviter
              </>
            )}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
