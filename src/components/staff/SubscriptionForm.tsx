"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PlanOption = { id: string; name: string };
export type SubscriptionState = {
  planId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  overrideMaxEvents: string;
  overrideMaxParticipantsPerEvent: string;
} | null;

function isoDay(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function SubscriptionForm({
  orgId,
  plans,
  current,
}: {
  orgId: string;
  plans: PlanOption[];
  current: SubscriptionState;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(current?.planId ?? plans[0]?.id ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "EXPIRED" | "CANCELLED">(current?.status ?? "ACTIVE");
  const [startDate, setStartDate] = useState(current?.startDate ?? "");
  const [endDate, setEndDate] = useState(current?.endDate ?? "");
  const [overrideMaxEvents, setOverrideMaxEvents] = useState(current?.overrideMaxEvents ?? "");
  const [overrideMaxParticipants, setOverrideMaxParticipants] = useState(
    current?.overrideMaxParticipantsPerEvent ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  function parseLimit(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    return Number.parseInt(t, 10);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    const res = await fetch(`/api/platform/organizations/${orgId}/subscription`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planId,
        status,
        startDate: startDate || undefined,
        endDate: endDate || null,
        overrideMaxEvents: parseLimit(overrideMaxEvents),
        overrideMaxParticipantsPerEvent: parseLimit(overrideMaxParticipants),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Plan</span>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Statut</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Début</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Fin (vide = sans échéance)</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Override max events</span>
          <input
            type="number"
            min={0}
            value={overrideMaxEvents}
            onChange={(e) => setOverrideMaxEvents(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Override max participants/event</span>
          <input
            type="number"
            min={0}
            value={overrideMaxParticipants}
            onChange={(e) => setOverrideMaxParticipants(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !planId}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Enregistrer l&apos;abonnement
        </button>
        {ok && <span className="text-sm text-green-600">Enregistré.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

export { isoDay };
