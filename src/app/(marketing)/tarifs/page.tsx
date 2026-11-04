import Link from "next/link";
import type { Metadata } from "next";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBand } from "@/components/marketing/CtaBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PricingCards } from "@/components/marketing/PricingCards";
import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { displayFont, btnOnNavy } from "@/components/marketing/styles";
import { listPublicPlans } from "@/lib/public-plans";

export const metadata: Metadata = {
  title: "Badge — Tarifs",
  description: "Des offres simples, à l'usage. Changez d'offre à tout moment.",
};

const FAQ = [
  { q: "Puis-je changer d'offre en cours de route ?", a: "Oui, vous pouvez passer à une offre supérieure ou inférieure à tout moment. La montée en gamme est facturée immédiatement au prorata du montant déjà payé ; le passage à une offre moins chère prend effet à l'échéance." },
  { q: "Que se passe-t-il si je dépasse mon quota ?", a: "Vous êtes averti à l'approche de la limite. Aucune inscription n'est perdue : vous pouvez ajuster votre offre pour continuer à collecter." },
  { q: "Y a-t-il un engagement de durée ?", a: "Non. Les offres mensuelles sont sans engagement et résiliables à tout moment. Les contrats Entreprise sont établis selon vos besoins." },
  { q: "Proposez-vous des tarifs associatifs ou publics ?", a: "Oui, des conditions particulières existent pour les établissements publics, l'enseignement et les associations. Contactez-nous pour un devis adapté." },
];

export default async function TarifsPage() {
  const plans = await listPublicPlans();
  return (
    <>
      <section className="border-b border-line bg-white py-[88px] pb-2">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading
            as="h1"
            center
            eyebrow="Tarifs"
            title="Des offres simples, à l'usage"
            lede="Changez d'offre à tout moment : la montée en gamme est facturée au prorata."
          />
          <div className="mb-[88px] mt-[52px]">
            <PricingCards plans={plans} />
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-[1160px] px-7">
            <h2 style={displayFont} className="text-3xl font-bold tracking-tight text-slate-900 md:text-[38px]">
              Comparer les offres
            </h2>
            <ComparisonTable plans={plans} />
          </div>
        </section>
      )}

      <section className="border-y border-line bg-white py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <h2
            style={displayFont}
            className="mx-auto max-w-[720px] text-center text-3xl font-bold tracking-tight text-slate-900 md:text-[38px]"
          >
            Questions sur les tarifs
          </h2>
          <FaqAccordion items={FAQ} defaultOpenFirst />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-[1160px] px-7">
          <CtaBand
            title="Une question sur l'offre adaptée ?"
            body="Parlons de vos événements et trouvons ensemble la formule qui vous convient."
            actions={
              <Link href="/contact" className={btnOnNavy}>
                Demander une démo
              </Link>
            }
          />
        </div>
      </section>
    </>
  );
}
