"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { OnsitePrintSettings } from "@/lib/settings";

export type OnsiteTemplateOption = {
  id: string;
  label: string;
  version: number;
  widthMm: number;
  heightMm: number;
  previewSrc: string;
};

// Réglages « Impression sur place » : templates proposés (toutes les versions non
// archivées, une version figée étant ce qu'un évènement utilise), note de l'imprimante
// et marge par défaut.
export function OnsitePrintSettingsForm({
  templates,
  initial,
}: {
  templates: OnsiteTemplateOption[];
  initial: OnsitePrintSettings;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() =>
    initial.templateIds.filter((id) => templates.some((t) => t.id === id)),
  );
  const [note, setNote] = useState(initial.printerNote ?? "");
  const [margin, setMargin] = useState(String(initial.defaultMarginPercent));

  const marginValid = /^\d+$/.test(margin.trim()) && Number(margin) <= 100;

  const save = useAsyncAction(
    async () => {
      const res = await fetch("/api/platform/settings/onsite-print", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateIds: selected,
          printerNote: note.trim() === "" ? null : note.trim(),
          defaultMarginPercent: Number(margin),
        }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Réglages enregistrés.",
      error: "Échec de l'enregistrement des réglages.",
      onSuccess: () => router.refresh(),
    },
  );

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (marginValid) void save.run();
      }}
      className="max-w-2xl space-y-6"
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Templates proposés</legend>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun template installé.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {templates.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={(e) => toggle(t.id, e.target.checked)}
                    disabled={save.pending}
                    className="h-4 w-4 shrink-0 accent-green-600"
                  />
                  <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-100 bg-slate-50">
                    <TemplatePreview src={t.previewSrc} label={t.label} />
                  </span>
                  <span>
                    {t.label} — v{t.version} — {t.widthMm} × {t.heightMm} mm
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div>
        <label htmlFor="onsite-printer-note" className="mb-1 block text-sm font-medium text-slate-700">
          Imprimante (note)
        </label>
        <textarea
          id="onsite-printer-note"
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          disabled={save.pending}
          placeholder="Ex. : Zebra ZC300, cartes CR80"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <Input
        label="Marge par défaut (%)"
        type="number"
        min={0}
        max={100}
        step={1}
        value={margin}
        onChange={(e) => setMargin(e.target.value)}
        disabled={save.pending}
        error={marginValid ? undefined : "Saisir un entier entre 0 et 100."}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={save.pending} disabled={!marginValid}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
