import Link from "next/link";
import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBand } from "@/components/marketing/CtaBand";
import { BadgeCredential } from "@/components/marketing/BadgeCredential";
import { BrowserMock } from "@/components/marketing/BrowserMock";
import { ScannerMock } from "@/components/marketing/ScannerMock";
import { displayFont, btnOnNavy, btnGhostNavy } from "@/components/marketing/styles";

export const metadata: Metadata = {
  title: "Badge — Fonctionnalités",
  description: "De l'inscription en ligne au contrôle d'accès sur site : tout ce qu'il faut pour gérer un événement de bout en bout.",
};

function Tick({ children, onNavy }: { children: React.ReactNode; onNavy?: boolean }) {
  return (
    <li className={`flex items-start gap-3 text-[15px] leading-relaxed ${onNavy ? "text-white/80" : "text-slate-600"}`}>
      <span
        className={`mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${
          onNavy ? "bg-gold/20 text-gold" : "bg-mist text-navy"
        }`}
      >
        <Icon name="check" size={13} />
      </span>
      {children}
    </li>
  );
}

const MORE: { icon: IconName; title: string; desc: string }[] = [
  { icon: "users", title: "Rôles & permissions", desc: "Staff, organisations et événements avec des rôles fins : admin, opérateur, imprimeur, lecteur, auditeur." },
  { icon: "scroll-text", title: "Journal d'activité", desc: "Chaque action tracée avec avant/après et métadonnées, pour l'audit et la conformité." },
  { icon: "building-2", title: "Multi-organisation", desc: "Gérez plusieurs organisations et leurs événements depuis un espace plateforme unique." },
  { icon: "shield-check", title: "Conformité RGPD", desc: "Hébergement européen, export et suppression des données, protection anti-spam." },
  { icon: "download", title: "Exports", desc: "Exportez inscriptions et badges en CSV et PDF, individuellement ou par lot." },
  { icon: "settings", title: "Paramétrage fin", desc: "SMTP, branding, quotas, blocages : adaptez la plateforme à votre contexte." },
];

export default function FonctionnalitesPage() {
  return (
    <>
      <section className="border-b border-line bg-white py-[88px] pb-14">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading
            as="h1"
            center
            eyebrow="Fonctionnalités"
            title="Tout ce qu'il faut pour gérer un événement de bout en bout"
            lede="Une plateforme unique, pensée pour les organisateurs : de l'inscription en ligne au contrôle d'accès sur site, sans tableurs ni outils dispersés."
          />
        </div>
      </section>

      {/* Inscriptions */}
      <section className="py-[88px]">
        <div className="mx-auto grid max-w-[1160px] items-center gap-14 px-7 md:grid-cols-2">
          <div>
            <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-navy">Inscriptions</p>
            <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[38px]">
              Des formulaires publics sur mesure
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Créez un formulaire par événement, avec vos catégories et vos champs. Le lien public se partage en un clic.
            </p>
            <ul className="mt-[22px] flex flex-col gap-3">
              <Tick>Catégories de participants illimitées, chacune avec sa couleur</Tick>
              <Tick>Champs personnalisés, obligatoires ou facultatifs</Tick>
              <Tick>Protection anti-spam (reCAPTCHA) et listes de blocage</Tick>
              <Tick>Ouverture / fermeture des inscriptions en un toggle</Tick>
            </ul>
          </div>
          <BrowserMock url="badge.app/e/salon-pro-2026">
            <label className="mb-1 block text-xs font-medium text-slate-500">Nom complet</label>
            <input
              readOnly
              value="Camille Fabre"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <label className="mb-1 mt-3 block text-xs font-medium text-slate-500">Catégorie</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-3 rounded-xl border-[1.5px] border-navy bg-mist p-4">
                <span className="mt-0.5 h-3.5 w-3.5 flex-none rounded" style={{ background: "#0ea5e9" }} />
                <span className="text-sm font-semibold text-navy">Visiteur</span>
              </div>
              <div className="flex items-start gap-3 rounded-xl border-[1.5px] border-slate-200 p-4">
                <span className="mt-0.5 h-3.5 w-3.5 flex-none rounded" style={{ background: "#8b5cf6" }} />
                <span className="text-sm font-semibold text-navy">Exposant</span>
              </div>
            </div>
            <button className="mt-3.5 w-full rounded-lg bg-navy py-2 text-sm font-medium text-white">
              S&apos;inscrire
            </button>
          </BrowserMock>
        </div>
      </section>

      {/* Moderation */}
      <section className="border-y border-line bg-white py-[88px]">
        <div className="mx-auto grid max-w-[1160px] items-center gap-14 px-7 md:grid-cols-2">
          <BrowserMock url="Inscriptions · 184 en attente">
            <div className="flex items-center gap-3 rounded-lg bg-navy px-4 py-2.5 text-sm text-white">
              <span className="font-semibold">12 sélectionnées</span>
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-[13px]">
                <Icon name="check" size={14} /> Approuver
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-[13px]">
                <Icon name="x" size={14} /> Rejeter
              </span>
            </div>
            <table className="mt-3 w-full text-sm text-slate-700">
              <tbody>
                {[
                  ["Léa Moreau", "pending"],
                  ["Hugo Faure", "approved"],
                  ["Inès Petit", "pending"],
                ].map(([n, s]) => (
                  <tr key={n} className="border-t border-line">
                    <td className="py-2">{n}</td>
                    <td className="py-2 text-right">
                      {s === "approved" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-turquoise-soft px-2 py-0.5 text-xs font-medium text-turquoise-strong">
                          <Icon name="check" size={12} /> Approuvée
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-strong">
                          <Icon name="clock" size={12} /> En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BrowserMock>
          <div className="md:order-first">
            <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-navy">Modération</p>
            <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[38px]">
              Approuvez ou rejetez en masse
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Traitez des centaines de demandes rapidement, avec un historique complet et une détection des doublons.
            </p>
            <ul className="mt-[22px] flex flex-col gap-3">
              <Tick>Actions par lot : approuver, rejeter, exporter</Tick>
              <Tick>Motifs de rejet enregistrés et notifiés</Tick>
              <Tick>Détection de doublons e-mail / document</Tick>
              <Tick>Filtres par statut, catégorie et date</Tick>
            </ul>
          </div>
        </div>
      </section>

      {/* Badges */}
      <section className="py-[88px]">
        <div className="mx-auto grid max-w-[1160px] items-center gap-14 px-7 md:grid-cols-2">
          <div>
            <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-navy">Badges</p>
            <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[38px]">
              Des credentials générés automatiquement
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Un modèle par plateforme, organisation ou événement. Badge produit des credentials cohérents, prêts à
              imprimer.
            </p>
            <ul className="mt-[22px] flex flex-col gap-3">
              <Tick>Modèles hérités et personnalisables</Tick>
              <Tick>QR code de vérification sur chaque badge</Tick>
              <Tick>Génération individuelle ou par lot</Tick>
              <Tick>Export PDF haute qualité</Tick>
            </ul>
          </div>
          <div className="flex justify-center">
            <BadgeCredential />
          </div>
        </div>
      </section>

      {/* Scanner (navy) */}
      <section className="bg-navy py-[88px] text-white">
        <div className="mx-auto grid max-w-[1160px] items-center gap-14 px-7 md:grid-cols-2">
          <div className="md:order-2">
            <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-gold">Contrôle d&apos;accès</p>
            <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight md:text-[38px]">
              Un scanner mobile fiable
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/75">
              Vérifiez les entrées en une seconde, même sans connexion permanente, et gardez la trace de chaque passage.
            </p>
            <ul className="mt-[22px] flex flex-col gap-3">
              <Tick onNavy>Résultat instantané valide / non valide</Tick>
              <Tick onNavy>Contrôle des catégories et zones d&apos;accès</Tick>
              <Tick onNavy>Historique par session et par opérateur</Tick>
              <Tick onNavy>Vérification publique par lien</Tick>
            </ul>
          </div>
          <div className="flex justify-center md:order-1">
            <ScannerMock className="max-w-[260px]" />
          </div>
        </div>
      </section>

      {/* More features */}
      <section className="border-y border-line bg-white py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="Et aussi" title="Les fondations d'une plateforme sérieuse" />
          <div className="mt-[52px] grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-[26px]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-mist text-navy">
                  <Icon name={f.icon} size={22} />
                </div>
                <h3 className="mb-2 text-[17px] font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-[1160px] px-7">
          <CtaBand
            title="Voir Badge en action"
            body="Réservez une démonstration et découvrez comment gérer vos événements sans friction."
            actions={
              <>
                <Link href="/contact" className={btnOnNavy}>
                  Demander une démo
                </Link>
                <Link href="/tarifs" className={btnGhostNavy}>
                  Voir les tarifs
                </Link>
              </>
            }
          />
        </div>
      </section>
    </>
  );
}
