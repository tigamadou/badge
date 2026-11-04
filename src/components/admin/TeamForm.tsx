"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TeamFormProps {
  initialData?: { id: string; name: string; color: string; number?: number; neutralBadge?: boolean; anonymous?: boolean };
  onSubmit: (data: { name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function TeamForm({ initialData, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || "#1a3a7c");
  const [number, setNumber] = useState(initialData?.number ?? 0);
  const [neutralBadge, setNeutralBadge] = useState(initialData?.neutralBadge ?? false);
  const [anonymous, setAnonymous] = useState(initialData?.anonymous ?? false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, color, number, neutralBadge, anonymous });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom de la catégorie" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Numéro (0-999)</label>
        <input
          type="number"
          min={0}
          max={999}
          value={number}
          onChange={(e) => setNumber(parseInt(e.target.value) || 0)}
          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Couleur</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" />
      </div>
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={neutralBadge}
          onChange={(e) => setNeutralBadge(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-navy focus:ring-navy"
        />
        <span className="text-sm text-slate-700">Badge neutre (fond blanc, couleur sur le texte)</span>
      </label>
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-navy focus:ring-navy"
        />
        <span className="text-sm text-slate-700">Catégorie anonyme (badge sans informations personnelles, invisible sur le formulaire public)</span>
      </label>
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : initialData ? "Modifier" : "Créer"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
