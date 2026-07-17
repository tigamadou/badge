"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/Feedback";

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
  onCancel,
}: {
  orgId: string;
  initial?: Template;
  onSaved: () => void;
  onCancel?: () => void;
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
      ? `/api/org/${orgId}/templates/${initial.id}`
      : `/api/org/${orgId}/templates`;
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
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert tone="err">{err}</Alert>}
      <Input label="Nom" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Couleur</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 rounded-lg border border-slate-300"
          />
        </label>
        <Input
          label="Numéro"
          type="number"
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
          min={0}
          max={999}
        />
      </div>
      <div className="space-y-2">
        <Switch checked={neutralBadge} onChange={setNeutralBadge} label="Badge neutre" />
        <Switch checked={anonymous} onChange={setAnonymous} label="Anonyme (pas de photo/nom sur badge)" />
      </div>
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit">{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}
