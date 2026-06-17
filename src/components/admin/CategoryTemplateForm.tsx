"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Template = {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
};

export function CategoryTemplateForm({
  orgId,
  initial,
  onSaved,
}: {
  orgId: string;
  initial?: Template;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#0066cc");
  const [number, setNumber] = useState(initial?.number ?? 0);
  const [neutralBadge, setNeutralBadge] = useState(initial?.neutralBadge ?? false);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const url = initial
      ? `/api/admin/${orgId}/templates/${initial.id}`
      : `/api/admin/${orgId}/templates`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, number, neutralBadge, anonymous }),
    });
    if (!res.ok) {
      setErr("Échec.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">{initial ? "Modifier" : "Nouveau"} modèle</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <Input
        type="number"
        value={number}
        onChange={(e) => setNumber(Number(e.target.value))}
        min={0}
        max={999}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={neutralBadge}
          onChange={(e) => setNeutralBadge(e.target.checked)}
        />
        Badge neutre
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        Anonyme (pas de photo/nom sur badge)
      </label>
      <Button type="submit">{initial ? "Mettre à jour" : "Créer"}</Button>
    </form>
  );
}
