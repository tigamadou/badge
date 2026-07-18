import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/LegalLayout";

export const metadata: Metadata = {
  title: "Badge — Mentions légales",
  description: "Mentions légales de la plateforme Badge.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updated="18 juillet 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le présent site est édité par Badge SAS, société par actions simplifiée au capital de 50 000 €, immatriculée au
        RCS de Paris sous le numéro 000 000 000, dont le siège social est situé 12 rue de la Convention, 75015 Paris,
        France.
      </p>
      <p>
        Directeur de la publication : la présidence de Badge SAS. Contact :{" "}
        <a href="mailto:contact@badge.app">contact@badge.app</a>.
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site et la plateforme sont hébergés au sein de l&apos;Union européenne. Les coordonnées de l&apos;hébergeur
        sont disponibles sur simple demande à <a href="mailto:contact@badge.app">contact@badge.app</a>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments composant le site (marque, logo, textes, interfaces, structure) est protégé par le
        droit de la propriété intellectuelle. Toute reproduction ou représentation, totale ou partielle, sans
        autorisation écrite préalable est interdite.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Badge s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur ce site. Toutefois, elle ne
        saurait être tenue responsable des omissions, inexactitudes ou carences dans la mise à jour, qu&apos;elles
        soient de son fait ou du fait de tiers.
      </p>

      <h2>Liens hypertextes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers. Badge n&apos;exerce aucun contrôle sur ces sites et
        décline toute responsabilité quant à leur contenu.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur interprétation ou
        leur exécution relève de la compétence des tribunaux français.
      </p>
    </LegalLayout>
  );
}
