import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/LegalLayout";

export const metadata: Metadata = {
  title: "Badge — Politique de confidentialité",
  description: "Comment Badge protège et traite les données personnelles, conformément au RGPD.",
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="18 juillet 2026">
      <p>
        Badge accorde une importance particulière à la protection des données personnelles. La présente politique décrit
        les traitements réalisés dans le cadre de l&apos;utilisation de la plateforme, conformément au Règlement général
        sur la protection des données (RGPD).
      </p>

      <h2>Responsable de traitement</h2>
      <p>
        Le responsable de traitement des données du site est Badge SAS. Dans le cadre des événements gérés par ses
        clients, Badge agit en qualité de sous-traitant pour le compte de l&apos;organisation cliente, responsable de
        traitement.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>Données de compte : nom, adresse e-mail, organisation, rôle.</li>
        <li>Données d&apos;inscription des participants : identité, catégorie, champs définis par l&apos;organisateur.</li>
        <li>Données techniques : journaux de connexion et d&apos;activité, à des fins de sécurité et d&apos;audit.</li>
      </ul>

      <h2>Finalités</h2>
      <ul>
        <li>Fournir et exploiter le service de gestion d&apos;inscriptions, de badges et de contrôle d&apos;accès.</li>
        <li>Assurer la sécurité, prévenir la fraude et tracer les actions sensibles.</li>
        <li>Communiquer avec les utilisateurs à propos de leur compte et du service.</li>
      </ul>

      <h2>Hébergement &amp; localisation</h2>
      <p>
        Les données sont hébergées au sein de l&apos;Union européenne. Aucune donnée n&apos;est transférée hors de
        l&apos;UE sans garanties appropriées.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les données sont conservées pour la durée nécessaire aux finalités décrites, puis archivées ou supprimées
        conformément aux obligations légales et aux instructions de l&apos;organisation cliente.
      </p>

      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        limitation, d&apos;opposition et de portabilité. Pour exercer ces droits, écrivez à{" "}
        <a href="mailto:privacy@badge.app">privacy@badge.app</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        Le site utilise des cookies strictement nécessaires à son fonctionnement et, le cas échéant, des cookies de
        mesure d&apos;audience anonymisés. Vous pouvez configurer votre navigateur pour les refuser.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative à cette politique, contactez notre délégué à la protection des données à{" "}
        <a href="mailto:privacy@badge.app">privacy@badge.app</a>.
      </p>
    </LegalLayout>
  );
}
