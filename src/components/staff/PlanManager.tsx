"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/Button";
import { TableFrame } from "@/components/ui/TableFrame";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type PlanPeriod = "MONTHLY" | "ANNUAL";
export type PlanRow = {
  id: string;
  name: string;
  period: PlanPeriod;
  maxEvents: number | null;
  maxParticipantsPerEvent: number | null;
  price: number | null;
  archived: boolean;
  subscriptionsCount: number;
  publicVisible: boolean;
  position: number;
  description: string | null;
  features: string[];
  highlighted: boolean;
};

// Une fonctionnalité par ligne ; les lignes vides sont ignorées.
export function parseFeatures(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

export type PublicSheet = {
  publicVisible: boolean;
  highlighted: boolean;
  position: string;
  description: string;
  featuresText: string;
};

// Corps d'API de la fiche publique : liste vide ou description vide = effacées (null).
export function publicSheetPayload(sheet: PublicSheet) {
  const features = parseFeatures(sheet.featuresText);
  const description = sheet.description.trim();
  return {
    publicVisible: sheet.publicVisible,
    highlighted: sheet.highlighted,
    position: sheet.position.trim() === "" ? 0 : Number(sheet.position),
    description: description === "" ? null : description,
    features: features.length === 0 ? null : features,
  };
}

function sheetOf(plan: PlanRow): PublicSheet {
  return {
    publicVisible: plan.publicVisible,
    highlighted: plan.highlighted,
    position: String(plan.position),
    description: plan.description ?? "",
    featuresText: plan.features.join("\n"),
  };
}

const fieldClass = "w-full rounded-lg border border-slate-300 px-3 py-2";

function fmtLimit(v: number | null): string {
  return v == null ? "Illimité" : String(v);
}

function fmtPrice(v: number | null): string {
  return v == null ? "Non vendu en ligne" : `${new Intl.NumberFormat("fr-FR").format(v)} FCFA`;
}

function fmtPeriod(p: PlanPeriod): string {
  return p === "ANNUAL" ? "Annuel" : "Mensuel";
}

// Édition du prix en ligne : champ vide = null = « Non vendu en ligne ». Une erreur 400 est affichée par le toast.
function PriceCell({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const save = useAsyncAction(
    async () => {
      const t = value.trim();
      const res = await fetch(`/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price: t === "" ? null : Number(t) }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Prix mis à jour.",
      error: "Échec de la mise à jour du prix.",
      onSuccess: () => {
        setEditing(false);
        router.refresh();
      },
    },
  );

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{fmtPrice(plan.price)}</span>
        <Button
          type="button"
          variant="link"
          className="text-slate-700"
          onClick={() => {
            setValue(plan.price == null ? "" : String(plan.price));
            setEditing(true);
          }}
        >
          Modifier le prix
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={100}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Prix (FCFA)"
        placeholder="Non vendu"
        className="w-28 rounded-lg border border-slate-300 px-2 py-1"
      />
      <Button type="button" loading={save.pending} onClick={() => void save.run()}>
        Enregistrer
      </Button>
      <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
        Annuler
      </Button>
    </div>
  );
}

function PublicSheetFields({ sheet, onChange }: { sheet: PublicSheet; onChange: (next: PublicSheet) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={sheet.publicVisible}
          onChange={(e) => onChange({ ...sheet, publicVisible: e.target.checked })}
        />
        Visible sur /tarifs
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={sheet.highlighted}
          onChange={(e) => onChange({ ...sheet, highlighted: e.target.checked })}
        />
        Mis en avant
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Position (ordre d&apos;affichage)</span>
        <input
          type="number"
          min={0}
          max={9999}
          value={sheet.position}
          onChange={(e) => onChange({ ...sheet, position: e.target.value })}
          className={`${fieldClass} sm:w-32`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">Description courte (300 caractères max)</span>
        <input
          value={sheet.description}
          maxLength={300}
          onChange={(e) => onChange({ ...sheet, description: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">Fonctionnalités (une par ligne, 12 max)</span>
        <textarea
          rows={5}
          value={sheet.featuresText}
          onChange={(e) => onChange({ ...sheet, featuresText: e.target.value })}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

// Panneau d'édition de la fiche publique d'un plan (PATCH de tous les champs publics).
function PublicSheetPanel({ plan, onClose }: { plan: PlanRow; onClose: () => void }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<PublicSheet>(() => sheetOf(plan));

  const save = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(publicSheetPayload(sheet)),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Fiche publique mise à jour.",
      error: "Échec de la mise à jour de la fiche publique.",
      onSuccess: () => {
        onClose();
        router.refresh();
      },
    },
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-mist p-4">
      <PublicSheetFields sheet={sheet} onChange={setSheet} />
      <div className="flex gap-2">
        <Button type="button" loading={save.pending} onClick={() => void save.run()}>
          Enregistrer
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function PlanRowView({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function toggleArchive() {
    const res = await fetch(`/api/platform/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !plan.archived }),
    });
    if (!res.ok) throw res;
  }

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-2 font-medium text-slate-900">{plan.name}</td>
        <td className="py-2">{fmtPeriod(plan.period)}</td>
        <td className="py-2">{fmtLimit(plan.maxEvents)}</td>
        <td className="py-2">{fmtLimit(plan.maxParticipantsPerEvent)}</td>
        <td className="py-2"><PriceCell plan={plan} /></td>
        <td className="py-2">
          <div className="flex flex-col items-start gap-1">
            <span className="text-slate-700">
              {plan.publicVisible ? "Visible" : "Masqué"} · position {plan.position}
              {plan.highlighted ? " · mis en avant" : ""}
            </span>
            <Button type="button" variant="link" className="text-slate-700" onClick={() => setEditing((v) => !v)}>
              Fiche publique
            </Button>
          </div>
        </td>
        <td className="py-2">{plan.subscriptionsCount}</td>
        <td className="py-2 text-right">
          <ActionButton
            variant="link"
            className="text-slate-700"
            action={toggleArchive}
            success={plan.archived ? "Plan restauré." : "Plan archivé."}
            error={plan.archived ? "Échec de la restauration." : "Échec de l'archivage."}
            onSuccess={() => router.refresh()}
          >
            {plan.archived ? "Restaurer" : "Archiver"}
          </ActionButton>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-slate-100">
          <td colSpan={8} className="py-3">
            <PublicSheetPanel plan={plan} onClose={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

export function PlanManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<PlanPeriod>("MONTHLY");
  const [maxEvents, setMaxEvents] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [price, setPrice] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PublicSheet>({
    publicVisible: false,
    highlighted: false,
    position: "0",
    description: "",
    featuresText: "",
  });

  function parseLimit(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    return Number.parseInt(t, 10);
  }

  // Motif C : NAME_TAKEN est rattaché au champ « Nom » ; le reste lève une exception (toast).
  const createPlan = useAsyncAction(
    async (): Promise<{ nameError?: string }> => {
      const res = await fetch("/api/platform/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          period,
          maxEvents: parseLimit(maxEvents),
          maxParticipantsPerEvent: parseLimit(maxParticipants),
          price: parseLimit(price),
          ...publicSheetPayload(sheet),
        }),
      });
      if (!res.ok) {
        const j = await res.clone().json().catch(() => ({}));
        if (j.error === "NAME_TAKEN") return { nameError: "Ce nom de plan existe déjà." };
        throw res;
      }
      return {};
    },
    {
      error: "Erreur de création.",
      onSuccess: (result) => {
        if (result.nameError) {
          setNameError(result.nameError);
          return;
        }
        setName("");
        setPeriod("MONTHLY");
        setMaxEvents("");
        setMaxParticipants("");
        setPrice("");
        setSheet({ publicVisible: false, highlighted: false, position: "0", description: "", featuresText: "" });
        toastSuccess("Plan créé.");
        router.refresh();
      },
    },
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNameError(null);
          void createPlan.run();
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto">
          <span className="text-slate-600">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-auto"
          />
          {nameError && <span className="text-sm text-rose-600">{nameError}</span>}
        </label>
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto">
          <span className="text-slate-600">Période</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-auto"
          >
            <option value="MONTHLY">Mensuel (30 jours)</option>
            <option value="ANNUAL">Annuel (365 jours)</option>
          </select>
        </label>
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto">
          <span className="text-slate-600">Max events (vide = illimité)</span>
          <input
            type="number"
            min={0}
            value={maxEvents}
            onChange={(e) => setMaxEvents(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-44"
          />
        </label>
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto">
          <span className="text-slate-600">Max participants/event</span>
          <input
            type="number"
            min={0}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-44"
          />
        </label>
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto">
          <span className="text-slate-600">Prix (FCFA) (vide = non vendu en ligne)</span>
          <input
            type="number"
            min={100}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-44"
          />
        </label>
        <div className="w-full">
          <PublicSheetFields sheet={sheet} onChange={setSheet} />
        </div>
        <Button type="submit" loading={createPlan.pending} className="w-full sm:w-auto">
          Créer le plan
        </Button>
      </form>

      <TableFrame>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Nom</th>
            <th className="py-2">Période</th>
            <th className="py-2">Max events</th>
            <th className="py-2">Max participants/event</th>
            <th className="py-2">Prix</th>
            <th className="py-2">Public</th>
            <th className="py-2">Abonnements</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <PlanRowView key={p.id} plan={p} />
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-slate-400">
                Aucun plan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </TableFrame>
    </div>
  );
}
