import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "user-check", title: "Inscription & modération", desc: "Collectez et approuvez les inscriptions en ligne." },
  { icon: "id-card", title: "Badges PDF + QR", desc: "Générez des badges prêts à imprimer." },
  { icon: "scan-line", title: "Contrôle d'accès", desc: "Vérifiez chaque entrée par scan." },
];

// Landing marketing publique (visiteur non authentifié). Reproduit template/accueil.html.
export function LandingView() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center px-8 py-5">
        <Image src="/logo.png" alt="Badge" width={120} height={30} className="h-[30px] w-auto object-contain" />
        <span className="flex-1" />
        <Link
          href="/login"
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
        >
          Se connecter
        </Link>
      </nav>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center">
        <svg className="mb-7 h-[72px] w-[72px]" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M20 2.5 L34 7.2 V19 C34 28.4 27.9 34.6 20 37.5 C12.1 34.6 6 28.4 6 19 V7.2 Z" fill="#36ab58" />
          <text x="20" y="27" fontFamily="var(--font-badge)" fontSize="20" fontWeight="700" fill="#fff" textAnchor="middle">
            B
          </text>
        </svg>
        <h1 className="m-0 mb-3.5 max-w-[660px] text-[40px] font-semibold leading-[1.12] tracking-tight text-slate-900">
          La gestion de badges, simple et maîtrisée.
        </h1>
        <p className="m-0 mb-8 max-w-[520px] text-[17px] leading-relaxed text-slate-600">
          Inscriptions en ligne, modération, génération de badges PDF avec QR code et contrôle d&apos;accès par scan — pour
          vos événements professionnels et institutionnels.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          Se connecter <Icon name="arrow-right" size={16} />
        </Link>

        <div className="mt-16 flex flex-wrap justify-center gap-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex max-w-[180px] flex-col items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-slate-200 bg-white text-green-600">
                <Icon name={f.icon} size={20} />
              </span>
              <span className="text-sm font-semibold text-slate-900">{f.title}</span>
              <span className="text-[13px] leading-snug text-slate-400">{f.desc}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 p-6 text-center text-[13px] text-slate-400">
        © 2026 Badge · Plateforme multi-organisation et multi-rôles ·{" "}
        <Link href="#" className="font-medium text-green-600 hover:underline">
          Mentions légales
        </Link>
      </footer>
    </div>
  );
}
