"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function OrgMemberForm({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr("Échec de l'invitation.");
      return;
    }
    setEmail("");
    setName("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">Inviter un OWNER</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input
        placeholder="Nom complet"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        type="email"
        placeholder="email@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi..." : "Inviter"}
      </Button>
    </form>
  );
}
