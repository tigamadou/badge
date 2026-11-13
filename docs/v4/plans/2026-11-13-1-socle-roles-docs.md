# Vague 1 — Socle rôles, permissions et ancrages documentation — Plan d'implémentation

> **Pour les agents d'exécution :** sous-skill requis : `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans`. Les étapes utilisent la syntaxe `- [ ]`.

> **Exécution :** séquentielle, dans le **dossier principal**
> (`/Users/amadou/Devs/projects/badge`), sur la branche `feat/roles-imprimeur-support`, avant la
> vague 2. **Toutes les commandes `make` tournent dans le worktree** (le dossier principal ici ; le
> conteneur `app` doit tourner : `make dev`). En exécution automatisée (tâche planifiée), **un
> commit par tâche est autorisé** sur la branche du plan (message en français ASCII, style
> conventional commits, **sans mention d'IA ni co-auteur**) ; en dehors, aucun commit sans demande
> explicite de l'utilisateur. La vague 2 ne démarre qu'une fois ce socle **commité**.

**Objectif :** poser tout ce que les lots 2a, 2b et 2c partagent pour les rôles et permissions
(schéma, catalogue de permissions, rôles système, résolution, gardes, contexte `EventAuthCtx`,
couche de compatibilité `minRole`/`role`, migration, seed, fabriques, notifications par permission,
logique d'impression partagée, découplage de `OnsiteStation`), plus la règle serveur de la
quantité des accessoires (spec 39) et les points d'ancrage de la documentation des pages (spec 40).
À la fin, **l'application reste verte** (lint, typecheck, tests, e2e) sans qu'aucun lot ait encore
migré ses gardes.

**Architecture :** le catalogue de permissions et les permissions des rôles système vivent dans le
code (`src/lib/permissions/**`) ; les rôles sont aussi des lignes `Role` en base (clé
`systemKey` pour les rôles système) pour les clés étrangères des membres. La résolution est une
fonction pure sur un `UserContext` enrichi. L'ancien monde (`minRole`, `role`, `staffRole`,
`effectiveRole`) est conservé **en lecture seule** au-dessus du nouveau contexte : le contexte
dérive les champs hérités de la clé du rôle système, avec repli sur la colonne d'enum tant que
`roleId` est nul (données non encore migrées, code non encore converti).

**Stack :** Next.js 16, Prisma 6 / MySQL 8, Vitest 4 (base `badge_test`), Playwright.

**Spec :**
[37 rôles et permissions](../specs/2026-11-13-37-v4-roles-et-permissions.md) (principale),
[36 coordination](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md) (section « Vague 1 »),
[39 quantité des accessoires](../specs/2026-11-13-39-v4-quantite-accessoires-automatique.md) (règle serveur),
[40 documentation des pages](../specs/2026-11-13-40-v4-documentation-des-pages.md) (ancrages seulement).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma Prisma, reset de test, types de journal | [x] | 2026-11-13 | Correctifs mécaniques (`role` facultatif) : `prisma/seed/demo/notifications/notifications.ts`, `prisma/seed/demo/notifications/activity.ts` (5 types ajoutés à `ACTIVITY_NOT_SEEDED`), `src/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route.ts`, `src/app/api/org/[orgId]/members/[userId]/route.ts`, `src/app/api/platform/organizations/[orgId]/owners/route.ts`, `src/app/event/[eventId]/members/page.tsx`, `src/app/org/[orgId]/members/page.tsx`, `src/app/platform/organizations/[orgId]/members/page.tsx`, `src/lib/notifications/recipients.ts`, `src/lib/user-context.ts` |
| 2 | Catalogue des permissions et libellés | [x] | 2026-11-13 | 98 clés (56/18/20/4). Union `PermissionDomain` figée : access, roles, users, organizations, members, subscriptions, plans, payments, profiles, blocklist, settings, rejection_reasons, badge_templates, email_jobs, activity, print_requests, print_catalog, print_layouts, print_sheets, org, events, billing, scan, registrations, badges, print_event, account (`print.onsite.margin.update` et `print.quote.accept` dans `print_requests`; `org.events.*` dans `events`; `org.members.*` dans `members`). |
| 3 | Rôles système (permissions en code) | [x] | 2026-11-13 | `system-roles.ts` : grants typés `Record<Permission, …>` (une permission sans attribution ne compile pas). `index.ts` ré-exporte catalog, system-roles, labels (resolve en Task 5). |
| 4 | Contexte utilisateur enrichi et repli sur les enums | [x] | 2026-11-13 | Correctifs mécaniques : `auth-helpers.ts` (garde `m.role !== null`), `recipients.ts` (champs de compat du contexte, Task 11 refait), tests `auth-helpers`, `org-redirect`, `api-staff-users-post/detail` (formes de contexte / lignes mockées). `print-requests/service.ts` inchangé (typecheck vert). Appartenance sans `roleId` ni enum ignorée (fermé par défaut). |
| 5 | Résolution des permissions effectives | [x] | 2026-11-13 | `resolve.ts` pur ; `eventTargetOf` accepte `{ id, orgId }` ou `{ eventId, orgId }`. Les règles « jamais le staff » sont laissées aux gardes. |
| 6 | Gardes : `requirePermission`, compatibilité, derniers titulaires | [x] | 2026-11-13 | `requirePermission` accepte une liste ; `hasOrgRole`/`effectiveEventRole` : un staff sans rôle hérité (STAFF_PRINTER, personnalisé) n'obtient plus le contournement staff ; `getEventTarget` testé dans `event-org-target.test.ts` (base réelle, `event-org.test.ts` mocke Prisma) |
| 7 | Wrappers de routes et garde participant | [x] | 2026-11-13 | Code écrit avant les tests (RED prouvé ensuite par stash des sources). Assertions EVENT_FORBIDDEN -> PERMISSION_DENIED mises à jour dans api-event-badge-exports.test.ts et badges/[badgeId]/__tests__/route.test.ts (tests seulement). assertNotStaff hors tâche. |
| 8 | Rôles système en base, migration, `make migrate-roles` | [x] | 2026-11-13 | `make migrate-roles ARGS=--dry-run` sur la base de dev : 0 staff, 0 membre d'org, 0 membre d'évènement, 0 déjà migré (dev vide d'enums à migrer). `dryRun` n'écrit rien, pas même les rôles système. |
| 9 | Fabriques, reset global et helpers e2e | [ ] | | |
| 10 | Seed : rôles système, SUPER_ADMIN, comptes démo | [ ] | | |
| 11 | Notifications ciblées par permission | [ ] | | |
| 12 | Logique d'impression partagée | [ ] | | |
| 13 | Découplage de `OnsiteStation` | [ ] | | |
| 14 | Consommateurs transverses | [ ] | | |
| 15 | Spec 39 : quantité des accessoires côté serveur | [ ] | | |
| 16 | Spec 40 : ancrages de la documentation | [ ] | | |
| 17 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Le socle est seul à écrire pendant la vague 1. Fichiers créés ou modifiés :

- `prisma/schema.prisma`
- `src/lib/permissions/**` (nouveau : `catalog.ts`, `system-roles.ts`, `resolve.ts`, `labels.ts`,
  `db.ts`, `migrate.ts`, `index.ts`, `__tests__/**`)
- `src/lib/auth-guards.ts`, `src/lib/auth-helpers.ts`, `src/lib/user-context.ts`,
  `src/types/auth.ts`, `src/lib/with-staff-auth.ts`, `src/lib/with-org-auth.ts`,
  `src/lib/with-event-auth.ts`, `src/lib/auth-participant.ts`, `src/lib/event-org.ts` et leurs
  tests dans `src/lib/__tests__/`
- `src/lib/notifications/recipients.ts`, `types.ts`, `triggers.ts` et leurs tests
- `src/lib/activity-labels.ts`, `src/lib/activity-log.ts`, `src/lib/seed-super-admin.ts` et tests
- `scripts/migrate-roles.ts`, `scripts/smoke-tests.ts`, cible `migrate-roles` de `Makefile`
- `prisma/seed/**` (rôles système, comptes démo Imprimeur et AGENT) et leurs tests
- `src/test/factories.ts`, `src/test-setup.ts`, `e2e/helpers/db.ts`, `e2e/helpers/auth.ts`,
  `e2e/transverse/**`
- `src/components/staff/print/OnsiteStation.tsx`, `src/components/staff/print/request-fetch.ts`
  et `src/components/staff/print/__tests__/request-fetch.test.ts`
- `src/lib/print-requests/service.ts`, `route.ts`, `lifecycle.ts`, `credit-view.ts`,
  `onsite-station-view.ts`, `quote.ts`, `content.ts` ; `src/lib/print-sheets/layout-page-data.ts` ;
  `src/components/event/print/guard.ts`
- `src/components/activity/JournalEntryDetail.tsx`, `src/app/(marketing)/page.tsx`
- Ancrages doc : `src/components/page-docs/PageDocButton.tsx`,
  `src/components/staff/StaffShell.tsx`, `src/components/admin/OrgShell.tsx`,
  `src/components/event/EventShell.tsx`, `src/components/public/AccountNav.tsx`,
  `src/app/account/layout.tsx`, `src/app/platform/docs/page.tsx`,
  `src/app/org/[orgId]/docs/page.tsx`, `src/app/event/[eventId]/docs/page.tsx`,
  `src/app/account/docs/page.tsx` (+ tests des shells existants)
- `docs/v4/features/roles-permissions.md` (nouveau). `docs/v4/architecture.md` et `CLAUDE.md` : vague 3, pas ici.

**Correctifs mécaniques de typage** : rendre `OrgMembership.role`, `EventMembership.role`
facultatifs peut faire échouer `make typecheck` dans des fichiers de lots (`m.role` devenu
`OrgRole | null`). Le socle passe avant les lots : il corrige ces seuls points par le changement
minimal (`?? valeur`, garde `null`) et **liste chaque fichier touché dans les Notes de la
Progression**. Aucun autre changement hors liste.

**En lecture seule (lots 2a, 2b, 2c)** : tout ce qui précède après la vague 1. Un lot qui a
besoin d'y toucher s'arrête et le signale.

**En lecture seule pour le socle** : `src/app/api/**` et `src/app/**` hors ancrages, et
`src/components/**` hors liste ci-dessus (sauf correctifs mécaniques). **Besoin d'y toucher →
s'arrêter et le signaler.**

## Global Constraints

Règles de test de `CLAUDE.md` (valables pour tout test écrit ici) :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (`make test` crée et met au schéma la base
  via `make test-db`) ; jamais sur la base de dev (garde-fou dans `src/test-setup.ts`).
- **Pas de mock de la base ni de Prisma** : MySQL réel. Seuls se mockent les services externes
  (SMTP, renderer via `fakeExporter`, session NextAuth).
- **Fabriques** : données de test via `src/test/factories.ts` (`@faker-js/faker`) ; ajouter une
  fabrique plutôt que dupliquer des `prisma.*.create`.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (gate de `vitest.config.ts`) :
  chaque branche de la couche de compatibilité est testée.
- **e2e** (Playwright) contre l'app en cours d'exécution, avec leurs propres fixtures préfixées
  et nettoyées (`e2e/helpers/db.ts`).

Règles du chantier :

- **Pas de déploiement, pas de commande de production, pas de SSH.** `make db-push` en **dev
  uniquement** (la base de test est mise au schéma par `make test-db`). Ne pas modifier `.env*`,
  `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`. Pas de cible `migrate-roles-preprod` /
  `-prod` (hors chantier).
- **Aucune régression de droits** pour un utilisateur existant, hors changements assumés par la
  spec 37 : Observateur en lecture seule chez les clients (nouvelle API `permission` seulement),
  `STAFF_SUPPORT` sans la production d'impression, union rôle d'organisation + rôle d'évènement
  (nouvelle API seulement), `users.update` réservé à AD+.
- **Compatibilité temporaire** : les API `minRole`/`role`/`allowStaff`/`effectiveRole` gardent
  leur **sémantique actuelle** ; seules les nouvelles API (`requirePermission`, option
  `permission`, `hasPermission`) ont la sémantique de la spec 37. Tout code de compatibilité est
  marqué `@deprecated compat chantier roles-permissions (retiré à la fusion)`.
- Code et identifiants en anglais ; UI, libellés, messages en français avec accents ;
  commentaires en français, style du fichier. Fichiers, branches, commits en ASCII.
- Toute action sensible loggue via `logActivity()`. Ne jamais exposer hash, secrets, tokens.
- Les `ActivityType` ajoutés : `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_ARCHIVED`, `ROLE_RESTORED`,
  `USER_PERMISSIONS_CHANGED`.

## Contrats publiés

Signatures **figées** : les plans 2a, 2b, 2c, 3 s'y réfèrent. Ne pas les changer sans mettre à
jour ces plans.

```ts
// src/lib/permissions/catalog.ts
export type PermissionScope = "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT";
export type PermissionDomain = /* union de littéraux fixée en Task 2 */ string;
export type PermissionDef = {
  key: string; scope: PermissionScope; domain: PermissionDomain;
  label: string; description: string; reserved?: true;
};
export const PERMISSION_CATALOG: readonly PermissionDef[]; // `as const satisfies`
export type Permission = (typeof PERMISSION_CATALOG)[number]["key"];
export type PermissionOfScope<S extends PermissionScope> = Extract<(typeof PERMISSION_CATALOG)[number], { scope: S }>["key"];
export const PERMISSION_KEYS: ReadonlySet<string>;
export function isPermission(value: unknown): value is Permission;
export function permissionDef(key: Permission): PermissionDef;
export function permissionScopeOf(key: Permission): PermissionScope;
export const RESERVED_PERMISSIONS: readonly Permission[]; // les 4 clés `reserved`

// src/lib/permissions/system-roles.ts
export type SystemRoleKey =
  | "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_PRINTER" | "STAFF_OBSERVER"
  | "OWNER" | "MANAGER" | "AUDITOR" | "AGENT"
  | "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER"
  | "PARTICIPANT";
export type RoleScope = "PLATFORM" | "ORG" | "EVENT" | "PARTICIPANT"; // = enum Prisma RoleScope
export type SystemRoleDef = { key: SystemRoleKey; scope: RoleScope; name: string; description: string; permissions: readonly Permission[] };
export const SYSTEM_ROLES: Readonly<Record<SystemRoleKey, SystemRoleDef>>;
export function isSystemRoleKey(value: unknown): value is SystemRoleKey;
export function systemRolePermissions(key: SystemRoleKey): ReadonlySet<Permission>;
export const ROLE_SCOPE_ALLOWS: Readonly<Record<RoleScope, readonly PermissionScope[]>>; // « Qui peut porter quoi »

// src/types/auth.ts
export type ResolvedRole = {
  id: string | null;            // null : rôle système résolu par repli sur l'enum
  systemKey: SystemRoleKey | null; // null : rôle personnalisé
  scope: RoleScope; name: string;
  permissions: ReadonlySet<Permission>;
};
export type PermissionOverrideLite = { orgId: string | null; permission: Permission; effect: "GRANT" | "REVOKE" };
export type OrgMembershipLite = { orgId: string; roleId: string | null; roleRef: ResolvedRole | null;
  /** @deprecated compat */ role: OrgRole | null };
export type EventMembershipLite = { eventId: string; roleId: string | null; roleRef: ResolvedRole | null;
  /** @deprecated compat */ role: EventRole | null };
export type UserContext = {
  user: { id: string; email: string; name: string };
  isStaff: boolean;
  platformRole: ResolvedRole | null;
  orgMemberships: OrgMembershipLite[];
  eventMemberships: EventMembershipLite[];
  overrides: PermissionOverrideLite[];
  /** @deprecated compat : clé héritée (SUPER_ADMIN…STAFF_OBSERVER), null pour STAFF_PRINTER/personnalisé */
  staffRole: StaffRole | null;
};
export type EffectiveEventRole = EventRole | "STAFF" | null; // inchangé (compat)

// src/lib/permissions/resolve.ts (pures)
export type PermissionTarget =
  | { kind: "platform" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string; orgId: string }
  | { kind: "participant" };
export function effectivePermissions(ctx: UserContext, target: PermissionTarget): Set<Permission>;
export function hasPermission(ctx: UserContext, permission: Permission, target: PermissionTarget): boolean;
export function isStaffActor(ctx: UserContext, target: PermissionTarget): boolean;
  // ctx.isStaff sans membership dans l'org (target org) ni dans l'org/l'évènement (target event) ; false pour platform/participant
export function eventTargetOf(e: { id?: string; eventId?: string; orgId: string }): Extract<PermissionTarget, { kind: "event" }>;

// src/lib/user-context.ts
export const USER_CONTEXT_SELECT: Prisma.UserSelect;   // select unique partagé (gardes, notifications)
export function buildUserContext(row: Prisma.UserGetPayload<{ select: typeof USER_CONTEXT_SELECT }>): UserContext;
export async function loadUserContext(userId: string): Promise<UserContext | null>; // null si absent ou archivé, NON mémoïsé
export const getUserContext: (userId: string) => Promise<UserContext | null>;       // = React cache(loadUserContext), pour pages et loadPermissions

// src/lib/auth-guards.ts
export class AuthError { code: /* existants */ | "PERMISSION_DENIED"; httpStatus: 401 | 403 | 404 | 409 }
export async function requirePermission(userId: string, permission: Permission, target: PermissionTarget): Promise<void>;
  // 401 NOT_AUTHENTICATED (contexte nul) ; 403 PERMISSION_DENIED
export async function loadPermissions(userId: string, target: PermissionTarget): Promise<Set<Permission>>; // Server Components ; ensemble vide si contexte nul
export async function loadEventTarget(eventId: string): Promise<Extract<PermissionTarget, { kind: "event" }>>; // 404 EVENT_NOT_FOUND
// src/lib/event-org.ts
export async function getEventTarget(eventId: string): Promise<Extract<PermissionTarget, { kind: "event" }>>; // notFound() si absent (pages)

// Wrappers
withStaffAuth(handler, options?: { permission?: Permission; minRole?: StaffRole });          // permission : cible platform ; sans option = minRole STAFF_OBSERVER (hérité)
withOrgAuth(guard: Permission | OrgRole, handler);                                            // permission : cible org
withEventAuth({ permission?: Permission; minRole?: EventRole; allowArchived?: boolean; requireRegistrationOpen?: boolean }, handler);
export type EventAuthCtx = {
  session: Session; orgId: string; eventId: string;
  event: { id: string; orgId: string; archived: boolean; registrationOpen: boolean; date: Date; endDate: Date | null };
  permissions: Set<Permission>;   // permissions effectives sur l'évènement
  isStaffActor: boolean;
  /** @deprecated compat */ effectiveRole: EffectiveEventRole;
};

// src/lib/auth-participant.ts
export async function requireParticipantPermission(permission: Permission): Promise<SessionUser>;
  // AuthError("NOT_AUTHENTICATED",401) si compte absent/archivé ; ("ACCOUNT_BLOCKED",403) si bloqué ; ("FORBIDDEN",403) si permission absente

// src/lib/permissions/db.ts (client passé en paramètre : utilisable par e2e/helpers/db.ts)
export type RoleDb = Pick<PrismaClient, "role">;
export async function ensureSystemRoles(db: RoleDb): Promise<Record<SystemRoleKey, string>>; // upsert idempotent par systemKey, renvoie les ids
export async function systemRoleId(db: RoleDb, key: SystemRoleKey): Promise<string>;
export function legacyKeyOf<T extends "StaffRole" | "OrgRole" | "EventRole">(key: SystemRoleKey): /* enum Prisma ou null */;

// src/lib/permissions/migrate.ts
export async function migrateRoles(db: PrismaClient, opts?: { dryRun?: boolean }): Promise<{ users: number; orgMemberships: number; eventMemberships: number; alreadyDone: number }>;

// Notifications
export type RecipientSpec =
  | { users: string[] }
  | { permission: Permission; target: Exclude<PermissionTarget, { kind: "participant" }>; includeStaff?: boolean };
  // target org/event : titulaires parmi les MEMBRES de l'org/l'évènement ; includeStaff élargit au staff porteur

// Impression (fonctions de vue acceptant l'ancien ou le nouveau paramètre pendant la transition)
canApplyCredit(status, access: StaffRole | ReadonlySet<Permission>, available, grossTotal): boolean   // print.requests.credit.apply
canSetOnsiteMargin(status: string, access: StaffRole | ReadonlySet<Permission>): boolean            // print.onsite.margin.update
canEditQuote(...)  // inchangé (2a)
assertOwner(userId: string, orgId: string): Promise<void>                                            // print.quote.accept ; STAFF_FORBIDDEN / OWNER_REQUIRED
assertNotStaff(ctx: Pick<EventAuthCtx, "isStaffActor">): void                                         // STAFF_FORBIDDEN 403
canWriteLayouts(): Promise<boolean>                                                                   // print.layouts.manage

// Fabriques Vitest (src/test/factories.ts) — clés de rôle système, rôles écrits en base
makeStaff(role: PlatformSystemKey, data?): Promise<User>          // PlatformSystemKey = SUPER_ADMIN|STAFF_ADMIN|STAFF_SUPPORT|STAFF_PRINTER|STAFF_OBSERVER
makeOrgMember(orgId: string, role: OrgSystemKey, data?): Promise<User>     // OrgSystemKey = OWNER|MANAGER|AUDITOR|AGENT
makeEventMember(eventId: string, role: EventSystemKey, data?): Promise<User>
makeCustomRole(input: { scope: RoleScope; orgId?: string | null; name?: string; permissions: Permission[] }): Promise<Role>
makeOverride(input: { userId: string; orgId?: string | null; permission: Permission; effect: "GRANT" | "REVOKE" }): Promise<UserPermissionOverride>

// Helpers e2e (e2e/helpers/db.ts) — mêmes noms qu'aujourd'hui, types élargis
type TestStaffRole = PlatformSystemKey; type TestOrgRole = OrgSystemKey; type TestEventRole = EventSystemKey
createTestStaff({ scope, role }), createTestOrgMember({ scope, orgId, role }), createTestEventMember({ scope, orgId, eventId, role, attachOrgAuditor? })
loginAsStaff / loginAsOrgMember / loginAsEventMember (e2e/helpers/auth.ts) : inchangés, acceptent STAFF_PRINTER et AGENT

// OnsiteStation
type OnsiteStationProps = { …existants; apiBase?: string /* défaut /api/platform/print/requests/${requestId} */; backHref?: string /* défaut /platform/print/orders/${requestId} */ }
requestUrl(requestId: string, path?: string, apiBase?: string): string  // apiBase fourni → `${apiBase}${path}`

// Documentation (spec 40)
export function PageDocButton(): null   // "use client", src/components/page-docs/PageDocButton.tsx ; remplacé par le lot 4a
```

**Codes d'erreur** : `AuthError` (gardes) ajoute `PERMISSION_DENIED` (403) ; réponses JSON
`{ error: "PERMISSION_DENIED" }`. Inchangés : `NOT_AUTHENTICATED` 401, `NOT_STAFF`,
`INSUFFICIENT_STAFF_ROLE`, `ORG_FORBIDDEN`, `EVENT_FORBIDDEN` 403, `EVENT_NOT_FOUND` 404,
`LAST_OWNER`, `LAST_SUPER_ADMIN` 409. `PrintRequestError` : `STAFF_FORBIDDEN`, `OWNER_REQUIRED`
(403) inchangés.

**Arbitrages du socle** (à reporter dans le journal de la spec 36 par l'orchestrateur) :
précédence `roleId` puis colonne d'enum ; `role`/`staffRole` du contexte `null` pour les rôles non
hérités (AGENT, STAFF_PRINTER, personnalisés) donc **ils ne satisfont aucun contrôle hérité** ;
`EventAuthCtx.event` ajouté (la spec le disait « inchangé » mais le type actuel ne le porte pas) ;
`RecipientSpec.includeStaff` ajouté (équivalence : les anciens ciblages `eventRoles`/`orgRoles`
excluaient le staff) ; fabriques, seed et helpers e2e **écrivent aussi la colonne d'enum** pour
les rôles hérités (double écriture de compatibilité, retirée à la fusion).

## Review Focus

1. **Utilisateur non encore migré** (`roleId` nul, colonne d'enum posée, ou créé par du code non
   converti) : garde exactement ses droits actuels ; `migrate-roles` rejoué deux fois ne change rien.
2. **Ajustements** : `REVOKE` l'emporte sur `GRANT` ; un ajustement d'une organisation ne fuit
   ni vers une autre organisation ni vers le niveau plateforme ; un ajustement de clé de mauvais
   niveau est ignoré.
3. **Rôles sans équivalent hérité** (`STAFF_PRINTER`, `AGENT`, rôle personnalisé) : refusés par
   tout `minRole`/`role`/`allowStaff`, jamais promus par un repli ; permission inconnue du code
   (clé retirée) ou rôle archivé en base : ignorée sans erreur.
4. **Union rôle d'organisation + rôle d'évènement** (AUDITOR membre PRINTER = VIEWER et PRINTER),
   et staff porteur de permissions d'évènement sur **tout** évènement mais `isStaffActor` vrai.
5. **Notifications** : le staff non membre ne reçoit jamais une notification d'organisation ou
   d'évènement ; comptes archivés ou bloqués et auteur exclus ; destinataires identiques à
   aujourd'hui pour chaque déclencheur (table de la Task 11).
6. **Accessoires (spec 39)** : une quantité d'accessoire envoyée par le client est ignorée par le
   serveur, y compris sur un brouillon existant ; une ligne dont la quantité a été fixée par le
   staff n'est pas contestée.

---

### Task 1: Schéma Prisma, reset de test, types de journal

**Files:**
- Modify: `prisma/schema.prisma`, `src/test-setup.ts`, `src/lib/activity-labels.ts`
- Test: `src/lib/__tests__/activity-labels.test.ts`

**Interfaces:**
- Produces : modèles `Role`, `RolePermission`, `UserPermissionOverride`, enums `RoleScope`,
  `PermissionEffect`, champs `User.platformRoleId/platformRole`, `OrgMembership.roleId/roleRef`,
  `EventMembership.roleId/roleRef`, 5 `ActivityType`.

- [ ] **Step 1 : test rouge** dans `activity-labels.test.ts` : `logKind("ROLE_CREATED") === "creation"`,
  `ROLE_UPDATED` et `USER_PERMISSIONS_CHANGED` → `"modification"`, `ROLE_ARCHIVED` → `"suppression"`,
  `ROLE_RESTORED` → `"modification"` ; chaque nouveau type a une description française non vide
  (`describeActivity` ou fonction équivalente du fichier : reprendre l'API existante du test).
- [ ] **Step 2 : lancer** `make test FILE=src/lib/__tests__/activity-labels.test.ts` → échec (types inconnus).
- [ ] **Step 3 : schéma** — ajouter exactement le modèle de la spec 37 (« Schéma (Prisma) ») :
  enums `RoleScope`, `PermissionEffect` ; modèles `Role`, `RolePermission`, `UserPermissionOverride`.
  Relations nommées : `User.platformRole Role? @relation("PlatformRole", fields:[platformRoleId], references:[id], onDelete: SetNull)`
  + `@@index([platformRoleId])` ; `OrgMembership.roleId String?` + `roleRef Role? @relation("OrgMembershipRole", …, onDelete: SetNull)` + `@@index([roleId])` ;
  idem `EventMembership` (`"EventMembershipRole"`) ; `Role.organization Organization? @relation(fields:[orgId], …, onDelete: Cascade)` ;
  `UserPermissionOverride.user` (Cascade) et `.organization` (Cascade) ; back-relations `Organization.roles`,
  `Organization.permissionOverrides`, `User.permissionOverrides`. **Rendre facultatifs** `OrgMembership.role` (`OrgRole?`) et
  `EventMembership.role` (`EventRole?`) ; `User.staffRole` l'est déjà. Les enums `StaffRole`/`OrgRole`/`EventRole`
  restent inchangés. Ajouter les 5 `ActivityType` (groupe « Rôles et permissions »).
- [ ] **Step 4 : `src/test-setup.ts`** — dans le `beforeEach`, ajouter `await prisma.userPermissionOverride.deleteMany()`
  avant `user.deleteMany()` et `await prisma.role.deleteMany()` après `organization.deleteMany()` (les rôles
  référencent organisation et utilisateurs en `SetNull`/`Cascade`).
- [ ] **Step 5 : `src/lib/activity-labels.ts`** — descriptions françaises des 5 types ; `ROLE_RESTORED` classé
  « modification » (cas explicite dans `logKind`).
- [ ] **Step 6 : `make db-push`** (base de dev, accepter l'ajout de colonnes ; si l'invite signale une perte de
  données, **s'arrêter et demander**). Puis `make typecheck` : corriger **mécaniquement** (voir « Correctifs
  mécaniques ») les erreurs dues à `role` facultatif ; lister les fichiers dans les Notes. `make test FILE=src/lib/__tests__/activity-labels.test.ts` → vert.
- [ ] **Step 7 : commit** (exécution automatisée) : `feat(roles): schema des roles, permissions et ajustements`.

### Task 2: Catalogue des permissions et libellés

**Files:**
- Create: `src/lib/permissions/catalog.ts`, `src/lib/permissions/labels.ts`
- Test: `src/lib/permissions/__tests__/catalog.test.ts`, `src/lib/permissions/__tests__/labels.test.ts`

**Interfaces:**
- Produces : `PERMISSION_CATALOG`, `Permission`, `PermissionOfScope`, `PERMISSION_KEYS`, `isPermission`,
  `permissionDef`, `permissionScopeOf`, `RESERVED_PERMISSIONS`, `PermissionDomain` ; `DOMAIN_LABELS:
  Record<PermissionDomain, string>`, `domainOf(key: Permission): PermissionDomain`,
  `groupByDomain(keys: readonly Permission[]): { domain: PermissionDomain; label: string; permissions: PermissionDef[] }[]`.

- [x] **Step 1 : tests rouges** (`catalog.test.ts`) :
  - le catalogue contient **exactement** les clés des tableaux « Niveau PLATFORM » (56 clés),
    « Niveau ORG » (18), « Niveau EVENT » (20) et « Niveau PARTICIPANT » (4) de la spec 37 : comparer à une
    liste littérale par niveau écrite dans le test (copiée des tableaux de la spec, ordre indifférent) ;
  - clés uniques ; chaque `scope` correspond au tableau d'origine ; chaque `label` et `description` non vides,
    en français (au moins un caractère accentué ou un espace) ;
  - `RESERVED_PERMISSIONS` = `platform.roles.manage`, `users.permissions.manage`, `org.roles.manage`,
    `org.members.permissions.manage` et ce sont les seules `reserved` ;
  - `isPermission("event.archive") === false` (renommée `org.events.archive`) ; `isPermission("org.events.archive")`.
  `labels.test.ts` : chaque domaine du catalogue a un libellé ; `groupByDomain` regroupe et conserve l'ordre du catalogue.
- [x] **Step 2 : lancer** `make test FILE=src/lib/permissions` → échec (module absent).
- [x] **Step 3 : implémenter `catalog.ts`** — `PERMISSION_CATALOG` en `as const satisfies readonly PermissionDef[]`,
  transcription fidèle des quatre tableaux de la spec 37 (clé, niveau, `reserved`) ; le `label` et la
  `description` sont ceux de la colonne « Description » de la spec (libellé court + phrase) ; choisir
  l'union `PermissionDomain` (un domaine par préfixe fonctionnel : `access`, `roles`, `organizations`,
  `subscriptions`, `plans`, `payments`, `users`, `profiles`, `blocklist`, `settings`, `rejection_reasons`,
  `badge_templates`, `email_jobs`, `activity`, `print_requests`, `print_catalog`, `print_layouts`, `print_sheets`,
  `org`, `members`, `billing`, `events`, `registrations`, `scan`, `badges`, `print_event`, `account` — ajuster si
  besoin, **puis figer** et noter l'union finale dans les Notes pour les lots).
- [x] **Step 4 : implémenter `labels.ts`** (libellés FR des domaines, `domainOf`, `groupByDomain`).
- [x] **Step 5 : lancer** `make test FILE=src/lib/permissions` → vert, couverture des deux fichiers à 100 %.
- [x] **Step 6 : commit** : `feat(roles): catalogue des permissions et libelles par domaine`.

### Task 3: Rôles système (permissions en code)

**Files:**
- Create: `src/lib/permissions/system-roles.ts`, `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/__tests__/system-roles.test.ts`

**Interfaces:**
- Consumes : `Permission`, `isPermission`, `PERMISSION_CATALOG`, `permissionScopeOf`.
- Produces : `SYSTEM_ROLES`, `SystemRoleKey`, `RoleScope`, `isSystemRoleKey`, `systemRolePermissions`,
  `ROLE_SCOPE_ALLOWS` ; `index.ts` ré-exporte `catalog`, `system-roles`, `resolve`, `labels`.

- [x] **Step 1 : tests rouges** (`system-roles.test.ts`), tous écrits sur la spec 37 :
  - invariants : chaque permission d'un rôle système est dans le catalogue ; son niveau est autorisé par
    `ROLE_SCOPE_ALLOWS[role.scope]` (PLATFORM → PLATFORM/ORG/EVENT ; ORG → ORG/EVENT ; EVENT → EVENT ;
    PARTICIPANT → PARTICIPANT) ; les 4 clés `reserved` n'apparaissent que dans `SUPER_ADMIN` et `OWNER`
    (`platform.roles.manage`, `users.permissions.manage` : SUPER_ADMIN seul ; `org.roles.manage`,
    `org.members.permissions.manage` : OWNER et SUPER_ADMIN) ;
  - `SUPER_ADMIN` = toutes les clés du catalogue sauf niveau PARTICIPANT ;
  - valeurs exactes : `STAFF_PRINTER` = {`platform.access`, `print.requests.read`, `print.requests.messages.send`,
    `print.requests.reject`, `print.requests.advance`, `print.catalog.read`, `print.layouts.read`,
    `print.sheets.read`, `print.sheets.generate`, `badge.print`, `print.onsite.operate`} (11 clés, aucune
    clé `ORG`) ; `AGENT` = {`org.read`, `org.events.list`, `scan.history.read`, `badge.print`, `scan.check-in`,
    `print.onsite.operate`} ; `VIEWER` = {`event.read.aggregated`} ; `PRINTER` = {`badge.print`} ;
    `OPERATOR` = {`event.read.aggregated`, `event.read.detailed`, `scan.history.read`, `registration.approve`,
    `badge.print`, `scan.check-in`} ; `PARTICIPANT` = les 4 clés `account.*` / `registration.self.*` ;
  - `STAFF_OBSERVER` ne détient aucune clé d'écriture : aucune clé se terminant par `.manage`, `.update`, `.create`,
    `.delete`, `.archive`, `.send`, `.review`, `.approve`, `.block`, `.export`, `.advance`, `.reject`, `.generate`,
    `.reopen`, `.apply`, `.mark_paid`, `.complete`, `.operate`, `.check-in`, `.print`, sauf `print.request`
    (lecture seule imposée en code) ;
  - `STAFF_SUPPORT` n'a ni `print.requests.advance` ni `print.requests.messages.send` ; a `profiles.review`,
    `registration.approve`, `users.create`, `users.password.reset` ;
  - `STAFF_ADMIN` = `SUPER_ADMIN` moins les clés que les tableaux n'accordent pas à AD, au minimum :
    `organizations.delete`, `users.staff.assign_top_role`, `settings.secrets.update`, `platform.roles.manage`,
    `users.permissions.manage`, `org.roles.manage`, `org.members.permissions.manage`, `billing.subscription.pay`,
    `print.quote.accept` (dériver la liste complète attendue des tableaux de la spec) ;
  - `MANAGER` ne contient pas `org.update`, `org.members.manage`, `billing.subscription.pay`, `print.quote.accept`.
- [x] **Step 2 : lancer** → échec.
- [x] **Step 3 : implémenter `system-roles.ts`** — `SYSTEM_ROLES` : une entrée par clé (scope, `name` FR :
  « Super administrateur », « Administrateur », « Support », « Imprimeur », « Observateur »,
  « Propriétaire », « Gestionnaire », « Auditeur », « Agent », « Administrateur d'évènement »,
  « Opérateur », « Imprimeur d'évènement », « Lecteur », « Participant » ; `description` d'une phrase).
  Permissions : transcrire les colonnes « Rôles système » des tableaux (abréviations SA AD SU PR OB / O M A G /
  ead eop epr evi / PA). Les clés EVENT d'un rôle plateforme ou d'organisation viennent des colonnes « Staff » et
  « Rôles org (tous évènements) » du tableau EVENT. `SUPER_ADMIN` calculé (toutes sauf PARTICIPANT).
  `index.ts` ré-exporte (le `resolve` arrive en Task 5 : l'export est ajouté alors).
- [x] **Step 4 : lancer** → vert ; couverture 100 %.
- [x] **Step 5 : commit** : `feat(roles): roles systeme et leurs permissions dans le code`.

### Task 4: Contexte utilisateur enrichi et repli sur les enums

**Files:**
- Modify: `src/types/auth.ts`, `src/lib/user-context.ts`
- Test: `src/lib/__tests__/user-context.test.ts`

**Interfaces:**
- Consumes : `SYSTEM_ROLES`, `isSystemRoleKey`, `isPermission`, fabriques (Task 9 les complète ; ici utiliser
  `prisma.*.create` via les fabriques existantes `makeUser`, `makeOrg`, `makeEvent` et des `prisma.role.create`
  directs dans le test **tant que `makeCustomRole` n'existe pas** — puis les remplacer en Task 9).
- Produces : `UserContext` enrichi, `USER_CONTEXT_SELECT`, `buildUserContext`, `loadUserContext`, `getUserContext`.

- [x] **Step 1 : tests rouges** (`user-context.test.ts`, base réelle) :
  - rôle plateforme **système via `roleId`** (`SUPER_ADMIN`) → `platformRole.systemKey === "SUPER_ADMIN"`,
    `platformRole.permissions` = `systemRolePermissions("SUPER_ADMIN")`, `staffRole === "SUPER_ADMIN"` ;
  - **repli** : `staffRole: "STAFF_ADMIN"` en colonne sans `roleId` → même résultat que le rôle système
    `STAFF_ADMIN`, `platformRole.id === null` ; idem `OrgMembership.role` seul → `roleRef.systemKey`, `role`
    conservé ; `EventMembership` idem ;
  - **précédence** : `roleId` d'un rôle `STAFF_PRINTER` et colonne `staffRole: "STAFF_ADMIN"` → `STAFF_PRINTER`
    gagne ; `staffRole` du contexte = `null` ;
  - `STAFF_PRINTER` (système), `AGENT` (membre d'org), rôle **personnalisé** : `role`/`staffRole` du contexte `null`,
    `roleRef.systemKey === null`, permissions = lignes `RolePermission` filtrées par `isPermission` (une clé
    inconnue en base est ignorée) ;
  - rôle **archivé** : traité comme aucun rôle (permissions vides) ;
  - ajustements chargés (`overrides`) avec `orgId` nul ou non, clés inconnues ignorées ;
  - utilisateur absent ou `archived` → `null` ;
  - `getUserContext` renvoie la même valeur que `loadUserContext`.
- [x] **Step 2 : lancer** → échec.
- [x] **Step 3 : `src/types/auth.ts`** — types du bloc « Contrats » (`ResolvedRole`, `PermissionOverrideLite`,
  `OrgMembershipLite`, `EventMembershipLite`, `UserContext`, `EffectiveEventRole` inchangé).
- [x] **Step 4 : `user-context.ts`** — `USER_CONTEXT_SELECT` : champs identité, `isStaff`, `archived`, `staffRole`,
  `platformRole { id systemKey scope name archived permissions { permission } }`,
  `orgMemberships { orgId role roleId roleRef {…même forme} }`, `eventMemberships { eventId role roleId roleRef }`,
  `permissionOverrides { orgId permission effect }`. `buildUserContext(row)` : résolution d'un rôle = `roleRef` non
  archivé si présent (système → permissions du code ; personnalisé → lignes filtrées) sinon repli sur la colonne
  d'enum (`SYSTEM_ROLES[enum]`) sinon `null`. Champs hérités : `staffRole` = `systemKey` si ∈ {SUPER_ADMIN,
  STAFF_ADMIN, STAFF_SUPPORT, STAFF_OBSERVER} sinon `null` ; `role` idem pour OWNER/MANAGER/AUDITOR et
  ADMIN/OPERATOR/PRINTER/VIEWER. `loadUserContext` = `findUnique` + `buildUserContext` (non mémoïsé : les routes
  qui modifient un rôle puis relisent ne doivent pas voir un contexte périmé) ; `getUserContext = cache(loadUserContext)`
  (`react`, comme `src/lib/org-access.ts`).
- [x] **Step 5 : lancer** `make test FILE=src/lib/__tests__/user-context.test.ts` → vert. Puis
  `make typecheck` : corriger mécaniquement les consommateurs de `UserContext` (ex. `recipients.ts` construit un
  `UserContext` à la main : traité en Task 11 ; `src/lib/print-requests/service.ts:53` lit `m.role`).
- [x] **Step 6 : commit** : `feat(roles): contexte utilisateur enrichi avec repli sur les enums`.

### Task 5: Résolution des permissions effectives

**Files:**
- Create: `src/lib/permissions/resolve.ts`
- Modify: `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/__tests__/resolve.test.ts` (fonctions pures : contextes construits à la main avec `buildUserContext` sur des lignes littérales, **sans base** — la règle « pas de mock Prisma » ne concerne pas les fonctions pures)

**Interfaces:**
- Consumes : `UserContext`, `PermissionTarget`, `permissionScopeOf`.
- Produces : `effectivePermissions`, `hasPermission`, `isStaffActor`, `eventTargetOf`, `PermissionTarget`.

- [x] **Step 1 : tests rouges** (un `it` par ligne) :
  - base = union plateforme + org + évènement, filtrée par le niveau de la cible (clé de mauvais niveau ignorée) ;
  - cible `event` : SUPER_ADMIN a `badge.print` ; STAFF_OBSERVER a `event.read.aggregated` mais pas `registration.delete` ;
  - cible `org` d'un membre `AGENT` : {`org.read`, `org.events.list`} ; sur une **autre** org : vide ;
  - cible `event` d'un membre d'org `AGENT` : {`scan.history.read`, `badge.print`, `scan.check-in`, `print.onsite.operate`} ;
  - **union** : membre d'org `AUDITOR` + membre d'évènement `PRINTER` → {`event.read.aggregated`, `badge.print`} ;
  - cible `participant` : tout compte détient les 4 clés `PARTICIPANT` ; un `REVOKE` plateforme
    (`orgId` nul) sur `registration.self.create` la retire ;
  - ajustements : `GRANT` ajoute ; `REVOKE` retire ; `REVOKE` d'organisation sans effet sur une autre org ; ajustement
    plateforme (`orgId` nul) sur une clé `ORG` s'applique à toute org ; ajustement de clé de mauvais niveau ignoré ;
  - rôle personnalisé d'org donne ses permissions à tous les évènements de l'org ;
  - `hasPermission` = appartenance ; `isStaffActor` : staff sans membership → vrai ; staff membre de l'org → faux (target
    org et event) ; staff membre de l'évènement seul → faux pour la cible événement ; non staff → faux ; cibles
    `platform`/`participant` → faux ; `eventTargetOf({ id, orgId })` et `eventTargetOf({ eventId, orgId })`.
- [x] **Step 2 : lancer** → échec.
- [x] **Step 3 : implémenter `resolve.ts`** selon l'ordre de la spec 37 (« Résolution des permissions
  effectives », points 1 à 5) ; scope d'une cible : platform→PLATFORM, org→ORG, event→EVENT, participant→PARTICIPANT ;
  ajustements applicables : `orgId` nul toujours, `orgId === target.orgId` pour org/event ; `REVOKE` appliqué après `GRANT`.
  Ajouter `export * from "./resolve"` à `index.ts`.
- [x] **Step 4 : lancer** → vert, 100 %.
- [x] **Step 5 : commit** : `feat(roles): resolution des permissions effectives`.

### Task 6: Gardes : `requirePermission`, compatibilité, derniers titulaires

**Files:**
- Modify: `src/lib/auth-guards.ts`, `src/lib/auth-helpers.ts`, `src/lib/event-org.ts`
- Test: `src/lib/__tests__/auth-guards.test.ts`, `src/lib/__tests__/auth-helpers.test.ts`, `src/lib/__tests__/event-org.test.ts` (créer si absent)

**Interfaces:**
- Consumes : `getUserContext`/`loadUserContext`, `hasPermission`, `eventTargetOf`.
- Produces : `requirePermission`, `loadPermissions`, `loadEventTarget`, `getEventTarget`, `AuthError` + `PERMISSION_DENIED`.

- [x] **Step 1 : tests rouges** (base réelle, fabriques ; `makeStaff` actuelle écrit encore l'enum : suffisant) :
  - `requirePermission` : contexte nul → `NOT_AUTHENTICATED` 401 ; permission absente → `PERMISSION_DENIED` 403 ; présente → résout ;
    STAFF_OBSERVER refusé sur `registration.delete` d'un évènement mais accepté sur `event.read.aggregated` ;
  - `loadPermissions` renvoie l'ensemble ; `Set` vide pour un utilisateur inconnu ;
  - `loadEventTarget` : évènement absent → `EVENT_NOT_FOUND` 404 ; présent → `{ kind:"event", eventId, orgId }` ;
  - **compatibilité inchangée** (les tests actuels de `requireStaff`, `requireOrgRole`, `requireEventRole`,
    `requireEventPermission`, `getEffectiveEventRole` restent verts **sans modification**) + nouveaux cas : un
    `STAFF_PRINTER` (via `roleId`) est refusé par `requireStaff(…, "STAFF_OBSERVER")`, par `requireOrgRole(…, "AUDITOR")`
    (même avec `allowStaff`) ; un membre `AGENT` est refusé par `requireOrgRole(…, "AUDITOR")` et `getEffectiveEventRole`
    → `null` ;
  - `assertNotLastOwner` compte les titulaires du rôle système `OWNER` **par `roleId` ou par colonne d'enum** (un OWNER
    via `roleId` seul compte ; un AGENT n'est pas OWNER) ; `assertNotLastSuperAdmin` idem (`roleId` ou `staffRole`).
- [x] **Step 2 : lancer** → échec sur les nouveaux cas.
- [x] **Step 3 : implémenter** — `AuthError` : ajouter `"PERMISSION_DENIED"` à l'union ; `requirePermission` (charge
  `loadUserContext`, 401 si nul, `hasPermission` sinon `PERMISSION_DENIED`) ; `loadPermissions` (via `getUserContext`) ;
  `loadEventTarget` (lookup `orgId`). Compatibilité : `requireStaff`, `requireOrgRole`/`hasOrgRole`, `requireEventRole`,
  `effectiveEventRole`, `hasEventPermission`, `requireEventPermission` gardent leur logique et lisent les champs hérités
  du contexte (déjà dérivés de `systemKey` : un rôle sans équivalent hérité donne `null` donc refus). Retirer
  `"event.archive"` du type `EventPermission` et de `EVENT_PERMISSION_ROLES` (clé renommée `org.events.archive`, aucun
  usage). `assertNotLastOwner`/`assertNotLastSuperAdmin` : `where` en `OR` entre `roleRef: { systemKey }` et
  `{ roleId: null, role|staffRole: <enum> }`. `getEventTarget(eventId)` dans `event-org.ts` (`notFound()` si absent).
- [x] **Step 4 : lancer** `make test FILE=src/lib/__tests__/auth-guards.test.ts` et `auth-helpers`, `event-org` → vert.
- [x] **Step 5 : commit** : `feat(roles): requirePermission et gardes compatibles`.

### Task 7: Wrappers de routes et garde participant

**Files:**
- Modify: `src/lib/with-staff-auth.ts`, `src/lib/with-org-auth.ts`, `src/lib/with-event-auth.ts`, `src/lib/auth-participant.ts`
- Test: `src/lib/__tests__/with-staff-auth.test.ts`, `with-org-auth.test.ts`, `with-event-auth.test.ts`, `auth-participant.test.ts`, `with-auth-rethrow.test.ts`

**Interfaces:**
- Consumes : `requirePermission`, `loadEventTarget`, `getUserContext`, `effectivePermissions`, `isStaffActor`.
- Produces : wrappers et `EventAuthCtx` du bloc « Contrats », `requireParticipantPermission`.

- [x] **Step 1 : tests rouges** :
  - `withStaffAuth(h, { permission: "print.sheets.read" })` : STAFF_PRINTER 200 ; STAFF_OBSERVER 403
    `PERMISSION_DENIED` ; non staff 403 `NOT_STAFF` ; sans option = `minRole` STAFF_OBSERVER hérité (STAFF_PRINTER **403**) ;
    `permission` + `minRole` ensemble → erreur de configuration levée à la construction ; permission de niveau ≠ PLATFORM →
    erreur de configuration ;
  - `withOrgAuth("org.members.read", h)` : OWNER 200, AGENT 403 `PERMISSION_DENIED`, staff SA 200 ; `withOrgAuth("AUDITOR", h)` hérité inchangé ;
  - `withEventAuth({ permission: "scan.check-in" }, h)` : membre d'évènement OPERATOR 200, VIEWER 403, AGENT de l'org 200,
    staff SA 200 ; `ctx.permissions` contient les permissions effectives ; `ctx.isStaffActor` vrai pour staff non membre,
    faux pour un OWNER ; `ctx.event` présent ; `ctx.effectiveRole` encore fourni (`"STAFF"` pour un staff) ; options
    `minRole` et `permission` exclusives (erreur) ; 404/410/409 d'archivage et d'inscriptions fermées inchangés ;
    exemption `MANAGE_ONGOING_EVENTS` du staff inchangée ;
  - `requireParticipantPermission("registration.self.create")` : sans session → 401 `NOT_AUTHENTICATED` ; compte archivé →
    401 ; compte bloqué → 403 `ACCOUNT_BLOCKED` ; permission retirée par un `REVOKE` plateforme → 403 `FORBIDDEN` ;
    compte normal → `SessionUser`.
- [x] **Step 2 : lancer** → échec.
- [x] **Step 3 : implémenter** — wrappers : discriminer `Permission` d'un `OrgRole` avec `isPermission` ; vérifier le
  niveau de la clé (`PLATFORM` pour staff, `ORG` pour org, `EVENT` pour évènement) à la construction ; `withEventAuth`
  charge `ctx` une fois (`loadUserContext`), calcule `permissions = effectivePermissions(ctx, target)` et
  `isStaffActor`, garde `effectiveRole` via `getEffectiveEventRole` ; les réponses d'erreur restent
  `{ error: err.code }` avec le statut de l'`AuthError`. `requireParticipantPermission` dans `auth-participant.ts`
  (`requireAuth`, lecture `archived`/`blocked` en base, puis `hasPermission` sur la cible `participant`).
- [x] **Step 4 : lancer** les 5 fichiers → vert. Lancer ensuite les tests des 8 routes qui utilisent déjà l'option
  `permission` (`src/app/api/org/[orgId]/events/[eventId]/{badges,registrations/print,print-requests/upload}/**`) :
  si l'un échoue à cause d'un changement de sémantique (staff Observateur/Support), **s'arrêter et signaler**
  (ne pas modifier le code de production pour le test).
- [x] **Step 5 : commit** : `feat(roles): wrappers de routes par permission et garde participant`.

### Task 8: Rôles système en base, migration, `make migrate-roles`

**Files:**
- Create: `src/lib/permissions/db.ts`, `src/lib/permissions/migrate.ts`, `scripts/migrate-roles.ts`
- Modify: `Makefile` (cible `migrate-roles`, ajouter à `.PHONY`)
- Test: `src/lib/permissions/__tests__/db.test.ts`, `src/lib/permissions/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes : `SYSTEM_ROLES`, `prisma`.
- Produces : `ensureSystemRoles`, `systemRoleId`, `legacyKeyOf`, `migrateRoles`.

- [x] **Step 1 : tests rouges** :
  - `ensureSystemRoles(prisma)` crée 14 lignes (`systemKey` unique, `scope`, `name`, `orgId` nul) ; deuxième appel
    n'en crée aucune et ne change pas les ids ; renvoie l'id de chaque clé ; met à jour `name`/`description` si le code a changé ;
  - `systemRoleId` renvoie l'id ; `legacyKeyOf("STAFF_PRINTER")`/`("AGENT")` → `null`, `("OWNER")` → `"OWNER"` ;
  - `migrateRoles` : base avec 1 staff (`staffRole: "STAFF_ADMIN"`), 1 OWNER d'org, 1 membre d'évènement `VIEWER`, 1 utilisateur
    sans rôle → après appel : `platformRoleId` = rôle `STAFF_ADMIN`, `isStaff` vrai, `OrgMembership.roleId` = `OWNER`,
    `EventMembership.roleId` = `VIEWER`, rapport `{ users:1, orgMemberships:1, eventMemberships:1 }` ; **deuxième appel**
    → rapport à 0 et `alreadyDone` > 0 ; `dryRun: true` n'écrit rien mais renvoie les mêmes compteurs ; une ligne dont `roleId`
    est déjà posé n'est pas modifiée ; ne touche jamais aux colonnes d'enum.
- [x] **Step 2 : lancer** → échec.
- [x] **Step 3 : implémenter** `db.ts` (upsert par `systemKey`, transaction ; paramètre `RoleDb` structurel pour pouvoir
  passer un `PrismaClient` d'e2e) et `migrate.ts` (`updateMany` par clé d'enum, dans une transaction, en ne ciblant que
  `roleId: null`). `scripts/migrate-roles.ts` : lit `--dry-run`, crée `new PrismaClient()`, appelle `migrateRoles`, affiche
  le rapport en français, `process.exit(1)` en cas d'erreur. `Makefile` : cible
  `migrate-roles: $(DEV_COMPOSE) exec app yarn tsx scripts/migrate-roles.ts $(ARGS)` avec un commentaire (idempotent ;
  `ARGS=--dry-run` pour prévisualiser ; dev uniquement dans ce chantier).
- [x] **Step 4 : lancer** `make test FILE=src/lib/permissions` → vert, 100 %. Puis `make migrate-roles ARGS=--dry-run`
  sur la base de dev et noter le rapport dans les Notes ; **ne pas** lancer sans `--dry-run` avant la Task 17.
- [x] **Step 5 : commit** : `feat(roles): roles systeme en base et script migrate-roles`.

### Task 9: Fabriques, reset global et helpers e2e

**Files:**
- Modify: `src/test/factories.ts`, `e2e/helpers/db.ts`, `e2e/helpers/auth.ts`
- Test: `src/test/__tests__/factories.test.ts` (créer si absent)

**Interfaces:**
- Consumes : `systemRoleId`, `legacyKeyOf`, `ensureSystemRoles`.
- Produces : fabriques et helpers e2e du bloc « Contrats ».

- [ ] **Step 1 : tests rouges** (`factories.test.ts`) : `makeStaff("STAFF_PRINTER")` → utilisateur `isStaff`, `platformRoleId` du
  rôle système `STAFF_PRINTER`, `staffRole` nul ; `makeStaff("STAFF_ADMIN")` → `platformRoleId` **et** `staffRole: "STAFF_ADMIN"`
  (double écriture de compatibilité) ; `makeOrgMember(org.id, "AGENT")` → `roleId` AGENT, `role` nul ; `makeOrgMember(…, "OWNER")`
  → `roleId` + `role` ; `makeEventMember` idem ; `makeCustomRole({ scope:"ORG", orgId, permissions:["org.read"] })` crée le rôle
  et ses `RolePermission` ; `makeOverride` ; le reset de `beforeEach` supprime rôles et ajustements (deux tests successifs
  sans collision sur `systemKey`).
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : `factories.ts`** — `makeStaff(role: PlatformSystemKey, data)` (signature élargie, rétrocompatible avec les
  appels `makeStaff("STAFF_ADMIN")` existants), `makeOrgMember`, `makeEventMember`, `makeCustomRole`, `makeOverride` ;
  `systemRoleId(prisma, key)` à chaque appel (le reset supprime les rôles). Exporter `PlatformSystemKey`, `OrgSystemKey`,
  `EventSystemKey`.
- [ ] **Step 4 : `e2e/helpers/db.ts`** — élargir `TestStaffRole`/`TestOrgRole`/`TestEventRole` ; `createTestStaff`,
  `createTestOrgMember`, `createTestOrgWithOwner` (OWNER), `createTestEventMember` (y compris `attachOrgAuditor`) écrivent
  `roleId` via `ensureSystemRoles(db())` (rôles **permanents**, jamais supprimés par `cleanupE2ETestData`) et la colonne
  d'enum pour les rôles hérités. `cleanupE2ETestData` supprime en plus les `UserPermissionOverride` des utilisateurs e2e et les
  rôles personnalisés des organisations e2e (déjà emportés par la cascade d'organisation : vérifier). `e2e/helpers/auth.ts` :
  types seulement.
- [ ] **Step 5 : lancer** `make test FILE=src/test` puis `make test FILE=src/lib/__tests__/user-context.test.ts` (remplacer
  les `prisma.role.create` provisoires de la Task 4 par `makeCustomRole`/`makeStaff`) → vert.
- [ ] **Step 6 : commit** : `test(roles): fabriques et helpers e2e par cle de role systeme`.

### Task 10: Seed : rôles système, SUPER_ADMIN, comptes démo

**Files:**
- Modify: `prisma/seed/minimal.ts`, `prisma/seed/demo/context.ts`, `prisma/seed/demo/accounts.ts`,
  `prisma/seed/demo/organizations.ts`, `prisma/seed/demo/print/orders.ts`, `src/lib/seed-super-admin.ts`
- Test: `prisma/seed/__tests__/*`, `prisma/seed/demo/__tests__/accounts.test.ts`, `prisma/seed/demo/__tests__/organizations.test.ts`, `src/lib/__tests__/seed-super-admin.test.ts`

**Interfaces:**
- Consumes : `ensureSystemRoles`, `systemRoleId`, `legacyKeyOf`.
- Produces : rôles système présents après tout seed ; comptes démo `staff-printer` (Imprimeur) et `agent` (AGENT).

- [ ] **Step 1 : tests rouges** : `runMinimalSeed` crée les 14 rôles système et un SUPER_ADMIN avec `platformRoleId` ;
  `seedSuperAdmin` : `exists` si un SUPER_ADMIN existe par `roleId` **ou** par colonne d'enum ; création avec `platformRoleId`
  (+ colonne d'enum) et `isStaff` ; le seed démo crée un compte Imprimeur plateforme (`platformRole.systemKey ===
  "STAFF_PRINTER"`) et un compte AGENT d'une organisation démo (`roleRef.systemKey === "AGENT"`) ; chaque membre démo a
  `roleId` ET colonne d'enum pour les rôles hérités (les lectures actuelles des seeds de notifications/billing, qui lisent
  `staffRole`/`role`, restent vertes).
- [ ] **Step 2 : lancer** `make test FILE=prisma/seed src/lib/__tests__/seed-super-admin.test.ts` → échec.
- [ ] **Step 3 : implémenter** — appeler `ensureSystemRoles(prisma)` au début du seed minimal (et du démo, idempotent) ;
  poser `platformRoleId` aux côtés de `staffRole` partout où le seed crée un staff (`minimal.ts`, `context.ts#ensureSuperAdmin`,
  `seed-super-admin.ts`, `accounts.ts#staff`) ; poser `roleId` aux côtés de `role` pour les memberships
  (`organizations.ts`, `print/orders.ts`). Étendre `Seed.staffRole` en `PlatformSystemKey` (clé de rôle) avec `legacyKeyOf` pour
  la colonne ; ajouter `staff("printer", "STAFF_PRINTER", "Imprimeur plateforme (menu Impression)", …)` et
  `orgMember("agent.grosse-org", "AGENT", "Agent de la grosse organisation (poste sur place)", [{ slug: GROSSE, role: "AGENT" }])`.
  Mettre à jour le registre des comptes (fichier `.demo/comptes-demo.md` généré, aucun changement manuel).
- [ ] **Step 4 : lancer** les mêmes tests → vert. Puis `make db-seed` (base de dev, seed minimal) et vérifier que
  `admin@badge.local` a toujours accès à `/platform` (curl authentifié non nécessaire : test e2e en Task 17).
- [ ] **Step 5 : commit** : `feat(roles): seed des roles systeme et comptes Imprimeur et Agent`.

### Task 11: Notifications ciblées par permission

**Files:**
- Modify: `src/lib/notifications/types.ts`, `src/lib/notifications/recipients.ts`, `src/lib/notifications/triggers.ts`,
  `prisma/seed/demo/organizations.ts` (si elle utilise l'ancienne forme de `RecipientSpec`)
- Test: `src/lib/notifications/__tests__/recipients.test.ts`, `notify.test.ts` et le fichier de tests des déclencheurs du même dossier

**Interfaces:**
- Consumes : `USER_CONTEXT_SELECT`, `buildUserContext`, `hasPermission`.
- Produces : `RecipientSpec` du bloc « Contrats » ; les variantes `staffMinRole`, `orgRoles`, `eventRoles` **disparaissent**.

Table trigger → destinataire (équivalence avec l'actuel + les deux ajustements de la spec) :

| Déclencheur | Avant | Après (`permission`, cible) |
|---|---|---|
| `notifyRegistrationCreated`, `notifyRegistrationResubmitted` | évènement ADMIN, OPERATOR | `registration.approve`, event |
| `notifyEventRegistrationToggled` | évènement ADMIN, OPERATOR, PRINTER, VIEWER | `event.read.aggregated`, event (**le PRINTER d'évènement n'est plus notifié** : arbitrage à signaler) |
| `notifyProfileSubmitted` | staff ≥ SUPPORT | `profiles.review`, platform |
| `notifyOrgCreated` | staff ≥ ADMIN | `organizations.create`, platform |
| `notifySubscriptionChanged` (org) / (staff) | OWNER / staff ≥ ADMIN | `billing.subscription.pay`, org / `subscriptions.update`, platform |
| `notifySubscriptionExpiring` | OWNER | `billing.subscription.pay`, org |
| `notifyQuotaExceeded` (org) / (staff) | OWNER / staff ≥ ADMIN | `billing.subscription.pay`, org / `subscriptions.update`, platform |
| `notifyEmailFailed` | staff ≥ ADMIN | `email_jobs.manage`, platform |
| `notifyPrintRequestSubmitted` | staff ≥ ADMIN | `print.requests.quote.send`, platform |
| `notifyPrintRequestQuoted` | évènement ADMIN | `print.request`, event |
| `notifyPrintRequestMessage` (vers le staff) | staff ≥ SUPPORT | `print.requests.messages.send`, platform (ajustement de la spec : l'Imprimeur et l'Admin reçoivent, le Support ne reçoit plus) |
| `notifyPrintRequestMessage` (vers l'organisateur) | évènement ADMIN | `print.request`, event |
| `notifyPrintRequestStatusChanged` (organisateur / staff) | évènement ADMIN / staff ≥ ADMIN | `print.request`, event / `print.requests.quote.send`, platform |
| `notifyPrintRequestPaid` (organisateur / staff) | évènement ADMIN / staff ≥ ADMIN | `print.request`, event / `print.requests.mark_paid`, platform |
| `notifyPrintPaymentUnmatched` | staff ≥ ADMIN | `print.requests.mark_paid`, platform |

Les cibles `event` portent `{ kind: "event", eventId, orgId }` (l'`orgId` est déjà chargé dans chaque déclencheur) ;
`includeStaff` n'est posé nulle part (aucun ancien ciblage n'incluait le staff dans l'org ou l'évènement). Le message
« vers le staff » d'une commande d'impression garde `scope: "PLATFORM"`.

> **Écart à signaler** : la spec dit que les notifications de commandes destinées « aujourd'hui au staff ≥ SUPPORT »
> vont à `print.requests.messages.send` ; seul `notifyPrintRequestMessage` est dans ce cas. Les autres sont
> destinées à ≥ ADMIN : équivalent conservé (SA, AD) avec la permission d'écriture la plus proche ci-dessus.

- [ ] **Step 1 : tests rouges** (`recipients.test.ts`, base réelle) :
  - cible `platform` : `profiles.review` → SA, AD, SU (pas OB, pas PR) ; `print.requests.messages.send` → SA, AD, PR (pas SU) ;
    un `GRANT` plateforme donne la permission à un non-staff avec ajustement ; utilisateur `archived` ou `blocked` exclu ;
    `actorId` et `excludeUserIds` exclus ; ordre par `id`, sans doublon ;
  - cible `event` : `registration.approve` → membres d'évènement ADMIN/OPERATOR et membres d'org OWNER/MANAGER ; **pas** AUDITOR,
    **pas** AGENT, **pas** le staff non membre ; `includeStaff: true` ajoute SA/AD/SU ; membre d'une autre org exclu ;
  - cible `org` : `billing.subscription.pay` → OWNER seulement ;
  - utilisateurs repliés sur l'enum (`OrgMembership.role` seul, sans `roleId`) correctement résolus ;
  - `{ users }` inchangé.
  Tests des déclencheurs (fichiers existants de `src/lib/notifications/__tests__/`) : un test par ligne de la table ci-dessus vérifiant les destinataires (et le `scope`).
- [ ] **Step 2 : lancer** `make test FILE=src/lib/notifications` → échec.
- [ ] **Step 3 : implémenter** — `types.ts` (nouvelle union ; retirer les imports `EventRole`, `OrgRole`, `StaffRole`) ;
  `recipients.ts` : requête de candidats (cible platform : `isStaff`, `platformRoleId`/`staffRole` non nuls ou ajustement
  `orgId` nul ; org : membres de l'org ou ajustements de l'org ; event : membres de l'org, membres de l'évènement ou
  ajustements de l'org ; `includeStaff` ajoute les candidats « staff »), `select: USER_CONTEXT_SELECT`, filtrage par
  `hasPermission(buildUserContext(row), permission, target)`, mêmes exclusions `blocked/archived/actor/excluded` qu'aujourd'hui ;
  `triggers.ts` : appliquer la table.
- [ ] **Step 4 : lancer** `make test FILE=src/lib/notifications` → vert ; lancer ensuite les tests des routes qui déclenchent des
  notifications (`make test FILE=src/app/api` est long : lancer au minimum les dossiers `print-requests`, `registrations`,
  `profiles`, `subscription`) ; tout échec lié aux destinataires : s'arrêter et signaler.
- [ ] **Step 5 : commit** : `feat(roles): notifications ciblees par permission`.

### Task 12: Logique d'impression partagée

**Files:**
- Modify: `src/lib/print-requests/service.ts`, `route.ts`, `lifecycle.ts`, `credit-view.ts`, `onsite-station-view.ts`,
  `quote.ts` ; `src/lib/print-sheets/layout-page-data.ts` ; `src/components/event/print/guard.ts`
- Test: tests existants de ces fichiers (`src/lib/__tests__/print-*.test.ts`, `src/lib/print-requests/__tests__/**`,
  `src/components/event/print/__tests__/**` — localiser avec `grep -rln "assertOwner\|assertNotStaff\|canApplyCredit\|canSetOnsiteMargin\|canWriteLayouts\|markPaidManually\|requirePrintAccess"`)

**Interfaces:**
- Consumes : `hasPermission`, `isStaffActor`, `eventTargetOf`, `getUserContext`.
- Produces : `assertOwner`, `assertNotStaff(ctx)`, `canApplyCredit`/`canSetOnsiteMargin` (paramètre union), `canWriteLayouts`.

- [ ] **Step 1 : tests rouges** (ajouter ou adapter) :
  - `assertOwner` : membre d'org `OWNER` accepté ; `MANAGER` → `OWNER_REQUIRED` 403 ; staff **non membre** (SA) →
    `STAFF_FORBIDDEN` 403 ; staff **membre OWNER** de l'org → accepté (changement assumé : staff acteur seulement) ;
    contexte inconnu → `OWNER_REQUIRED` ;
  - `assertNotStaff({ isStaffActor: true })` → `STAFF_FORBIDDEN` ; `{ isStaffActor: false }` ne lève pas ;
    `organizerRoute` : POST d'un staff non membre → 403 `STAFF_FORBIDDEN` (ses GET passent) ;
  - `canApplyCredit` et `canSetOnsiteMargin` : avec `StaffRole` (hérité : STAFF_ADMIN vrai, STAFF_SUPPORT faux) **et** avec
    `ReadonlySet<Permission>` (vrai ssi contient `print.requests.credit.apply` / `print.onsite.margin.update`) ;
  - `markPaidManually` : SA et AD autorisés (`print.requests.mark_paid`), SU/PR/OB → `STAFF_FORBIDDEN` ; non staff idem ;
  - `canWriteLayouts` : SA/AD vrai (`print.layouts.manage`), SU/PR/OB faux, non connecté faux ;
  - `requirePrintAccess` : membre ADMIN d'évènement passe ; OPERATOR redirigé vers `/event/{id}` ; AGENT redirigé.
- [ ] **Step 2 : lancer** les fichiers localisés → échec sur les nouveaux cas.
- [ ] **Step 3 : implémenter** — `service.ts#assertOwner` : contexte ; `isStaffActor(ctx, orgTarget)` → `STAFF_FORBIDDEN` ;
  `hasPermission(ctx, "print.quote.accept", orgTarget)` sinon `OWNER_REQUIRED` ; `route.ts#assertNotStaff(ctx: Pick<EventAuthCtx,
  "isStaffActor">)` et l'appel dans `organizerRoute` passe `ctx` ; `quote.ts#markPaidManually` :
  `hasPermission(ctx, "print.requests.mark_paid", { kind: "platform" })` ; `credit-view.ts`/`onsite-station-view.ts` :
  paramètre `StaffRole | ReadonlySet<Permission>` (`typeof access === "string"` → ancien `staffRoleAtLeast`, sinon
  `access.has(clé)`) ; `layout-page-data.ts#canWriteLayouts` : `hasPermission(ctx, "print.layouts.manage", platform)` ;
  `guard.ts` : `hasPermission(ctx, "print.request", eventTargetOf(event))`. `lifecycle.ts` n'appelle qu'`assertOwner`
  (aucune modification de signature ; vérifier). Marquer la branche `StaffRole` des deux fonctions de vue
  `@deprecated compat`.
- [ ] **Step 4 : lancer** les fichiers localisés + `make test FILE=src/app/api/org` sous-dossiers `print-requests` → vert ;
  `make typecheck` : les appelants de `assertNotStaff` hors `route.ts` (rechercher) sont mis à jour mécaniquement.
- [ ] **Step 5 : commit** : `feat(roles): controles de role de la logique d'impression par permission`.

### Task 13: Découplage de `OnsiteStation`

**Files:**
- Modify: `src/components/staff/print/OnsiteStation.tsx`, `src/components/staff/print/request-fetch.ts`
- Test: `src/components/staff/print/__tests__/request-fetch.test.ts`, `src/components/staff/print/__tests__/OnsiteStation.test.tsx` (créer : `renderToStaticMarkup`, même style que `OrderSheetPanel.test.tsx`)

**Interfaces:**
- Produces : props `apiBase?`, `backHref?` de `OnsiteStation` ; `requestUrl(requestId, path?, apiBase?)`.

- [ ] **Step 1 : tests rouges** : `requestUrl("r1", "/onsite/lookup")` inchangé (`/api/platform/print/requests/r1/onsite/lookup`) ;
  `requestUrl("r1", "/onsite/lookup", "/api/org/o1/events/e1/print-requests/r1")` → `…/r1/onsite/lookup` sur cette base ;
  `OnsiteStation` sans `backHref` rend le lien `/platform/print/orders/r1` ; avec `backHref="/event/e1/print/r1"` rend ce lien.
  (le rendu statique ne déclenche pas les `fetch` : tester les URL de `fetch` en extrayant la construction dans une fonction
  exportée `onsiteUrls(requestId, apiBase)` du même fichier, testée à part, si le composant reste intestable en statique.)
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** — ajouter `apiBase` et `backHref` (facultatifs, défauts ci-dessus) à `OnsiteStationProps` ;
  les trois `fetch` utilisent `requestUrl(requestId, path, apiBase)` ; le lien de retour utilise `backHref`. **Aucun changement
  visible** pour `/platform/print/orders/[requestId]/onsite` (la page n'est pas modifiée : défauts).
- [ ] **Step 4 : lancer** `make test FILE=src/components/staff/print` → vert.
- [ ] **Step 5 : commit** : `refactor(impression): poste sur place decouple de /platform`.

### Task 14: Consommateurs transverses

**Files:**
- Modify: `src/components/activity/JournalEntryDetail.tsx`, `src/lib/activity-log.ts`, `src/lib/event-org.ts` (déjà Task 6),
  `src/app/(marketing)/page.tsx`, `scripts/smoke-tests.ts`
- Test: `src/components/activity/__tests__/JournalEntryDetail.test.tsx` (existant ou à créer), `src/lib/__tests__/activity-log.test.ts`, `scripts/__tests__/smoke-tests.test.ts` (existant)

**Interfaces:**
- Produces : `JournalEntryDetail` accepte `user.platformRole?: { name: string } | null` en plus de `staffRole?`.

- [ ] **Step 1 : tests rouges** : `JournalEntryDetail` affiche `platformRole.name` (« Imprimeur ») quand fourni, sinon l'ancien
  `staffRole`, sinon rien ; `logActivity` : `staffActor` vrai pour un staff **sans** membership dans l'org du journal, faux
  pour un staff membre de cette org (aligné sur `isStaffActor`), faux pour un non staff ; le smoke test accepte un staff
  identifié par `platformRoleId` ou `isStaff` et vérifie la présence des rôles système en base (nouveau contrôle « Rôles
  système présents », 14 lignes) ; la page d'accueil marketing mentionne les rôles personnalisés.
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** — `JournalEntryDetail` : prop et affichage ; `activity-log.ts` : sélectionner
  `isStaff` + `orgMemberships { where: { orgId } }` (+ `eventMemberships` si `eventId`) et dériver `staffActor` ;
  `scripts/smoke-tests.ts` : nouveau contrôle ; marketing : libellé de la carte « Rôles & permissions » (« …et rôles
  personnalisés selon votre organisation »). Les pages `activity/[logId]` qui sélectionnent `staffRole` (plateforme : lot 2a ;
  org/évènement : lot 2b) ne sont **pas** modifiées : elles passent `platformRole` en vague 2.
- [ ] **Step 4 : lancer** les trois fichiers de test → vert.
- [ ] **Step 5 : commit** : `feat(roles): consommateurs transverses (journal, audit, smoke)`.

### Task 15: Spec 39 — quantité des accessoires côté serveur

**Files:**
- Modify: `src/lib/print-requests/content.ts` (`setOrganizerProducts`)
- Test: tests existants de `setOrganizerProducts` (`grep -rln "setOrganizerProducts" src`), à adapter ; ajout de cas

**Interfaces:**
- Consumes : `requestBadgeCount` (existant). Produit : pour tout produit non `BADGE`, la quantité de la ligne
  de l'organisateur = nombre de badges, quelle que soit `entry.quantity`.

- [ ] **Step 1 : tests rouges** : demande de 10 badges ; `products: [badge, accessoire { quantity: 3 }]` → ligne accessoire
  `quantity === 10` et `lineTotal` calculé sur 10 (paliers de prix inclus) ; `quantity: null` ou absent → 10 ;
  appel API direct (route `PUT …/products`, test d'intégration existant du dossier `print-requests`) avec `quantity: 999` →
  10 ; brouillon existant avec une ligne accessoire à 3 : au prochain enregistrement la ligne passe à 10 sans erreur
  (`LINE_LOCKED_BY_STAFF` uniquement si le staff a fixé la ligne : alors la quantité du staff est conservée, comme
  aujourd'hui pour une quantité non saisie) ; changement du nombre de badges puis nouvel enregistrement → la ligne suit.
  **Adapter** les tests existants qui attendent une quantité d'accessoire choisie par le client (changement d'exigence de la
  spec 39, pas un contournement).
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** — dans la boucle de `setOrganizerProducts`, la quantité dérivée est `badgeCount` pour tous les
  produits : `derivedQuantity` vaut toujours vrai et `quantity = badgeCount` ; le champ `entry.quantity` reste accepté par
  `OrganizerProductInput` (rétrocompatibilité des clients) mais est ignoré (commentaire en français : « la quantité d'un
  accessoire est toujours le nombre de badges (spec 39) »). Ne pas toucher à `PrintRequestWizard` (lot 2b).
- [ ] **Step 4 : lancer** `make test FILE=src/lib` (sous-ensemble impression) et les tests API `print-requests` → vert.
- [ ] **Step 5 : commit** : `feat(impression): quantite des accessoires egale au nombre de badges (serveur)`.

### Task 16: Spec 40 — ancrages de la documentation

**Files:**
- Create: `src/components/page-docs/PageDocButton.tsx`, `src/app/platform/docs/page.tsx`, `src/app/org/[orgId]/docs/page.tsx`,
  `src/app/event/[eventId]/docs/page.tsx`, `src/app/account/docs/page.tsx`
- Modify: `src/components/staff/StaffShell.tsx`, `src/components/admin/OrgShell.tsx`, `src/components/event/EventShell.tsx`,
  `src/components/public/AccountNav.tsx`, `src/app/account/layout.tsx`
- Test: `src/components/layout/__tests__/space-shells.test.tsx`, `src/components/staff/__tests__/StaffShell.test.tsx`,
  `src/components/admin/__tests__/OrgShell.test.tsx`, `src/components/page-docs/__tests__/PageDocButton.test.tsx`,
  `src/components/public/__tests__/AccountNav.test.tsx` (créer si absent)

**Interfaces:**
- Produces : `PageDocButton(): null` (composant client) à la gauche de la cloche des quatre en-têtes ; entrée de menu
  « Documentation » (icône `book-open` si présente dans `Icon.tsx`, sinon `file`) vers `/platform/docs`, `/org/{id}/docs`,
  `/event/{id}/docs`, `/account/docs` ; pages d'attente `EmptyState` « Bientôt disponible ».

- [ ] **Step 1 : tests rouges** : chaque shell rend le lien « Documentation » avec le bon `href` (StaffShell, OrgShell pour tout
  rôle, EventShell, AccountNav y compris sous `sm` — libellé court « Docs » via `shortLabel`) ; `PageDocButton` rend `null` ;
  chaque page `docs` rend le titre « Documentation » et le texte « Bientôt disponible » (rendu statique des pages serveur,
  `params` simulés) ; le bouton est placé dans l'en-tête avant la cloche (test d'ordre sur le HTML de `StaffShell`).
- [ ] **Step 2 : lancer** `make test FILE=src/components` → échec.
- [ ] **Step 3 : implémenter** — insérer `<PageDocButton />` juste avant `<NotificationBell …/>` dans les trois shells et dans
  `src/app/account/layout.tsx` ; ajouter l'entrée de menu en fin de liste (OrgShell : `minRole: "AUDITOR"` ; StaffShell : dans le
  groupe « Plateforme » ; EventShell : groupe « Administration », sans condition de rôle — **les shells `EventOperatorShell`,
  `EventPrinterShell`, `EventViewerShell` ne sont pas modifiés**, ils disparaissent en 2b) ; pages d'attente avec
  `EmptyState icon="file" title="Bientôt disponible" description="La documentation de cet espace arrive prochainement."`.
  Les pages ne vérifient aucune permission (les layouts d'espace protègent déjà l'accès).
- [ ] **Step 4 : lancer** `make test FILE=src/components` → vert ; `make typecheck`. Contrôle visuel du bouton absent (rendu
  `null`) et de l'entrée de menu à 375, 1024 et 1280 px (voir Task 17).
- [ ] **Step 5 : commit** : `feat(docs): ancrages de la documentation des pages (bouton nul, menu, pages d'attente)`.

### Task 17: e2e, doc, vérification

**Files:**
- Create: `docs/v4/features/roles-permissions.md`
- Modify: `e2e/transverse/*.spec.ts` (adaptations aux helpers si nécessaire), spec de coordination : **non** (journal tenu par l'orchestrateur)
- Test: `e2e/transverse/roles-socle.spec.ts` (nouveau)

- [ ] **Step 1 : squelette `docs/v4/features/roles-permissions.md`**, en français avec accents, en-tête de statut « En construction —
  chantier `roles-permissions` » et **une section par lot** (titres exacts, chaque lot remplit la sienne) : « Socle : modèle,
  catalogue et résolution » (remplie ici : rôles en base + catalogue en code, rôles système figés, niveaux et « Qui peut porter
  quoi », ordre de résolution, règle de cible, repli sur les enums, `migrate-roles`, gardes et contexte `EventAuthCtx`,
  notifications par permission, fabriques et helpers e2e), « Plateforme (lot 2a) », « Organisation et évènement (lot 2b) »,
  « Gestion des droits (lot 2c) » (trois sections avec une ligne « À rédiger par le lot 2x »), « Migration et exploitation »
  (`make migrate-roles`, ordre : `db-push` puis `migrate-roles`, colonnes d'enum conservées jusqu'à un changement ultérieur).
- [ ] **Step 2 : e2e `roles-socle.spec.ts`** (helpers du socle, base de dev, fixtures préfixées) : (a) un `STAFF_ADMIN` créé par
  `createTestStaff` se connecte et voit `/platform` ; (b) un `STAFF_OBSERVER` voit `/platform` ; (c) un `OWNER` d'organisation voit
  `/org/{id}` et le lien « Documentation » mène à la page « Bientôt disponible » ; (d) un compte `STAFF_PRINTER` créé par le helper
  existe, se connecte (pas d'erreur 500 ; la page d'atterrissage n'est pas exigée avant le lot 2a).
- [ ] **Step 3 : migration de dev** : `make migrate-roles` (base de dev, après `ARGS=--dry-run` de la Task 8) puis
  `make migrate-roles` une seconde fois : le second rapport doit être à zéro. Noter les compteurs dans les Notes.
- [ ] **Step 4 : vérification complète** : `make lint && make typecheck && make test-coverage` → 0 erreur, seuils de couverture à
  100 % respectés. Puis e2e **complets** (`make test-e2e`) : rien n'est écarté ; si le smoke SMTP échoue en masse, voir la
  mémoire projet (`make db-seed` répare le SMTP du dev) avant de conclure à une régression.
- [ ] **Step 5 : contrôle visuel** (navigateur) : `/platform`, `/org/{id}`, `/event/{id}`, `/account` aux largeurs 375, 1024 et 1280 px ;
  entrée « Documentation » visible et sans débordement dans les quatre en-têtes/menus ; pas de bouton parasite.
- [ ] **Step 6 : mise à jour de la Progression** (tous les `[x]` datés, Notes : fichiers touchés pour typage, union
  `PermissionDomain` finale, compteurs de migration) puis **commit** : `docs(roles): squelette de la doc roles-permissions et verification du socle`.

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **Garde « une parmi »** : `withStaffAuth`, `withOrgAuth` et `withEventAuth` acceptent
   `permission: Permission | readonly Permission[]`. Une liste signifie « au moins une ».
   `requirePermission` accepte aussi une liste (même sens). Tests : liste satisfaite par la
   seconde clé seulement → 200 ; aucune → 403 `PERMISSION_DENIED`. Contrat publié pour 2b
   (journal d'évènement : `["event.activity.read", "scan.history.read"]`).
2. **`eventTargetOf`** est exporté par `src/lib/permissions` (signature
   `eventTargetOf(r: { eventId: string; orgId: string }): PermissionTarget`) ; les lots ne le
   redéfinissent pas.
3. Les fabriques publiées s'appellent `makeCustomRole` et `makeOverride` (pas `makeRole`) :
   signatures figées dans « Contrats publiés », reprises par 2c.
4. **Tests de `src/lib/__tests__/`** : le socle ne possède que ceux du code qu'il modifie ; un
   test d'un module appartenant à un lot appartient à ce lot (voir spec 36).
5. Arbitrages du socle acceptés et journalisés dans la spec 36 : repli sur la colonne d'enum
   quand `roleId` est nul (transition), double écriture des enums par fabriques/seed/helpers
   e2e pour les rôles hérités, `includeStaff` dans les notifications, `loadUserContext` non
   mémoïsé + `getUserContext` mémoïsé, `assertOwner`/`assertNotStaff` sur `isStaffActor`,
   correctifs mécaniques de typecheck autorisés dans des fichiers de lots (listés dans les
   Notes de la tâche).
