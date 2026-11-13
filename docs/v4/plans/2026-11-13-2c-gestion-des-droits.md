# Vague 2 · Lot 2c — Gestion des droits et participant — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2b, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2c feat/roles-imprimeur-support-2c`. Toutes les commandes
> `make` se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`. En exécution
> automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du plan ;
> sinon aucun commit sans demande explicite. Jamais de co-auteur IA dans les messages.

**Objectif :** livrer la gestion des droits (rôles personnalisés plateforme et organisation,
ajustements par utilisateur, sélecteurs de rôle par `roleId`, garde-fous anti-escalade) et passer
les routes participant sur `requireParticipantPermission`.

**Spec :** [`specs/2026-11-13-37-v4-roles-et-permissions.md`](../specs/2026-11-13-37-v4-roles-et-permissions.md)
(sections « Gestion des droits : qui peut quoi », « Interfaces », « Participant ») et
[`specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md`](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md)
(lot 2c, table de contrôle).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Service de gestion des rôles et de leurs ajustements (`_lib`) | [x] | 2026-11-13 | Service dans src/lib/role-management/ (amendement 1). Residuels N1 (commit 4539d54) et N2 faits. Ecarts : validateRolePermissions(actor, level, keys, {keep?}) sans param target (calcule du niveau) ; updateRole/archiveRole/restoreRole prennent un RoleOwner ; applyOverrides porte aussi SELF/OWNER_PROTECTED/appartenance. |
| 2 | API rôles plateforme | [x] | 2026-11-13 | Ajouts au service : http.ts (schemas zod, parseBody), listAssignableRoles/missingPermission ; exception : un staff non membre attribue un role SYSTEME d'organisation (STAFF_ADMIN doit pouvoir donner OWNER). |
| 3 | API rôles d'organisation | [x] | 2026-11-13 | orgId du chemin impose ; assignable accepte eventId optionnel (cible evenement). |
| 4 | API d'ajustements de permissions (plateforme et organisation) | [x] | 2026-11-13 | SELF/OWNER_PROTECTED/appartenance portes par applyOverrides ; GET org renvoie levels[1]. |
| 5 | API utilisateurs et propriétaires plateforme par `roleId` | [x] | 2026-11-13 | owners POST: roleId optionnel (OWNER par defaut). Anciens tests api-staff-users-{post,detail} reecrits. withRoleErrors traduit aussi AuthError. notifications.ts (role-management) pour roles sans enum. Journal: from/to = cle systeme sinon nom. |
| 6 | API membres d'organisation et d'évènement par `roleId` | [ ] | | |
| 7 | Routes participant | [ ] | | |
| 8 | Composants `src/components/permissions/**` | [ ] | | |
| 9 | Pages `/platform/roles` et `/org/[orgId]/roles` | [ ] | | |
| 10 | Pages d'ajustement et liens d'entrée | [ ] | | |
| 11 | Formulaires et pages de membres / utilisateurs | [ ] | | |
| 12 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables (et leurs `__tests__` colocalisés) :

- API : `src/app/api/platform/roles/**` (nouveau), `src/app/api/platform/users/**`,
  `src/app/api/platform/organizations/[orgId]/owners/**`, `src/app/api/org/[orgId]/roles/**`
  (nouveau), `src/app/api/org/[orgId]/members/**`,
  `src/app/api/org/[orgId]/events/[eventId]/members/**`, `src/app/api/account/**`,
  `src/app/api/events/[slug]/register/**`.
- Pages : `src/app/platform/roles/**` (nouveau), `src/app/platform/users/**`,
  `src/app/org/[orgId]/roles/**` (nouveau), `src/app/org/[orgId]/members/**`,
  `src/app/event/[eventId]/members/**`, `src/app/account/**`.
- Composants : `src/components/permissions/**` (nouveau), `src/components/staff/UserCreationForm.tsx`,
  `src/components/admin/OrgMemberForm.tsx`, `src/components/event/MemberInviteForm.tsx`,
  `src/components/event/MemberTable.tsx`, `src/components/platform/PlatformOrgMemberInviteForm.tsx`
  (voir écart 1).
- e2e : `e2e/platform/user-*.spec.ts`, `e2e/public/**`, specs de membres (`e2e/org/members.spec.ts`,
  `e2e/event/members.spec.ts`), nouveaux `e2e/platform/roles.spec.ts`, `e2e/org/roles.spec.ts`,
  `e2e/platform/user-permissions.spec.ts`, `e2e/org/member-permissions.spec.ts`.
- Doc : section « Gestion des droits » de `docs/v4/features/roles-permissions.md` (uniquement).

**En lecture seule** : tout le socle (`prisma/schema.prisma`, `src/lib/**` dont `src/lib/permissions/**`,
`auth-guards.ts`, `with-*-auth.ts`, `auth-participant.ts`, `user-context.ts`, `activity-log.ts`,
`activity-labels.ts`, `src/test/**`, `src/test-setup.ts`, `e2e/helpers/**`), les fichiers des lots
2a et 2b (dont `StaffShell`, `OrgShell`, `EventShell`, `src/app/platform/organizations/**`),
`src/components/ui/**`. Besoin d'y toucher → **s'arrêter et le signaler**.

## Contrats du socle consommés (noms exacts)

Le socle n'est pas encore écrit : **avant la Task 1, relever dans le code fusionné les noms
exacts** ci-dessous et noter tout écart dans la colonne Notes de la Task 1.

- `src/lib/permissions/catalog.ts` : type `Permission` ; catalogue d'entrées
  `{ key, scope, domain, label, description, reserved? }` (`scope` ∈ `PLATFORM | ORG | EVENT | PARTICIPANT`).
- `src/lib/permissions/system-roles.ts` : définition des rôles système (clés `SUPER_ADMIN`,
  `STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_PRINTER`, `STAFF_OBSERVER`, `OWNER`, `MANAGER`, `AUDITOR`,
  `AGENT`, `ADMIN`, `OPERATOR`, `PRINTER`, `VIEWER`, `PARTICIPANT`) avec leurs permissions dans le code.
- `src/lib/permissions/resolve.ts` : `PermissionTarget`, `effectivePermissions(ctx, target)`,
  `hasPermission(ctx, permission, target)`. `src/lib/permissions/labels.ts` : libellés par domaine.
- `src/lib/user-context.ts` : `loadUserContext` (rôles + ajustements chargés).
- `src/lib/auth-guards.ts` : `requirePermission(userId, permission, target)`, `AuthError`
  (code `PERMISSION_DENIED`, 403), `assertNotLastOwner`, `assertNotLastSuperAdmin`.
- Wrappers : `withStaffAuth(handler, { permission })`, `withOrgAuth(permission, handler)`,
  `withEventAuth({ permission, allowArchived?, requireRegistrationOpen? }, handler)` avec
  `EventAuthCtx = { session, orgId, eventId, event, permissions, isStaffActor }`.
- `src/lib/auth-participant.ts` : `requireParticipantPermission(permission): Promise<SessionUser>`
  (relit le compte en base ; archivé ou bloqué refusé) ; `loadPermissions(userId, target)` pour les pages.
- `ActivityType` : `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_ARCHIVED`, `ROLE_RESTORED`,
  `USER_PERMISSIONS_CHANGED` ; `logActivity({ type, userId?, targetId?, orgId?, eventId?, details?, req? })`.
- Modèle Prisma : `Role`, `RolePermission`, `UserPermissionOverride`, `User.platformRoleId`,
  `OrgMembership.roleId`, `EventMembership.roleId`.
- Tests : fabriques `src/test/factories.ts` par clé de rôle système (ex. `makeStaff("STAFF_PRINTER")`),
  helpers e2e `e2e/helpers/auth.ts` / `db.ts` par clé de rôle système.

## Global Constraints

- **Règles de test** (CLAUDE.md) : Vitest sur une base finissant par `_test` (`badge_2c_test` dans le
  worktree), jamais la base de dev ; **aucun mock de la base ni de Prisma** (vrai MySQL) — seuls les
  services externes se mockent (SMTP, session NextAuth) ; données préparées avec
  `src/test/factories.ts` (`@faker-js/faker`, graine fixée par fichier), jamais de `prisma.*.create`
  dupliqués ; **ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander ; couverture **100 %** sur `src/lib/**` et `src/app/api/**`.
- Pas de déploiement, pas de SSH, pas de commande `db-reset` ; **ne pas modifier `.env`**,
  `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`. Migrations / `db push` en dev uniquement.
- Aucune réponse d'API n'expose de hash, de secret SMTP / reCAPTCHA ni de jeton d'invitation.
- Toute action sensible est journalisée via `logActivity` (avant / après dans `details`).
- Règles qui restent en code (pas des permissions) : dernier `OWNER`, dernier `SUPER_ADMIN`, pas
  d'auto-modification de son rôle ni de ses permissions, l'OWNER n'édite pas un autre OWNER.
- Codes d'erreur : 409 `ROLE_NAME_TAKEN`, 409 `ROLE_IN_USE`, 409 `SYSTEM_ROLE` ; ajoutés par le lot :
  403 `PERMISSION_NOT_HELD` (anti-escalade), 403 `RESERVED_PERMISSION`, 403 `SELF_MODIFICATION`,
  403 `OWNER_PROTECTED`, 400 `INVALID_PERMISSION` (clé inconnue ou niveau non portable par le rôle).
- UI en français avec accents, code en anglais, commentaires en français ; pas de nouvelle
  dépendance ; Server Components par défaut.

## Review Focus

- **Escalade de privilèges** : un acteur ne coche, n'accorde et n'attribue jamais (rôle ou
  ajustement) une permission qu'il ne détient pas sur la cible ; testé pour chaque route d'écriture
  (rôle, ajustement, attribution de rôle à un membre, rôle plateforme d'un compte).
- **IDOR entre organisations** : `orgId` toujours pris dans le chemin, jamais dans le corps ;
  un `roleId` d'une autre organisation, un `userId` non membre, un `membershipId` d'un autre
  évènement répondent 404 ou 400, jamais 200.
- **Permissions `reserved`** : refusées dans les rôles personnalisés et les ajustements, absentes des
  éditeurs ; aucun chemin API pour les attribuer hors rôles système `SUPER_ADMIN` / `OWNER`.
- **Rôles système figés** : ni modification ni archivage (`SYSTEM_ROLE`) ; rôle attribué non
  archivable (`ROLE_IN_USE`) ; nom unique par `(orgId, scope)` parmi les non archivés.
- **Aucun secret exposé** dans les listes de rôles, de membres et d'ajustements ; compte archivé ou
  bloqué refusé sur les routes participant d'écriture.
- Responsive : contrôle à **375, 1024 et 1280 px** de toutes les pages ajoutées (le menu latéral
  occupe ~224 px dès `lg` ; la matrice de permissions ne doit pas déborder horizontalement).

---

### Task 1: Service de gestion des rôles et des ajustements

**Files:**
- Create: `src/app/api/platform/roles/_lib/role-service.ts` (dossier privé Next, importé aussi par les
  routes org du lot — voir écart 2), `.../_lib/overrides-service.ts`
- Test: `src/app/api/platform/roles/_lib/__tests__/role-service.test.ts`, `overrides-service.test.ts`

**Interfaces:**
- Consumes : catalogue, `system-roles`, `effectivePermissions`, `hasPermission`, `loadUserContext`,
  `logActivity`, modèles `Role` / `RolePermission` / `UserPermissionOverride`.
- Produces :
  - `type RoleLevel = { scope: "PLATFORM" } | { scope: "ORG" | "EVENT"; orgId: string }`
  - `validateRolePermissions(actor: UserContext, level: RoleLevel, keys: string[], target: PermissionTarget): Permission[]`
    — lève `RoleError` (`INVALID_PERMISSION` 400, `RESERVED_PERMISSION` 403, `PERMISSION_NOT_HELD` 403) ;
    niveaux portables : PLATFORM → PLATFORM+ORG+EVENT, ORG → ORG+EVENT, EVENT → EVENT.
  - `createRole(actor, level, { name, description?, permissions }, req): Promise<RoleDTO>`
  - `updateRole(actor, roleId, { name?, description?, permissions? }, req): Promise<RoleDTO>`
  - `archiveRole(actor, roleId, req)` / `restoreRole(actor, roleId, req)`
  - `listRoles(level, { includeArchived? }): Promise<RoleDTO[]>` (rôles système issus du code + personnalisés)
  - `assertCanAssignRole(actor: UserContext, role: RoleDTO, target: PermissionTarget): void` (`PERMISSION_NOT_HELD`)
  - `resolveAssignableRole(roleId, expected: { scope; orgId? }): Promise<RoleDTO>` — 404 si absent,
    archivé ou d'une autre organisation (anti-IDOR).
  - `applyOverrides(actor, subjectUserId, orgId: string | null, desired: { permission: string; effect: "GRANT" | "REVOKE" }[], req): Promise<OverridesDiff>` — remplace l'ensemble du niveau en transaction (upsert pour `orgId = null`).
  - `type RoleDTO = { id; scope; systemKey: string | null; name; description: string | null; orgId: string | null; archived; permissions: Permission[]; assignedCount?: number }`
  - `class RoleError extends Error { code; status }` + `roleErrorResponse(err): NextResponse | null`.

- [ ] **Step 1: relever les noms exacts du socle** (voir « Contrats consommés »), les noter dans la
  colonne Notes ; vérifier la présence d'une fabrique de rôle personnalisé dans `src/test/factories.ts`.
  Absente → **s'arrêter et le signaler** (le socle doit l'ajouter : `makeRole({ scope, orgId?, permissions })`).
- [ ] **Step 2: tests (échec attendu)** — `validateRolePermissions` : clé inconnue → `INVALID_PERMISSION` ;
  `platform.roles.manage` → `RESERVED_PERMISSION` ; `org.members.manage` dans un rôle EVENT →
  `INVALID_PERMISSION` ; acteur `OWNER` cochant `settings.update` → `PERMISSION_NOT_HELD`.
  `createRole` : nom déjà pris parmi les non archivés → `ROLE_NAME_TAKEN` (409) mais réutilisable
  après archivage ; écrit les lignes `RolePermission` et un `ROLE_CREATED` avec les permissions.
  `updateRole` / `archiveRole` sur un rôle système → `SYSTEM_ROLE` ; `archiveRole` d'un rôle porté par
  un `OrgMembership` → `ROLE_IN_USE` ; `updateRole` journalise avant / après (`ROLE_UPDATED`) ;
  `restoreRole` refuse si le nom est désormais pris. `resolveAssignableRole` : rôle d'une autre
  organisation → 404 ; `assertCanAssignRole` : `MANAGER` ne peut pas attribuer `OWNER`.
  `applyOverrides` : `reserved` refusé, `GRANT` d'une clé non détenue refusé, deux appels successifs
  idempotents (une seule ligne par clé, y compris `orgId = null`), diff `USER_PERMISSIONS_CHANGED`.
- [ ] **Step 3: implémenter** les fonctions ci-dessus (aucune dépendance au niveau HTTP hors
  `RoleError`). Le nombre d'attributions (`assignedCount`) compte `User.platformRoleId`,
  `OrgMembership.roleId`, `EventMembership.roleId` non archivés.
- [ ] **Step 4:** `make test` ciblé sur les deux fichiers → vert, couverture 100 % du dossier.
- [ ] **Step 5: commit** `feat(droits): service de gestion des roles et des ajustements`.

### Task 2: API rôles plateforme

**Files:**
- Create: `src/app/api/platform/roles/route.ts`, `[roleId]/route.ts`, `[roleId]/restore/route.ts`,
  `assignable/route.ts`
- Test: `__tests__/route.test.ts` à côté de chaque route

**Interfaces:**
- Consumes : Task 1 ; `withStaffAuth(handler, { permission: "platform.roles.manage" })`.
- Produces (utilisé par les Tasks 9 et 11) :
  - `GET /api/platform/roles?scope=PLATFORM|ORG|EVENT&archived=` → `{ roles: RoleDTO[] }`
    (rôles système des trois niveaux en lecture ; personnalisés = scope PLATFORM uniquement).
  - `POST /api/platform/roles` `{ name, description?, permissions: string[] }` → 201 `{ role }` (scope PLATFORM).
  - `GET|PATCH|DELETE /api/platform/roles/[roleId]` (DELETE = archivage) ; `POST …/restore`.
  - `GET /api/platform/roles/assignable?scope=PLATFORM|ORG&orgId=` gardé par `platform.access` →
    `{ roles: (Pick<RoleDTO,"id"|"name"|"systemKey"|"scope"|"description"> & { assignable: boolean; reason?: string })[] }` :
    rôles système + personnalisés applicables (PLATFORM, ou ORG d'une organisation donnée) ;
    `assignable = false` si l'acteur ne détient pas toutes les permissions du rôle. Pas de liste de permissions.
  - Zod strict (`.strict()`), limites : nom 2–60 caractères, description ≤ 500, ≤ 200 clés.

- [ ] **Step 1: tests (échec attendu)** — par route : `STAFF_ADMIN` / `STAFF_SUPPORT` / participant → 403 ;
  `SUPER_ADMIN` crée (201) ; doublon → 409 `ROLE_NAME_TAKEN` ; permission `reserved` → 403 ; PATCH d'un
  rôle système → 409 `SYSTEM_ROLE` ; DELETE d'un rôle attribué → 409 `ROLE_IN_USE` ; GET `scope=ORG`
  renvoie les rôles système `OWNER`, `MANAGER`, `AUDITOR`, `AGENT` sans rôle personnalisé d'organisation ;
  `assignable` marque `SUPER_ADMIN` non assignable pour un `STAFF_ADMIN` ; roleId inexistant → 404 ;
  un `roleId` de scope ORG passé à PATCH → 404 (cette route ne gère que PLATFORM).
- [ ] **Step 2: implémenter** les routes en déléguant au service ; chaque réponse d'erreur via `roleErrorResponse`.
- [ ] **Step 3:** tests verts ; **Step 4: commit** `feat(droits): api des roles plateforme`.

### Task 3: API rôles d'organisation

**Files:**
- Create: `src/app/api/org/[orgId]/roles/route.ts`, `[roleId]/route.ts`, `[roleId]/restore/route.ts`,
  `assignable/route.ts` ; tests colocalisés

**Interfaces:**
- Consumes : Task 1 ; `withOrgAuth("org.roles.manage", handler)` (cible org) ; `assignable` : `withOrgAuth("org.read", …)`.
- Produces :
  - `GET /api/org/[orgId]/roles?scope=ORG|EVENT&archived=` → `{ roles: RoleDTO[] }` (système communs + personnalisés **de cette organisation** uniquement).
  - `POST` `{ scope: "ORG" | "EVENT", name, description?, permissions }` ; `GET|PATCH|DELETE [roleId]` ; `POST …/restore`.
  - `GET …/roles/assignable?scope=ORG|EVENT` → même forme qu'en Task 2 (alimente les Tasks 6 et 11).
  - Règle : `orgId` du chemin imposé au rôle ; un rôle d'une autre organisation ou un rôle PLATFORM → 404.

- [ ] **Step 1: tests (échec attendu)** — `MANAGER`, `AUDITOR`, `AGENT` → 403 ; `OWNER` crée un rôle ORG
  avec `org.events.create` (201) mais pas avec `org.roles.manage` (403 `RESERVED_PERMISSION`), pas avec
  `settings.update` (400 `INVALID_PERMISSION`, niveau PLATFORM), pas avec une permission qu'un OWNER
  « réduit » (rôle système + ajustement `REVOKE`) a perdue (403 `PERMISSION_NOT_HELD`) ; IDOR : OWNER de
  l'organisation A lisant / modifiant / archivant un rôle de B → 404 ; deux organisations peuvent
  porter le même nom de rôle ; liste de A ne contient jamais un rôle de B ; archivage d'un rôle porté
  par un membre → 409 `ROLE_IN_USE` ; staff `SUPER_ADMIN` passe la garde (détient tout) et l'acteur est journalisé.
- [ ] **Step 2: implémenter** ; journalisation avec `orgId`.
- [ ] **Step 3:** tests verts ; **Step 4: commit** `feat(droits): api des roles d'organisation`.

### Task 4: API d'ajustements de permissions

**Files:**
- Create: `src/app/api/platform/users/[userId]/permissions/route.ts`,
  `src/app/api/org/[orgId]/members/[userId]/permissions/route.ts` ; tests colocalisés

**Interfaces:**
- Consumes : Task 1 (`applyOverrides`) ; `withStaffAuth(handler, { permission: "users.permissions.manage" })` ;
  `withOrgAuth("org.members.permissions.manage", handler)`.
- Produces (Task 10) — même forme pour les deux routes :
  - `GET` → `{ levels: { target: { kind: "platform" } | { kind: "org"; orgId: string; orgName: string }; role: { id; name; systemKey } | null; inherited: Permission[]; overrides: { permission: Permission; effect: "GRANT" | "REVOKE" }[]; effective: Permission[] }[] }` ;
    plateforme : un niveau `platform` (incluant les clés PARTICIPANT, seul endroit où elles s'ajustent)
    puis un niveau par organisation dont l'utilisateur est membre ; organisation : un seul niveau `org`.
  - `PUT` `{ orgId: string | null; overrides: { permission; effect }[] }` (plateforme) / `{ overrides }`
    (organisation, `orgId` du chemin) → `{ level }` ; remplace l'ensemble du niveau.
  - Règles : refus de soi-même (403 `SELF_MODIFICATION`) ; cible OWNER sur la route org → 403
    `OWNER_PROTECTED` sauf acteur détenant `users.permissions.manage` ; route org : utilisateur non
    membre de l'organisation → 404 ; niveau org n'accepte que ORG et EVENT ; `reserved` refusé.

- [ ] **Step 1: tests (échec attendu)** — `SUPER_ADMIN` retire `registration.export` à un membre puis
  l'ajoute au niveau organisation, et `effective` suit ; `STAFF_ADMIN` → 403 ; OWNER retire
  `event.update` à un MANAGER de son organisation (200), l'ajoute à un AUDITOR (200) mais ne peut accorder
  `settings.update` (400) ni `org.roles.manage` (403) ; OWNER sur un autre OWNER → 403 `OWNER_PROTECTED` ;
  OWNER sur lui-même → 403 `SELF_MODIFICATION` ; OWNER de A sur un membre de B → 404 ; `PUT` deux
  fois identique = aucune ligne en double et un seul journal `USER_PERMISSIONS_CHANGED` utile
  (diff vide → pas de journal) ; l'ajustement d'organisation n'affecte pas les autres organisations.
- [ ] **Step 2: implémenter** `GET` (calcul `inherited` via `effectivePermissions` sans ajustement,
  `effective` avec) et `PUT`.
- [ ] **Step 3:** tests verts ; **Step 4: commit** `feat(droits): api des ajustements de permissions`.

### Task 5: API utilisateurs et propriétaires plateforme par `roleId`

**Files:**
- Modify: `src/app/api/platform/users/route.ts`, `users/[userId]/route.ts`,
  `src/app/api/platform/organizations/[orgId]/owners/route.ts`, `owners/[userId]/route.ts` ;
  tests colocalisés existants (`owners/**/__tests__`) + nouveaux

**Interfaces:**
- Consumes : Tasks 1–2 ; wrappers avec `permission` : `users.read` (GET), `users.create` /
  `users.staff.create` (POST selon `type`), `users.update`, `users.staff.assign_role`,
  `users.staff.assign_top_role`, `users.archive`, `users.password.reset`, `organizations.read`,
  `organizations.members.manage` (owners).
- Produces : corps `POST /api/platform/users` : `{ email, name, type: "client" | "staff", platformRoleId?, orgMemberships?: { orgId, roleId }[], orgId?, orgRoleId? }` ;
  `PATCH …/users/[userId]` : `platformRoleId: string | null` remplace `staffRole` ; owners :
  `POST { email, name, roleId }` (remplace `role`), réponses avec `{ role: { id, name, systemKey } }`.
  `isStaff` tenu à jour (`platformRoleId != null`).

- [ ] **Step 1: tests (échec attendu)** — `STAFF_SUPPORT` crée un client (201) mais pas un staff (403) ;
  `STAFF_ADMIN` crée un `STAFF_SUPPORT` (201), pas un `STAFF_ADMIN` ni `SUPER_ADMIN` (403
  `PERMISSION_DENIED`, `assign_top_role`) ; rôle `STAFF_PRINTER` attribuable par `STAFF_ADMIN` ; rôle
  personnalisé plateforme attribuable seulement si l'acteur détient toutes ses permissions
  (`PERMISSION_NOT_HELD`) ; `roleId` de scope ORG passé comme `platformRoleId` → 400 ; archivé → 404 ;
  auto-modification de son rôle → 403 `SELF_MODIFICATION` ; rétrogradation / archivage du dernier
  `SUPER_ADMIN` → refusé (`assertNotLastSuperAdmin`) ; `STAFF_OBSERVER` n'a plus `users.update`
  (PATCH nom → 403) ; retrait du rôle (`platformRoleId = null`) repasse `isStaff` à `false` ;
  owners : un `roleId` d'une autre organisation → 404 ; rétrogradation ou suppression du dernier OWNER refusée (`assertNotLastOwner`) sur DELETE et sur changement de rôle ; réponses sans hash.
- [ ] **Step 2: implémenter** : remplacer `staffRole` / `role` par `platformRoleId` / `roleId`, les
  contrôles `staffRoleAtLeast` par les permissions ci-dessus ; `GET` liste renvoie `platformRole { id, name, systemKey }`.
- [ ] **Step 3:** mettre à jour les tests existants du périmètre ; tests verts ; **Step 4: commit**
  `feat(droits): roleId sur les api utilisateurs et proprietaires plateforme`.

### Task 6: API membres d'organisation et d'évènement par `roleId`

**Files:**
- Modify: `src/app/api/org/[orgId]/members/route.ts`, `members/[userId]/route.ts`,
  `src/app/api/org/[orgId]/events/[eventId]/members/route.ts`, `members/[membershipId]/route.ts` ;
  tests colocalisés

**Interfaces:**
- Consumes : Tasks 1 et 3 ; `withOrgAuth("org.members.read", …)` (GET),
  `withOrgAuth("org.members.manage", …)` ; `withEventAuth({ permission: "event.members.manage" }, …)`
  (GET inclus, `allowArchived: true`) ; `assertNotLastOwner`.
- Produces : `POST /api/org/[orgId]/members` `{ email, name, roleId }` ; `PATCH …/members/[userId]`
  `{ roleId }` ; `DELETE` inchangé ; évènement : `POST { email, name, roleId }`, `PATCH [membershipId] { roleId }` ;
  les `GET` renvoient `role: { id, name, systemKey }`.
  Règles : `roleId` de scope ORG (resp. EVENT), système ou personnalisé **de l'organisation du chemin**
  non archivé ; `assertCanAssignRole` sur la cible org (resp. événement, via `ctx.permissions`) ;
  auto-modification → 403 `SELF_MODIFICATION` ; modifier ou retirer un membre titulaire du rôle système
  `OWNER` exige `users.permissions.manage` (sinon 403 `OWNER_PROTECTED`) ; rétrograder ou retirer le dernier
  `OWNER` → 409 (code existant d'`assertNotLastOwner`) ; `membershipId` d'un autre évènement → 404.

- [ ] **Step 1: tests (échec attendu)** — OWNER invite avec un rôle personnalisé de son organisation
  (201) ; `roleId` d'une autre organisation → 404 ; `MANAGER` / `AUDITOR` / `AGENT` → 403 sur
  POST / PATCH / DELETE, `AUDITOR` peut lire la liste ; OWNER ne peut attribuer un rôle personnalisé
  contenant une permission qu'il n'a plus (ajustement `REVOKE`) → 403 `PERMISSION_NOT_HELD` ; OWNER
  modifiant un autre OWNER → 403 `OWNER_PROTECTED`, `SUPER_ADMIN` (staff) le peut ; dernier OWNER non
  rétrogradable ; évènement : `ADMIN` d'évènement attribue `VIEWER` (200) mais pas un rôle personnalisé EVENT
  portant une clé qu'il n'a pas (403) ; `OPERATOR` → 403 ; membre
  d'un autre évènement → 404 ; journal `MEMBER_ROLE_CHANGED`-équivalent existant conservé avec `roleId` / nom avant-après.
- [ ] **Step 2: implémenter** ; conserver les notifications existantes (`notifyMembershipRoleChanged`)
  en passant les noms de rôle.
- [ ] **Step 3:** tests verts ; **Step 4: commit** `feat(droits): roleId sur les api de membres`.

### Task 7: Routes participant

**Files:**
- Modify: `src/app/api/account/profile/route.ts` (PUT), `src/app/api/account/upload/route.ts`,
  `src/app/api/account/registrations/[id]/resubmit/route.ts`, `src/app/api/events/[slug]/register/route.ts` ;
  tests `src/app/api/account/__tests__/*.test.ts`, `account/upload/__tests__`, `src/app/api/__tests__/…`
  du périmètre, `src/app/api/events/__tests__/register-event.test.ts`

**Interfaces:**
- Consumes : `requireParticipantPermission(permission)`, `AuthError` du participant ; ajustements
  `REVOKE` posés via la fabrique ou la Task 4.
- Produces : PUT profil → `account.profile.update` ; upload → `account.profile.upload` ; resubmit →
  `registration.self.resubmit` (en gardant `requireRegistrationOwner` pour la propriété) ; register →
  `registration.self.create`. Les `GET` (profil, inscriptions, notifications) restent sur `requireAuth`
  (lectures toujours permises à un compte valide, spec 37).

- [ ] **Step 1: tests (échec attendu)** — pour chaque route : compte archivé avec session valide → refus
  (401/403) ; compte bloqué → refus ; ajustement `REVOKE registration.self.create` par un
  `SUPER_ADMIN` → 403 sur l'inscription mais lecture du profil toujours 200 ; `REVOKE` d'une clé n'affecte pas
  les autres routes ; propriétaire différent sur resubmit → 403 (non-régression).
- [ ] **Step 2: implémenter** ; adapter la gestion `AuthError` de chaque route au code `PERMISSION_DENIED`.
- [ ] **Step 3:** tests verts ; **Step 4: commit** `feat(droits): routes participant par permission`.

### Task 8: Composants `src/components/permissions/**`

**Files:**
- Create : `PermissionMatrix.tsx`, `RoleEditor.tsx`, `RoleTable.tsx`, `UserPermissionsEditor.tsx`,
  `RoleSelect.tsx`, `types.ts` ; tests `__tests__/*.test.tsx` (comportement des composants purs)

**Interfaces:**
- Consumes : catalogue (`Permission`, entrées) et libellés importés des modules purs du socle
  (aucun import Prisma côté client) ; `src/components/ui/**` (`Button`, `Modal`, `TabLinks`, `Labels`,
  `Feedback`, `FormControls`, `useAsyncAction`) ; Tasks 2–4 pour les URL.
- Produces :
  - `PermissionMatrix({ levels: Scope[]; selected: Set<Permission>; onChange?; readOnly?; disabled?: Map<Permission, string> })` —
    cases groupées par domaine avec libellé et description ; `reserved` jamais rendues ;
    cases désactivées avec infobulle (raison) ; responsive sans débordement.
  - `RoleEditor({ mode: "create" | "edit" | "duplicate"; scope; initial?; apiBase; heldPermissions: Permission[]; redirectTo })` —
    nom, description, matrice ; appelle `POST` / `PATCH` de `apiBase` ; erreurs 409/403 affichées par code.
  - `RoleTable({ roles: RoleDTO[]; apiBase; editHref(id); duplicateHref?(id); canManage })` — pastille « Système »,
    archiver / restaurer, compteur `assignedCount`, message pour `ROLE_IN_USE`.
  - `UserPermissionsEditor({ levels, endpoint, orgId: string | null })` — trois états par permission
    (hérité / ajouté / retiré) + colonne « effectif » recalculée côté client ; enregistre via `PUT` ;
    permissions non détenues non « ajoutables » (désactivées).
  - `RoleSelect({ roles: AssignableRole[]; value; onChange; name; disabled? })` — groupes « Rôles système »
    / « Rôles personnalisés » ; options `assignable: false` désactivées avec raison.

- [ ] **Step 1: tests (échec attendu)** — `PermissionMatrix` ne rend jamais `platform.roles.manage` ;
  une case désactivée n'émet pas `onChange` ; `UserPermissionsEditor` : passer une permission héritée à
  « retiré » retire la clé de `effective`, « ajouté » l'y ajoute ; `RoleSelect` désactive les
  `assignable: false`. Les tests de composants ne touchent pas la base.
- [ ] **Step 2: implémenter** les composants ; styles de la palette existante (`palette-guard.test.ts` doit rester vert).
- [ ] **Step 3:** tests verts, `make lint && make typecheck` ; **Step 4: commit** `feat(droits): composants d'edition des roles et permissions`.

### Task 9: Pages `/platform/roles` et `/org/[orgId]/roles`

**Files:**
- Create : `src/app/platform/roles/page.tsx`, `new/page.tsx`, `[roleId]/page.tsx` ;
  `src/app/org/[orgId]/roles/page.tsx`, `new/page.tsx`, `[roleId]/page.tsx`

**Interfaces:**
- Consumes : Task 8 ; `loadPermissions(userId, target)` + `redirect` (garde de page) ; `listRoles` (Task 1) ;
  `TabLinks`. Les entrées de menu « Rôles » sont ajoutées par 2a (`StaffShell`) et 2b (`OrgShell`).
- Produces : `/platform/roles?tab=platform|org|event` — onglets Plateforme / Organisation / Évènement, système
  en lecture (permissions grisées), personnalisés plateforme : créer, dupliquer un système plateforme
  (`/platform/roles/new?from=<roleId>`), modifier, archiver / restaurer ; garde `platform.roles.manage`
  sinon redirection `/platform`. `/org/[orgId]/roles?tab=org|event` — système communs en lecture +
  personnalisés de l'organisation ; garde `org.roles.manage` sinon redirection `/org/[orgId]`.

- [ ] **Step 1: écrire les pages** (Server Components, `export const dynamic = "force-dynamic"` comme les
  pages voisines) ; `heldPermissions` calculé côté serveur pour griser l'éditeur (anti-escalade visible).
- [ ] **Step 2:** vérifier dans le navigateur (`https://badge.local` ou le port de la stack du lot) en
  `SUPER_ADMIN` puis `OWNER` ; garde par URL directe pour un `STAFF_ADMIN` / `MANAGER` → redirection.
- [ ] **Step 3:** `make lint && make typecheck` ; **Step 4: commit** `feat(droits): pages de gestion des roles`.

### Task 10: Pages d'ajustement et liens d'entrée

**Files:**
- Create : `src/app/platform/users/[userId]/permissions/page.tsx`,
  `src/app/org/[orgId]/members/[userId]/permissions/page.tsx`
- Modify : `src/app/platform/users/[userId]/page.tsx` (lien « Permissions » si `users.permissions.manage` ;
  rôle affiché par `platformRole.name`, plus de `staffRole`), `src/app/platform/users/[userId]/UserDetailActions.tsx`
  (sélecteur de rôle par `RoleSelect`, voir Task 11), `src/app/org/[orgId]/members/page.tsx` +
  `MembersClient.tsx` (lien « Permissions » par ligne si `org.members.permissions.manage`, jamais pour soi
  ni pour un autre OWNER ; `canManageRoles` remplacé par les permissions `org.members.manage`)

**Interfaces:**
- Consumes : Tasks 4 et 8 ; `loadPermissions`.
- Produces : `/platform/users/[userId]/permissions` — rôle plateforme (sélecteur selon
  `users.staff.assign_role` / `assign_top_role`) puis un `UserPermissionsEditor` par niveau (plateforme
  puis chaque organisation) ; `/org/[orgId]/members/[userId]/permissions` — rôle d'organisation
  (si `org.members.manage`) et un éditeur au niveau organisation. Gardes de page : permission absente,
  utilisateur non membre ou soi-même → redirection vers la fiche / la liste.

- [ ] **Step 1: implémenter** les pages et liens ; **Step 2:** contrôle navigateur : états
  hérité / ajouté / retiré et effectif cohérents avec la réponse API, 375 / 1024 / 1280 px.
- [ ] **Step 3:** `make lint && make typecheck` ; **Step 4: commit** `feat(droits): pages d'ajustement des permissions`.

### Task 11: Formulaires et pages de membres / utilisateurs

**Files:**
- Modify : `src/components/staff/UserCreationForm.tsx`, `src/components/platform/PlatformOrgMemberInviteForm.tsx`,
  `src/components/admin/OrgMemberForm.tsx`, `src/components/event/MemberInviteForm.tsx`,
  `src/components/event/MemberTable.tsx`, `src/app/platform/users/new/page.tsx`, `users/page.tsx`,
  `src/app/event/[eventId]/members/page.tsx`

**Interfaces:**
- Consumes : `RoleSelect` (Task 8) et les routes `assignable` (Tasks 2–3), corps `roleId` des Tasks 5–6.
- Produces : les cinq formulaires et `MemberTable` envoient `roleId` ; options = rôles système + personnalisés
  applicables (plateforme : `assignable?scope=PLATFORM|ORG&orgId=` ; organisation / évènement :
  `/api/org/[orgId]/roles/assignable?scope=ORG|EVENT`) ; les pages passent la liste précalculée aux composants
  clients (pas de requête au premier rendu) ; `/platform/users` affiche `platformRole.name` ;
  `MemberTable` : lecture seule du rôle sans `event.members.manage`.

- [ ] **Step 1: implémenter** ; valeurs par défaut conservées (OWNER à la création d'organisation,
  `MANAGER` pour une invitation d'organisation) en retrouvant l'id par `systemKey`.
- [ ] **Step 2:** vérifier navigateur : un rôle personnalisé créé en Task 9 apparaît dans les cinq
  sélecteurs ; rôle non assignable grisé avec raison ; 375 px sans débordement.
- [ ] **Step 3:** `make lint && make typecheck` ; **Step 4: commit** `feat(droits): selecteurs de role par roleId`.

### Task 12: e2e, doc, vérification

**Files:**
- Modify : `e2e/platform/user-detail.spec.ts`, `user-new.spec.ts`, `e2e/org/members.spec.ts`,
  `e2e/event/members.spec.ts`, `e2e/public/account-profile.spec.ts`, `account-registration.spec.ts`,
  `event-register*.spec.ts` (adaptation aux helpers par clé de rôle système)
- Create : `e2e/platform/roles.spec.ts`, `e2e/org/roles.spec.ts`, `e2e/platform/user-permissions.spec.ts`,
  `e2e/org/member-permissions.spec.ts`
- Modify : `docs/v4/features/roles-permissions.md` (section « Gestion des droits » uniquement)

- [ ] **Step 1: e2e** (préfixes de fixtures propres, nettoyage via `e2e/helpers/db.ts`, rôles créés par
  l'UI, jamais par SQL) : `SUPER_ADMIN` crée un rôle plateforme, le duplique depuis un rôle système, tente
  d'archiver un rôle attribué (message `ROLE_IN_USE`), `STAFF_ADMIN` n'a pas l'entrée ni l'accès direct à
  `/platform/roles` (redirection) ; `OWNER` crée un rôle d'organisation, l'attribue à un membre
  (sélecteur des cinq formulaires), puis lui retire une permission sur la page d'ajustement et vérifie
  l'effet (entrée de menu / bouton disparu après reconnexion de ce membre) ; `OWNER` ne voit ni le lien
  Permissions pour un autre OWNER ni pour lui-même ; accès par URL directe de l'OWNER de A à une page ou API
  d'ajustement d'un membre de B → refus ; participant dont `registration.self.create` est retirée voit son
  inscription refusée et son profil lisible ; compte archivé avec session ouverte : écriture refusée.
- [ ] **Step 2: contrôle visuel** 375 / 1024 / 1280 px des pages ajoutées (`/platform/roles`,
  `/platform/roles/new`, `/org/[orgId]/roles`, deux pages d'ajustement) : pas de défilement horizontal de la
  page, matrice lisible, menu latéral ~224 px dès `lg` pris en compte.
- [ ] **Step 3: doc** — section « Gestion des droits » : modèle (rôles système figés, personnalisés,
  ajustements), qui peut quoi (tableau de la spec 37), garde-fous et codes d'erreur, URL des pages, routes participant.
- [ ] **Step 4: vérification complète dans le worktree** :
  `make lint && make typecheck && make test-coverage` → tout vert, gates 100 % (`src/lib/**`,
  `src/app/api/**`) ; puis les e2e du lot (`yarn playwright test e2e/platform/roles.spec.ts
  e2e/org/roles.spec.ts e2e/platform/user-permissions.spec.ts e2e/org/member-permissions.spec.ts
  e2e/platform/user-*.spec.ts e2e/org/members.spec.ts e2e/event/members.spec.ts e2e/public`) → verts.
  `grep` nul, dans le périmètre du lot, sur `minRole`, `staffRoleAtLeast`, `hasOrgRole`,
  `requireOrgRole`, `StaffRole`, `OrgRole`, `EventRole`.
- [ ] **Step 5:** mettre à jour la Progression (statuts, dates) ; **commit** `test(droits): e2e et documentation de la gestion des droits`. Rapport prêt à fusionner.

## Écarts à signaler à l'orchestrateur

1. `PlatformOrgMemberInviteForm.tsx` vit dans `src/components/platform/` (pas `src/components/staff/`) et
   n'est listé dans aucun glob de lot hors la spec 36 ; il est traité ici (2c). Sa page appelante
   `src/app/platform/organizations/[orgId]/members/page.tsx` est à 2a : 2a ne doit pas changer l'import ni les props.
2. Aucun dossier `src/lib/**` n'est modifiable par le lot : le service de gestion des rôles est placé
   dans `src/app/api/platform/roles/_lib/` (importé aussi par les routes org du lot). S'il doit migrer
   vers `src/lib/permissions/`, c'est une demande au socle.
3. Une fabrique de rôle personnalisé (`makeRole`) et un helper e2e équivalent ne sont pas dans les contrats
   du socle : à vérifier en Task 1 ; absente → demande au socle (les e2e passent par l'UI et n'en ont pas besoin).
4. Changement de comportement à confirmer : un OWNER ne peut plus modifier ni retirer un autre OWNER
   (règle demandée) ; les e2e de membres existants qui l'exercent sont adaptés.
5. Les `GET` participant restent sur `requireAuth` (spec : lectures toujours permises) ; la page publique
   d'inscription, hors périmètre, n'est pas adaptée à un `registration.self.create` retiré (seule l'API refuse).

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **Service de gestion des rôles et ajustements** dans `src/lib/role-management/**`
   (nouveau, **exclusif au lot 2c**, couverture 100 %), et non sous
   `src/app/api/platform/roles/_lib/`.
2. Fabriques du socle : `makeCustomRole` et `makeOverride` (pas `makeRole`) ; ne pas
   s'arrêter si `makeRole` est absente.
3. `PlatformOrgMemberInviteForm.tsx` est dans `src/components/platform/` (exclusif au lot).
4. Arbitrages acceptés (journalisés dans la spec 36) : OWNER ne modifie ni ne retire un autre
   OWNER (sauf détenteur de `users.permissions.manage`) ; GET participant sur `requireAuth` ;
   codes d'erreur `PERMISSION_NOT_HELD`, `RESERVED_PERMISSION`, `SELF_MODIFICATION`,
   `OWNER_PROTECTED`, `INVALID_PERMISSION` ; `/platform/roles` ne crée que des rôles
   plateforme, onglets Organisation et Évènement en lecture seule.

## Amendements de la revue finale du socle (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. **`memberPermissions`** est publié par le socle : `memberPermissions(ctx: UserContext, target: PermissionTarget): ReadonlySet<Permission>` (`src/lib/permissions/resolve.ts`, exporté par `@/lib/permissions`), plus `loadMemberPermissions(userId, target)` dans `src/lib/auth-guards.ts`. C'est l'ensemble effectif **sans** le rôle plateforme ni ses ajustements : les droits « côté organisateur » d'un membre. Pour un non-staff, il est égal à `effectivePermissions`. Tout contrôle « jamais le staff » ou « côté organisateur » (écriture d'une demande d'impression, acceptation de devis, paiement d'abonnement, destinataires de notification sans `includeStaff`) l'utilise **en plus** du refus de `isStaffActor`. Un staff membre d'une organisation n'agit plus côté organisateur avec ses droits plateforme.
2. **`effectivePermissions`** n'applique le rôle plateforme que si `ctx.isStaff` (invariant `isStaff = platformRoleId != null`). Le résolveur ignore les clés `reserved` d'un rôle non système ou d'un ajustement, et un `roleRef` de niveau incompatible avec la place de la membership.
3. Les quatre routes de changement de rôle (`platform/users/[userId]`, `org/[orgId]/members/[userId]`, `org/[orgId]/events/[eventId]/members/[membershipId]`, `platform/organizations/[orgId]/owners`) écrivent désormais `roleId` / `platformRoleId` en plus de la colonne d'enum (marqueur `@deprecated compat`). Le lot qui les reprend conserve cette double écriture jusqu'au plan 3.
4. `migrate-roles` ne migre que les comptes `isStaff = true`, n'écrit jamais `isStaff` et signale les lignes incohérentes (`isStaff = 0 AND staffRole IS NOT NULL`).
5. **Résidus de la re-revue du socle, confiés à 2c** (2c est le premier lot à écrire des ajustements
   et à gérer les rôles staff) :
   - **N1** : `memberPermissions` (`src/lib/permissions/resolve.ts`, fichier du socle dont 2c reçoit
     la propriété pour ce seul point) doit appliquer les REVOKE plateforme (`orgId = null`) de
     l'utilisateur, tout en ignorant toujours son rôle plateforme et ses GRANT plateforme. Test : staff
     OWNER d'une organisation avec REVOKE plateforme de `print.quote.accept` → refusé.
   - **N2** : `assertNotLastSuperAdmin` (`src/lib/auth.ts`) ne compte que les comptes `isStaff = true`.
     Test : une ligne incohérente (`isStaff = 0`, rôle SUPER_ADMIN) ne protège pas le dernier
     SUPER_ADMIN effectif.
