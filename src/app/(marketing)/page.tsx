import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { resolveHomeRedirect } from "@/lib/org-redirect";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBand } from "@/components/marketing/CtaBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { BadgeCredential } from "@/components/marketing/BadgeCredential";
import { BrowserMock } from "@/components/marketing/BrowserMock";
import { ScannerMock } from "@/components/marketing/ScannerMock";
import { PricingCards } from "@/components/marketing/PricingCards";
import { displayFont, btnPrimaryLg, btnSecondaryLg, btnOnNavy, btnGhostNavy } from "@/components/marketing/styles";

export const metadata: Metadata = {
  title: "Badge — Inscriptions, badges & contrôle d'accès pour vos événements",
  description:
    "Collectez les inscriptions, modérez-les, générez des badges PDF avec QR code et contrôlez chaque entrée par scan, depuis une seule plateforme.",
};

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "user-check", title: "Inscriptions en ligne", desc: "Formulaires publics personnalisables par événement, avec catégories, champs sur mesure et protection anti-spam." },
  { icon: "check-circle", title: "Modération & approbation", desc: "Validez ou rejetez les demandes en masse, avec motifs de rejet, détection de doublons et listes de blocage." },
  { icon: "id-card", title: "Badges PDF + QR", desc: "Modèles réutilisables aux couleurs de vos catégories, génération individuelle ou par lot, prêts à imprimer." },
  { icon: "scan-line", title: "Contrôle d'accès par scan", desc: "Application de scan sur mobile, résultat instantané valide / non valide, historique des passages par session." },
  { icon: "users", title: "Rôles & permissions", desc: "Gérez équipes staff, organisations et événements avec des rôles fins : admin, opérateur, imprimeur, lecteur." },
  { icon: "scroll-text", title: "Journal d'activité", desc: "Traçabilité complète de chaque action, avec avant/après et métadonnées, pour l'audit et la conformité." },
];

const STEPS = [
  { n: 1, title: "Créez l'événement", desc: "Configurez les dates, les catégories de participants et le formulaire d'inscription en quelques minutes, puis publiez le lien public." },
  { n: 2, title: "Collectez & modérez", desc: "Suivez les inscriptions en temps réel, approuvez ou rejetez, et laissez Badge générer les credentials automatiquement." },
  { n: 3, title: "Imprimez & scannez", desc: "Exportez les badges en PDF, imprimez-les, et contrôlez les entrées le jour J avec le scanner mobile intégré." },
];

const AUDIENCES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "building-2", title: "Salons & congrès", desc: "Gérez des milliers d'inscriptions avec catégories multiples, exposants, presse et VIP, et fluidifiez l'accueil." },
  { icon: "building", title: "Institutions & administrations", desc: "Traçabilité, rôles séparés et hébergement européen pour répondre aux exigences de conformité." },
  { icon: "users", title: "Écoles & associations", desc: "Une solution simple et abordable pour vos journées portes ouvertes, colloques et assemblées." },
];

const FAQ = [
  { q: "Faut-il installer un logiciel ?", a: "Non. Badge fonctionne entièrement dans le navigateur. Le scanner d'accès s'utilise depuis un smartphone ou une tablette, sans installation particulière." },
  { q: "Les données sont-elles hébergées en Europe ?", a: "Oui. L'ensemble des données est hébergé et opéré en Europe, dans le respect du RGPD. Vous restez propriétaire de vos données et pouvez les exporter à tout moment." },
  { q: "Peut-on personnaliser les badges ?", a: "Chaque organisation et chaque événement peut définir son propre modèle de badge, avec logo, couleurs de catégories et champs affichés. Les modèles s'héritent de la plateforme vers l'événement." },
  { q: "Comment fonctionne le contrôle d'accès sur site ?", a: "Chaque badge porte un QR code unique. Vos opérateurs scannent les participants à l'entrée et obtiennent un résultat immédiat, avec vérification des catégories et des zones autorisées." },
  { q: "Peut-on gérer plusieurs organisations ?", a: "Oui. Badge est multi-organisation et multi-rôles : l'équipe plateforme, les organisations et les événements disposent chacun d'un espace et de permissions dédiés." },
];

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-600">
      <span className="mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-green-500/15 text-green-700">
        <Icon name="check" size={13} />
      </span>
      {children}
    </li>
  );
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const ctx = await loadUserContext(session.user.id);
    redirect(resolveHomeRedirect(ctx));
  }

  return (
    <>
      {/* HERO */}
      <section className="border-b border-slate-200 bg-slate-50 pb-16 pt-[76px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <span className="mb-[22px] inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3 text-[13px] font-medium text-slate-600">
                <b className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-green-700">
                  Nouveau
                </b>
                Scanner QR hors-ligne sur mobile
              </span>
              <h1 style={displayFont} className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[52px]">
                La gestion de badges, simple et maîtrisée.
              </h1>
              <p className="mt-[18px] text-lg leading-relaxed text-slate-600">
                Collectez les inscriptions en ligne, modérez-les, générez des badges PDF avec QR code et contrôlez
                chaque entrée par scan — le tout depuis une seule plateforme, pour vos événements professionnels et
                institutionnels.
              </p>
              <div className="mt-[30px] flex flex-wrap gap-3">
                <Link href="/contact" className={btnPrimaryLg}>
                  Demander une démo <Icon name="arrow-right" size={18} />
                </Link>
                <Link href="/fonctionnalites" className={btnSecondaryLg}>
                  Voir les fonctionnalités
                </Link>
              </div>
              <div className="mt-[26px] flex items-center gap-2 text-[13px] text-slate-400">
                <Icon name="shield-check" size={16} /> Hébergement en Europe · Conforme RGPD · Sans engagement
              </div>
            </div>
            <div className="relative">
              <BrowserMock url="badge.app/admin/events/salon-2026">
                <div className="mb-3.5 grid grid-cols-3 gap-2.5">
                  {[
                    { l: "Inscriptions", v: "1 248" },
                    { l: "Approuvées", v: "1 087" },
                    { l: "Badges émis", v: "982" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-[10px] border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-[0.06em] text-slate-400">{s.l}</div>
                      <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{s.v}</div>
                    </div>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-2 font-medium">Participant</th>
                      <th className="pb-2 font-medium">Catégorie</th>
                      <th className="pb-2 text-right font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {[
                      { n: "Camille Fabre", c: "Visiteur", cc: "#0ea5e9", s: "approved" },
                      { n: "Yanis Bouaziz", c: "Exposant", cc: "#8b5cf6", s: "pending" },
                      { n: "Léa Moreau", c: "Presse", cc: "#f59e0b", s: "approved" },
                      { n: "Thomas Girard", c: "Visiteur", cc: "#0ea5e9", s: "rejected" },
                    ].map((r) => (
                      <tr key={r.n} className="border-t border-slate-100">
                        <td className="py-2">{r.n}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.cc }} />
                            {r.c}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {r.s === "approved" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <Icon name="check" size={12} /> Approuvée
                            </span>
                          )}
                          {r.s === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <Icon name="clock" size={12} /> En attente
                            </span>
                          )}
                          {r.s === "rejected" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                              <Icon name="x" size={12} /> Rejetée
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </BrowserMock>
              <div className="pointer-events-none absolute -bottom-12 -right-12 hidden origin-bottom-right rotate-[5deg] scale-[0.4] drop-shadow-2xl xl:block">
                <BadgeCredential />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="py-12">
        <div className="mx-auto max-w-[1160px] px-7">
          <p className="mb-7 text-center text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Ils organisent leurs événements avec Badge
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {[
              ["SP", "Salon Pro"],
              ["IN", "Institut National"],
              ["CX", "Congrès Expo"],
              ["UF", "UniForum"],
              ["MV", "Meetup Ville"],
            ].map(([mk, name]) => (
              <div key={name} className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-400">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-slate-100 text-[13px] font-bold text-brand-navy">
                  {mk}
                </span>
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading
            center
            eyebrow="Une plateforme complète"
            title="Tout le cycle de vie d'un badge, au même endroit"
            lede="De la collecte des inscriptions au contrôle d'accès sur site, Badge couvre chaque étape sans passer par des tableurs ou des outils dispersés."
          />
          <div className="mt-[52px] grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-[26px]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-green-500/15 text-green-700">
                  <Icon name={f.icon} size={22} />
                </div>
                <h3 className="mb-2 text-[17px] font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="Comment ça marche" title="Opérationnel en trois étapes" />
          <div className="mt-[52px] grid grid-cols-1 gap-7 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div
                  style={displayFont}
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-navy text-[17px] font-bold text-white"
                >
                  {s.n}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPLIT : badges */}
      <section className="bg-slate-50 py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid items-center gap-14 md:grid-cols-2">
            <div>
              <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-green-600">Badges</p>
              <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[38px]">
                Des credentials professionnels, sans effort de design
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Choisissez un modèle, appliquez les couleurs de vos catégories, et Badge génère des credentials
                cohérents avec QR code de vérification.
              </p>
              <ul className="mt-[22px] flex flex-col gap-3">
                <Tick>Modèles hérités de la plateforme, de l&apos;organisation ou de l&apos;événement</Tick>
                <Tick>Bandes de catégorie colorées et mention « ALL ACCESS »</Tick>
                <Tick>Génération par lot avec suivi de progression</Tick>
                <Tick>Export PDF prêt pour l&apos;impression professionnelle</Tick>
              </ul>
            </div>
            <div className="flex justify-center">
              <BadgeCredential />
            </div>
          </div>
        </div>
      </section>

      {/* SPLIT : scanner (navy) */}
      <section className="bg-brand-navy py-[88px] text-white">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid items-center gap-14 md:grid-cols-2">
            <div className="md:order-2">
              <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-green-400">Contrôle d&apos;accès</p>
              <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight md:text-[38px]">
                Vérifiez chaque entrée en une seconde
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/75">
                Le scanner mobile lit le QR du badge et affiche instantanément un résultat clair. Aucune connexion
                permanente requise sur site.
              </p>
              <ul className="mt-[22px] flex flex-col gap-3">
                {[
                  "Résultat immédiat valide (vert) ou non valide (rouge)",
                  "Contrôle des catégories et des zones d'accès",
                  "Historique des passages par session et par opérateur",
                  "Vérification publique d'un badge par simple lien",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-white/80">
                    <span className="mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-green-400/20 text-green-400">
                      <Icon name="check" size={13} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center md:order-1">
              <ScannerMock className="max-w-[280px]" />
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="Pour qui" title="Conçu pour les organisateurs exigeants" />
          <div className="mt-[52px] grid grid-cols-1 gap-[22px] md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="rounded-2xl border border-slate-200 bg-white p-[26px]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-navy/10 text-brand-navy">
                  <Icon name={a.icon} size={20} />
                </div>
                <h3 className="mb-2 text-[17px] font-semibold text-slate-900">{a.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* METRICS (navy) */}
      <section className="bg-brand-navy py-16 text-white">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ["98", "%", "de badges générés sans intervention"],
              ["<1", "s", "pour vérifier une entrée au scan"],
              ["3", "x", "plus rapide qu'un accueil manuel"],
              ["100", "%", "hébergé et opéré en Europe"],
            ].map(([v, u, l]) => (
              <div key={l}>
                <div style={displayFont} className="text-[44px] font-bold tracking-tight">
                  {v}
                  <span className="text-green-400">{u}</span>
                </div>
                <div className="mt-1.5 text-sm text-white/70">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="bg-slate-50 py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading
            center
            eyebrow="Tarifs"
            title="Une offre pour chaque volume d'événements"
            lede="Payez à l'usage, sans coût caché. Changez d'offre à tout moment."
          />
          <div className="mt-[52px]">
            <PricingCards />
          </div>
          <p className="mt-7 text-center">
            <Link href="/tarifs" className="text-sm font-medium text-green-600 hover:underline">
              Comparer les offres en détail →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="Questions fréquentes" title="Ce qu'il faut savoir" />
          <FaqAccordion items={FAQ} defaultOpenFirst />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1160px] px-7">
          <CtaBand
            title="Prêt à simplifier vos événements ?"
            body="Découvrez Badge en conditions réelles avec une démonstration adaptée à vos besoins."
            actions={
              <>
                <Link href="/contact" className={btnOnNavy}>
                  Demander une démo
                </Link>
                <Link href="/login" className={btnGhostNavy}>
                  Se connecter
                </Link>
              </>
            }
          />
        </div>
      </section>
    </>
  );
}
