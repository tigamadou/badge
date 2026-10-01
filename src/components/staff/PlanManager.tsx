"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function parseLimit(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    return Number.parseInt(t, 10);
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
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
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error === "NAME_TAKEN" ? "Ce nom de plan existe déjà." : "Erreur de création.");
      return;
    }
    setName("");
    setPeriod("MONTHLY");
    setMaxEvents("");
    setMaxParticipants("");
    router.refresh();
  }

  async function toggleArchive(plan: PlanRow) {
    setBusy(true);
    await fetch(`/api/platform/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !plan.archived }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={createPlan}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Période</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="MONTHLY">Mensuel (30 jours)</option>
            <option value="ANNUAL">Annuel (365 jours)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Max events (vide = illimité)</span>
          <input
            type="number"
            min={0}
            value={maxEvents}
            onChange={(e) => setMaxEvents(e.target.value)}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Max participants/event</span>
          <input
            type="number"
            min={0}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Créer le plan
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

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
                <button
                  onClick={() => toggleArchive(p)}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {p.archived ? "Restaurer" : "Archiver"}
                </button>
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
    </div>
  );
}
