"use client";

import { usePathname } from "next/navigation";
import { isAlwaysAllowedOrgPath } from "@/lib/subscription-path";
import { SubscriptionBlockedNotice } from "@/components/admin/SubscriptionBlockedNotice";

// Blocage d'interface de l'espace organisation. Le layout serveur n'est pas re-rendu
// lors d'une navigation douce (<Link>) : la décision dépend donc du pathname courant,
// lu côté client, et non d'un header calculé une seule fois côté serveur.
export function OrgAccessGate({
  orgId,
  canAccessOrgSpace,
  children,
}: {
  orgId: string;
  canAccessOrgSpace: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  // /events/new : la page vérifie elle-même CREATE_EVENT et redirige vers la liste. Il faut
  // donc la monter pour que cette redirection s'exécute (sinon l'écran bloquant resterait
  // affiché sans redirection). Cas atypique ACCESS_ORG_SPACE refusé mais CREATE_EVENT
  // accordé : le wizard s'affiche, la création restant contrôlée côté API.
  const isNewEvent = pathname.replace(/\/$/, "") === `/org/${orgId}/events/new`;
  if (canAccessOrgSpace || isAlwaysAllowedOrgPath(pathname, orgId) || isNewEvent) return <>{children}</>;
  return <SubscriptionBlockedNotice orgId={orgId} />;
}
