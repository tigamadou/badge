import Link from "next/link";
import Image from "next/image";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "Vérifier un badge", href: "/verify" },
      { label: "Se connecter", href: "/login" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "/contact" },
      { label: "Galerie des écrans", href: "/styleguide" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "CGU", href: "/cgu" },
    ],
  },
];

export function PublicSiteFooter() {
  return (
    <footer className="bg-navy text-white/70">
      <div className="mx-auto max-w-[1160px] px-7 pb-8 pt-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Image src="/logo-light.svg" alt="Badge" width={92} height={28} className="mb-4 h-7 w-auto" />
            <p className="max-w-[260px] text-sm leading-relaxed text-white/60">
              La plateforme de gestion des inscriptions, badges et contrôle d&apos;accès pour vos événements
              professionnels et institutionnels.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/50">{col.title}</h4>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className="mb-2.5 block text-sm text-white/70 hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-7 py-5 text-[13px] text-white/55">
        <span>© 2026 Badge · Plateforme multi-organisation et multi-rôles.</span>
        <span className="flex flex-wrap gap-5">
          <Link href="/mentions-legales" className="text-white/70 hover:text-white">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="text-white/70 hover:text-white">
            Confidentialité
          </Link>
          <Link href="/cgu" className="text-white/70 hover:text-white">
            CGU
          </Link>
        </span>
      </div>
    </footer>
  );
}
