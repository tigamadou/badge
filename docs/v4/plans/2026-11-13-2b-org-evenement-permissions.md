# Vague 2 · Lot 2b — Organisation et évènement en permissions, poste AGENT, quantité des accessoires — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2b feat/roles-imprimeur-support-2b`. Toutes les commandes
> `make` se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`. En exécution
> automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du plan
> (messages en français ASCII, style conventional commits, sans mention d'IA) ; en dehors, aucun
> commit sans demande explicite de l'utilisateur.

**Objectif :** remplacer toutes les gardes de rôle de l'espace organisation et de l'espace
évènement par des vérifications de permission (routes, pages, composants, menus), n'avoir qu'un
seul `EventShell` filtré par permission, ouvrir le poste d'impression sur place au rôle `AGENT`
(routes et pages), et rendre automatique la quantité des accessoires dans l'assistant de commande.

**Architecture :** deux modèles de menu déclaratifs (`org-nav.ts`, `event-nav.ts`) filtrés par
`permissions`, partagés par les shells, les layouts et les redirections d'atterrissage ; deux
gardes de page (`requireOrgPagePermission`, `requireEventPagePermission`) qui remplacent les
`hasOrgRole` / `effectiveEventRole` dispersés ; les composants clients reçoivent un tableau
`permissions` sérialisable pour masquer les boutons que le serveur refuserait. Les routes AGENT
imitent celles du poste plateforme et réutilisent `src/lib/print-requests/onsite-station.ts`.

**Stack :** Next.js 16 (App Router), Prisma 6 / MySQL, NextAuth (JWT), Vitest 4, Playwright.

**Specs :**
[37 — rôles et permissions](../specs/2026-11-13-37-v4-roles-et-permissions.md) (catalogue ORG et
EVENT, résolution par union, `EventAuthCtx`, interfaces organisation et évènement, AGENT) ·
[39 — quantité des accessoires](../specs/2026-11-13-39-v4-quantite-accessoires-automatique.md) ·
[36 — coordination](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md) (lot 2b, table de
contrôle) · [35 — impression pendant l'évènement](../specs/2026-11-01-35-v4-impression-pendant-l-evenement.md)
(à amender).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Modèles de menu et gardes de page (org, évènement) | [x] | 2026-11-13 | Entree Documentation du socle conservee (avant le groupe Administration); SidebarNav n'active que l'entree la plus specifique. |
| 2 | Routes API `org/[orgId]/**` hors évènement | [x] | 2026-11-13 | archive/restore: org.events.archive. STAFF_SUPPORT perd archive/restore et PATCH org (spec). |
| 3 | Routes API d'évènement | [x] | 2026-11-13 | Garde 'une parmi' du socle (pas de helper local). STAFF_SUPPORT/Observateur: droits du catalogue. Matrice de tests derivee du catalogue des roles systeme. |
| 4 | Routes AGENT du poste sur place | [x] | 2026-11-13 | Controle d'appartenance dans onsite/_scope.ts (404 hors evenement/organisation/ADVANCE/brouillon). Les POST passent par le garde d'abonnement de withEventAuth (lookup inclus). |
| 5 | Espace organisation : layout, `/select`, redirection, `OrgShell`, pages | [x] | 2026-11-13 | Menu Documentation conserve (org.read). src/components/layout/__tests__/space-shells.test.tsx adapte (teste OrgShell/EventShell). accessibleOrgIds/accessibleEventIds exportes de org-redirect (utilises par /select); l'orgId d'un evenement est inconnu du contexte: ajustements d'organisation ignores pour l'atterrissage. |
| 6 | `EventShell` unique, layout et atterrissage | [x] | 2026-11-13 | EventShell unique, layout, atterrissage |
| 7 | Pages d'évènement gardées, boutons par permission, tableau de bord | [x] | 2026-11-13 | pages evenement gardees |
| 8 | Pages AGENT du poste sur place | [x] | 2026-11-13 | pages poste sur place agent, canAccept par permission |
| 9 | Quantité automatique des accessoires (spec 39) | [ ] | | |
| 10 | Documentation (spec 35, impression sur place, rôles et permissions) | [ ] | | |
| 11 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables (et leurs `__tests__`) :

- `src/app/api/org/**` **sauf** `[orgId]/members/**`, `[orgId]/roles/**`, `[orgId]/events/[eventId]/members/**` (2c).
- `src/app/org/**` **sauf** `[orgId]/members/**` et `[orgId]/roles/**` (2c).
- `src/app/event/**` **sauf** `[eventId]/members/**` (2c).
- `src/components/admin/**` **sauf** `OrgMemberForm.tsx` (2c).
- `src/components/event/**` **sauf** `MemberInviteForm.tsx`, `MemberTable.tsx` (2c) ; `src/components/event/print/guard.ts` est au socle (lecture seule).
- `src/app/select/**`, `src/lib/org-redirect.ts` **et son test `src/lib/__tests__/org-redirect.test.ts`** (exception à la règle « `src/lib/__tests__/` au socle » : ce seul fichier appartient à 2b).
- `e2e/org/**` et `e2e/event/**` **sauf** `e2e/org/members.spec.ts` et `e2e/event/members.spec.ts` (2c).
- `docs/v4/specs/2026-11-01-35-v4-impression-pendant-l-evenement.md` (amendement), `docs/v4/features/impression-sur-place.md`, section « Organisation et évènement » de `docs/v4/features/roles-permissions.md`.

Nouveaux fichiers prévus (tous sous les globs ci-dessus) : `src/components/admin/org-nav.ts`,
`src/components/event/event-nav.ts`, `src/app/org/[orgId]/_lib/page-access.ts`,
`src/app/event/[eventId]/_lib/page-access.ts`, `src/app/api/org/_lib/with-any-event-permission.ts`,
les routes `…/print-requests/[requestId]/onsite/**`, les pages `src/app/event/[eventId]/print/onsite/page.tsx`
et `src/app/event/[eventId]/print/[requestId]/onsite/page.tsx`, `src/components/event/print/accessory-quantity.ts`.

**À supprimer** : `src/components/event/EventOperatorShell.tsx`, `EventPrinterShell.tsx`, `EventViewerShell.tsx` (et leurs tests éventuels).

**En lecture seule** (besoin d'y toucher → **s'arrêter et le signaler**) : tout le socle
(`prisma/schema.prisma`, `src/lib/permissions/**`, `src/lib/auth-guards.ts`, `auth-helpers.ts`,
`user-context.ts`, `with-org-auth.ts`, `with-event-auth.ts`, `with-staff-auth.ts`,
`src/types/auth.ts`, `src/test/**`, `e2e/helpers/**`, `src/components/event/print/guard.ts`,
`src/components/staff/print/OnsiteStation.tsx` et `request-fetch.ts`), `src/components/print/**`,
`src/components/staff/print/**`, `src/lib/print-requests/**` (dont `onsite-station.ts`, `route.ts`,
`staff-api.ts`, `content.ts`), `src/lib/print-sheets/**`, tout `src/app/platform/**`,
`src/app/api/platform/**`, `src/app/api/files/**`, les fichiers de 2c cités plus haut.

## Contrats du socle consommés (noms exacts)

- `Permission` (union des clés du catalogue) et `PermissionTarget` — `@/lib/permissions`.
- `hasPermission(ctx: UserContext, permission, target): boolean` et `effectivePermissions(ctx, target): Set<Permission>` (purs, sur un `UserContext` déjà chargé).
- `loadPermissions(userId, target): Promise<Set<Permission>>` (Server Components, mémoïsé par requête).
- `requirePermission(userId, permission, target): Promise<void>` (lève `AuthError` `PERMISSION_DENIED` 403) — `@/lib/auth-guards`.
- `withOrgAuth(permission, handler)` ; `withEventAuth({ permission, allowArchived?, requireRegistrationOpen? }, handler)`.
- `EventAuthCtx { session, orgId, eventId, event, permissions: Set<Permission>, isStaffActor: boolean }` (plus de `effectiveRole`).
- `loadUserContext(userId)` / `UserContext` enrichi (rôles résolus, ajustements) et `ctx.orgMemberships`, `ctx.eventMemberships`, `ctx.isStaff`.
- `OnsiteStation` : props `apiBase` et `backHref` en plus des props actuelles (`requestId`, `reference`, `orgId`, `eventId`, `eventTitle`, `location`, `printerNote`, `initialCounter`).
- Fabriques `src/test/factories.ts` et helpers e2e `e2e/helpers/{db,auth}.ts` **par clé de rôle système** (ex. `makeStaff("STAFF_OBSERVER")`, membre d'organisation `AGENT`, `OWNER`, membre d'évènement `PRINTER`) ; clés des rôles système : `OWNER MANAGER AUDITOR AGENT`, `ADMIN OPERATOR PRINTER VIEWER`.
- Règle serveur de la quantité des accessoires dans `src/lib/print-requests/content.ts` (posée par le socle).
- `requirePrintAccess(eventId, path)` de `src/components/event/print/guard.ts` (signature inchangée : `{ ctx, event, orgId }`).
- `organizerRoute(...)` de `src/lib/print-requests/route.ts` (déjà gardé `print.request`).

Si une signature diffère de celle-ci à l'exécution, adapter l'appel du lot (jamais le socle) et le
noter dans la colonne « Notes » de la progression.

## Global Constraints

- **Règles de test (CLAUDE.md « Règles de test »)** : Vitest sur une base se terminant par `_test`
  (`badge_2b_test` dans la stack du lot ; garde-fou de `src/test-setup.ts`) ; **aucun mock de la
  base ni de Prisma** (seuls NextAuth `getServerSession`, SMTP, FedaPay et le renderer se mockent) ;
  données préparées avec `src/test/factories.ts` (`@faker-js/faker`, graine fixée par fichier) —
  ajouter une fabrique plutôt que dupliquer des `prisma.*.create` ; **ne jamais modifier le code de
  production pour faire passer un test** ou atteindre la couverture : s'arrêter et demander ;
  couverture **100 %** sur `src/lib/**` et `src/app/api/**` ; e2e Playwright contre l'app en
  cours, avec fixtures préfixées nettoyées par `e2e/helpers/db.ts`.
- **Aucune clé de permission hors catalogue** : toute clé utilisée ici existe dans le catalogue de
  la spec 37 (aucun ajout par le lot ; si une clé manque → signaler au socle).
- **Pas de déploiement** : le plan s'arrête à « vert en local » ; aucune étape de production, de SSH
  ni de migration hors développement. Ne **jamais modifier** `.env`, `.env.production`,
  `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`.
- **Règles métier en code conservées** (spec 37) : évènement archivé (410), le staff ne crée / ne
  soumet / n'accepte jamais une commande d'impression (`!session.user.isStaff`), contournement de
  quota par le staff, dernier OWNER (2c).
- Toute route reste gardée avant toute action ; toute action sensible garde son `logActivity`.
  Rien de sensible dans une réponse (hash, tokens, secrets).
- UI et messages en français avec accents ; code et identifiants en anglais ; commentaires en
  français sans exagération (le *pourquoi* seulement).
- Responsive : le menu latéral occupe ~224 px dès `lg` ; toute nouvelle page tient à 375, 1024 et 1280 px.

## Review Focus

- **IDOR du poste AGENT** : une commande d'un autre évènement (ou d'une autre organisation) passée
  dans l'URL `…/events/[eventId]/print-requests/[requestId]/onsite/*` répond 404, jamais 200 ni 403
  révélateur ; un AGENT d'une organisation A n'atteint rien de l'organisation B.
- **Fuite de prix au poste AGENT** : ni la page `/event/[eventId]/print/onsite`, ni
  `/print/[requestId]/onsite`, ni `GET …/onsite` n'exposent prix, lignes de devis, total ni marge
  modifiable ; un AGENT n'accède pas à `/print`, `/print/[requestId]`, `/print/new`.
- **Écart bouton ↔ serveur** : aucun bouton ou entrée de menu affiché sans la permission que la route
  exige (Observateur plateforme et AUDITOR sans bouton d'écriture ; PRINTER d'évènement sans lien
  vers les inscriptions) ; ouvrir l'URL à la main d'une page non autorisée redirige vers
  `/event/[eventId]` (ou `/org/[orgId]`), jamais d'écran vide ni de 500.
- **Union rôle d'organisation + rôle d'évènement** : un AUDITOR membre PRINTER d'un évènement
  (changement assumé) voit les entrées de VIEWER **et** de PRINTER ; un membre sans aucune
  permission sur l'évènement est renvoyé vers `/select` sans boucle de redirection.
- **Atterrissage sans boucle** : utilisateur à une seule permission (PRINTER = `badge.print`)
  atterrit sur Badges ; aucune redirection ne pointe vers la page qui redirige (landing
  ↔ `requireEventPagePermission`) ; utilisateur sans accès → `/select`.
- **Staff** : un Observateur plateforme lisant une organisation ou un évènement n'a aucun bouton
  d'écriture et reçoit 403 sur toute écriture ; le staff reste redirigé de `/org/[orgId]` vers
  `/platform/organizations/[orgId]` sans appartenance, et le bandeau « Mode staff » reste affiché.
- **Quantité des accessoires** : un appel API direct avec une quantité d'accessoire fausse est
  recalculé par le serveur ; changer la sélection de badges (ou la quantité estimée) met à jour les
  quantités affichées ; brouillon rouvert : quantité recalculée, pas de NaN.
- **Données nominatives** : un VIEWER (`event.read.aggregated` seul) ne voit ni liste d'inscrits ni
  « Dernières inscriptions » sur le tableau de bord ; `idDocumentReadable` suit la règle de
  `/api/files` (2a/socle), pas `ctx.isStaff`.

---

### Task 1: Modèles de menu et gardes de page

**Files:**
- Create: `src/components/admin/org-nav.ts`, `src/components/event/event-nav.ts`
- Create: `src/app/org/[orgId]/_lib/page-access.ts`, `src/app/event/[eventId]/_lib/page-access.ts`
- Test: `src/components/admin/__tests__/org-nav.test.ts`, `src/components/event/__tests__/event-nav.test.ts`, `src/app/org/[orgId]/_lib/__tests__/page-access.test.ts`, `src/app/event/[eventId]/_lib/__tests__/page-access.test.ts`

**Interfaces:**
- Consumes: `Permission`, `loadPermissions`, `loadUserContext`, `PermissionTarget`.
- Produces :

```ts
// org-nav.ts
export type OrgNavSpec = { suffix: string; label: string; icon: NavLink["icon"]; exact?: boolean; anyOf: readonly Permission[] };
export const ORG_NAV: readonly OrgNavSpec[];                       // ordre du menu
export function orgNavFor(orgId: string, permissions: ReadonlySet<Permission>): NavLink[];
// event-nav.ts
export type EventNavSpec = { suffix: string; label: string; icon: NavLink["icon"]; exact?: boolean; anyOf: readonly Permission[]; unlessAny?: readonly Permission[]; group?: "Administration" };
export const EVENT_NAV: readonly EventNavSpec[];
export function eventNavFor(eventId: string, permissions: ReadonlySet<Permission>, extras?: { printUnread?: number }): NavEntry[];
export function firstAllowedEventHref(eventId: string, permissions: ReadonlySet<Permission>): string | null; // 1re entrée autorisée, hors « Notifications »
// page-access.ts (org)
export async function requireOrgPagePermission(orgId: string, permission: Permission | readonly Permission[], path: string):
  Promise<{ ctx: UserContext; permissions: Set<Permission> }>;   // redirect(`/login?callbackUrl=…`) si pas de session ; redirect(`/org/${orgId}`) si refusé
// page-access.ts (évènement)
export async function requireEventPagePermission(eventId: string, permission: Permission | readonly Permission[] | null, path: string):
  Promise<{ ctx: UserContext; event: { id: string; orgId: string; title: string; archived: boolean }; orgId: string; permissions: Set<Permission>; isStaffActor: boolean }>;
  // null = « avoir au moins une permission » ; tableau = l'une d'elles (any-of) ; refusé → redirect(`/event/${eventId}`) ; aucune permission → redirect("/select") ; évènement inconnu → notFound()
```

Tableau du menu **organisation** (ordre) : Tableau de bord `org.read` (exact) · Notifications `org.read` ·
Événements `org.events.list` · Membres `org.members.read` · **Rôles** `org.roles.manage`
(suffixe `/roles`, icône `shield`) · Modèles catégories `org.templates.read` · Abonnement
`billing.subscription.read` · Paiements `billing.payments.read` · Paramètres `org.update` · Journal `org.activity.read`.

Tableau du menu **évènement** (ordre) : Tableau de bord (exact) `event.read.aggregated | event.read.detailed | scan.check-in` ·
Notifications (`anyOf: []` = « au moins une permission sur l'évènement ») ·
Vue d'ensemble `event.read.aggregated` avec `unlessAny: ["event.read.detailed"]` (suffixe `/registrations/overview`) ·
Inscriptions `event.read.detailed` · Badges `badge.print` · Impression `print.request` (compteur `printUnread`) ·
**Poste sur place** `print.onsite.operate` (suffixe `/print/onsite`, icône `printer`) · Catégories `event.read.detailed` ·
Scanner `scan.check-in` · Membres `event.members.manage` · groupe « Administration » (affiché seulement
si au moins une des deux entrées suivantes l'est) : Paramètres `event.settings.update` · Journal `event.activity.read | scan.history.read`.
« Poste sur place » reste visible dès `print.onsite.operate` (ADMIN, OWNER, MANAGER, AGENT, Imprimeur).

- [ ] **Step 1: Tests de `orgNavFor` / `eventNavFor`.** Assertions exactes : OWNER système → toutes les entrées dont « Rôles » ; MANAGER → pas de « Rôles », pas de « Paramètres » ; AUDITOR → Tableau de bord, Notifications, Événements, Membres, Modèles, Abonnement, Paiements, Journal, aucune entrée d'écriture ; AGENT d'organisation → Tableau de bord, Notifications, Événements seulement. Évènement : PRINTER (`badge.print`) → `["Notifications", "Badges"]` ; VIEWER → Tableau de bord, Notifications, Vue d'ensemble ; OPERATOR → Tableau de bord, Notifications, Inscriptions, Badges, Catégories, Scanner, Journal ; ADMIN → tout sauf « Vue d'ensemble » ; AGENT (via org) → Tableau de bord, Notifications, Badges, Poste sur place, Scanner, Journal. `firstAllowedEventHref` : PRINTER → `/event/E/badges` ; `Set` vide → `null`. Permissions construites avec `effectivePermissions` sur un `UserContext` réel (fabriques), pas écrites à la main.
- [ ] **Step 2: Lancer** `yarn vitest run src/components/admin/__tests__/org-nav.test.ts src/components/event/__tests__/event-nav.test.ts` — attendu : FAIL (modules absents).
- [ ] **Step 3: Implémenter** les deux fichiers de menu (données + fonctions pures, aucun import serveur) selon les signatures ci-dessus.
- [ ] **Step 4: Tests des gardes de page** (base réelle, `getServerSession` mocké, `redirect`/`notFound` de `next/navigation` mockés pour lever une exception identifiable) : sans session → redirection login avec `callbackUrl` ; permission manquante → `/event/E` (ou `/org/O`) ; aucune permission sur l'évènement → `/select` ; évènement inconnu → `notFound` ; any-of satisfait par la seconde permission ; `isStaffActor` vrai pour un staff sans membership, faux pour un staff également membre de l'org.
- [ ] **Step 5: Implémenter** `requireOrgPagePermission` et `requireEventPagePermission` : session → `loadUserContext` → `prisma.event.findUnique` (évènement) → `loadPermissions(userId, target)` ; `isStaffActor = ctx.isStaff && !ctx.orgMemberships.some(orgId) && !ctx.eventMemberships.some(eventId)` (même définition que `EventAuthCtx`). Aucune redirection vers la page d'atterrissage depuis cette garde (anti-boucle) : le refus va toujours à `/event/${eventId}`, dont la page décide.
- [ ] **Step 6: Relancer** les quatre fichiers — attendu : PASS. `make lint && make typecheck` sur ces fichiers.
- [ ] **Step 7: Commit** `feat(permissions): modeles de menu et gardes de page org et evenement`.

---

### Task 2: Routes API `org/[orgId]/**` hors évènement

**Files:** Modify les `route.ts` de `src/app/api/org/[orgId]/` : `route.ts`, `activity`, `settings/badge`, `subscription/checkout`, `templates` et `templates/[id]`, `upload`, `events/route.ts`, `events/[eventId]/archive`, `events/[eventId]/restore` ; Test : les `__tests__/route.test.ts` voisins (existants à migrer + nouveaux).

**Interfaces:** Consumes `withOrgAuth(permission, handler)`, `requirePermission(userId, permission, { kind: "org", orgId })`, `AuthError`. Produces : aucune API nouvelle ; les mêmes réponses JSON qu'avant.

Correspondance (remplacement 1 pour 1, sans changer le comportement métier) :

| Route | Avant | Permission |
|---|---|---|
| `GET /` | `AUDITOR` | `org.read` |
| `PATCH /` | `OWNER` | `org.update` |
| `GET /activity` | `AUDITOR` | `org.activity.read` |
| `PATCH /settings/badge` | `requireOrgRole MANAGER` | `org.badge_settings.update` |
| `POST /subscription/checkout` | `OWNER` | `billing.subscription.pay` |
| `GET /templates` | `AUDITOR` | `org.templates.read` |
| `POST /templates` | `MANAGER` | `org.templates.manage` |
| `PATCH/DELETE /templates/[id]` | `requireOrgRole MANAGER` | `org.templates.manage` |
| `POST /upload` | `MANAGER` | `org.upload` |
| `GET /events` | `AUDITOR` | `org.events.list` |
| `POST /events` | `MANAGER` | `org.events.create` (droit `CREATE_EVENT` et quota inchangés ; contournement du quota par `session.user.isStaff` conservé) |
| `POST …/archive` | `requireOrgRole MANAGER` | `org.events.archive` |
| `POST …/restore` | `requireOrgRole MANAGER` | `org.events.archive` |

- [ ] **Step 1: Écrire / migrer les tests** : pour chaque route, un test « autorisé » (le rôle système le plus bas qui détient la permission → 2xx) et un test « refusé » (`AUDITOR` pour les écritures, `AGENT` pour `org.activity.read`, utilisateur sans membership → 403) ; staff `STAFF_OBSERVER` : lecture 200 (`org.read`, `org.activity.read`, `org.templates.read`, `org.events.list`) et écriture 403 ; staff `STAFF_ADMIN` : `POST /events` avec quota dépassé passe et journalise `QUOTA_BYPASS`. Remplacer dans les tests existants les créations `orgMembership.create({ role: "OWNER" })` par les fabriques par clé de rôle du socle.
- [ ] **Step 2: Lancer** `yarn vitest run "src/app/api/org/\[orgId\]"` (hors `members`, `roles`) — attendu : FAIL sur les refus.
- [ ] **Step 3: Migrer** chaque route selon le tableau (`withOrgAuth("<permission>", …)` ; `requireOrgRole(…, "X")` → `requirePermission(session.user.id, "<permission>", { kind: "org", orgId })` en gardant le `try/catch AuthError` existant). Supprimer les commentaires devenus faux (« hiérarchie MANAGER… »).
- [ ] **Step 4: Relancer** — attendu : PASS ; `rtk grep -rnE "minRole|requireOrgRole|hasOrgRole" "src/app/api/org/[orgId]"` ne renvoie rien hors `members/**` et `roles/**`.
- [ ] **Step 5: Commit** `feat(permissions): routes org par permission`.

---

### Task 3: Routes API d'évènement

**Files:** Modify les `route.ts` de `src/app/api/org/[orgId]/events/[eventId]/` (hors `members/**`, hors `print-requests/**` déjà gardés par `organizerRoute`, hors `badges/**` déjà en `badge.print`) ; Create `src/app/api/org/_lib/with-any-event-permission.ts` ; Test : `__tests__` voisins + `src/app/api/org/_lib/__tests__/with-any-event-permission.test.ts`.

**Interfaces:**
- Consumes: `withEventAuth`, `EventAuthCtx { permissions, isStaffActor }`.
- Produces: `withAnyEventPermission(permissions: readonly [Permission, ...Permission[]], opts: { allowArchived?: boolean }, handler)` — **GET uniquement** : compose un `withEventAuth({ permission: p, ...opts }, handler)` par permission et essaie les gardes dans l'ordre ; une réponse 403 d'erreur `PERMISSION_DENIED` passe à la suivante, toute autre réponse (y compris 401, 404, 410) est renvoyée telle quelle ; le handler lit `ctx.permissions` pour savoir ce que l'appelant peut voir. (Vérifier dans `with-event-auth.ts` la forme exacte du corps 403 ; l'adapter sans toucher au socle.)

Correspondance :

| Route | Avant | Permission |
|---|---|---|
| `GET/PATCH …/[eventId]` (route.ts) | `OPERATOR` / `ADMIN` | `event.read.detailed` / `event.update` |
| `GET/PATCH …/settings` | `ADMIN` | `event.settings.update` |
| `PATCH …/settings/badge` | `VIEWER` + test explicite | `event.settings.update` (supprimer le test explicite) |
| `POST …/upload` | `ADMIN` | `event.update` |
| `GET …/activity` | `OPERATOR` (`effectiveRole === "OPERATOR"` → ses scans) | `withAnyEventPermission(["event.activity.read", "scan.history.read"])` ; sans `event.activity.read` dans `ctx.permissions` → filtre `userId = session.user.id` et `type = BADGE_SCANNED` |
| `GET/POST …/blocked-emails`, `DELETE …/[id]` | `ADMIN` | `registration.block` |
| `GET/POST …/blocked-documents`, `DELETE …/[id]` | `ADMIN` | `registration.block` |
| `GET …/categories` | `OPERATOR` | `event.read.detailed` |
| `POST …/categories`, `PATCH/DELETE …/categories/[id]`, `POST …/categories/import-templates` | `ADMIN` | `event.categories.manage` |
| `GET …/registrations` | `OPERATOR` | `event.read.detailed` |
| `POST …/registrations` | `ADMIN` | `registration.create` |
| `GET …/registrations/export` | `ADMIN` | `registration.export` |
| `GET …/registrations/overview` | `VIEWER` | `event.read.aggregated` |
| `GET …/registrations/[regId]` | `OPERATOR` | `event.read.detailed` |
| `PATCH …/registrations/[regId]` | `ADMIN` | `registration.update` |
| `DELETE …/registrations/[regId]` | `ADMIN` | `registration.delete` |
| `POST …/[regId]/approve`, `…/reject` | `OPERATOR` | `registration.approve` |
| `POST …/[regId]/checkin`, `POST …/scan/verify` | `OPERATOR` | `scan.check-in` |
| `POST …/[regId]/print` | `PRINTER` | `badge.print` |
| `POST …/[regId]/all-access` | `ADMIN` | `registration.all_access` |
| `POST …/[regId]/block-email`, `…/block-document`, `GET …/[regId]/duplicates` | `ADMIN` | `registration.block` |

- [ ] **Step 1: Tests du helper** `withAnyEventPermission` : première permission satisfaite → handler appelé une fois ; seconde satisfaite seulement → handler appelé ; aucune → 403 ; évènement archivé sans `allowArchived` → 410 renvoyé sans essayer la suivante ; 401 sans session.
- [ ] **Step 2: Tests de routes** (pour chaque ligne du tableau, au moins un rôle autorisé et un refusé, avec les rôles système) : `OPERATOR` reçoit 403 sur `registrations` POST/PATCH/DELETE/export ; `VIEWER` 200 sur `overview` et 403 sur `registrations` GET ; `PRINTER` 200 sur `…/print` et 403 sur `…/approve` ; AUDITOR d'org : lecture agrégée 200, `registrations` GET 403 ; staff `STAFF_OBSERVER` : `registrations` GET 200, `registrations/[id]` PATCH 403 ; staff `STAFF_SUPPORT` : `approve` 200 ; **activity** : ADMIN voit tous les types, AGENT ne voit que ses `BADGE_SCANNED`, VIEWER 403, `STAFF_OBSERVER` voit tout. Un membre d'un autre évènement → 403/404 comme avant (régression d'isolation).
- [ ] **Step 3: Lancer** `yarn vitest run "src/app/api/org/\[orgId\]/events"` — attendu : FAIL.
- [ ] **Step 4: Implémenter** le helper puis migrer chaque route : `withEventAuth({ permission: "…", allowArchived: … }, …)` en conservant les `allowArchived` actuels ; remplacer `effectiveRole`/`staff` par `ctx.permissions` / `ctx.isStaffActor`.
- [ ] **Step 5: Relancer** — PASS ; `rtk grep -rnE "minRole|effectiveRole|hasEventPermission|requireEventRole" "src/app/api/org/[orgId]/events"` vide hors `members/**`.
- [ ] **Step 6: Commit** `feat(permissions): routes evenement par permission`.

---

### Task 4: Routes AGENT du poste sur place

**Files:**
- Create: `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/onsite/route.ts` (GET), `…/onsite/lookup/route.ts` (POST), `…/onsite/search/route.ts` (GET), `…/onsite/print/route.ts` (POST)
- Test: un `__tests__/route.test.ts` par route

**Interfaces:**
- Consumes: `withEventAuth({ permission: "print.onsite.operate", allowArchived: false }, handler)` ; de `src/lib/print-requests/onsite-station.ts` : `loadOnsiteRequest(requestId) → { request, orgId, eventId, counter, hasBadgeLine }`, `lookupOnsiteRegistration(requestId, payload)`, `searchOnsiteRegistrations(requestId, q)`, `recordOnsitePrint({ requestId, registrationId, userId, confirmReprint })` ; de `src/lib/print-requests/staff-api.ts` : `guarded`, `json`, `parseBody` ; `getOnsitePrintSettings()` (`@/lib/settings`) ; `logActivity`.
- Produces: les corps de réponse **identiques** à ceux du poste plateforme (`{ registration }`, `{ registrations }`, `{ print, counter, pdfUrl }` 201 ; erreurs `FOREIGN_EVENT`, `REGISTRATION_NOT_FOUND`, `NOT_APPROVED`, `REQUEST_NOT_PRINTABLE`, `CAP_REACHED`) et, pour `GET …/onsite` : `{ request: { id, reference, status, onsiteLocation, onsiteSchedule }, counter, printerNote }` — **aucun prix, aucune ligne de devis, aucun total**.

Imiter `src/app/api/platform/print/requests/[requestId]/onsite/**` ; la différence est la garde et le **contrôle d'appartenance** (point central) : un helper local `loadEventOnsite(requestId, ctx)` dans chaque route (ou un petit module `…/onsite/_scope.ts` privé) appelle `loadOnsiteRequest` puis refuse (`OnsiteError("NOT_FOUND", 404)`) si `loaded.eventId !== ctx.eventId` ou `loaded.orgId !== ctx.orgId`. `lookup`, `search` et `print` appellent ce contrôle **avant** toute lecture d'inscription. `pdfUrl` reste `/api/org/${orgId}/events/${eventId}/badges/${registrationId}` (garde `badge.print`, que l'AGENT détient). `logActivity({ type: "BADGE_PRINTED", … details: { printRequestId, onsite: true, reprint } })` comme la route plateforme.

- [ ] **Step 1: Tests** (base réelle, commande `ONSITE` `PAID` créée via `makePrintOrder`, inscription `APPROVED`) : AGENT → `lookup` 200 (contenu `…/verify/<id>`), `search` 200 (`q` de 2 caractères, sinon 400 `VALIDATION`), `print` 201 puis journal `PrintRequestPrint` + `badgePrinted` ; seconde impression sans `confirmReprint` → refus de réimpression comme au poste plateforme ; plafond atteint → 409 `CAP_REACHED` ; **commande d'un autre évènement de la même organisation → 404 sur les quatre routes** ; commande d'une autre organisation → 404 ; `AUDITOR` / `VIEWER` / `OPERATOR` d'évènement → 403 ; inscription d'un autre évènement → `FOREIGN_EVENT` ; inscription `PENDING` → `NOT_APPROVED` ; commande `ADVANCE` → 404 ; `GET …/onsite` : la réponse sérialisée ne contient pas les chaînes `price`, `total`, `lines`, `margin` en écriture (assertion sur les clés, `JSON.stringify(body)` sans `unitPrice` ni `lineTotal`).
- [ ] **Step 2: Lancer** `yarn vitest run "src/app/api/org/\[orgId\]/events/\[eventId\]/print-requests/\[requestId\]/onsite"` — FAIL.
- [ ] **Step 3: Implémenter** les quatre routes selon les interfaces ci-dessus.
- [ ] **Step 4: Relancer** — PASS, couverture 100 % des nouveaux fichiers (`yarn vitest run --coverage` ciblé).
- [ ] **Step 5: Commit** `feat(impression): routes du poste sur place pour l'agent d'organisation`.

---

### Task 5: Espace organisation — layout, `/select`, redirection, `OrgShell`, pages

**Files:**
- Modify: `src/app/org/[orgId]/layout.tsx`, `src/app/select/page.tsx`, `src/lib/org-redirect.ts`, `src/components/admin/OrgShell.tsx`, `src/components/admin/OrgSelector.tsx` (si besoin), `src/app/org/[orgId]/{page,events/page,events/new/page,events/EventArchiveActions,activity/page,activity/[logId]/page,notifications/page,payments/page,payments/[paymentId]/page,payments/[paymentId]/receipt/route,settings/page,settings/SettingsClient,settings/badge/page,subscription/page,subscription/return/page,templates/page,templates/TemplatesClient}.tsx|ts`
- Test: `src/lib/__tests__/org-redirect.test.ts`, `src/components/admin/__tests__/OrgShell.test.tsx`, `src/app/org/[orgId]/payments/[paymentId]/receipt/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 1 (`orgNavFor`, `requireOrgPagePermission`), `hasPermission`, `effectivePermissions`, `loadPermissions`.
- Produces: `OrgShell` props `{ org, user, orgs, permissions: Permission[], photoUrl?, children }` (remplace `orgRole`) ; `resolveHomeRedirect(ctx: UserContext | null): string` (signature inchangée).

Règles :
- **Layout `/org/[orgId]`** : accès = membership de l'organisation **et** `hasPermission(ctx, "org.read", { kind: "org", orgId })` ; sinon staff → `/platform/organizations/${orgId}`, autre → `/select` (comportement actuel, plus de liste `[OWNER, MANAGER, AUDITOR]`). Liste du sélecteur : staff → toutes ; autres → organisations où l'utilisateur détient `org.read` (calculée avec `hasPermission` sur `ctx.orgMemberships`, puis `prisma.organization.findMany({ where: { id: { in } } })`). `OrgShell` reçoit `permissions: [...await loadPermissions(userId, org target)]`.
- **`OrgShell`** : `nav = orgNavFor(org.id, new Set(permissions))` ; l'entrée « Rôles » (`/org/${org.id}/roles`, icône `shield`) n'apparaît que pour `org.roles.manage` (la page est livrée par 2c).
- **`/select`** : `orgs` = organisations où `org.read` ; évènements = adhésions directes dont `effectivePermissions(...).size > 0` ; même règle de redirection que `resolveHomeRedirect`.
- **`resolveHomeRedirect`** : cibles = `/platform` si `ctx.isStaff` ; une cible `/org/${orgId}` par adhésion d'organisation détenant `org.read` ; une cible `/event/${eventId}` par adhésion d'évènement dont les permissions ne sont pas vides ; 0 → `/account`, 1 → la cible, ≥ 2 → `/select`.
- **Pages** (`requireOrgPagePermission`, redirection vers `/org/${orgId}`) : `events` (liste : `org.events.list` via layout ; bouton « Nouvel évènement » seulement avec `org.events.create` ; archiver/restaurer avec `org.events.archive` — remplace `canManage = hasOrgRole(…,"MANAGER")`), `events/new` `org.events.create` (en plus du `CREATE_EVENT` actuel), `activity` et `activity/[logId]` `org.activity.read`, `payments` et `payments/[paymentId]` et le reçu `billing.payments.read`, `settings` `org.update`, `settings/badge` `org.badge_settings.update`, `subscription` et `subscription/return` `billing.subscription.read` (`canPay` = `billing.subscription.pay`), `templates` `org.templates.read` (prop `canManage` = `org.templates.manage` vers `TemplatesClient`). `notifications` : `org.read` (layout).
- **Tableau de bord `/org/[orgId]`** : blocs gardés — compteurs d'évènements et d'inscriptions avec `org.events.list`, « Activité récente » avec `org.activity.read`, alerte de quota avec `billing.subscription.read` ; l'AGENT ne voit que la liste des derniers évènements.

- [ ] **Step 1: Tests** : `org-redirect.test.ts` (utilisateurs réels via fabriques + `loadUserContext`) : AGENT d'une seule org → `/org/<id>` ; membre sans `org.read` (rôle d'évènement seulement) → `/event/<id>` ; AUDITOR + membre d'un évènement → `/select` ; staff seul → `/platform` ; `null` → `/login` ; aucun espace → `/account`. `OrgShell.test.tsx` : OWNER voit « Rôles » avec `href="/org/O/roles"`, MANAGER non, AUDITOR n'a aucune entrée d'écriture, AGENT = 3 entrées. Reçu de paiement : MANAGER 200, AGENT 403/redirigé.
- [ ] **Step 2: Lancer** `yarn vitest run src/lib/__tests__/org-redirect.test.ts src/components/admin/__tests__` — FAIL.
- [ ] **Step 3: Implémenter** layout, `/select`, `resolveHomeRedirect`, `OrgShell`, pages et composants listés ; retirer les derniers imports `hasOrgRole`, `orgRoleAtLeast`, `OrgRole` du périmètre ; mettre à jour le commentaire de `EventArchiveActions`.
- [ ] **Step 4: Relancer** — PASS ; `rtk grep -rnE "hasOrgRole|orgRoleAtLeast|OrgRole|\"OWNER\"|\"MANAGER\"|\"AUDITOR\"" src/app/org src/app/select src/components/admin src/lib/org-redirect.ts` vide hors `members/**`, `roles/**`, `OrgMemberForm.tsx`.
- [ ] **Step 5: Commit** `feat(permissions): espace organisation, selecteur et redirection par permission`.

---

### Task 6: `EventShell` unique, layout et atterrissage

**Files:**
- Modify: `src/components/event/EventShell.tsx`, `src/app/event/[eventId]/layout.tsx`, `src/app/event/[eventId]/page.tsx` (redirection d'atterrissage seulement ; le tableau de bord est la tâche 7)
- Delete: `src/components/event/EventOperatorShell.tsx`, `EventPrinterShell.tsx`, `EventViewerShell.tsx`
- Test: `src/components/event/__tests__/EventShell.test.tsx` (nouveau)

**Interfaces:**
- Consumes: Task 1 (`eventNavFor`, `firstAllowedEventHref`, `requireEventPagePermission`), `loadPermissions`, `countOrdersWithUnread`.
- Produces: `EventShell` props `{ org, event, permissions: Permission[], isStaffMode: boolean, printUnread?: number, user, photoUrl?, children }` (**plus de `effectiveRole`**, plus de pastille de rôle dans l'en-tête).

Règles :
- **Layout** : session → contexte → évènement (`notFound` si absent) → `permissions = await loadPermissions(userId, { kind: "event", eventId, orgId })` ; `permissions.size === 0` → `redirect("/select")` ; `isStaffMode = ctx.isStaff && pas d'adhésion à l'organisation ni à l'évènement` (même définition que `EventAuthCtx.isStaffActor`) ; `printUnread` calculé seulement si `permissions.has("print.request") && !ctx.isStaff`. Un seul `return <EventShell …>`.
- **Page d'atterrissage `/event/[eventId]`** : si l'utilisateur détient une des permissions du tableau de bord (`event.read.aggregated`, `event.read.detailed`, `scan.check-in`) la page s'affiche (tâche 7) ; sinon `redirect(firstAllowedEventHref(...))` ; si `null` → `/select`. Le menu et l'atterrissage lisent le **même** modèle `EVENT_NAV`, donc ne divergent pas.

- [ ] **Step 1: Test `EventShell`** : ADMIN → entrées complètes + groupe « Administration » ; PRINTER → « Notifications » et « Badges » seulement, pas de groupe « Administration » ; compteur `printUnread` sur « Impression » ; bandeau « Mode staff » seulement si `isStaffMode`.
- [ ] **Step 2: Lancer** `yarn vitest run src/components/event/__tests__/EventShell.test.tsx` — FAIL.
- [ ] **Step 3: Implémenter** `EventShell` (menu = `eventNavFor`) et le layout ; supprimer les trois shells et corriger les imports restants ; ajouter la redirection d'atterrissage.
- [ ] **Step 4: Relancer** — PASS ; `rtk grep -rnE "EventOperatorShell|EventPrinterShell|EventViewerShell|effectiveRole|effectiveEventRole" src` ne renvoie rien dans le périmètre du lot.
- [ ] **Step 5: Commit** `feat(evenement): EventShell unique filtre par permission, atterrissage sur la premiere entree autorisee`.

---

### Task 7: Pages d'évènement gardées, boutons par permission, tableau de bord

**Files:** Modify `src/app/event/[eventId]/{page,activity/page,activity/[logId]/page,badges/page,badges/[badgeId]/page,badges/print/page,blocked-documents/page,blocked-emails/page,categories/page,notifications/page,registrations/page,registrations/new/page,registrations/overview/page,registrations/[regId]/page,scan/page,settings/page,settings/badge/page}.tsx` et `src/components/event/{RegistrationActions,RegistrationDetailPanel,RegistrationTable,CategoryTable,BlocklistTabs,EventSettingsForm}.tsx` (props `permissions`) ; Test : `src/components/event/__tests__/` (un test par composant touché) et un test de rendu du tableau de bord.

**Interfaces:** Consumes Task 1 (`requireEventPagePermission`). Produces : les composants clients reçoivent `permissions: Permission[]` (sérialisable) et masquent ce que le serveur refuserait.

Page → garde (redirection `/event/[eventId]`) :

| Page | Permission |
|---|---|
| `registrations`, `registrations/[regId]`, `categories`, `blocked-*` (lecture : `registration.block`) | `event.read.detailed` ; `registration.block` pour `blocked-*` |
| `registrations/new` | `registration.create` |
| `registrations/overview` | `event.read.aggregated` |
| `badges`, `badges/[badgeId]`, `badges/print` | `badge.print` |
| `scan` | `scan.check-in` |
| `settings`, `settings/badge` | `event.settings.update` |
| `activity`, `activity/[logId]` | l'une de `event.activity.read`, `scan.history.read` (sans la première : filtre « mes scans » comme la route) |
| `notifications` | au moins une permission (`null`) |

Boutons (le serveur exige la même permission) : `RegistrationTable` — « Exporter » `registration.export`, « Ajouter » `registration.create` ; `RegistrationActions` — approuver / rejeter `registration.approve`, imprimer `badge.print` ; `RegistrationDetailPanel` — modifier `registration.update`, supprimer `registration.delete`, bloquer e-mail / document et doublons `registration.block`, accès total `registration.all_access`, « Voir le badge » `badge.print` ; `CategoryTable` — ajouter / importer / supprimer / éditer `event.categories.manage` ; `EventSettingsForm` — champs d'images et enregistrement `event.update` quand la route d'images l'exige, sinon `event.settings.update`. `idDocumentReadable` = règle de `/api/files` pour la classe de fichier de `snapshotIdDocument` (spec 37, « Fichiers sensibles » : `event.read.detailed` pour `events/{id}/idDocuments/…`, `profiles.read` pour `profile/{uid}/documents/…`) — lire le code d'upload pour identifier la classe, appliquer la même fonction que `/api/files`, signaler la décision dans les Notes.

**Tableau de bord `/event/[eventId]`** (contenu par permission) : couverture, titre, `EventInfoCard` et lien public avec `event.read.aggregated | event.read.detailed` ; compteurs En attente / Approuvées / Rejetées / Badges imprimés avec `event.read.aggregated` ; « Scans aujourd'hui / total » avec `event.read.aggregated` ; **« Dernières inscriptions » et quota seulement avec `event.read.detailed`** ; bloc « Mes scans » (comptage `BADGE_SCANNED` de l'utilisateur) + bouton « Ouvrir le scanner » si `scan.check-in` **sans** `event.read.detailed` ; bloc « Poste sur place » (lien `/print/onsite`) si `print.onsite.operate` sans `event.read.detailed`. Plus de `effectiveEventRole === "OPERATOR"`.

- [ ] **Step 1: Tests de composants** (`@testing-library/react`, sans mock de données serveur) : `RegistrationTable` avec `permissions=["event.read.detailed"]` n'affiche ni « Exporter » ni « Ajouter » ; avec `["registration.export", "registration.create"]` les affiche ; idem pour `RegistrationActions` (approuver absent sans `registration.approve`), `RegistrationDetailPanel`, `CategoryTable`. Test du tableau de bord (page rendue avec un contexte réel) : VIEWER → compteurs mais pas « Dernières inscriptions » ; OPERATOR → « Mes scans » ; AGENT → « Mes scans » et « Poste sur place ».
- [ ] **Step 2: Lancer** `yarn vitest run src/components/event/__tests__` — FAIL.
- [ ] **Step 3: Implémenter** : ajouter `requireEventPagePermission` en tête de chaque page (supprimer `effectiveEventRole`, `hasEventPermission`), passer `permissions` aux composants, adapter le tableau de bord.
- [ ] **Step 4: Relancer** — PASS ; `make lint && make typecheck`.
- [ ] **Step 5: Commit** `feat(evenement): pages gardees par permission, boutons alignes sur les routes, tableau de bord adapte`.

---

### Task 8: Pages AGENT du poste sur place

**Files:**
- Create: `src/app/event/[eventId]/print/onsite/page.tsx`, `src/app/event/[eventId]/print/[requestId]/onsite/page.tsx`, `src/components/event/print/OnsiteOrderList.tsx`
- Modify: `src/app/event/[eventId]/print/[requestId]/page.tsx` et `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/route.ts` (propriétaire → `print.quote.accept`)
- Test: `src/components/event/print/__tests__/OnsiteOrderList.test.tsx`, test de route `…/print-requests/[requestId]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireEventPagePermission(eventId, "print.onsite.operate", path)` ; `loadOnsiteRequest`, `computeOnsiteCounter` (lecture) ; `OnsiteStation` avec `apiBase = /api/org/${orgId}/events/${eventId}/print-requests/${requestId}` et `backHref = /event/${eventId}/print/onsite` ; `getOnsitePrintSettings`.
- Produces: `OnsiteOrderList({ eventId, orders: Array<{ id; reference; status; location: string | null; schedule: string | null; printed: number; ordered: number }> })` — **aucun prix**.

- [ ] **Step 1: Tests** : `OnsiteOrderList` rend référence, lieu, jours, « imprimés / commandés » et un lien `/event/E/print/<id>/onsite`, et son HTML ne contient ni « FCFA » ni « Devis » ni « Total » ; état vide « Aucune commande sur place en cours ». Route `GET print-requests/[requestId]` : `canAccept` vrai pour OWNER (`print.quote.accept`), faux pour MANAGER, faux pour le staff même `SUPER_ADMIN`, faux hors `QUOTED`.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** : page liste (commandes `type = ONSITE`, `status ∈ PAID, IN_PRODUCTION, READY` de l'évènement, par date ; `select` Prisma explicite **sans** `total`, `lines`, `acceptedTotal`) ; page poste (même chargement et mêmes redirections que la page plateforme : statut non imprimable → `/event/${eventId}/print/onsite`, commande d'un autre évènement ou inconnue → `notFound()`, garde `print.onsite.operate`) ; dans `print/[requestId]/page.tsx` et la route, remplacer la requête `orgMembership … role: "OWNER"` par `permissions org` (`loadPermissions(userId, { kind: "org", orgId })` → `has("print.quote.accept")`) en conservant `!isStaff`.
- [ ] **Step 4: Relancer** — PASS ; vérifier 375 / 1024 / 1280 px (navigateur) : liste en cartes empilées < `lg`, poste utilisable au téléphone (caméra et saisie).
- [ ] **Step 5: Commit** `feat(impression): pages du poste sur place pour l'agent, proprietaire du devis par permission`.

---

### Task 9: Quantité automatique des accessoires (spec 39)

**Files:** Create `src/components/event/print/accessory-quantity.ts` ; Modify `src/components/event/print/PrintRequestWizard.tsx` ; Test `src/components/event/print/__tests__/accessory-quantity.test.ts`, e2e dans la tâche 11.

**Interfaces:**
- Consumes: `badgeCount` (état existant du wizard : nombre de badges sélectionnés en amont, quantité estimée sur place) ; règle serveur du socle (`content.ts`) ; `ProductConfigurator` avec `quantityLocked` (lecture seule, non modifiable).
- Produces: `withBadgeQuantity(cfg: ProductConfiguration, badgeCount: number): ProductConfiguration` — renvoie `{ ...cfg, quantity: badgeCount }`.

- [ ] **Step 1: Test** `withBadgeQuantity` : conserve `choices`, remplace `quantity` (y compris `NaN` → `badgeCount`), n'altère pas l'entrée.
- [ ] **Step 2: Lancer** `yarn vitest run src/components/event/print/__tests__/accessory-quantity.test.ts` — FAIL.
- [ ] **Step 3: Implémenter** le helper puis, dans `PrintRequestWizard.tsx` : (a) `productsPayload` envoie `quantity: badgeCount` pour tout accessoire (le serveur recalcule) et valide les choix avec cette quantité ; (b) l'étape « Accessoires » (`step === 3`) affiche chaque `ProductConfigurator` avec `value={withBadgeQuantity(configOf(product), badgeCount)}` et `quantityLocked`, suivi de la mention « Calculée sur le nombre de badges » (paragraphe dans le wizard — `ProductConfigurator` est en lecture seule) ; (c) le chargement d'un brouillon n'utilise plus `line.quantity` pour les accessoires ; (d) `onChange` ne propage que `choices`.
- [ ] **Step 4: Relancer** — PASS ; `make typecheck`. Vérification visuelle à 375 / 1024 / 1280 px : champ en lecture seule + mention, retour à l'étape « Badges » (ou « Quantité ») puis « Accessoires » : la valeur suit.
- [ ] **Step 5: Commit** `feat(impression): quantite des accessoires egale au nombre de badges dans l'assistant`.

---

### Task 10: Documentation

**Files:** Modify `docs/v4/specs/2026-11-01-35-v4-impression-pendant-l-evenement.md`, `docs/v4/features/impression-sur-place.md`, `docs/v4/features/roles-permissions.md` (section « Organisation et évènement » uniquement).

- [ ] **Step 1: Spec 35** — amender la décision 3 (« un opérateur de la plateforme imprime sur place » → « un opérateur de la plateforme **ou un AGENT de l'organisation** », renvoi spec 37 décision 10), la ligne « Droit : staff `STAFF_SUPPORT` minimum » de « Poste d'impression » (→ permission `print.onsite.operate`) ; ajouter une entrée datée au journal si le document en a un, sinon une note « Amendement 2026-11-13 » en tête de « Décisions ».
- [ ] **Step 2: `impression-sur-place.md`** — tableau « Écran / Rôle / Droits » : remplacer les rôles par les permissions (`print.onsite.operate` pour le poste, `print.onsite.margin.update` pour la marge…) ; section « Poste d'impression » : deux accès au même composant (plateforme `/platform/print/orders/[id]/onsite`, organisation `/event/[eventId]/print/[requestId]/onsite` avec la liste sans prix `/event/[eventId]/print/onsite`), routes `…/api/org/…/onsite/{lookup,search,print}` + `GET …/onsite`, contrôle d'appartenance à l'évènement ; tableau « Droits » ; tableau « Fichiers du code ». Ne pas toucher aux sections hors 2b (marge, clôture, crédit : 2a).
- [ ] **Step 3: `roles-permissions.md`, section « Organisation et évènement »** — le menu de l'organisation et de l'évènement par permission (reprendre les deux tableaux de la tâche 1), la table page → permission, la page d'atterrissage, le rôle AGENT et son parcours, les boutons masqués, l'union rôle d'organisation + rôle d'évènement, les règles métier restées en code, la limite connue « pas de permission de lecture de la page Paramètres de l'évènement (accès `event.settings.update`) ».
- [ ] **Step 4: Relire** chaque lien relatif et chaque nom de route cité contre le code (le code fait foi).
- [ ] **Step 5: Commit** `docs(roles): organisation, evenement et poste sur place de l'agent`.

---

### Task 11: e2e, doc, vérification

**Files:** Modify les specs `e2e/org/**` et `e2e/event/**` touchées par les rôles (hors specs membres) ; Create `e2e/org/permissions-nav.spec.ts`, `e2e/event/permissions-nav.spec.ts`, `e2e/event/print-onsite-agent.spec.ts`.

- [ ] **Step 1: Adapter les specs existantes** aux helpers par clé de rôle du socle (`dashboard`, `access`, `registrations*`, `badges`, `categories`, `settings`, `scan`, `print*`, `activity`, `images-badge`, `blocklist`, `pagination` ; `e2e/org/{access,dashboard,events,payments,settings,subscription,templates,activity,pagination}`) ; corriger les attentes qui supposaient les anciens shells (par ex. libellés « Opérateur — … »).
- [ ] **Step 2: `e2e/org/permissions-nav.spec.ts`** : OWNER voit « Rôles » (`href` `/org/O/roles`), MANAGER non ; AUDITOR : aucun bouton « Nouvel évènement », « Archiver », « Importer » ; AGENT : trois entrées de menu, `/org/O/payments` redirige vers `/org/O` ; membre d'une autre organisation sorti de l'espace ; `/select` n'affiche que les organisations à `org.read`.
- [ ] **Step 3: `e2e/event/permissions-nav.spec.ts`** : PRINTER atterrit sur Badges, `/event/E/registrations` redirige vers `/event/E` puis Badges ; VIEWER voit tableau de bord sans « Dernières inscriptions » ; OPERATOR : « Mes scans », pas de bouton « Exporter » ; ADMIN : menu complet sans pastille de rôle ; AUDITOR + membre PRINTER (union) : entrées de VIEWER et de PRINTER ; Observateur plateforme : bandeau « Mode staff », aucun bouton d'écriture ; membre sans permission → `/select`.
- [ ] **Step 4: `e2e/event/print-onsite-agent.spec.ts`** : AGENT → liste `/event/E/print/onsite` sans « FCFA » ; ouvre le poste, saisit le contenu `…/verify/<id>` d'une inscription approuvée, voit la fiche, imprime (compteur +1, journal en base), réimpression confirmée non comptée ; inscription d'un autre évènement refusée (« Ce QR ne correspond pas à cet évènement. ») ; `/event/E/print` et `/event/E/print/new` redirigent ; commande d'un autre évènement → 404 ; contrôle visuel du poste à 375 / 1024 / 1280 px.
- [ ] **Step 5: Assistant (spec 39)** dans `e2e/event/print-new.spec.ts` : cocher un cordon : champ de quantité en lecture seule égal au nombre de badges, mention « Calculée sur le nombre de badges » ; revenir à « Badges », retirer un badge : la quantité suit ; la ligne enregistrée en base porte la nouvelle quantité ; commande sur place : quantité = quantité estimée.
- [ ] **Step 6: Contrôle responsive** (navigateur, 375 / 1024 / 1280 px) : menu latéral `OrgShell` et `EventShell` avec l'entrée « Rôles » / « Poste sur place », tableau de bord d'évènement par rôle, liste et poste AGENT ; aucun défilement horizontal de page.
- [ ] **Step 7: Vérification complète** dans le worktree : `make lint && make typecheck && make test-coverage` (couverture 100 % `src/lib/**` et `src/app/api/**`), puis `scripts/agent-stack.sh status` et les e2e du lot : `yarn playwright test e2e/org e2e/event --grep-invert members` (hors specs membres, une seule exécution à la fois sur la stack). Si SMTP : `make db-seed` d'abord (e2e rouge → vérifier le SMTP du seed).
- [ ] **Step 8: Contrôles finaux** : `rtk grep -rnE "minRole|effectiveRole|hasEventPermission|hasOrgRole|requireOrgRole|requireEventRole|OrgRole|EventRole|StaffRole|EventOperatorShell|EventPrinterShell|EventViewerShell" src/app/org src/app/event src/app/select src/app/api/org src/components/admin src/components/event src/lib/org-redirect.ts` — vide hors fichiers de 2c ; cocher la progression ; rapport prêt à fusionner (liste des écarts aux contrats du socle, fichiers de 2c qui attendent des props ou routes de ce lot).
- [ ] **Step 9: Commit** `test(e2e): permissions de l'espace organisation et evenement, poste sur place de l'agent`.

---

## Auto-revue (spec ↔ tâches)

- Spec 37 « Organisation » : gardes routes (T2), layout / `/select` / `resolveHomeRedirect` (T5), `OrgShell` filtré + « Rôles » (T5, T1).
- Spec 37 « Évènement » : `EventShell` unique et suppression des trois gabarits, atterrissage, pages gardées, tableau de bord (T6, T7), routes (T3).
- Spec 37 « AGENT / poste sur place » : routes (T4), pages (T8), amendement spec 35 (T10).
- Spec 39 côté assistant (T9, e2e T11) ; règle serveur laissée au socle.
- Table de contrôle de la spec 36 : « Rôles » org (T1/T5), `OnsiteStation` (T8, props du socle), `onsite-station.ts` jamais modifié (T4), lien membres d'évènement conservé (T1, entrée `event.members.manage` → `/members`).

## Journal

- 2026-11-13 — Arbitrages de rédaction : (1) helper `withAnyEventPermission` local au lot parce que `withEventAuth` ne prend qu'une permission et que le journal d'évènement doit s'ouvrir à `event.activity.read` **ou** `scan.history.read` (cas AGENT / OPERATOR) — à remplacer par une garde « une parmi » du socle si elle apparaît ; (2) le test `src/lib/__tests__/org-redirect.test.ts` passe au lot 2b ; (3) pas de lecture de la page Paramètres d'évènement sans `event.settings.update` (le catalogue n'a pas de permission de lecture) ; (4) l'entrée « Vue d'ensemble » est masquée pour qui détient `event.read.detailed` (le tableau de bord montre déjà l'agrégé) ; (5) la pastille de rôle de l'en-tête de l'`EventShell` disparaît (le rôle n'est plus un enum unique) ; (6) le staff reste redirigé de `/org/[orgId]` vers `/platform/organizations/[orgId]` tant qu'il n'est pas membre, bien que son rôle plateforme porte `org.read`.

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **Pas de helper local `withAnyEventPermission`** : le socle publie la garde « une parmi »
   (`withEventAuth({ permission: ["event.activity.read", "scan.history.read"] }, h)`).
   Retirer `src/app/api/org/_lib/with-any-event-permission.ts` et son test des fichiers du
   lot ; le handler lit `ctx.permissions` pour filtrer.
2. Le test `src/lib/__tests__/org-redirect.test.ts` appartient au lot (règle : un test
   appartient au propriétaire du module testé).
3. Arbitrages acceptés (journalisés dans la spec 36) : pas de lecture des Paramètres
   d'évènement sans `event.settings.update` ; « Vue d'ensemble » masquée si
   `event.read.detailed` ; pastille de rôle supprimée ; staff non membre redirigé de `/org`
   vers `/platform/organizations/[orgId]`. `idDocumentReadable` suit `event.read.detailed`
   comme `/api/files`.

## Amendements de la revue finale du socle (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **`memberPermissions`** est publié par le socle : `memberPermissions(ctx: UserContext, target: PermissionTarget): ReadonlySet<Permission>` (`src/lib/permissions/resolve.ts`, exporté par `@/lib/permissions`), plus `loadMemberPermissions(userId, target)` dans `src/lib/auth-guards.ts`. C'est l'ensemble effectif **sans** le rôle plateforme ni ses ajustements : les droits « côté organisateur » d'un membre. Pour un non-staff, il est égal à `effectivePermissions`. Tout contrôle « jamais le staff » ou « côté organisateur » (écriture d'une demande d'impression, acceptation de devis, paiement d'abonnement, destinataires de notification sans `includeStaff`) l'utilise **en plus** du refus de `isStaffActor`. Un staff membre d'une organisation n'agit plus côté organisateur avec ses droits plateforme.
2. **`effectivePermissions`** n'applique le rôle plateforme que si `ctx.isStaff` (invariant `isStaff = platformRoleId != null`). Le résolveur ignore les clés `reserved` d'un rôle non système ou d'un ajustement, et un `roleRef` de niveau incompatible avec la place de la membership.
3. Les quatre routes de changement de rôle (`platform/users/[userId]`, `org/[orgId]/members/[userId]`, `org/[orgId]/events/[eventId]/members/[membershipId]`, `platform/organizations/[orgId]/owners`) écrivent désormais `roleId` / `platformRoleId` en plus de la colonne d'enum (marqueur `@deprecated compat`). Le lot qui les reprend conserve cette double écriture jusqu'au plan 3.
4. `migrate-roles` ne migre que les comptes `isStaff = true`, n'écrit jamais `isStaff` et signale les lignes incohérentes (`isStaff = 0 AND staffRole IS NOT NULL`).
