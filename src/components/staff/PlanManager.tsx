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
  archived: boolean;
  subscriptionsCount: number;
};

function fmtLimit(v: number | null): string {
  return v == null ? "Illimité" : String(v);
}

function fmtPeriod(p: PlanPeriod): string {
  return p === "ANNUAL" ? "Annuel" : "Mensuel";
}

export function PlanManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<PlanPeriod>("MONTHLY");
  const [maxEvents, setMaxEvents] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

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
        toastSuccess("Plan créé.");
        router.refresh();
      },
    },
  );

  async function toggleArchive(plan: PlanRow) {
    const res = await fetch(`/api/platform/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !plan.archived }),
    });
    if (!res.ok) throw res;
  }

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
            <th className="py-2">Abonnements</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-b border-slate-100">
              <td className="py-2 font-medium text-slate-900">{p.name}</td>
              <td className="py-2">{fmtPeriod(p.period)}</td>
              <td className="py-2">{fmtLimit(p.maxEvents)}</td>
              <td className="py-2">{fmtLimit(p.maxParticipantsPerEvent)}</td>
              <td className="py-2">{p.subscriptionsCount}</td>
              <td className="py-2 text-right">
                <ActionButton
                  variant="link"
                  className="text-slate-700"
                  action={() => toggleArchive(p)}
                  success={p.archived ? "Plan restauré." : "Plan archivé."}
                  error={p.archived ? "Échec de la restauration." : "Échec de l'archivage."}
                  onSuccess={() => router.refresh()}
                >
                  {p.archived ? "Restaurer" : "Archiver"}
                </ActionButton>
              </td>
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-slate-400">
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
