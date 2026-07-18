import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/LegalLayout";

export const metadata: Metadata = {
  title: "Badge — Conditions générales d'utilisation",
  description: "Conditions générales d'utilisation de la plateforme Badge.",
};

export default function CguPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updated="18 juillet 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;usage de la
        plateforme Badge. En créant un compte ou en utilisant le service, l&apos;utilisateur accepte sans réserve les
        présentes CGU.
      </p>

      <h2>2. Accès au service</h2>
      <p>
        L&apos;accès à la plateforme nécessite un compte valide. L&apos;utilisateur est responsable de la confidentialité
        de ses identifiants et de toute activité réalisée depuis son compte.
      </p>

      <h2>3. Utilisation conforme</h2>
      <ul>
        <li>Ne pas détourner le service de sa finalité de gestion d&apos;événements.</li>
        <li>Ne pas porter atteinte à la sécurité ou à l&apos;intégrité de la plateforme.</li>
        <li>
          Respecter les droits des tiers et la réglementation applicable, notamment en matière de données personnelles.
        </li>
      </ul>

      <h2>4. Responsabilités</h2>
      <p>
        L&apos;organisation cliente demeure responsable des données qu&apos;elle collecte auprès des participants et du
        paramétrage de ses événements. Badge fournit les moyens techniques et s&apos;engage à une obligation de moyens
        quant à la disponibilité du service.
      </p>

      <h2>5. Disponibilité</h2>
      <p>
        Badge met en œuvre les moyens raisonnables pour assurer la continuité du service. Des interruptions peuvent
        survenir pour maintenance ou en cas de force majeure, sans que la responsabilité de Badge puisse être engagée.
      </p>

      <h2>6. Propriété intellectuelle</h2>
      <p>
        La plateforme, ses composants et sa marque restent la propriété exclusive de Badge. Aucune licence n&apos;est
        concédée en dehors du droit d&apos;usage du service souscrit.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        L&apos;utilisateur peut résilier son abonnement à tout moment. Badge peut suspendre ou clôturer un compte en cas
        de manquement grave aux présentes CGU.
      </p>

      <h2>8. Modification des CGU</h2>
      <p>
        Badge peut faire évoluer les présentes CGU. Les utilisateurs sont informés des modifications substantielles. La
        poursuite de l&apos;utilisation vaut acceptation des CGU mises à jour.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes CGU sont régies par le droit français. Tout litige relève de la compétence des tribunaux français,
        sous réserve des dispositions légales impératives.
      </p>
    </LegalLayout>
  );
}
