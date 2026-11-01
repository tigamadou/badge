"use client";

import { useState } from "react";
import type { SubscriptionPeriod } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";

export interface CatalogPlan {
  id: string;
  name: string;
  period: SubscriptionPeriod;
  price: number;
  maxEvents: number | null;
  maxParticipantsPerEvent: number | null;
}

const amountFormat = new Intl.NumberFormat("fr-FR");

const ERROR_MESSAGES: Record<string, string> = {
  CHANGE_ALREADY_SCHEDULED: "Un changement de plan est déjà programmé.",
  PAYMENTS_DISABLED: "Le paiement en ligne n'est pas disponible pour le moment.",
};
const DEFAULT_ERROR = "Le paiement n'a pas pu démarrer. Réessayez.";

function limit(v: number | null): string {
  return v == null ? "illimité" : String(v);
}

export function PlanCatalog({
  orgId,
  plans,
  currentPlanId,
  currentPrice,
  scheduledPlanId,
  canPay,
}: {
  orgId: string;
  plans: CatalogPlan[];
  currentPlanId: string | null;
  currentPrice: number;
  scheduledPlanId: string | null;
  canPay: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function label(plan: CatalogPlan): string {
    if (plan.id === currentPlanId) return "Renouveler";
    if (plan.price < currentPrice) return "Programmer à l'échéance";
    return "Passer à ce plan";
  }

  async function pay(planId: string) {
    setPendingId(planId);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") {
        window.location.assign(data.url);
        return;
      }
      setError(ERROR_MESSAGES[data?.error] ?? DEFAULT_ERROR);
    } catch {
      setError(DEFAULT_ERROR);
    }
    setPendingId(null);
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="err">{error}</Alert>}
      {!canPay && (
        <p className="text-sm text-slate-500">
          Seul le propriétaire de l&apos;organisation peut changer d&apos;abonnement.
        </p>
      )}
      {plans.length === 0 && <p className="text-sm text-slate-400">Aucun plan disponible à la vente.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="font-medium text-slate-900">
                {plan.name}
                {plan.id === currentPlanId && <span className="ml-2 text-xs text-green-600">Plan actuel</span>}
                {plan.id === scheduledPlanId && <span className="ml-2 text-xs text-slate-500">Programmé</span>}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {amountFormat.format(plan.price)} FCFA
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {plan.period === "ANNUAL" ? "an" : "mois"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {limit(plan.maxEvents)} événement(s) · {limit(plan.maxParticipantsPerEvent)} participants / événement
              </p>
            </div>
            {canPay && (
              <Button
                variant={plan.id === currentPlanId ? "secondary" : "primary"}
                disabled={pendingId !== null}
                loading={pendingId === plan.id}
                onClick={() => pay(plan.id)}
              >
                {label(plan)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
