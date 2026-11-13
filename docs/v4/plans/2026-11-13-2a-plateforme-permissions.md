# Vague 2 · Lot 2a — Plateforme (permissions + loader des planches) — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2b et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2a feat/roles-imprimeur-support-2a`. **Toutes les commandes
> `make` se lancent dans le worktree.** Sous-skill : `superpowers:executing-plans` (ou
> `superpowers:subagent-driven-development`). En exécution automatisée (tâche planifiée), **un
> commit par tâche est autorisé** sur la branche du plan (message en français ASCII, style
> conventional commits, aucun trailer d'attribution IA) ; en dehors, **aucun commit sans demande
> explicite**. Modèle des sous-agents d'implémentation, de revue et de correction : `sonnet`.

**Objectif :** remplacer toutes les gardes de rôle de l'espace plateforme (`minRole`,
`staffRoleAtLeast`, `requireStaff`, `staffRole === …`) par les permissions du catalogue, filtrer
le menu et les boutons par permission, rendre `STAFF_PRINTER` opérationnel (menu Impression
seul), migrer `/api/files`, puis livrer le loader des planches (spec 38).

**Architecture :** une garde = une clé du catalogue (spec 37, niveau PLATFORM). `withStaffAuth`
reçoit `{ permission }` ; les routes qui agissent sur une ressource d'évènement (poste sur place)
vérifient la clé EVENT sur la cible de la ressource ; les cas à plusieurs droits (PATCH des
paramètres, `status`, `upload`) font une seconde vérification dans le handler via un petit
helper de réponse. Chaque page serveur vérifie sa permission (`requirePlatformPage`) ; les
composants clients reçoivent des booléens ou la liste `Permission[]`. Un test « matrice »
unique pose, pour chaque route, les rôles système autorisés d'après la spec 37 : il épingle le
catalogue contre la spec et couvre toutes les branches de refus.

**Stack :** Next.js 16 (App Router), Prisma 6 / MySQL, Vitest 4, Playwright, React Testing Library.

**Specs :** [`2026-11-13-37-v4-roles-et-permissions.md`](../specs/2026-11-13-37-v4-roles-et-permissions.md)
(catalogue PLATFORM, règle de cible, fichiers sensibles, interface plateforme),
[`2026-11-13-38-v4-loader-generation-planches.md`](../specs/2026-11-13-38-v4-loader-generation-planches.md),
coordination : [`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md)
(lot 2a).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Prérequis : contrats du socle, helpers de lot, matrice de refus | [x] | 2026-11-13 | contrats du socle conformes ; ligne de sonde dans la matrice |
| 2 | Shell, layout et tableau de bord filtrés (STAFF_PRINTER) | [x] | 2026-11-13 | tabs de paramètres et page paramètres (garde) faits ici ; entrée Documentation hors groupe |
| 3 | Organisations, abonnements, plans | [x] | 2026-11-13 | e2e verts (1 flaky sous charge, repasse) |
| 4 | Profils et listes de blocage | [x] | 2026-11-13 | |
| 5 | Paramètres, motifs de rejet, templates de badge | [x] | 2026-11-13 | |
| 6 | Jobs e-mail, journal, upload, paiements | [ ] | | |
| 7 | Impression : commandes et poste sur place | [ ] | | |
| 8 | Impression : catalogue, gabarits, planches (gardes) | [ ] | | |
| 9 | `/api/files` par permission | [ ] | | |
| 10 | Spec 38 : loader des planches en génération | [ ] | | |
| 11 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables (globs de la spec 36, lot 2a) :

- `src/app/api/platform/**` **sauf** `users/**`, `organizations/[orgId]/owners/**`, `roles/**` ;
- `src/app/platform/**` **sauf** `users/**`, `roles/**` ;
- `src/components/staff/**` **sauf** `UserCreationForm.tsx`, `PlatformOrgMemberInviteForm.tsx`,
  `print/OnsiteStation.tsx`, `print/request-fetch.ts` (socle) ;
- `src/app/api/files/**` ; `src/lib/platform-settings-tabs.ts` ; `src/middleware.ts` ;
- `src/lib/print-requests/**` et `src/lib/print-sheets/**` **hors** fichiers migrés par le socle ;
  ici seuls `staff-api.ts` (helper `eventTargetOf`) et `src/lib/print-sheets/order-queue.ts`
  (spec 38) sont touchés ;
- leurs `__tests__` (sous ces globs) et `e2e/platform/**` **sauf** `user-*.spec.ts` ;
- `docs/v4/features/roles-permissions.md` : **section « Plateforme » seulement** ;
  `docs/v4/features/impression-planches.md` (sections Génération et Droits, spec 38).

**En lecture seule** (socle) : `prisma/schema.prisma`, `src/lib/permissions/**`,
`src/lib/auth-guards.ts`, `auth-helpers.ts`, `user-context.ts`, `with-staff-auth.ts`,
`with-org-auth.ts`, `with-event-auth.ts`, `src/types/auth.ts`, `src/test/**`,
`src/test-setup.ts`, `e2e/helpers/**`, `src/components/staff/print/OnsiteStation.tsx`,
`src/components/staff/print/request-fetch.ts`, les fichiers de `src/lib/print-requests/**`
migrés par le socle (`service.ts`, `route.ts`, `lifecycle.ts`, `credit-view.ts`,
`onsite-station-view.ts`, `quote.ts`, `content.ts`), `src/lib/print-sheets/layout-page-data.ts`,
`src/components/event/print/guard.ts`, `src/components/admin/**` (dont `SidebarNav`),
`src/components/platform/**`. **Besoin d'y toucher → s'arrêter et le signaler.**

**Hors lot (2c)** : `src/app/api/platform/users/**` (dont `reset-password`),
`organizations/[orgId]/owners/**`, `roles/**`, `src/app/platform/users/**`, `roles/**`.

**Tests de `src/lib/__tests__/` (point à arbitrer, voir Task 1)** : la spec 36 attribue ce
dossier au socle, mais ces fichiers testent le code du lot et casseront à la migration :
`api-platform-*.test.ts`, `api-staff-activity.test.ts`, `api-staff-organizations*.test.ts`,
`api-staff-settings.test.ts`, `platform-settings-tabs.test.ts`, `print-order-queue.test.ts`,
`print-sheets-*.test.ts`, `api-print-catalog.test.ts`. Ce plan **suppose qu'ils sont attribués
au lot 2a** (arbitrage à journaliser dans la spec 36). Les `api-staff-users-*` restent à 2c.

## Global Constraints

- **Règles de test (CLAUDE.md, tous les tests présents et futurs)** : Vitest tourne sur une base
  dont le nom finit par `_test` (`badge_2a_test` dans ce worktree), jamais sur la base de dev ;
  **aucun mock de la base ni de Prisma** (seuls se mockent la session NextAuth, SMTP, FedaPay,
  le renderer via `fakeExporter`) ; données préparées avec `src/test/factories.ts`
  (`makeStaff("STAFF_PRINTER")`, etc.) plutôt que des `prisma.*.create` dupliqués ; **ne jamais
  modifier le code de production pour faire passer un test ou atteindre la couverture : s'arrêter
  et demander** ; couverture **100 %** sur `src/lib/**` et `src/app/api/**` ; e2e Playwright
  contre l'app en cours, fixtures préfixées et nettoyées (`e2e/helpers/db.ts`).
- Une garde = une clé du catalogue ; **aucune permission vérifiée par le code et absente du
  catalogue, ou l'inverse**. Pas de `minRole`, `staffRoleAtLeast`, `requireStaff`, `checkRole`,
  ni `ctx.staffRole` dans les fichiers du lot à la fin du lot (`grep` nul).
- Règle de cible : une clé EVENT se vérifie sur `{ kind: "event", eventId, orgId }` de la
  ressource touchée, même depuis une route plateforme.
- Refus API : 401 sans session ; 403 `{ error: "PERMISSION_DENIED" }` sans la permission
  (codes existants conservés quand une route en renvoie déjà un : `FORBIDDEN_SECRET_CHANGE`,
  `STAFF_FORBIDDEN`).
- Un bouton n'est affiché que si le serveur accepte l'action : chaque `canX` d'UI vient de la
  **même clé** que la garde de la route correspondante.
- Soumission jamais partielle : un PATCH refusé n'écrit rien.
- UI en français avec accents ; code en anglais ; commentaires en français ; commits ASCII.
- Pas de déploiement, pas de SSH, pas de migration hors dev ; **ne pas modifier `.env`**,
  `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`.
- Les changements de droits assumés (spec 37) : Observateur sans écriture chez les clients ;
  `STAFF_SUPPORT` sans la production d'impression ni les planches ; `users.update` AD+.

## Review Focus

Entrées ou conditions que la spec implique mais qu'aucun test « nominal » n'exerce, les plus
probables d'abord :

1. **Imprimeur en URL directe** sur une page sans permission (`/platform/organizations`,
   `/platform/settings`, `/platform/plans`, `/platform/payments`) : redirection vers
   `/platform`, jamais un 500 ni du contenu (Task 2, 3, 5, 6, 11).
2. **Observateur** : plus aucun bouton ou formulaire d'écriture visible (créer une organisation,
   archiver, abonnement, plans, test SMTP, motifs, templates, gabarits) et l'API répond 403
   (Task 3, 5, 8, 11).
3. **PATCH `/api/platform/settings` mixte** (SMTP + secrets + droits d'abonnement) avec un rôle
   qui n'a qu'une partie des permissions : 403 et **aucune écriture partielle** (Task 5).
4. **Poste sur place par un Imprimeur** : lookup/recherche/impression acceptés sur l'évènement
   de la commande, marge et clôture refusées ; fichiers `badge-exports` et `print-sheets`
   lisibles, pièces d'identité (`idDocuments`) refusées ; commande inexistante → 404 et non 500
   (Task 7, 9).
5. **Compte dont le rôle est retiré ou dont une permission est retirée par ajustement**
   (`isStaff` résiduel, `platformRoleId` nul ou `REVOKE`) : layout redirige vers `/`, API 403,
   bouton masqué (UI et API d'accord) ; **génération en échec ou lente** : spinner, bouton
   désactivé, polling arrêté à l'issue, onglet masqué sans requête (Task 2, 10).

---

### Task 1: Prérequis — contrats du socle, helpers de lot, matrice de refus

**Files:**
- Create: `src/app/platform/page-guard.ts`, `src/app/api/platform/permission-response.ts`
- Test: `src/app/platform/__tests__/page-guard.test.ts`,
  `src/app/api/platform/__tests__/permission-matrix.test.ts`

**Interfaces:**
- Consumes (socle, noms exacts à vérifier en lisant le code mergé) : `Permission`,
  `PermissionTarget`, `hasPermission(ctx, permission, target)`,
  `requirePermission(userId, permission, target)` (lève `AuthError` code `PERMISSION_DENIED`, 403),
  `loadPermissions(userId, target): Promise<Set<Permission>>`,
  `withStaffAuth(handler, { permission })`, `loadUserContext` (contexte enrichi, nom du rôle
  plateforme : `ctx.platformRole?.name` — **confirmer le nom du champ**), fabrique
  `makeStaff("STAFF_PRINTER" | "STAFF_ADMIN" | …)`, e2e `createTestStaff({ scope, role })` /
  `TestStaffRole` acceptant les clés de rôles système dont `STAFF_PRINTER`.
- Produces :
  - `requirePlatformPage(permission: Permission): Promise<{ userId: string; permissions: Set<Permission> }>`
    — redirige vers `/login?callbackUrl=…` sans session, vers `/platform` si la permission manque
    (`redirect` de `next/navigation`) ;
  - `permissionDenied(userId: string, permission: Permission, target?: PermissionTarget): Promise<NextResponse | null>`
    — `null` si autorisé, sinon la réponse 403 `{ error: "PERMISSION_DENIED" }` (cible par défaut
    `{ kind: "platform" }`) ; sert aux seconds contrôles dans les handlers.

- [ ] **Step 1: Contrôler le socle.** Lire `src/lib/permissions/index.ts`, `auth-guards.ts`,
  `with-staff-auth.ts`, `user-context.ts`, `src/test/factories.ts`, `e2e/helpers/db.ts`,
  `src/lib/print-requests/{credit-view,onsite-station-view}.ts` : relever les signatures réelles
  (type de `permissions` passé aux fonctions pures : `ReadonlySet` ou tableau). Si un contrat
  consommé par ce plan manque ou diffère, **s'arrêter et le signaler** (`NEEDS_CONTEXT`). Vérifier
  aussi que `make test` tourne dans le worktree (base `badge_2a_test`).
- [ ] **Step 2: Écrire les tests** `page-guard.test.ts` (redirige sans session ; redirige vers
  `/platform` pour un `STAFF_PRINTER` demandant `organizations.read` ; renvoie les permissions
  pour `STAFF_ADMIN`) avec `makeStaff` et la session NextAuth mockée ; `permissionDenied` (`null`
  pour SA, 403 pour OB sur `organizations.update`, cible événement honorée).
- [ ] **Step 3: Implémenter** les deux helpers ci-dessus.
- [ ] **Step 4: Squelette de la matrice** `permission-matrix.test.ts` : un tableau
  `ROWS: { route: string; method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE"; params?: Record<string,string>; permission: Permission; allowed: StaffKey[] }[]`
  (`StaffKey` = `SUPER_ADMIN|STAFF_ADMIN|STAFF_SUPPORT|STAFF_PRINTER|STAFF_OBSERVER`, déduit des
  abréviations SA AD SU PR OB de la spec 37) et la boucle : pour chaque ligne, 401 sans session ;
  403 pour un non-staff et pour chaque rôle hors `allowed` ; pour chaque rôle de `allowed`, la
  réponse n'est **ni 401 ni 403** (le handler est appelé avec des identifiants inexistants et un
  corps vide : il répond 400/404). Chaque tâche suivante **ajoute ses lignes** à ce tableau.
  Importer les handlers dynamiquement (`await import(...)`).
- [ ] **Step 5: Lancer** `make test FILE=src/app/platform/__tests__/page-guard.test.ts` puis le
  fichier matrice (Expected : PASS). Commit `test(plateforme): helpers de garde et matrice de refus`.

---

### Task 2: Shell, layout et tableau de bord filtrés (STAFF_PRINTER)

**Files:**
- Modify: `src/components/staff/StaffShell.tsx`, `src/app/platform/layout.tsx`,
  `src/app/platform/page.tsx`, `src/lib/platform-settings-tabs.ts` (seulement `hasAnySettingsTab`,
  voir Task 5), `src/middleware.ts` (vérification uniquement)
- Create: `src/app/platform/_components/PrintDashboardBlock.tsx`
- Test: `src/components/staff/__tests__/StaffShell.test.tsx`, `src/app/platform/__tests__/dashboard.test.tsx`

**Interfaces:**
- Produces : `buildStaffNav(permissions: ReadonlySet<Permission>, pendingPrintRequests: number): NavEntry[]`
  (exportée) et `StaffShell` avec la prop `user: { name; email; roleName: string }` + `permissions: ReadonlySet<Permission>`
  (remplace `user.staffRole`).

Entrées du menu et permission requise (une entrée absente si la permission manque ; un groupe
sans entrée visible disparaît) :

| Entrée | Permission |
|---|---|
| Tableau de bord, Notifications | `platform.access` |
| Organisations | `organizations.read` |
| Profils | `profiles.read` |
| Plans | `plans.read` |
| Paiements | `payments.read` |
| Utilisateurs (page : lot 2c) | `users.read` |
| Templates de badge | `badge_templates.read` |
| Impression › Commandes / Planches / Gabarits / Catalogue | `print.requests.read` / `print.sheets.read` / `print.layouts.read` / `print.catalog.read` |
| Plateforme › Emails | `email_jobs.read` |
| Plateforme › Paramètres | au moins un onglet visible (`hasAnySettingsTab`) |
| Plateforme › Journal | `activity.read` |
| Plateforme › **Rôles** (`/platform/roles`, icône `shield`, après Journal) | `platform.roles.manage` |

- [ ] **Step 1: Tests `StaffShell`** (remplacer le test « Paiements pour tout rôle ») : pour chaque
  rôle système, jeu de permissions d'après la spec 37 ; assertions : `STAFF_PRINTER` voit
  Tableau de bord, Notifications et les 4 entrées Impression, **rien d'autre** (ni Organisations,
  ni Paiements, ni groupe « Plateforme ») ; `STAFF_OBSERVER` ne voit pas « Planches » (corrige
  l'écart du menu) ; seul `SUPER_ADMIN` voit « Rôles » ; le libellé du rôle affiché est `roleName`.
- [ ] **Step 2: Implémenter** `buildStaffNav` et l'adaptation du shell (la prop `staffRole` et
  `ROLE_LABEL` disparaissent).
- [ ] **Step 3: Layout** : `requirePlatformPage("platform.access")`-équivalent (le layout redirige
  vers `/` si la permission manque ou si `ctx` est nul), charge les permissions via
  `loadPermissions(userId, { kind: "platform" })`, passe `roleName` ; ne calcule la pastille
  `pendingPrintRequests` (3 requêtes) que si `print.requests.read`.
- [ ] **Step 4: Tableau de bord** (`page.tsx`) : blocs KPI, top organisations par `organizations.read` ;
  « Activité récente » par `activity.read` ; pour un porteur de `print.requests.read` ou
  `print.sheets.read` sans `organizations.read` (Imprimeur) afficher `PrintDashboardBlock`
  (commandes à traiter via `getSubmittedPrintRequestCount`, planches à générer via
  `countOrdersToGenerate`, avec liens vers `/platform/print/orders` et `/platform/print/sheets`).
  Test `dashboard.test.tsx` (RTL, base réelle) : OB voit les KPI sans bloc impression ; PR voit
  le bloc impression et pas les KPI ; aucun bloc vide pour un rôle sans rien.
- [ ] **Step 5: Middleware** : relire `src/middleware.ts` (`token.isStaff`) ; aucun changement
  attendu. Vérifier à la main (e2e en Task 11) qu'un Imprimeur (`isStaff` vrai) passe. S'il
  fallait modifier le middleware, s'arrêter et signaler (le JWT est fixé par le socle).
- [ ] **Step 6: Lancer** `make test FILE=src/components/staff/__tests__/StaffShell.test.tsx`,
  `make typecheck`. Commit `feat(plateforme): menu et tableau de bord filtres par permission`.

---

### Task 3: Organisations, abonnements, plans

**Files:**
- Modify (API) : `src/app/api/platform/organizations/route.ts`, `organizations/[orgId]/route.ts`,
  `organizations/[orgId]/archive/route.ts`, `…/restore/route.ts`, `…/subscription/route.ts`,
  `plans/route.ts`, `plans/[planId]/route.ts`
- Modify (UI) : `src/app/platform/organizations/page.tsx`, `organizations/new/page.tsx`,
  `organizations/[orgId]/{layout,page,OrgDetailActions,subscription/page,events/page,activity/page,members/page}`,
  `src/app/platform/plans/page.tsx`, `src/components/staff/{PlanManager,SubscriptionForm,OrganizationsTable}.tsx`
- Test : `__tests__` voisins de chaque route, `PlanManager.test.tsx`, tests lib `api-staff-organizations*.test.ts`, `api-platform-plans.test.ts`

| Route / méthode | Permission | Autorisés (spec 37) |
|---|---|---|
| `organizations` GET, `[orgId]` GET | `organizations.read` | SA AD SU OB |
| `organizations` POST | `organizations.create` | SA AD |
| `[orgId]` PATCH | `organizations.update` | SA AD |
| `[orgId]` DELETE | `organizations.delete` | SA |
| `[orgId]/archive`, `/restore` POST | `organizations.archive` | SA AD |
| `[orgId]/subscription` PUT | `subscriptions.update` | SA AD |
| `plans` GET | `plans.read` | SA AD SU OB |
| `plans` POST, `plans/[planId]` PATCH | `plans.manage` | SA AD |

- [ ] **Step 1: Tests d'abord** : ajouter ces lignes à la matrice (Task 1) ; remplacer dans les
  tests existants les créations `prisma.user.create({ staffRole })` par `makeStaff(clé)` ;
  ajouter un cas par route « rôle sans la permission → 403 et aucune écriture en base »
  (ex. `STAFF_SUPPORT` ne crée pas d'organisation, OB n'archive pas, AD ne supprime pas).
- [ ] **Step 2: Migrer les 7 routes** vers `withStaffAuth(handler, { permission })`.
- [ ] **Step 3: Pages, composants** (chaque `canX` = la clé de la route) :
  `organizations/page.tsx` : bouton « Créer une organisation » seulement avec
  `organizations.create` ; `organizations/new` : `requirePlatformPage("organizations.create")` ;
  `[orgId]/layout.tsx` : `requirePlatformPage("organizations.read")` à la place de `requireStaff` ;
  `OrgDetailActions` : props `canArchive` (`organizations.archive`) et `canDelete`
  (`organizations.delete`) — **corrige l'écart « archivage visible sans droit »** ; page
  abonnement : lien « Gérer » et `SubscriptionForm` (nouvelle prop `canEdit`, champs désactivés
  et bouton masqué sinon) selon `subscriptions.update` ; `plans/page.tsx` :
  `requirePlatformPage("plans.read")`, `PlanManager` reçoit `canManage` (`plans.manage`) et masque
  création/édition/archivage sinon ; pages `events`, `members`, `activity` de l'organisation :
  `requirePlatformPage("organizations.read")`. `PlatformOrgMemberInviteForm` (2c) n'est pas
  modifié : en lecture seule, ne pas le rendre si le lot 2c n'a pas ajouté de prop — signaler
  dans le rapport.
- [ ] **Step 4: Tests UI** : `PlanManager.test.tsx` (sans `canManage` aucun bouton d'écriture),
  test de `OrgDetailActions` (RTL) pour les trois combinaisons de props.
- [ ] **Step 5: e2e** : adapter `organizations-list`, `organization-detail`, `organization-new`,
  `organization-subscription`, `organization-members`, `plans`, `subscription-flow` : l'OB ne voit
  ni « Créer une organisation », ni « Archiver », ni formulaire d'abonnement ; `STAFF_SUPPORT`
  ne voit pas « Créer » ; AD n'a pas « Supprimer ».
- [ ] **Step 6: Lancer** les tests Vitest touchés + `make test-e2e FILE=e2e/platform/organizations-list.spec.ts`
  (puis les autres specs de la tâche). Commit `feat(plateforme): organisations, abonnements et plans par permission`.

---

### Task 4: Profils et listes de blocage

**Files:**
- Modify : `src/app/api/platform/profiles/route.ts`, `profiles/[userId]/route.ts`,
  `…/approve/route.ts`, `…/reject/route.ts`, `blocked-emails/route.ts`, `blocked-emails/[id]/route.ts`,
  `blocked-documents/route.ts`, `blocked-documents/[id]/route.ts`,
  `src/app/platform/profiles/page.tsx`, `profiles/[userId]/page.tsx`
- Test : `__tests__` des routes `blocked-*`, `api-platform-profiles.test.ts`, `e2e/platform/profiles.spec.ts`, `profile-detail.spec.ts`

| Route / méthode | Permission | Autorisés |
|---|---|---|
| `profiles` GET, `profiles/[userId]` GET | `profiles.read` | SA AD SU OB |
| `profiles/[userId]/approve`, `/reject` POST | `profiles.review` | SA AD SU |
| `blocked-emails` GET, `blocked-documents` GET | `blocklist.read` | SA AD SU OB |
| `blocked-*` POST, `blocked-*/[id]` DELETE | `blocklist.manage` | SA AD SU |

- [ ] **Step 1: Tests** : lignes de matrice ; migrer les helpers `asStaff` des tests vers
  `makeStaff` ; cas « `STAFF_PRINTER` → 403 sur `profiles` GET » et « OB → 403 sur approve ».
- [ ] **Step 2: Migrer les 8 routes.**
- [ ] **Step 3: Pages** : `profiles/page.tsx` → `requirePlatformPage("profiles.read")` ;
  `profiles/[userId]/page.tsx` : même garde, `canDecide` = `profiles.review` (supprime la lecture
  de `staffRole`).
- [ ] **Step 4: e2e** : OB consulte un profil sans boutons d'approbation ; Imprimeur redirigé
  vers `/platform` en URL directe.
- [ ] **Step 5: Lancer** les tests ; commit `feat(plateforme): profils et blocage par permission`.

---

### Task 5: Paramètres, motifs de rejet, templates de badge

**Files:**
- Modify (API) : `settings/route.ts`, `settings/badge/route.ts`, `settings/onsite-print/route.ts`,
  `settings/test-smtp/route.ts`, `rejection-reasons/route.ts`, `rejection-reasons/[id]/route.ts`,
  `badge-templates/route.ts`, `badge-templates/[id]/route.ts`, `badge-templates/inspect/route.ts`
  (tous sous `src/app/api/platform/`)
- Modify (UI) : `src/lib/platform-settings-tabs.ts`, `src/app/platform/settings/page.tsx`,
  `settings/badge/page.tsx`, `badge-templates/page.tsx`, `badge-templates/[id]/page.tsx`,
  `src/components/staff/{PlatformSettingsForm,TestSmtpForm,SubscriptionRightsForm,OnsitePrintSettingsForm,RejectionReasonsManager,BadgeTemplateInstaller,BadgeTemplateArchiveButton}.tsx`
- Test : tests voisins des routes, `src/lib/__tests__/platform-settings-tabs.test.ts`,
  `api-staff-settings.test.ts`, `api-platform-rejection-reasons.test.ts`, `api-platform-settings-onsite-print.test.ts`, `SubscriptionRightsForm.test.tsx`

| Route / méthode | Permission | Autorisés |
|---|---|---|
| `settings` GET | `settings.read` | SA AD SU OB |
| `settings` PATCH | base `settings.read` puis **par champ** (ci-dessous) | — |
| `settings/badge` PATCH | `settings.badge_template.update` | SA AD |
| `settings/onsite-print` PATCH | `settings.onsite_print.update` | SA AD |
| `settings/test-smtp` POST | `settings.smtp.test` | SA AD |
| `rejection-reasons` GET | `rejection_reasons.read` | SA AD SU OB |
| `rejection-reasons` POST, `[id]` PATCH/DELETE | `rejection_reasons.manage` | SA AD |
| `badge-templates` GET | `badge_templates.read` | SA AD SU OB |
| `badge-templates` POST, `[id]` PATCH, `inspect` POST | `badge_templates.manage` | SA AD |

PATCH `settings`, contrôle par champ avant toute écriture : `smtpPassword` / `recaptchaSecretKey`
non vides → `settings.secrets.update` (403 `FORBIDDEN_SECRET_CHANGE`, comportement actuel
conservé) ; `subscriptionRights` → `settings.subscription_rights.update` ; tout autre champ →
`settings.update`. Le contrôle remplace la lecture de `staffRole !== "SUPER_ADMIN"`.

- [ ] **Step 1: Tests d'abord** : matrice (PATCH `settings` ligne de base ; `test-smtp`, etc.) ;
  tests dédiés au PATCH mixte avec **utilisateur à rôle personnalisé** (créé via la fabrique de
  rôle du socle) : `settings.update` seul + secret → 403 `FORBIDDEN_SECRET_CHANGE`, base inchangée ;
  `settings.update` seul + `subscriptionRights` → 403 `PERMISSION_DENIED`, rien écrit ;
  AD avec champs non secrets → 200 ; SA avec secret → 200 (journal `smtpPasswordChanged`).
  `platform-settings-tabs.test.ts` : nouvelle signature (voir Step 3).
- [ ] **Step 2: Migrer les 9 routes** (`settings/badge` et `badge-templates/**` quittent
  `requireStaff` + bloc `try/catch AuthError` pour `withStaffAuth` ; le PATCH `settings` utilise
  `permissionDenied`).
- [ ] **Step 3: `platform-settings-tabs.ts`** : chaque onglet porte sa permission de lecture
  (`email`, `security`, `subscriptions` → `settings.read` ; `reasons` → `rejection_reasons.read` ;
  `badge` → `settings.badge_template.update` ; `onsite-print` → `settings.onsite_print.update`).
  Exports : `visibleSettingsTabs(permissions)`, `resolveSettingsTab(raw, permissions)`,
  `hasAnySettingsTab(permissions)` (remplacent le booléen `isStaffAdmin`).
- [ ] **Step 4: Page paramètres** : `requirePlatformPage` puis redirection `/platform` si aucun
  onglet visible ; `PlatformSettingsForm` reçoit `canEdit` (`settings.update`) et `canEditSecrets`
  (`settings.secrets.update`) — **corrige l'écart : formulaires éditables pour OB/SU** ;
  `TestSmtpForm` rendu seulement avec `settings.smtp.test` ; `SubscriptionRightsForm.canManage` =
  `settings.subscription_rights.update` ; `RejectionReasonsManager.canManage` =
  `rejection_reasons.manage` ; formulaire d'impression sur place seulement avec
  `settings.onsite_print.update`. Pages `badge-templates` : garde `badge_templates.read`,
  `canInstall` = `badge_templates.manage`.
- [ ] **Step 5: e2e** : adapter `settings.spec.ts` (OB : onglets « E-mails », « Sécurité »,
  « Abonnements » en lecture seule, motifs sans bouton, pas de « Badge » ni « Impression sur place »,
  pas de test SMTP) et `badge-templates.spec.ts`.
- [ ] **Step 6: Lancer** les tests ; commit `feat(plateforme): parametres, motifs et templates par permission`.

---

### Task 6: Jobs e-mail, journal, upload, paiements

**Files:**
- Modify : `src/app/api/platform/jobs/route.ts`, `jobs/[jobId]/route.ts`, `jobs/[jobId]/cancel/route.ts`,
  `jobs/[jobId]/retry/route.ts`, `activity/route.ts`, `upload/route.ts`,
  `src/app/platform/payments/page.tsx`, `payments/[paymentId]/page.tsx`,
  `payments/[paymentId]/receipt/route.ts`, `src/app/platform/jobs/page.tsx`, `jobs/[jobId]/page.tsx`,
  `activity/page.tsx`, `activity/[logId]/page.tsx`, `src/app/platform/notifications/page.tsx` (aucune permission ajoutée : `platform.access`)
- Test : `jobs-api.test.ts`, `upload/__tests__/route.test.ts`, `receipt/__tests__/route.test.ts`, `api-staff-activity.test.ts`

| Route | Permission | Autorisés |
|---|---|---|
| `jobs` GET, `jobs/[jobId]` GET | `email_jobs.read` | SA AD SU OB |
| `jobs/[jobId]/cancel`, `/retry` POST | `email_jobs.manage` | SA AD |
| `activity` GET | `activity.read` | SA AD SU OB |
| `payments/[paymentId]/receipt` GET (route de page) | `payments.read` | SA AD SU OB |
| `upload` POST, contexte `print-product` | `print.catalog.manage` | SA AD |
| `upload` POST, contexte `print-request` | `print.requests.messages.send` | SA AD PR |

`upload` : `withStaffAuth(…, { permission: "platform.access" })`, puis `permissionDenied(userId,
<clé du contexte>)` après le choix du contexte (remplace `requireStaff` et le drapeau `admin`).

- [ ] **Step 1: Tests** : matrice (deux lignes pour `upload` : contexte dans la requête) ; adapter
  les tests existants à `makeStaff` ; `STAFF_SUPPORT` n'envoie plus de pièce jointe de commande
  (403) mais `STAFF_PRINTER` oui.
- [ ] **Step 2: Migrer** routes et route de reçu (`requireStaff` → `requirePermission`/garde).
- [ ] **Step 3: Pages** : `jobs` (`email_jobs.read`, `canAdmin` = `email_jobs.manage`), `activity`
  (`activity.read` ; la page de détail lit le libellé du rôle via la relation `platformRole` du
  socle à la place de `staffRole`), `payments` (`payments.read`).
- [ ] **Step 4: e2e** : adapter `jobs`, `activity`, `payments`, `notifications` (Imprimeur : Journal
  et Emails absents du menu, URL directe redirigée).
- [ ] **Step 5: Lancer** les tests ; commit `feat(plateforme): jobs, journal, upload et paiements par permission`.

---

### Task 7: Impression — commandes et poste sur place

**Files:**
- Modify (API, sous `src/app/api/platform/print/requests/`) : `route.ts`, `[requestId]/route.ts`,
  `items`, `messages`, `reject`, `reopen`, `send-quote`, `lines`, `lines/[lineId]`, `mark-paid`,
  `credit`, `status`, `onsite/lookup`, `onsite/search`, `onsite/print`, `onsite/margin`
- Modify (lib) : `src/lib/print-requests/staff-api.ts` (ajout de `eventTargetOf`)
- Modify (UI) : `src/app/platform/print/orders/page.tsx`, `orders/[requestId]/page.tsx`,
  `orders/[requestId]/onsite/page.tsx`, `src/components/staff/print/{request-actions.ts,RequestDetail,RequestStatusActions,RequestCreditPanel,OnsiteRequestPanel,OnsiteMarginForm,QuoteEditor,RequestList}.tsx`,
  `src/components/staff/print/order/OrderQuoteColumn.tsx`
- Test : `api-platform-print-requests.test.ts`, `-credit`, `-onsite`, `items/__tests__/route.test.ts`,
  `request-actions.test.ts`, `OrderSheetPanel.test.tsx`

**Interfaces:**
- Produces : `eventTargetOf(r: { eventId: string; orgId: string }): PermissionTarget`
  (`{ kind: "event", eventId, orgId }`, à moins que le socle n'en exporte déjà un : le réutiliser).
- Consumes : `canApplyCredit`, `canSetOnsiteMargin`, `canOpenOnsiteStation` (socle, signatures
  par permissions — relevées en Task 1), `requestUrl` (lecture seule).

| Route / méthode | Permission | Autorisés |
|---|---|---|
| `requests` GET, `[id]` GET, `items` GET, `messages` GET | `print.requests.read` | SA AD PR OB |
| `messages` POST | `print.requests.messages.send` | SA AD PR |
| `reject` POST | `print.requests.reject` | SA AD PR |
| `reopen` POST | `print.requests.reopen` | SA AD |
| `send-quote` POST | `print.requests.quote.send` | SA AD |
| `lines` POST, `lines/[lineId]` PATCH/DELETE | `print.requests.quote.edit` | SA AD |
| `mark-paid` POST | `print.requests.mark_paid` | SA AD |
| `credit` POST | `print.requests.credit.apply` | SA AD |
| `status` POST | `print.requests.advance` ; `to = COMPLETED` sur commande `ONSITE` : `print.requests.onsite.complete` à la place | SA AD PR ; SA AD |
| `onsite/margin` PATCH | `print.onsite.margin.update` | SA AD |
| `onsite/lookup`, `search`, `print` | `platform.access` puis `print.onsite.operate` sur `eventTargetOf(request)` | SA AD PR |

Arbitrage à journaliser dans la spec 37 : le catalogue décrit `messages.send` comme « lire et
écrire le fil » ; pour ne pas retirer à l'Observateur la lecture qu'il a aujourd'hui (anti-
régression), **`GET messages` est gardé par `print.requests.read`**, seul l'envoi par
`messages.send`. La clôture d'une commande sur place conserve l'erreur `STAFF_FORBIDDEN` (403)
existante quand `onsite.complete` manque.

- [ ] **Step 1: Tests d'abord** : matrice (la ligne `status` en deux variantes, ADVANCE et ONSITE
  `COMPLETED`) ; tests dédiés : `STAFF_PRINTER` fait lookup/search/print sur l'évènement d'une
  commande sur place, `STAFF_SUPPORT` reçoit 403 ; lookup d'une commande inexistante → 404 pour
  tous les rôles autorisés ; `STAFF_PRINTER` clôture une commande ADVANCE (200) mais pas une
  commande sur place (403 `STAFF_FORBIDDEN`) ; `request-actions.test.ts` réécrit avec des
  permissions (ex. `availableActions("SUBMITTED", type, perms)`).
- [ ] **Step 2: Migrer les 16 routes** ; `status` : `withStaffAuth(…, { permission: "print.requests.advance" })`
  et, pour `ONSITE` + `COMPLETED`, `hasPermission(ctx, "print.requests.onsite.complete", { kind: "platform" })`
  à la place de `staffRoleAtLeast` (supprime `loadUserContext(...)!`/`ctx.staffRole!`) ; onsite
  lookup/search/print : après `loadStaffRequest`, `permissionDenied(userId, "print.onsite.operate", eventTargetOf(request))`.
- [ ] **Step 3: `request-actions.ts`** : `ACTION_ROLE` devient `ACTION_PERMISSION`
  (`SEND_QUOTE`→`quote.send`, `REJECT`→`reject`, `REOPEN`→`reopen`, `MARK_PAID`→`mark_paid`,
  `START_PRODUCTION`/`MARK_READY`/`COMPLETE`→`advance` ; **`COMPLETE` sur `ONSITE` exige
  `onsite.complete`** : corrige l'écart où l'UI proposait « Terminer » à un rôle que l'API
  refusait) ; `availableActions(status, type, permissions)`, `canEditQuote(status, permissions)`
  (`quote.edit`), `canGenerateSheets(status, type, permissions)` (`print.sheets.generate`).
- [ ] **Step 4: Pages et composants** : les pages `orders*` appellent `requirePlatformPage("print.requests.read")`
  (la liste), la fiche charge `permissions` (cible plateforme) **et** `canOperateOnsite`
  (`hasPermission` `print.onsite.operate` sur l'évènement de la commande, `eventId` ajouté au
  `select`) ; `RequestDetail`, `RequestStatusActions`, `RequestCreditPanel`, `OnsiteRequestPanel`,
  `OrderQuoteColumn` reçoivent `permissions: Permission[]` (+ `canOperateOnsite`) à la place de
  `role: StaffRole` ; `canPost` = `print.requests.messages.send` ; le lien de planche masqué à
  l'Observateur (`role === "STAFF_OBSERVER"`) devient `print.sheets.read` ; produits de la modale
  de devis chargés seulement avec `quote.edit`. Page `onsite` : garde `canOperateOnsite` (sinon
  redirection vers la fiche), et passe à `OnsiteStation` les props `apiBase`
  (`/api/platform/print/requests/${requestId}/onsite`) et `backHref` (`/platform/print/orders/${requestId}`)
  — valeurs exactes à confirmer sur la signature du socle.
- [ ] **Step 5: e2e** : adapter `print-requests`, `print-request-detail`, `print-request-onsite` :
  parcours de production par `STAFF_PRINTER` (démarrer, prête, terminer une commande en amont),
  poste sur place par PR, absence de « Marge », « Envoyer le devis », « Marquer payée » pour PR ;
  l'Observateur lit la fiche et le fil sans zone de saisie.
- [ ] **Step 6: Lancer** les tests Vitest et `make test-e2e FILE=e2e/platform/print-request-onsite.spec.ts` ;
  commit `feat(plateforme): commandes d'impression et poste sur place par permission`.

---

### Task 8: Impression — catalogue, gabarits, planches (gardes)

**Files:**
- Modify (API, sous `src/app/api/platform/print/`) : `products/route.ts`, `products/[productId]/route.ts`,
  `…/images`, `…/options`, `…/tiers`, `layouts/route.ts`, `layouts/[layoutId]/route.ts`,
  `sheets/route.ts`, `sheets/[generationId]/route.ts`, `sheets/options/route.ts`, `sheets/orders/route.ts`
- Modify (UI) : `src/app/platform/print/catalog/page.tsx`, `catalog/[productId]/page.tsx`,
  `layouts/page.tsx`, `layouts/new/page.tsx`, `layouts/[layoutId]/page.tsx`,
  `sheets/sheets-data.ts`, `sheets/{page,layout}.tsx` et sous-pages, `src/components/staff/print/{GenerationForm,CatalogList,ProductEditor}.tsx`
- Test : `api-platform-print-products.test.ts`, `-product-content`, `-layouts`, `api-print-catalog.test.ts`, `api-platform-print-sheets-options.test.ts`, `print-sheets-generations.test.ts`

| Route / méthode | Permission | Autorisés |
|---|---|---|
| `layouts` GET | `print.layouts.read` | SA AD PR OB |
| `layouts` POST, `[id]` PATCH/DELETE | `print.layouts.manage` | SA AD |
| `products` POST, `[id]` PATCH/DELETE, `images`/`options`/`tiers` PUT | `print.catalog.manage` | SA AD |
| `sheets` GET, `sheets/[generationId]` GET, `sheets/orders` GET | `print.sheets.read` | SA AD PR |
| `sheets` POST, `sheets/options` GET | `print.sheets.generate` | SA AD PR |

- [ ] **Step 1: Tests d'abord** : matrice ; adapter les tests existants à `makeStaff` ; cas
  `STAFF_SUPPORT` → 403 sur `sheets` (il perd les planches) ; `STAFF_PRINTER` génère une planche
  par commande (200/201) mais n'écrit ni gabarit ni produit.
- [ ] **Step 2: Migrer les 11 routes.**
- [ ] **Step 3: Pages** : `sheets-data.ts` `requireSheetsStaff` → `requirePlatformPage("print.sheets.read")` ;
  les sous-pages passent `canGenerate` (`print.sheets.generate`) à `OrderQueueTable` et
  `GenerationForm` (boutons « Générer »/« Regénérer » absents sinon) ; catalogue :
  `requirePlatformPage("print.catalog.read")`, `canWrite` = `print.catalog.manage` (remplace
  `staffRoleAtLeast` dans les deux pages) ; gabarits : `requirePlatformPage("print.layouts.read")`,
  `canWrite` via `canWriteLayouts()` du socle (déjà par permission).
- [ ] **Step 4: e2e** : `print-catalog*`, `print-layouts`, `print-sheets` (le test « STAFF_OBSERVER
  est redirigé » devient « l'Observateur n'a pas l'entrée Planches et est redirigé en URL
  directe » ; le test de génération utilise `STAFF_PRINTER`).
- [ ] **Step 5: Lancer** les tests ; commit `feat(plateforme): catalogue, gabarits et planches par permission`.

---

### Task 9: `/api/files` par permission

**Files:**
- Modify: `src/app/api/files/[...path]/route.ts`
- Test: `src/app/api/files/__tests__/files-route.test.ts`

Règles (spec 37, « Fichiers sensibles ») ; `hasPermission(ctx, clé, cible)` sur le contexte chargé,
**plus aucun passe-droit `ctx.isStaff`** :

| Classe de clé | Règle |
|---|---|
| `print-sheets/*` | `print.sheets.read` (plateforme) |
| `print-requests/{eventId}/…`, `print-requests/staff/{requestId}/…` | `print.requests.read` (plateforme) **ou** `print.request` sur l'évènement (de la clé, ou de la commande nommée par la clé) |
| autre forme `print-requests/…` | `print.requests.read` seulement |
| `badge-exports/{eventId}/…` | `badge.print` sur l'évènement |
| `events/{id}/idDocuments/…` | `event.read.detailed` sur l'évènement |
| `profile/{uid}/documents/…` | propriétaire **ou** `profiles.read` (plateforme) |

- [ ] **Step 1: Réécrire le tableau de tests** par classe × rôle : `STAFF_PRINTER` lit planches,
  pièces de commande et exports, pas les `idDocuments` ni les documents de profil ; `STAFF_OBSERVER`
  lit pièces de commande, `idDocuments` et profils, pas planches ni exports ; `STAFF_SUPPORT` lit
  `idDocuments` et profils (et les pièces de commande via `print.request` de l'évènement) ; un
  OWNER d'organisation lit les `idDocuments` de ses évènements, pas ceux d'une autre organisation ;
  non connecté → 403 ; clé inconnue d'une commande → 403 ; clé publique → 200 sans session.
- [ ] **Step 2: Migrer** `canRead` et `canReadPrintRequestFile` (types `SensitiveFile` conservés,
  les drapeaux `staffOnly`/`staffAny` deviennent des clés de permission).
- [ ] **Step 3: Lancer** `make test FILE=src/app/api/files/__tests__/files-route.test.ts` (PASS,
  couverture 100 % du fichier) ; commit `feat(fichiers): lecture des fichiers sensibles par permission`.

---

### Task 10: Spec 38 — loader des planches en génération

**Files:**
- Modify: `src/lib/print-sheets/order-queue.ts`, `src/components/staff/print/sheets/OrderQueueTable.tsx`,
  `src/components/staff/print/sheets/GenerateOrderSheetDialog.tsx` (libellé seulement si besoin),
  `src/components/staff/print/GenerationList.tsx`
- Create: `src/components/staff/print/sheets/GenerationStatePill.tsx`,
  `src/components/staff/print/sheets/transitions.ts`
- Test: `src/lib/print-sheets/__tests__/order-queue-active.test.ts` (+ adaptation de
  `src/lib/__tests__/print-order-queue.test.ts`), `src/components/staff/print/sheets/__tests__/{transitions.test.ts,OrderQueueTable.test.tsx,GenerationStatePill.test.tsx}`,
  `e2e/platform/print-sheets.spec.ts`

**Interfaces:**
- Produces :
  - `GenerationStatePill({ status: "PENDING"|"RUNNING"|"DONE"|"FAILED"; doneLabel: string; error?: string | null })` :
    `PENDING` → spinner (`Spinner` de `ui/Feedback`, `role="status"`) + « En attente… » ;
    `RUNNING` → spinner + « Génération en cours… » ; `DONE` → `doneLabel` ; `FAILED` → « Échec »
    + `error ?? "Erreur inconnue."` ;
  - `detectTransitions(prev: OrderQueueRow[], next: OrderQueueRow[]): { ready: OrderQueueRow[]; failed: OrderQueueRow[] }`
    — lignes dont la planche était `PENDING|RUNNING` et est devenue `DONE` / `FAILED`.
- Écart de vocabulaire de la spec 38 : l'énumération réelle est `PrintSheetGenerationStatus`
  (`DONE`, pas `COMPLETED`) ; l'onglet existant s'appelle « À traiter » (la spec écrit « À
  générer ») : **libellés et énumération du code conservés**, à journaliser dans la spec 38.

Comportement retenu : **« À traiter » = commandes sans planche, ou dont la génération n'est pas
`DONE`** (`PENDING`, `RUNNING`, `FAILED`) ; elles quittent l'onglet à `DONE` seulement.
« Générées » inchangé (toute génération). Le compteur de l'onglet suit la même règle.

- [ ] **Step 1: Tests lib d'abord** (`order-queue-active.test.ts`, base réelle, `makePrintOrder` /
  `makePrintGeneration`) : une commande payée avec génération `RUNNING` reste dans
  `listOrdersToGenerate` avec `sheet.status === "RUNNING"` ; `PENDING` idem ; `FAILED` idem ;
  `DONE` en sort ; `countOrdersToGenerate` aligné ; `listOrdersWithSheet` inchangé. Adapter
  `print-order-queue.test.ts` (l'ancien cas « FAILED → Générées seulement »).
- [ ] **Step 2: Implémenter** dans `order-queue.ts` la clause
  `OR: [{ generation: { is: null } }, { generation: { is: { status: { not: "DONE" } } } }]` pour
  la file « À traiter » et le compteur.
- [ ] **Step 3: Tests composants d'abord** : `GenerationStatePill` (les 4 états ; spinner présent
  seulement pour `PENDING`/`RUNNING`) ; `transitions.test.ts` (RUNNING→DONE, PENDING→FAILED,
  inchangé, ligne absente) ; `OrderQueueTable.test.tsx` (`fetch` mocké = service externe autorisé,
  `vi.useFakeTimers`) : une ligne `RUNNING` affiche « Génération en cours… », son bouton
  Générer/Regénérer est `disabled`, le polling toutes les 5 s tourne **en mode `pending` comme
  en mode `generated`**, s'arrête quand plus aucune ligne n'est active et ne tire pas quand
  `document.visibilityState === "hidden"` ; passage à `DONE` → `toastSuccess("Planche de {référence} prête")`
  et, en mode `pending`, `router.refresh()` ; passage à `FAILED` → `toastError` (message avec la
  référence) et le bouton « Regénérer » redevient actif.
- [ ] **Step 4: Implémenter** : colonne « État » dans les **deux** modes via `GenerationStatePill`
  (`doneLabel` « Prête ») ; `active = rows.some(isActive)` sans condition de mode ; le polling lit
  `GET /api/platform/print/sheets/orders` (liste de toutes les planches, contient les lignes
  actives de l'onglet « À traiter ») et fusionne par `mergeRows` ; bouton d'action : « Générer »
  si `sheet === null`, sinon « Regénérer », `disabled` tant que `isActive` ; `regenerate` du
  dialogue = `row.sheet !== null`. Garde-fou existant : le bouton de validation du dialogue
  garde son loader (spec 28).
- [ ] **Step 5: Historique libre** : dans `GenerationList.tsx`, la cellule « Statut » utilise
  `GenerationStatePill` (`doneLabel` « Terminée ») ; test RTL sur une ligne `RUNNING`.
- [ ] **Step 6: e2e** (`print-sheets.spec.ts`) : commande payée + génération `RUNNING` posée via
  `getDb()` (le worker ne prend que `PENDING`) → la ligne de « À traiter » montre « Génération en
  cours… », bouton désactivé ; passer la ligne en `DONE` (avec `fileKey`) via `getDb()` →
  `toast(page, "Planche de {référence} prête")` sous 10 s, la ligne disparaît de « À traiter » et
  apparaît dans « Générées » ; cas `FAILED` : pastille « Échec », message, « Regénérer » actif.
  Contrôle visuel du spinner à 375, 1024 et 1280 px (tableau sans débordement).
- [ ] **Step 7: Lancer** les tests ; commit `feat(planches): indicateur de generation en cours sur la ligne`.

---

### Task 11: e2e, doc, vérification

**Files:**
- Create: `e2e/platform/staff-printer.spec.ts`
- Modify: `e2e/platform/{access,dashboard}.spec.ts`, `docs/v4/features/roles-permissions.md`
  (section « Plateforme »), `docs/v4/features/impression-planches.md`

- [ ] **Step 1: `staff-printer.spec.ts`** (un `describe` « Platform — Imprimeur ») : connexion
  `STAFF_PRINTER` → menu limité (Tableau de bord, Notifications, Commandes, Planches, Gabarits,
  Catalogue), pas de groupe « Plateforme », pas de « Rôles » ; URL directe `/platform/organizations`,
  `/platform/settings`, `/platform/plans`, `/platform/payments`, `/platform/jobs`, `/platform/activity`
  → retour `/platform` ; fiche d'une commande payée : « Démarrer la production » visible, pas
  « Envoyer le devis » ni « Marquer payée » ; génération d'une planche de commande ; téléchargement
  du PDF (via `/api/files`). `access.spec.ts` : « Le plancher d'accès est STAFF_OBSERVER »
  devient « tout rôle porteur de `platform.access` » ; `dashboard.spec.ts` : KPI pour OB, bloc
  impression pour PR. Entrée « Rôles » visible du seul `SUPER_ADMIN` (lien vers `/platform/roles`).
- [ ] **Step 2: Contrôle visuel** : lancer l'app du worktree (`scripts/agent-stack.sh status` pour
  le port), relever à **375, 1024 et 1280 px** : menu Imprimeur, tableau de bord Imprimeur,
  fiche de commande (actions), page Planches avec spinner, page paramètres Observateur
  (lecture seule). Aucun débordement horizontal ; le menu latéral (~224 px dès `lg`) respecté.
- [ ] **Step 3: Doc** : section « Plateforme » de `roles-permissions.md` (clés → routes, écrans
  et boutons, rôles autorisés, arbitrages : `GET messages`, `settings` par champ, Observateur
  sans « Planches », Support sans planches ni production) ; `impression-planches.md` :
  sections Génération (loader, règle « À traiter ») et Droits réécrites en permissions. Lister
  par `grep -rn "STAFF_\(OBSERVER\|SUPPORT\|ADMIN\)" docs/v4/features` les autres fiches qui citent
  un rôle pour un écran plateforme et **les signaler au rapport** (hors fichiers du lot).
- [ ] **Step 4: Vérification de fin de lot** (dans le worktree) :
  `grep -rnE "minRole|staffRoleAtLeast|requireStaff|checkRole|\.staffRole|StaffRole" src/app/api/platform src/app/platform src/components/staff src/app/api/files src/lib/platform-settings-tabs.ts src/lib/print-sheets`
  hors `users/**`, `owners/**`, `roles/**`, `UserCreationForm.tsx`, `UserDetailActions` → **aucune
  ligne** ; puis `make lint && make typecheck && make test-coverage` (couverture 100 % maintenue
  sur `src/lib/**` et `src/app/api/**`) ; puis `make test-e2e` sur les specs
  `e2e/platform/*.spec.ts` **sauf** `user-*.spec.ts` (une stack à la fois, pas d'e2e en parallèle).
- [ ] **Step 5: Rapport** : fichiers touchés, résultats des commandes (sorties réelles), captures
  aux trois largeurs, points à arbitrer (propriété de `src/lib/__tests__/`, `PlatformOrgShell`),
  prêt à fusionner. Commit `docs(plateforme): section roles-permissions et planches`.

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **`eventTargetOf`** vient du socle (`@/lib/permissions`) : ne pas l'ajouter à
   `src/lib/print-requests/staff-api.ts`.
2. **Fichiers ajoutés aux exclusifs du lot** : `src/components/platform/PlatformOrgShell.tsx`
   (filtrer ses onglets de supervision par permission : Membres `organizations.read`,
   Abonnement `subscriptions.update` pour l'édition, etc.) et `src/components/platform/__tests__/`
   hors `PlatformOrgMemberInviteForm` ; `docs/v4/features/impression-planches.md`.
   `src/components/platform/PlatformOrgMemberInviteForm.tsx` reste au lot 2c (la page
   appelante, à 2a, ne change ni l'import ni les props).
3. **Tests de `src/lib/__tests__/`** qui testent du code du lot (`api-platform-*`,
   `api-staff-*` hors users, `platform-settings-tabs`, `print-order-queue`, `print-sheets-*`) :
   propriété du lot 2a.
4. Arbitrages acceptés : `GET messages` sous `print.requests.read` (envoi sous
   `print.requests.messages.send`) ; noms du code pour la spec 38 (`DONE`, onglet « À traiter »,
   file conservant `PENDING`, `RUNNING`, `FAILED`) ; pertes de droits assumées de
   `STAFF_SUPPORT` (planches, exports, production) et de l'Observateur (planches, exports).

## Amendements de la revue finale du socle (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **`memberPermissions`** est publié par le socle : `memberPermissions(ctx: UserContext, target: PermissionTarget): ReadonlySet<Permission>` (`src/lib/permissions/resolve.ts`, exporté par `@/lib/permissions`), plus `loadMemberPermissions(userId, target)` dans `src/lib/auth-guards.ts`. C'est l'ensemble effectif **sans** le rôle plateforme ni ses ajustements : les droits « côté organisateur » d'un membre. Pour un non-staff, il est égal à `effectivePermissions`. Tout contrôle « jamais le staff » ou « côté organisateur » (écriture d'une demande d'impression, acceptation de devis, paiement d'abonnement, destinataires de notification sans `includeStaff`) l'utilise **en plus** du refus de `isStaffActor`. Un staff membre d'une organisation n'agit plus côté organisateur avec ses droits plateforme.
2. **`effectivePermissions`** n'applique le rôle plateforme que si `ctx.isStaff` (invariant `isStaff = platformRoleId != null`). Le résolveur ignore les clés `reserved` d'un rôle non système ou d'un ajustement, et un `roleRef` de niveau incompatible avec la place de la membership.
3. Les quatre routes de changement de rôle (`platform/users/[userId]`, `org/[orgId]/members/[userId]`, `org/[orgId]/events/[eventId]/members/[membershipId]`, `platform/organizations/[orgId]/owners`) écrivent désormais `roleId` / `platformRoleId` en plus de la colonne d'enum (marqueur `@deprecated compat`). Le lot qui les reprend conserve cette double écriture jusqu'au plan 3.
4. `migrate-roles` ne migre que les comptes `isStaff = true`, n'écrit jamais `isStaff` et signale les lignes incohérentes (`isStaff = 0 AND staffRole IS NOT NULL`).
