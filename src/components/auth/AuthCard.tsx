import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Gabarit centré pour les écrans d'authentification.
 * Fond slate-50, carte blanche arrondie max-w-[400px].
 */
export function AuthCard({ title, subtitle, footer, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="mb-4 w-full max-w-[400px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900"
        >
          <Icon name="arrow-left" size={16} /> Retour à l&apos;accueil
        </Link>
      </div>
      <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8">
        <Link href="/" className="flex justify-center mb-6" aria-label="Badge — accueil">
          <Image
            src="/logo.png"
            alt="Badge"
            width={120}
            height={120}
            className="h-20 w-auto object-contain"
          />
        </Link>
        <h1 className="text-[22px] font-semibold text-slate-900 text-center mb-2">
          {title}
        </h1>
        {subtitle ? <p className="mb-6 text-center text-sm text-slate-500">{subtitle}</p> : <div className="mb-6" />}
        {children}
        {footer ? (
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-[13px] text-slate-400">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
