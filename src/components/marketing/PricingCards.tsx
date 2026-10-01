import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { displayFont, btnPrimaryLg, btnSecondaryLg } from "@/components/marketing/styles";

type Plan = {
  name: string;
  price: string;
  per?: string;
  desc: string;
  features: string[];
  offFeatures?: string[];
  cta: { label: string; href: string };
  hot?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Découverte",
    price: "Gratuit",
    desc: "Pour un premier événement et tester la plateforme.",
    features: ["1 événement actif", "Jusqu'à 100 inscriptions", "Badges PDF + QR", "Scanner mobile"],
    offFeatures: ["Rôles avancés"],
    cta: { label: "Commencer", href: "/login" },
  },
  {
    name: "Pro",
    price: "79 €",
    per: "/ mois",
    desc: "Pour les organisations qui multiplient les événements.",
    features: [
      "Événements illimités",
      "Jusqu'à 10 000 inscriptions / mois",
      "Rôles & permissions avancés",
      "Modèles de badges personnalisés",
      "Journal d'activité complet",
    ],
    cta: { label: "Demander une démo", href: "/contact" },
    hot: true,
  },
  {
    name: "Entreprise",
    price: "Sur devis",
    desc: "Pour les grands comptes et institutions publiques.",
    features: [
      "Volume & SLA sur mesure",
      "SSO & annuaire d'entreprise",
      "Hébergement dédié",
      "Accompagnement dédié",
    ],
    cta: { label: "Nous contacter", href: "/contact" },
  },
];

export function PricingCards({ showOffRows = false }: { showOffRows?: boolean }) {
  return (
    <div className="mx-auto grid max-w-[420px] grid-cols-1 items-start gap-[22px] md:max-w-none md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className={`relative flex flex-col rounded-2xl bg-white p-[30px] ${
            plan.hot ? "border border-green-600 shadow-[0_0_0_1px_var(--color-green-600,#16a34a)]" : "border border-slate-200"
          }`}
        >
          {plan.hot && (
            <span className="absolute -top-3 left-[30px] rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-white">
              Le plus choisi
            </span>
          )}
          <div className="text-base font-semibold text-slate-900">{plan.name}</div>
          <div className="mb-1 mt-4">
            <span style={displayFont} className="text-[40px] font-bold tracking-tight text-slate-900">
              {plan.price}
            </span>
            {plan.per && <span className="text-sm text-slate-400"> {plan.per}</span>}
          </div>
          <p className="mb-[22px] min-h-[42px] text-sm leading-relaxed text-slate-500">{plan.desc}</p>
          <ul className="mb-[26px] flex flex-1 flex-col gap-3 border-t border-slate-100 pt-[22px]">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm leading-snug text-slate-600">
                <span className="mt-0.5 flex-none text-green-600">
                  <Icon name="check" size={16} />
                </span>
                {f}
              </li>
            ))}
            {showOffRows &&
              plan.offFeatures?.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm leading-snug text-slate-400">
                  <span className="mt-0.5 flex-none text-slate-300">
                    <Icon name="x" size={16} />
                  </span>
                  {f}
                </li>
              ))}
          </ul>
          <Link href={plan.cta.href} className={plan.hot ? btnPrimaryLg : btnSecondaryLg}>
            {plan.cta.label}
          </Link>
        </div>
      ))}
    </div>
  );
}
