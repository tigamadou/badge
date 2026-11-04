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

// Devis de changement calculé par le serveur (dates en ISO) : le montant exact est figé à la
// création du paiement.
export type QuoteView =
  | {
      allowed: true;
      mode: "IMMEDIATE" | "EXTENSION" | "SCHEDULED";
      listPrice: number;
      credit: number;
      amount: number;
      daysLeft: number | null;
    }
  | { allowed: false; activeUntil: string | null; renewableFrom: string | null };

const amountFormat = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) => `${amountFormat.format(n)} FCFA`;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function activeMessage(q: { activeUntil: string | null; renewableFrom: string | null }): string {
  if (!q.activeUntil) return "Votre abonnement est actif sans échéance.";
  return `Votre abonnement est actif jusqu'au ${fmtDate(q.activeUntil)}${
    q.renewableFrom ? `, renouvelable à partir du ${fmtDate(q.renewableFrom)}` : ""
  }.`;
}

const ERROR_MESSAGES: Record<string, string> = {
  CHANGE_ALREADY_SCHEDULED: "Un changement de plan est déjà programmé.",
  PAYMENTS_DISABLED: "Le paiement en ligne n'est pas disponible pour le moment.",
  NOTHING_TO_PAY: "Votre crédit couvre déjà ce plan : contactez le support.",
  PAYMENT_IN_PROGRESS: "Un paiement est déjà en cours d'ouverture. Réessayez dans un instant.",
  PLAN_NOT_FOR_SALE: "Ce plan n'est plus disponible à la vente.",
};
const DEFAULT_ERROR = "Le paiement n'a pas pu démarrer. Réessayez.";

function limit(v: number | null): string {
  return v == null ? "illimité" : String(v);
}

export function PlanCatalog({
  orgId,
  plans,
  quotes,
  currentPlanId,
  scheduledPlanId,
  canPay,
}: {
  orgId: string;
  plans: CatalogPlan[];
  quotes: Record<string, QuoteView>;
  currentPlanId: string | null;
  scheduledPlanId: string | null;
  canPay: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function label(plan: CatalogPlan, quote: QuoteView | undefined): string {
    if (plan.id === currentPlanId) return "Renouveler";
    if (quote?.allowed && quote.mode === "SCHEDULED") return "Programmer à l'échéance";
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
      setError(
        data?.error === "ALREADY_ACTIVE"
          ? activeMessage({ activeUntil: data.activeUntil ?? null, renewableFrom: data.renewableFrom ?? null })
          : (ERROR_MESSAGES[data?.error] ?? DEFAULT_ERROR),
      );
    } catch {
      setError(DEFAULT_ERROR);
    }
    setPendingId(null);
  }

  const showFrozenNote = Object.values(quotes).some((q) => q.allowed && q.credit > 0);

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
        {plans.map((plan) => {
          const quote = quotes[plan.id];
          const blocked = quote !== undefined && !quote.allowed;
          return (
            <li key={plan.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-medium text-slate-900">
                  {plan.name}
                  {plan.id === currentPlanId && <span className="ml-2 text-xs text-green-600">Plan actuel</span>}
                  {plan.id === scheduledPlanId && <span className="ml-2 text-xs text-slate-500">Programmé</span>}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {fcfa(plan.price)}
                  <span className="text-sm font-normal text-slate-400">
                    {" "}
                    / {plan.period === "ANNUAL" ? "an" : "mois"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {limit(plan.maxEvents)} événement(s) · {limit(plan.maxParticipantsPerEvent)} participants / événement
                </p>
                {quote && !quote.allowed && (
                  <p className="mt-2 text-xs text-slate-600">{activeMessage(quote)}</p>
                )}
                {quote?.allowed && quote.mode === "IMMEDIATE" && quote.credit > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    Prix plein {fcfa(quote.listPrice)} − crédit {fcfa(quote.credit)}
                    {quote.daysLeft !== null && ` (${quote.daysLeft} jour${quote.daysLeft > 1 ? "s" : ""} restant${quote.daysLeft > 1 ? "s" : ""})`}{" "}
                    = {fcfa(quote.amount)} à payer
                  </p>
                )}
              </div>
              {canPay && (
                <Button
                  variant={plan.id === currentPlanId ? "secondary" : "primary"}
                  disabled={pendingId !== null || blocked}
                  loading={pendingId === plan.id}
                  onClick={() => pay(plan.id)}
                >
                  {label(plan, quote)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {showFrozenNote && (
        <p className="text-xs text-slate-400">Le montant exact est figé à la création du paiement.</p>
      )}
    </div>
  );
}
