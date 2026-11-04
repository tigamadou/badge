import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { displayFont } from "@/components/marketing/styles";

// Gabarit des pages legales/documentaires (mentions, confidentialite, CGU).
// Reproduit .legal du design : lien retour, titre display, date de mise a jour,
// puis contenu en prose (h2 / p / ul).
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-7 py-14">
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-navy hover:underline">
        <Icon name="arrow-left" size={14} /> Retour à l&apos;accueil
      </Link>
      <h1 style={displayFont} className="text-[34px] font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mb-10 mt-2 text-[13px] text-slate-400">Mis à jour le {updated}</p>
      <div className="legal-prose flex flex-col">{children}</div>
    </div>
  );
}
