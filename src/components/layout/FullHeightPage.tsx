import type { ReactNode } from "react";

// Page qui occupe toute la zone de contenu d'AppShell (padding de <main> compris) ; le défilement
// est alors géré par la page elle-même, colonne par colonne.
export function FullHeightPage({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex min-h-0 flex-col">{children}</div>;
}
