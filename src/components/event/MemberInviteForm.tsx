"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function MemberInviteForm({
  orgId,
  eventId,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER">("OPERATOR");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, role }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.code === "ALREADY_MEMBER") setErr("Cet utilisateur est déjà membre de l'événement.");
      else setErr("Échec de l'invitation.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">Inviter un membre</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        placeholder="Nom (optionnel si l'utilisateur existe)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER")}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="ADMIN">Administrateur (tous droits)</option>
        <option value="OPERATOR">Opérateur (scan + impression)</option>
        <option value="PRINTER">Imprimeur (impression badges)</option>
        <option value="VIEWER">Observateur (vue agrégée)</option>
      </select>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "..." : "Inviter"}
        </Button>
      </div>
    </form>
  );
}
