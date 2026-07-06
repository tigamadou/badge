import Image from "next/image";

type Props = {
  title: string;
  children: React.ReactNode;
};

/**
 * Gabarit centré pour les écrans d'authentification.
 * Fond slate-50, carte blanche arrondie max-w-[400px].
 */
export function AuthCard({ title, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="Badge"
            width={120}
            height={120}
            className="h-20 w-auto object-contain"
          />
        </div>
        <h1 className="text-[22px] font-semibold text-slate-900 text-center mb-6">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
