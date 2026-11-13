// Catalogue des permissions (source de vérité du code). Les rôles système vivent dans system-roles.ts.

export type PermissionScope = "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT";

export type PermissionDomain =
  | "access"
  | "roles"
  | "users"
  | "organizations"
  | "members"
  | "subscriptions"
  | "plans"
  | "payments"
  | "profiles"
  | "blocklist"
  | "settings"
  | "rejection_reasons"
  | "badge_templates"
  | "email_jobs"
  | "activity"
  | "print_requests"
  | "print_catalog"
  | "print_layouts"
  | "print_sheets"
  | "org"
  | "events"
  | "billing"
  | "scan"
  | "registrations"
  | "badges"
  | "print_event"
  | "account";

export type PermissionDef = {
  key: string;
  scope: PermissionScope;
  domain: PermissionDomain;
  label: string;
  description: string;
  reserved?: true;
};

export const PERMISSION_CATALOG = [
  { key: "platform.access", scope: "PLATFORM", domain: "access", label: "Accès plateforme", description: "Accéder à l'espace plateforme." },
  { key: "platform.roles.manage", scope: "PLATFORM", domain: "roles", label: "Gérer les rôles plateforme", description: "Gérer les rôles plateforme et voir tous les rôles système.", reserved: true },
  { key: "users.permissions.manage", scope: "PLATFORM", domain: "users", label: "Ajuster les permissions des utilisateurs", description: "Ajuster les permissions de n'importe quel utilisateur.", reserved: true },
  { key: "organizations.read", scope: "PLATFORM", domain: "organizations", label: "Consulter les organisations", description: "Consulter les organisations, leurs membres, évènements et journal." },
  { key: "organizations.create", scope: "PLATFORM", domain: "organizations", label: "Créer une organisation", description: "Créer une organisation." },
  { key: "organizations.update", scope: "PLATFORM", domain: "organizations", label: "Modifier une organisation", description: "Modifier les informations d'une organisation." },
  { key: "organizations.archive", scope: "PLATFORM", domain: "organizations", label: "Archiver une organisation", description: "Archiver ou restaurer une organisation." },
  { key: "organizations.delete", scope: "PLATFORM", domain: "organizations", label: "Supprimer une organisation", description: "Supprimer définitivement une organisation." },
  { key: "organizations.members.manage", scope: "PLATFORM", domain: "members", label: "Gérer les membres d'une organisation", description: "Inviter, changer le rôle, retirer un membre d'organisation." },
  { key: "subscriptions.update", scope: "PLATFORM", domain: "subscriptions", label: "Attribuer un abonnement", description: "Attribuer un plan et un statut d'abonnement." },
  { key: "plans.read", scope: "PLATFORM", domain: "plans", label: "Consulter les plans", description: "Consulter les plans." },
  { key: "plans.manage", scope: "PLATFORM", domain: "plans", label: "Gérer les plans", description: "Créer et modifier les plans." },
  { key: "payments.read", scope: "PLATFORM", domain: "payments", label: "Consulter les paiements", description: "Consulter les paiements, télécharger les reçus." },
  { key: "users.read", scope: "PLATFORM", domain: "users", label: "Consulter les utilisateurs", description: "Consulter les utilisateurs." },
  { key: "users.update", scope: "PLATFORM", domain: "users", label: "Modifier un utilisateur", description: "Modifier le nom d'un utilisateur." },
  { key: "users.create", scope: "PLATFORM", domain: "users", label: "Créer un compte client", description: "Créer un compte client." },
  { key: "users.staff.create", scope: "PLATFORM", domain: "users", label: "Créer un compte staff", description: "Créer un compte staff." },
  { key: "users.staff.assign_role", scope: "PLATFORM", domain: "users", label: "Changer le rôle plateforme", description: "Changer le rôle plateforme d'un compte." },
  { key: "users.staff.assign_top_role", scope: "PLATFORM", domain: "users", label: "Attribuer un rôle plateforme supérieur", description: "Attribuer ou retirer STAFF_ADMIN / SUPER_ADMIN." },
  { key: "users.archive", scope: "PLATFORM", domain: "users", label: "Archiver un utilisateur", description: "Archiver ou restaurer un utilisateur." },
  { key: "users.password.reset", scope: "PLATFORM", domain: "users", label: "Réinitialiser un mot de passe", description: "Envoyer un lien de réinitialisation." },
  { key: "profiles.read", scope: "PLATFORM", domain: "profiles", label: "Consulter les profils", description: "Consulter les profils à valider (et leurs documents)." },
  { key: "profiles.review", scope: "PLATFORM", domain: "profiles", label: "Valider les profils", description: "Approuver ou rejeter un profil." },
  { key: "blocklist.read", scope: "PLATFORM", domain: "blocklist", label: "Consulter la liste de blocage", description: "Consulter e-mails et documents bloqués." },
  { key: "blocklist.manage", scope: "PLATFORM", domain: "blocklist", label: "Gérer la liste de blocage", description: "Bloquer ou débloquer un e-mail ou un document." },
  { key: "settings.read", scope: "PLATFORM", domain: "settings", label: "Consulter les paramètres", description: "Consulter les paramètres (secrets masqués)." },
  { key: "settings.update", scope: "PLATFORM", domain: "settings", label: "Modifier les paramètres", description: "Modifier SMTP et reCAPTCHA (hors secrets)." },
  { key: "settings.secrets.update", scope: "PLATFORM", domain: "settings", label: "Modifier les secrets", description: "Écrire le mot de passe SMTP et la clé secrète reCAPTCHA." },
  { key: "settings.smtp.test", scope: "PLATFORM", domain: "settings", label: "Tester le SMTP", description: "Envoyer un e-mail de test." },
  { key: "settings.subscription_rights.update", scope: "PLATFORM", domain: "settings", label: "Modifier les droits d'abonnement", description: "Modifier la matrice des droits d'abonnement." },
  { key: "settings.badge_template.update", scope: "PLATFORM", domain: "settings", label: "Choisir le template de badge par défaut", description: "Choisir le template de badge par défaut." },
  { key: "settings.onsite_print.update", scope: "PLATFORM", domain: "settings", label: "Régler l'impression sur place", description: "Régler l'impression sur place." },
  { key: "rejection_reasons.read", scope: "PLATFORM", domain: "rejection_reasons", label: "Consulter les motifs de rejet", description: "Consulter les motifs de rejet." },
  { key: "rejection_reasons.manage", scope: "PLATFORM", domain: "rejection_reasons", label: "Gérer les motifs de rejet", description: "Gérer les motifs de rejet." },
  { key: "badge_templates.read", scope: "PLATFORM", domain: "badge_templates", label: "Consulter les templates de badge", description: "Consulter les templates de badge installés." },
  { key: "badge_templates.manage", scope: "PLATFORM", domain: "badge_templates", label: "Gérer les templates de badge", description: "Inspecter, installer, archiver un template." },
  { key: "email_jobs.read", scope: "PLATFORM", domain: "email_jobs", label: "Consulter les envois d'e-mails", description: "Consulter les envois d'e-mails." },
  { key: "email_jobs.manage", scope: "PLATFORM", domain: "email_jobs", label: "Gérer les envois d'e-mails", description: "Annuler ou relancer un envoi." },
  { key: "activity.read", scope: "PLATFORM", domain: "activity", label: "Consulter le journal plateforme", description: "Consulter le journal plateforme." },
  { key: "print.requests.read", scope: "PLATFORM", domain: "print_requests", label: "Consulter les commandes d'impression", description: "Consulter les commandes d'impression." },
  { key: "print.requests.messages.send", scope: "PLATFORM", domain: "print_requests", label: "Écrire dans le fil d'une commande", description: "Écrire dans le fil de messages d'une commande, joindre un fichier (la lecture du fil relève de print.requests.read)." },
  { key: "print.requests.reject", scope: "PLATFORM", domain: "print_requests", label: "Rejeter une commande", description: "Rejeter une commande." },
  { key: "print.requests.advance", scope: "PLATFORM", domain: "print_requests", label: "Faire avancer une commande", description: "Passer une commande en production, prête, terminée (hors sur place)." },
  { key: "print.requests.onsite.complete", scope: "PLATFORM", domain: "print_requests", label: "Clore une commande sur place", description: "Clore une commande sur place (crédit ou supplément)." },
  { key: "print.requests.quote.edit", scope: "PLATFORM", domain: "print_requests", label: "Modifier le devis", description: "Modifier les lignes du devis." },
  { key: "print.requests.quote.send", scope: "PLATFORM", domain: "print_requests", label: "Envoyer le devis", description: "Envoyer le devis." },
  { key: "print.requests.reopen", scope: "PLATFORM", domain: "print_requests", label: "Rouvrir une commande", description: "Rouvrir une commande pour révision." },
  { key: "print.requests.mark_paid", scope: "PLATFORM", domain: "print_requests", label: "Marquer une commande payée", description: "Marquer payée manuellement." },
  { key: "print.requests.credit.apply", scope: "PLATFORM", domain: "print_requests", label: "Appliquer le crédit d'impression", description: "Appliquer le crédit d'impression." },
  { key: "print.onsite.margin.update", scope: "PLATFORM", domain: "print_requests", label: "Régler la marge sur place", description: "Régler la marge d'une commande sur place." },
  { key: "print.catalog.read", scope: "PLATFORM", domain: "print_catalog", label: "Consulter le catalogue d'impression", description: "Consulter le catalogue produits." },
  { key: "print.catalog.manage", scope: "PLATFORM", domain: "print_catalog", label: "Gérer le catalogue d'impression", description: "Gérer produits, options, paliers, images." },
  { key: "print.layouts.read", scope: "PLATFORM", domain: "print_layouts", label: "Consulter les gabarits", description: "Consulter les gabarits de planche." },
  { key: "print.layouts.manage", scope: "PLATFORM", domain: "print_layouts", label: "Gérer les gabarits", description: "Gérer les gabarits." },
  { key: "print.sheets.read", scope: "PLATFORM", domain: "print_sheets", label: "Consulter les planches", description: "Lister et télécharger les planches." },
  { key: "print.sheets.generate", scope: "PLATFORM", domain: "print_sheets", label: "Générer des planches", description: "Générer des planches." },
  { key: "org.read", scope: "ORG", domain: "org", label: "Accéder à l'organisation", description: "Accéder à l'espace organisation." },
  { key: "org.update", scope: "ORG", domain: "org", label: "Modifier l'organisation", description: "Modifier les informations de l'organisation (slug : staff seul)." },
  { key: "org.activity.read", scope: "ORG", domain: "org", label: "Consulter le journal de l'organisation", description: "Consulter le journal de l'organisation." },
  { key: "org.members.read", scope: "ORG", domain: "members", label: "Voir les membres", description: "Voir les membres." },
  { key: "org.members.manage", scope: "ORG", domain: "members", label: "Gérer les membres", description: "Inviter, changer le rôle, retirer un membre (dernier OWNER protégé)." },
  { key: "org.roles.manage", scope: "ORG", domain: "roles", label: "Gérer les rôles de l'organisation", description: "Gérer les rôles personnalisés de l'organisation.", reserved: true },
  { key: "org.members.permissions.manage", scope: "ORG", domain: "members", label: "Ajuster les permissions d'un membre", description: "Ajuster les permissions d'un membre.", reserved: true },
  { key: "org.templates.read", scope: "ORG", domain: "org", label: "Voir les modèles de catégories", description: "Voir les modèles de catégories." },
  { key: "org.templates.manage", scope: "ORG", domain: "org", label: "Gérer les modèles de catégories", description: "Gérer les modèles de catégories." },
  { key: "org.badge_settings.update", scope: "ORG", domain: "org", label: "Choisir le template de badge", description: "Choisir le template de badge de l'organisation." },
  { key: "org.upload", scope: "ORG", domain: "org", label: "Téléverser les fichiers de l'organisation", description: "Téléverser les fichiers de l'organisation (logo)." },
  { key: "org.events.list", scope: "ORG", domain: "events", label: "Lister les évènements", description: "Lister les évènements." },
  { key: "org.events.create", scope: "ORG", domain: "events", label: "Créer un évènement", description: "Créer un évènement (droit CREATE_EVENT et quota en plus)." },
  { key: "org.events.archive", scope: "ORG", domain: "events", label: "Archiver un évènement", description: "Archiver ou restaurer un évènement." },
  { key: "billing.subscription.read", scope: "ORG", domain: "billing", label: "Consulter l'abonnement", description: "Consulter l'abonnement et les plans." },
  { key: "billing.subscription.pay", scope: "ORG", domain: "billing", label: "Payer l'abonnement", description: "Payer ou changer d'abonnement (jamais le staff)." },
  { key: "billing.payments.read", scope: "ORG", domain: "billing", label: "Consulter les paiements de l'organisation", description: "Consulter les paiements, télécharger les reçus." },
  { key: "print.quote.accept", scope: "ORG", domain: "print_requests", label: "Accepter un devis d'impression", description: "Accepter et payer un devis d'impression (jamais le staff)." },
  { key: "event.read.aggregated", scope: "EVENT", domain: "events", label: "Voir les chiffres agrégés", description: "Chiffres agrégés, sans données nominatives." },
  { key: "event.read.detailed", scope: "EVENT", domain: "events", label: "Voir les données détaillées", description: "Inscriptions, catégories, pièces d'identité en détail." },
  { key: "event.update", scope: "EVENT", domain: "events", label: "Modifier l'évènement", description: "Modifier l'évènement (dont images)." },
  { key: "event.registration_toggle", scope: "EVENT", domain: "events", label: "Ouvrir ou fermer les inscriptions", description: "Ouvrir ou fermer les inscriptions." },
  { key: "event.settings.update", scope: "EVENT", domain: "events", label: "Modifier les paramètres de l'évènement", description: "Contacts, template de badge, paramètres." },
  { key: "event.categories.manage", scope: "EVENT", domain: "events", label: "Gérer les catégories", description: "Gérer les catégories." },
  { key: "event.members.manage", scope: "EVENT", domain: "events", label: "Gérer les membres de l'évènement", description: "Gérer les membres de l'évènement." },
  { key: "event.activity.read", scope: "EVENT", domain: "events", label: "Consulter le journal de l'évènement", description: "Journal complet de l'évènement." },
  { key: "scan.history.read", scope: "EVENT", domain: "scan", label: "Voir son historique de scans", description: "Voir son propre historique de scans." },
  { key: "registration.approve", scope: "EVENT", domain: "registrations", label: "Approuver ou rejeter une inscription", description: "Approuver ou rejeter une inscription." },
  { key: "registration.create", scope: "EVENT", domain: "registrations", label: "Créer une inscription", description: "Créer une inscription manuellement." },
  { key: "registration.update", scope: "EVENT", domain: "registrations", label: "Modifier une inscription", description: "Modifier une inscription." },
  { key: "registration.delete", scope: "EVENT", domain: "registrations", label: "Supprimer une inscription", description: "Supprimer une inscription." },
  { key: "registration.export", scope: "EVENT", domain: "registrations", label: "Exporter les inscriptions", description: "Exporter les inscriptions." },
  { key: "registration.block", scope: "EVENT", domain: "registrations", label: "Bloquer un e-mail ou un document", description: "Bloquer e-mail ou document, voir les doublons." },
  { key: "registration.all_access", scope: "EVENT", domain: "registrations", label: "Accorder l'accès à toutes les zones", description: "Accorder l'accès à toutes les zones." },
  { key: "badge.print", scope: "EVENT", domain: "badges", label: "Imprimer les badges", description: "Prévisualiser, exporter, marquer imprimés les badges." },
  { key: "scan.check-in", scope: "EVENT", domain: "scan", label: "Contrôler l'accès", description: "Scanner les QR, contrôler l'accès." },
  { key: "print.request", scope: "EVENT", domain: "print_event", label: "Commander des impressions", description: "Créer et suivre les commandes d'impression." },
  { key: "print.onsite.operate", scope: "EVENT", domain: "print_event", label: "Tenir le poste d'impression sur place", description: "Tenir le poste d'impression sur place (recherche, scan, impression)." },
  { key: "account.profile.update", scope: "PARTICIPANT", domain: "account", label: "Modifier son profil", description: "Modifier son profil." },
  { key: "account.profile.upload", scope: "PARTICIPANT", domain: "account", label: "Téléverser ses documents", description: "Téléverser sa photo et sa pièce d'identité." },
  { key: "registration.self.create", scope: "PARTICIPANT", domain: "account", label: "S'inscrire à un évènement", description: "S'inscrire à un évènement." },
  { key: "registration.self.resubmit", scope: "PARTICIPANT", domain: "account", label: "Resoumettre une inscription", description: "Resoumettre une inscription rejetée." },
] as const satisfies readonly PermissionDef[];

export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];

export type PermissionOfScope<S extends PermissionScope> = Extract<
  (typeof PERMISSION_CATALOG)[number],
  { scope: S }
>["key"];

export const PERMISSION_KEYS: ReadonlySet<string> = new Set(PERMISSION_CATALOG.map((p) => p.key));

const BY_KEY: ReadonlyMap<string, PermissionDef> = new Map(
  PERMISSION_CATALOG.map((p) => [p.key, p as PermissionDef]),
);

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSION_KEYS.has(value);
}

export function permissionDef(key: Permission): PermissionDef {
  return BY_KEY.get(key)!;
}

export function permissionScopeOf(key: Permission): PermissionScope {
  return permissionDef(key).scope;
}

/** Permissions de gestion des droits : réservées aux rôles système qui les portent. */
export const RESERVED_PERMISSIONS: readonly Permission[] = PERMISSION_CATALOG.filter(
  (p) => "reserved" in p,
).map((p) => p.key);
