import { ReactNode } from "react";

interface TableFrameProps {
  children: ReactNode;
  className?: string;
}

// Enveloppe de tableau : défilement horizontal sur petit écran, coins arrondis conservés
// (overflow-x-auto découpe aussi le contenu au rayon de bordure).
export function TableFrame({ children, className }: TableFrameProps) {
  const base = "overflow-x-auto rounded-xl border border-slate-200 bg-white";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
