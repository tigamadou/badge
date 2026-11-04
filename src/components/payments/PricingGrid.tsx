"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { displayFont, btnPrimaryLg, btnSecondaryLg } from "@/components/marketing/styles";
import type { PublicPlan } from "@/lib/public-plans";

const amountFormat = new Intl.NumberFormat("fr-FR");

type Period = "MONTHLY" | "ANNUAL";

function limitLine(count: number | null, one: string, many: string, unlimited: string): string {
  if (count === null) return unlimited;
  return `${amountFormat.format(count)} ${count > 1 ? many : one}`;
}

// Grille publique des plans. La bascule mensuel / annuel n'existe que si des plans payants des
// deux périodes sont proposés ; un plan sans prix (« Nous contacter ») reste visible dans les deux.
export function PricingGrid({ plans }: { plans: PublicPlan[] }) {
  const [period, setPeriod] = useState<Period>("MONTHLY");

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl border border-slate-200 bg-white p-[30px] text-center">
        <p style={displayFont} className="text-2xl font-bold text-slate-900">
          Tarifs sur demande
        </p>
        <p className="mb-5 mt-2 text-sm text-slate-500">
          Parlez-nous de vos événements : nous vous proposons l&apos;offre adaptée.
        </p>
        <Link href="/contact" className={btnPrimaryLg}>
          Nous contacter
        </Link>
      </div>
    );
  }

  const paid = plans.filter((p) => p.price !== null);
  const hasBoth = paid.some((p) => p.period === "MONTHLY") && paid.some((p) => p.period === "ANNUAL");
  const shown = hasBoth ? plans.filter((p) => p.price === null || p.period === period) : plans;

  return (
    <div>
      {hasBoth && (
        <div className="mb-8 flex justify-center">
          <div role="group" aria-label="Période de facturation" className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {(["MONTHLY", "ANNUAL"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={`min-h-[40px] rounded-full px-5 text-sm font-medium transition-colors ${
                  period === p ? "bg-green-600 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p === "MONTHLY" ? "Mensuel" : "Annuel"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-[420px] grid-cols-1 items-start gap-[22px] md:max-w-none md:grid-cols-2 lg:grid-cols-3">
        {shown.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl bg-white p-[30px] ${
              plan.highlighted
                ? "border border-green-600 shadow-[0_0_0_1px_var(--color-green-600,#16a34a)]"
                : "border border-slate-200"
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-[30px] rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-white">
                Le plus choisi
              </span>
            )}
            <div className="text-base font-semibold text-slate-900">{plan.name}</div>
            <div className="mb-1 mt-4">
              {plan.price === null ? (
                <span style={displayFont} className="text-[32px] font-bold tracking-tight text-slate-900">
                  Sur devis
                </span>
              ) : (
                <>
                  <span style={displayFont} className="text-[34px] font-bold tracking-tight text-slate-900">
                    {amountFormat.format(plan.price)} FCFA
                  </span>
                  <span className="text-sm text-slate-400"> {plan.period === "ANNUAL" ? "/ an" : "/ mois"}</span>
                </>
              )}
            </div>
            <p className="mb-[22px] min-h-[42px] text-sm leading-relaxed text-slate-500">{plan.description}</p>
            <ul className="mb-[26px] flex flex-1 flex-col gap-3 border-t border-slate-100 pt-[22px]">
              {[
                limitLine(plan.maxEvents, "événement", "événements", "Événements illimités"),
                `${limitLine(plan.maxParticipantsPerEvent, "participant", "participants", "Participants illimités")} / événement`,
                ...plan.features,
              ].map((line, i) => (
                <li key={`${i}-${line}`} className="flex items-start gap-2.5 text-sm leading-snug text-slate-600">
                  <span className="mt-0.5 flex-none text-green-600">
                    <Icon name="check" size={16} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            {plan.price === null ? (
              <Link href="/contact" className={btnSecondaryLg}>
                Nous contacter
              </Link>
            ) : (
              <Link href="/login" className={plan.highlighted ? btnPrimaryLg : btnSecondaryLg}>
                Choisir ce plan
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
