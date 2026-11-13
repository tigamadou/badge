import { PERMISSION_CATALOG, type Permission, type PermissionDef, type PermissionDomain } from "./catalog";

export const DOMAIN_LABELS: Record<PermissionDomain, string> = {
  access: "Accès",
  roles: "Rôles",
  users: "Utilisateurs",
  organizations: "Organisations",
  members: "Membres",
  subscriptions: "Abonnements",
  plans: "Plans",
  payments: "Paiements",
  profiles: "Profils",
  blocklist: "Liste de blocage",
  settings: "Paramètres",
  rejection_reasons: "Motifs de rejet",
  badge_templates: "Templates de badge",
  email_jobs: "Envois d'e-mails",
  activity: "Journal d'activité",
  print_requests: "Commandes d'impression",
  print_catalog: "Catalogue d'impression",
  print_layouts: "Gabarits de planche",
  print_sheets: "Planches d'impression",
  org: "Organisation",
  events: "Évènements",
  billing: "Facturation",
  scan: "Scan et contrôle d'accès",
  registrations: "Inscriptions",
  badges: "Badges",
  print_event: "Impression d'évènement",
  account: "Compte participant",
};

export function domainOf(key: Permission): PermissionDomain {
  return PERMISSION_CATALOG.find((p) => p.key === key)!.domain;
}

/** Regroupe les permissions par domaine ; l'ordre des domaines et des permissions suit le catalogue. */
export function groupByDomain(
  keys: readonly Permission[],
): { domain: PermissionDomain; label: string; permissions: PermissionDef[] }[] {
  const wanted = new Set<string>(keys);
  const groups = new Map<PermissionDomain, PermissionDef[]>();
  for (const def of PERMISSION_CATALOG as readonly PermissionDef[]) {
    if (!wanted.has(def.key)) continue;
    const list = groups.get(def.domain) ?? [];
    list.push(def);
    groups.set(def.domain, list);
  }
  return [...groups].map(([domain, permissions]) => ({ domain, label: DOMAIN_LABELS[domain], permissions }));
}
