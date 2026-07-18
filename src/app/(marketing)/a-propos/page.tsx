import Link from "next/link";
import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBand } from "@/components/marketing/CtaBand";
import { BrowserMock } from "@/components/marketing/BrowserMock";
import { displayFont, btnOnNavy, btnGhostNavy } from "@/components/marketing/styles";

export const metadata: Metadata = {
  title: "Badge — À propos",
  description: "Badge est née d'un constat simple : gérer les inscriptions, imprimer des badges et contrôler les accès ne devrait pas être un patchwork d'outils.",
};

const VALUES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "sliders", title: "Sobriété", desc: "Une interface utilitaire, sans distraction. La donnée et l'action priment sur la décoration." },
  { icon: "shield-check", title: "Confiance", desc: "Hébergement européen, traçabilité complète et respect strict de la vie privée des participants." },
  { icon: "users", title: "Proximité", desc: "Un accompagnement humain, à l'écoute des organisateurs et de leurs contraintes réelles." },
];

const TEAM = [
  { av: "AL", name: "Amélie Laurent", role: "Direction produit" },
  { av: "KM", name: "Karim Mansouri", role: "Ingénierie" },
  { av: "SB", name: "Sophie Bernard", role: "Relation client" },
  { av: "TG", name: "Thomas Girard", role: "Sécurité & conformité" },
];

const CHART = [40, 55, 48, 70, 62, 82, 75, 95, 88, 100];

export default function AProposPage() {
  return (
    <>
      {/* Hero navy */}
      <section className="bg-brand-navy py-20 text-white">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading
            as="h1"
            onNavy
            eyebrow="À propos"
            title="Nous rendons l'accueil des événements enfin fluide"
            lede="Badge est née d'un constat simple : gérer les inscriptions, imprimer des badges et contrôler les accès reste, pour trop d'organisateurs, un patchwork de tableurs et d'outils qui ne se parlent pas. Nous avons voulu une seule plateforme, claire et rigoureuse."
          />
        </div>
      </section>

      {/* Mission */}
      <section className="py-[88px]">
        <div className="mx-auto grid max-w-[1160px] items-center gap-14 px-7 md:grid-cols-2">
          <div>
            <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-green-600">Notre mission</p>
            <h2 style={displayFont} className="text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[38px]">
              Un outil, pas un casse-tête
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Nous concevons Badge comme une console d&apos;administration : dense, fiable, sans fioritures. Chaque écran
              sert le travail de l&apos;organisateur — collecter, modérer, imprimer, scanner — et rien d&apos;autre.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              De la conférence de quartier au congrès international, la même plateforme s&apos;adapte au volume, aux
              rôles et aux exigences de conformité.
            </p>
          </div>
          <BrowserMock url="badge.app">
            <div className="mb-3.5 grid grid-cols-3 gap-2.5">
              {[
                { l: "Organisations", v: "340+" },
                { l: "Événements", v: "2 100" },
                { l: "Badges émis", v: "1,4 M" },
              ].map((s) => (
                <div key={s.l} className="rounded-[10px] border border-slate-200 p-3">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-slate-400">{s.l}</div>
                  <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="flex h-[90px] items-end gap-[3px]">
              {CHART.map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[3px] bg-green-500/85" style={{ height: `${h}%` }} />
              ))}
            </div>
          </BrowserMock>
        </div>
      </section>

      {/* Values */}
      <section className="bg-slate-50 py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="Nos principes" title="Ce qui guide nos décisions" />
          <div className="mt-[52px] grid grid-cols-1 gap-[22px] md:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title}>
                <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-green-500/15 text-green-700">
                  <Icon name={v.icon} size={20} />
                </div>
                <h3 className="mb-2 text-[17px] font-semibold text-slate-900">{v.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics (navy) */}
      <section className="bg-brand-navy py-16 text-white">
        <div className="mx-auto max-w-[1160px] px-7">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ["340", "+", "organisations clientes"],
              ["2 100", "", "événements gérés"],
              ["1,4", "M", "badges émis"],
              ["12", "", "pays desservis"],
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

      {/* Team */}
      <section className="py-[88px]">
        <div className="mx-auto max-w-[1160px] px-7">
          <SectionHeading center eyebrow="L'équipe" title="Des profils produit, terrain et sécurité" />
          <div className="mt-11 grid grid-cols-2 gap-[22px] md:grid-cols-4">
            {TEAM.map((m) => (
              <div key={m.name} className="text-center">
                <div
                  style={displayFont}
                  className="mx-auto mb-3.5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-brand-navy"
                >
                  {m.av}
                </div>
                <div className="text-[15px] font-semibold text-slate-900">{m.name}</div>
                <div className="mt-0.5 text-[13px] text-slate-500">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-[1160px] px-7">
          <CtaBand
            title="Envie d'en savoir plus ?"
            body="Discutons de votre organisation et de la façon dont Badge peut vous accompagner."
            actions={
              <>
                <Link href="/contact" className={btnOnNavy}>
                  Nous contacter
                </Link>
                <Link href="/fonctionnalites" className={btnGhostNavy}>
                  Voir les fonctionnalités
                </Link>
              </>
            }
          />
        </div>
      </section>
    </>
  );
}
