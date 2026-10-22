// Squelette commun des espaces d'administration (composant serveur).
//
// Composition :
//   <AppShell
//     sidebarHeader={<>marque, contexte (org, événement)</>}   // reste visible
//     sidebar={<SidebarNav .../>}                              // défile si l'écran est bas
//     sidebarFooter={<>LogoutButton, e-mail</>}                // reste visible
//     header={<>fil d'Ariane, badge de rôle, avatar…</>}
//     banner={<div>…</div>}   // facultatif : bandeau au-dessus de l'en-tête (mode staff)
//   >
//     {contenu de la page}
//   </AppShell>
//
// - L'unique <aside> se compose de trois zones : `sidebarHeader` (fixe, en haut), `sidebar`
//   (la navigation, qui défile quand la hauteur est faible) et `sidebarFooter` (fixe, en bas,
//   pour que la déconnexion reste toujours visible). Sous `lg` l'aside devient un tiroir ouvert
//   par le bouton menu, à partir de `lg` c'est la barre latérale permanente. Ne pas rendre
//   le bouton « Fermer le menu » : il est ajouté en tête par le panneau.
// - `header` se place à droite du bouton menu (masqué à partir de `lg`) ; il gère lui-même
//   ses éléments compacts (`hidden sm:inline-flex`, `min-w-0 truncate`…).
// - Le contenu de `sidebar` doit rester sur fond sombre (`bg-brand-navy`).

import type { ReactNode } from "react";
import { MobileNavPanel, MobileNavProvider, MobileNavToggle } from "./MobileNav";

export function AppShell({
  sidebarHeader,
  sidebar,
  sidebarFooter,
  header,
  banner,
  children,
}: {
  sidebarHeader?: ReactNode;
  sidebar: ReactNode;
  sidebarFooter?: ReactNode;
  header: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="flex h-dvh overflow-hidden">
        <MobileNavPanel header={sidebarHeader} footer={sidebarFooter}>
          {sidebar}
        </MobileNavPanel>
        <div className="flex min-w-0 flex-1 flex-col">
          {banner}
          <header className="flex h-14 flex-none items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3 sm:px-5">
            <MobileNavToggle />
            {header}
          </header>
          <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
