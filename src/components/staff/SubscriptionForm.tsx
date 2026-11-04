"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export type SubscriptionPeriodValue = "MONTHLY" | "ANNUAL";
export type PlanOption = { id: string; name: string; period: SubscriptionPeriodValue };
export type SubscriptionState = {
  planId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  overrideMaxEvents: string;
  overrideMaxParticipantsPerEvent: string;
  endDate: string | null;
} | null;

function periodLabel(p: SubscriptionPeriodValue): string {
  return p === "ANNUAL" ? "Annuel (365 jours)" : "Mensuel (30 jours)";
}

export function SubscriptionForm({
  orgId,
  plans,
  current,
  scheduledPlanName = null,
}: {
  orgId: string;
  plans: PlanOption[];
  current: SubscriptionState;
  scheduledPlanName?: string | null;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(current?.planId ?? plans[0]?.id ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "EXPIRED" | "CANCELLED">(current?.status ?? "ACTIVE");
  const [overrideMaxEvents, setOverrideMaxEvents] = useState(current?.overrideMaxEvents ?? "");
  const [overrideMaxParticipants, setOverrideMaxParticipants] = useState(
    current?.overrideMaxParticipantsPerEvent ?? "",
  );
  // Un abonnement existant s'affiche en resume ; le formulaire n'apparait que sur demande.
  const [editing, setEditing] = useState(current == null);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  function parseLimit(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    return Number.parseInt(t, 10);
  }

  const save = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${orgId}/subscription`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          status,
          overrideMaxEvents: parseLimit(overrideMaxEvents),
          overrideMaxParticipantsPerEvent: parseLimit(overrideMaxParticipants),
        }),
      });
      if (!res.ok) throw res;
    },
    {
      success: "Abonnement enregistré.",
      error: "Erreur à l'enregistrement de l'abonnement.",
      onSuccess: () => {
        setEditing(false);
        router.refresh();
      },
    },
  );
  const busy = save.pending;

  function cancel() {
    setPlanId(current?.planId ?? plans[0]?.id ?? "");
    setStatus(current?.status ?? "ACTIVE");
    setOverrideMaxEvents(current?.overrideMaxEvents ?? "");
    setOverrideMaxParticipants(current?.overrideMaxParticipantsPerEvent ?? "");
    setEditing(false);
  }

  if (!editing && current) {
    const plan = plans.find((p) => p.id === current.planId) ?? null;
    const rows: [string, string][] = [
      ["Plan", plan?.name ?? "—"],
      ["Statut", current.status],
      ["Période", plan ? periodLabel(plan.period) : "—"],
      ["Fin", current.endDate ? new Date(current.endDate).toLocaleDateString("fr-FR") : "Sans échéance"],
      ...(scheduledPlanName
        ? [
            [
              "Changement programmé",
              `${scheduledPlanName}${current.endDate ? ` le ${new Date(current.endDate).toLocaleDateString("fr-FR")}` : ""}`,
            ] as [string, string],
          ]
        : []),
      ["Override max events", current.overrideMaxEvents || "—"],
      ["Override max participants/event", current.overrideMaxParticipantsPerEvent || "—"],
    ];
    return (
      <div className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-mist"
          >
            Modifier
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
      className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
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
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">Période</span>
        <p className="rounded-lg border border-slate-200 bg-mist px-3 py-2 text-slate-700">
          {selectedPlan ? periodLabel(selectedPlan.period) : "—"}
        </p>
        <span className="text-xs text-slate-500">
          Définie par le plan. Les dates de début et de fin sont calculées à l&apos;enregistrement.
        </span>
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
        <Button type="submit" loading={busy} disabled={!planId}>
          Enregistrer l&apos;abonnement
        </Button>
        {current && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-mist disabled:opacity-50"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

