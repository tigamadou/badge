"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/FormControls";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Initial = { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };

export function CategoryForm({
  orgId,
  eventId,
  initial,
  onSaved,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  initial?: Initial;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#0066cc");
  const [number, setNumber] = useState(initial?.number ?? 0);
  const [neutralBadge, setNeutralBadge] = useState(initial?.neutralBadge ?? false);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [fieldErrors, setFieldErrors] = useState<{ number?: string; name?: string }>({});

  // Motif C : NUMBER_TAKEN / NAME_TAKEN sont rattachés à leur champ, sans toast d'erreur.
  const save = useAsyncAction(
    async (): Promise<{ fieldErrors?: { number?: string; name?: string } }> => {
      const url = initial
        ? `/api/org/${orgId}/events/${eventId}/categories/${initial.id}`
        : `/api/org/${orgId}/events/${eventId}/categories`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, color, number, neutralBadge, anonymous }),
      });
      if (!res.ok) {
        const json = await res.clone().json().catch(() => ({}));
        if (json.code === "NUMBER_TAKEN") {
          return { fieldErrors: { number: `Le numéro ${number} est déjà utilisé dans cet événement.` } };
        }
        if (json.code === "NAME_TAKEN") {
          return { fieldErrors: { name: `Le nom « ${name} » est déjà utilisé dans cet événement.` } };
        }
        throw res;
      }
      return {};
    },
    {
      error: "Échec de l'enregistrement.",
      // Le toast est global : il survit à la fermeture de la modale qui porte ce formulaire.
      onSuccess: (result) => {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          return;
        }
        toastSuccess(initial ? "Catégorie modifiée." : "Catégorie créée.");
        onSaved();
      },
    },
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFieldErrors({});
        void save.run();
      }}
      className="space-y-4"
    >
      <Input
        label="Nom"
        placeholder="Nom"
        value={name}
        error={fieldErrors.name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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
          error={fieldErrors.number}
          onChange={(e) => setNumber(Number(e.target.value))}
          min={0}
          max={999}
        />
      </div>
      <div className="space-y-2">
        <Switch checked={neutralBadge} onChange={setNeutralBadge} label="Badge neutre (couleur grise sur le PDF)" />
        <Switch checked={anonymous} onChange={setAnonymous} label="Anonyme (pas de nom ni de photo sur le badge)" />
      </div>
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" loading={save.pending}>
          {initial ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
