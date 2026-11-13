// Rôles système et leurs permissions (source de vérité du code, spec 37). Aucune ligne RolePermission en base pour ces rôles.
import { PERMISSION_CATALOG, type Permission, type PermissionScope } from "./catalog";

export type RoleScope = "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT";

export type SystemRoleKey =
  | "SUPER_ADMIN"
  | "STAFF_ADMIN"
  | "STAFF_SUPPORT"
  | "STAFF_PRINTER"
  | "STAFF_OBSERVER"
  | "OWNER"
  | "MANAGER"
  | "AUDITOR"
  | "AGENT"
  | "ADMIN"
  | "OPERATOR"
  | "PRINTER"
  | "VIEWER"
  | "PARTICIPANT";

export type SystemRoleDef = {
  key: SystemRoleKey;
  scope: RoleScope;
  name: string;
  description: string;
  permissions: readonly Permission[];
};

/** « Qui peut porter quoi » : niveaux de permission autorisés pour un rôle de chaque niveau. */
export const ROLE_SCOPE_ALLOWS: Readonly<Record<RoleScope, readonly PermissionScope[]>> = {
  PLATFORM: ["PLATFORM", "ORG", "EVENT"],
  ORG: ["ORG", "EVENT"],
  EVENT: ["EVENT"],
  PARTICIPANT: ["PARTICIPANT"],
};

// Abréviations de la spec 37 ; SUPER_ADMIN (SA) est calculé, il détient tout sauf le niveau PARTICIPANT.
type Abbr =
  | "AD" | "SU" | "PR" | "OB" // staff
  | "O" | "M" | "A" | "G" // organisation
  | "ead" | "eop" | "epr" | "evi" // évènement
  | "PA"; // participant

const ABBR_TO_ROLE: Readonly<Record<Abbr, SystemRoleKey>> = {
  AD: "STAFF_ADMIN",
  SU: "STAFF_SUPPORT",
  PR: "STAFF_PRINTER",
  OB: "STAFF_OBSERVER",
  O: "OWNER",
  M: "MANAGER",
  A: "AUDITOR",
  G: "AGENT",
  ead: "ADMIN",
  eop: "OPERATOR",
  epr: "PRINTER",
  evi: "VIEWER",
  PA: "PARTICIPANT",
};

// Rôles système (hors SUPER_ADMIN) accordant chaque permission ; liste vide : SUPER_ADMIN seul.
// Typé en Record<Permission, …> : une permission ajoutée au catalogue sans attribution ne compile pas.
const GRANTS: Readonly<Record<Permission, readonly Abbr[]>> = {
  // PLATFORM
  "platform.access": ["AD", "SU", "PR", "OB"],
  "platform.roles.manage": [],
  "users.permissions.manage": [],
  "organizations.read": ["AD", "SU", "OB"],
  "organizations.create": ["AD"],
  "organizations.update": ["AD"],
  "organizations.archive": ["AD"],
  "organizations.delete": [],
  "organizations.members.manage": ["AD"],
  "subscriptions.update": ["AD"],
  "plans.read": ["AD", "SU", "OB"],
  "plans.manage": ["AD"],
  "payments.read": ["AD", "SU", "OB"],
  "users.read": ["AD", "SU", "OB"],
  "users.update": ["AD"],
  "users.create": ["AD", "SU"],
  "users.staff.create": ["AD"],
  "users.staff.assign_role": ["AD"],
  "users.staff.assign_top_role": [],
  "users.archive": ["AD"],
  "users.password.reset": ["AD", "SU"],
  "profiles.read": ["AD", "SU", "OB"],
  "profiles.review": ["AD", "SU"],
  "blocklist.read": ["AD", "SU", "OB"],
  "blocklist.manage": ["AD", "SU"],
  "settings.read": ["AD", "SU", "OB"],
  "settings.update": ["AD"],
  "settings.secrets.update": [],
  "settings.smtp.test": ["AD"],
  "settings.subscription_rights.update": ["AD"],
  "settings.badge_template.update": ["AD"],
  "settings.onsite_print.update": ["AD"],
  "rejection_reasons.read": ["AD", "SU", "OB"],
  "rejection_reasons.manage": ["AD"],
  "badge_templates.read": ["AD", "SU", "OB"],
  "badge_templates.manage": ["AD"],
  "email_jobs.read": ["AD", "SU", "OB"],
  "email_jobs.manage": ["AD"],
  "activity.read": ["AD", "SU", "OB"],
  "print.requests.read": ["AD", "PR", "OB"],
  "print.requests.messages.send": ["AD", "PR"],
  "print.requests.reject": ["AD", "PR"],
  "print.requests.advance": ["AD", "PR"],
  "print.requests.onsite.complete": ["AD"],
  "print.requests.quote.edit": ["AD"],
  "print.requests.quote.send": ["AD"],
  "print.requests.reopen": ["AD"],
  "print.requests.mark_paid": ["AD"],
  "print.requests.credit.apply": ["AD"],
  "print.onsite.margin.update": ["AD"],
  "print.catalog.read": ["AD", "PR", "OB"],
  "print.catalog.manage": ["AD"],
  "print.layouts.read": ["AD", "PR", "OB"],
  "print.layouts.manage": ["AD"],
  "print.sheets.read": ["AD", "PR"],
  "print.sheets.generate": ["AD", "PR"],
  // ORG
  "org.read": ["O", "M", "A", "G", "AD", "SU", "OB"],
  "org.update": ["O", "AD"],
  "org.activity.read": ["O", "M", "A", "AD", "SU", "OB"],
  "org.members.read": ["O", "M", "A", "AD", "SU", "OB"],
  "org.members.manage": ["O", "AD"],
  "org.roles.manage": ["O"],
  "org.members.permissions.manage": ["O"],
  "org.templates.read": ["O", "M", "A", "AD", "SU", "OB"],
  "org.templates.manage": ["O", "M", "AD"],
  "org.badge_settings.update": ["O", "M", "AD"],
  "org.upload": ["O", "M", "AD"],
  "org.events.list": ["O", "M", "A", "G", "AD", "SU", "OB"],
  "org.events.create": ["O", "M", "AD"],
  "org.events.archive": ["O", "M", "AD"],
  "billing.subscription.read": ["O", "M", "AD", "SU", "OB"],
  "billing.subscription.pay": ["O"],
  "billing.payments.read": ["O", "M", "AD", "SU", "OB"],
  "print.quote.accept": ["O"],
  // EVENT : rôles évènement, rôles org (tous évènements), staff
  "event.read.aggregated": ["ead", "eop", "evi", "O", "M", "A", "AD", "SU", "OB"],
  "event.read.detailed": ["ead", "eop", "O", "M", "AD", "SU", "OB"],
  "event.update": ["ead", "O", "M", "AD"],
  "event.registration_toggle": ["ead", "O", "M", "AD"],
  "event.settings.update": ["ead", "O", "M", "AD"],
  "event.categories.manage": ["ead", "O", "M", "AD"],
  "event.members.manage": ["ead", "O", "M", "AD"],
  "event.activity.read": ["ead", "O", "M", "AD", "SU", "OB"],
  "scan.history.read": ["ead", "eop", "O", "M", "G", "AD"],
  "registration.approve": ["ead", "eop", "O", "M", "AD", "SU"],
  "registration.create": ["ead", "O", "M", "AD"],
  "registration.update": ["ead", "O", "M", "AD"],
  "registration.delete": ["ead", "O", "M", "AD"],
  "registration.export": ["ead", "O", "M", "AD"],
  "registration.block": ["ead", "O", "M", "AD"],
  "registration.all_access": ["ead", "O", "M", "AD"],
  "badge.print": ["ead", "eop", "epr", "O", "M", "G", "AD", "PR"],
  "scan.check-in": ["ead", "eop", "O", "M", "G", "AD"],
  // lecture seule pour le staff : l'écriture lui est refusée en code
  "print.request": ["ead", "O", "M", "AD", "SU", "OB"],
  "print.onsite.operate": ["ead", "O", "M", "G", "AD", "PR"],
  // PARTICIPANT
  "account.profile.update": ["PA"],
  "account.profile.upload": ["PA"],
  "registration.self.create": ["PA"],
  "registration.self.resubmit": ["PA"],
};

const ALL_KEYS = PERMISSION_CATALOG.map((p) => p.key) as readonly Permission[];

function permissionsOf(role: SystemRoleKey): readonly Permission[] {
  if (role === "SUPER_ADMIN") {
    return PERMISSION_CATALOG.filter((p) => p.scope !== "PARTICIPANT").map((p) => p.key);
  }
  return ALL_KEYS.filter((key) => GRANTS[key].some((abbr) => ABBR_TO_ROLE[abbr] === role));
}

type RoleMeta = { scope: RoleScope; name: string; description: string };

const ROLE_META: Readonly<Record<SystemRoleKey, RoleMeta>> = {
  SUPER_ADMIN: { scope: "PLATFORM", name: "Super administrateur", description: "Détient toutes les permissions de la plateforme." },
  STAFF_ADMIN: { scope: "PLATFORM", name: "Administrateur", description: "Administre la plateforme, hors secrets et gestion des droits." },
  STAFF_SUPPORT: { scope: "PLATFORM", name: "Support", description: "Accompagne les clients : comptes, profils, inscriptions et consultation." },
  STAFF_PRINTER: { scope: "PLATFORM", name: "Imprimeur", description: "Traite les commandes d'impression et génère les planches." },
  STAFF_OBSERVER: { scope: "PLATFORM", name: "Observateur", description: "Consulte la plateforme en lecture seule." },
  OWNER: { scope: "ORG", name: "Propriétaire", description: "Gère l'organisation, ses membres, ses rôles et son abonnement." },
  MANAGER: { scope: "ORG", name: "Gestionnaire", description: "Gère les évènements de l'organisation au quotidien." },
  AUDITOR: { scope: "ORG", name: "Auditeur", description: "Consulte l'organisation et ses évènements en lecture seule." },
  AGENT: { scope: "ORG", name: "Agent", description: "Scanne les accès et tient le poste d'impression sur place." },
  ADMIN: { scope: "EVENT", name: "Administrateur d'évènement", description: "Administre un évènement." },
  OPERATOR: { scope: "EVENT", name: "Opérateur", description: "Valide les inscriptions, imprime les badges et contrôle les accès." },
  PRINTER: { scope: "EVENT", name: "Imprimeur d'évènement", description: "Imprime les badges d'un évènement." },
  VIEWER: { scope: "EVENT", name: "Lecteur", description: "Consulte les chiffres agrégés d'un évènement." },
  PARTICIPANT: { scope: "PARTICIPANT", name: "Participant", description: "Gère son profil et ses inscriptions." },
};

export const SYSTEM_ROLES: Readonly<Record<SystemRoleKey, SystemRoleDef>> = Object.fromEntries(
  (Object.keys(ROLE_META) as SystemRoleKey[]).map((key) => [
    key,
    { key, ...ROLE_META[key], permissions: permissionsOf(key) },
  ]),
) as Record<SystemRoleKey, SystemRoleDef>;

export function isSystemRoleKey(value: unknown): value is SystemRoleKey {
  return typeof value === "string" && Object.hasOwn(SYSTEM_ROLES, value);
}

const PERMISSION_SETS = new Map<SystemRoleKey, ReadonlySet<Permission>>();

export function systemRolePermissions(key: SystemRoleKey): ReadonlySet<Permission> {
  let set = PERMISSION_SETS.get(key);
  if (!set) {
    set = new Set(SYSTEM_ROLES[key].permissions);
    PERMISSION_SETS.set(key, set);
  }
  return set;
}
