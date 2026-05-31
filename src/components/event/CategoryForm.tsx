"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Initial = { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };

export function CategoryForm({
  orgId,
  eventId,
  initial,
  onSaved,
}: {
  orgId: string;
  eventId: string;
  initial?: Initial;
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
      ? `/api/admin/${orgId}/events/${eventId}/categories/${initial.id}`
      : `/api/admin/${orgId}/events/${eventId}/categories`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, number, neutralBadge, anonymous }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.code === "NUMBER_TAKEN") setErr(`Le numéro ${number} est déjà utilisé dans cet événement.`);
      else if (json.code === "NAME_TAKEN") setErr(`Le nom « ${name} » est déjà utilisé dans cet événement.`);
      else setErr("Échec de l'enregistrement.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">{initial ? "Modifier" : "Nouvelle"} catégorie</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex items-center gap-2">
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <Input
          type="number"
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
          min={0}
          max={999}
          className="w-24"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={neutralBadge} onChange={(e) => setNeutralBadge(e.target.checked)} />
        Badge neutre (couleur grise sur le PDF)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Anonyme (pas de nom ni de photo sur le badge)
      </label>
      <Button type="submit">{initial ? "Mettre à jour" : "Créer"}</Button>
    </form>
  );
}
