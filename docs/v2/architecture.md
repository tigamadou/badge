# Architecture technique v2

## Vue d'ensemble

Badge v2 conserve le socle technique de la v1 (Next.js monolithe + Prisma/MySQL + NextAuth) mais en refonte structurelle pour supporter le multi-tenant. Les concepts métier (organisations, événements, multi-rôle) sont au cœur des modèles Prisma et de la couche d'autorisation.

## Stack technologique

| Composant | Technologie | Version | Différence v1 |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.x | — |
| Runtime | Node.js | 22+ | — |
| UI | React | 19.x | — |
| Langage | TypeScript | 5.x | — |
| CSS | Tailwind CSS | 4.x | — |
| ORM | Prisma | 6.x | — |
| Base de données | MySQL | 8.x | — |
| Authentification | NextAuth.js (Credentials, JWT) | 4.x | JWT minimal (userId + isStaff), pas de role |
| PDF | @react-pdf/renderer | 4.x | — |
| QR Code | qrcode + html5-qrcode | 1.x / 2.x | — |
| Email | nodemailer | 6.x | SMTP plateforme unique, branding cascadé Event/Org |
| Hachage | bcryptjs | 2.x | — |
| CAPTCHA | react-google-recaptcha (v3) | 3.x | — |
| Tests | Vitest | 4.x | — |
| Package manager | Yarn (via Corepack) | — | — |

## Modèle conceptuel

```
┌────────────────────────────────────────────────────────────────┐
│ STAFF APPLICATIF (User.isStaff=true)                           │
│   SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER   │
│   Accès global à toutes les organisations (avec audit)         │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (crée, gère)
┌────────────────────────────────────────────────────────────────┐
│ USER                                                            │
│   Entité globale (peut exister sans org)                        │
│   ├─ OrgMembership[]   (User × Org × OrgRole)                   │
│   └─ EventMembership[] (User × Event × EventRole)               │
└────────────────────────────────────────────────────────────────┘
       │                                            │
       ▼                                            ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ ORGANIZATION                      │  │ EVENT                            │
│   identite (name, legalName,      │1▶│   slug global, archived          │
│     slug), adresse, taxId,        │ N│   ├─ EventSettings (override)    │
│     website, logo, contact,       │  │   ├─ Categories                  │
│     quotas, archived              │  │   ├─ Registrations               │
│   ├─ CategoryTemplates            │  │   ├─ BlockedEmails/Documents     │
│   └─ Memberships                  │  │   └─ Memberships                 │
│      (OWNER / MANAGER / AUDITOR)  │  │      (ADMIN / OPERATOR /         │
└──────────────────────────────────┘  │       PRINTER / VIEWER)          │
                                       └──────────────────────────────────┘
```

Voir [Multi-tenancy & RBAC](features/multi-tenancy-rbac.md) pour le schéma Prisma complet.

## Structure du projet (cible v2)

```
src/
  app/
    api/
      auth/[...nextauth]/                # NextAuth Credentials, JWT minimal
      public/                            # Routes publiques (sans auth)
        events/[slug]/                   # Inscription publique
        verify/[badgeId]/
        edit-registration/[token]/
      staff/                             # Routes /staff/* (isStaff requis)
        organizations/
        users/
        settings/
        activity/
      admin/[orgId]/                     # Routes scope organisation
        events/[eventId]/                # Routes scope événement
          registrations/
          badges/
          categories/
          members/
          settings/
          scan/
          blocked-emails/
          blocked-documents/
          activity/
        members/                         # OWNERs de l'org
        templates/
        settings/
        activity/
      profile/                           # Profil utilisateur (commun)
      upload/                            # Upload avec contexte (event public, admin)
      files/[...path]/                   # Serving fichiers (ACL via path)

    staff/                               # Pages /staff/*
    admin/[orgId]/                       # Pages /admin/[orgId]/*
      events/[eventId]/                  # Pages event
    e/[slug]/                            # Inscription publique
    verify/[badgeId]/
    edit-registration/[token]/
    login/
    setup-password/
    select/                              # Sélecteur post-login si multi-org
    profile/
    page.tsx                             # Redirige vers /login pour MVP v2

  components/
    ui/                                  # Génériques (Button, Input, ...) — inchangés
    layouts/                             # StaffShell, OrgShell, EventShell, PublicEventLayout
    admin/                               # Forms refactorés par scope
    badge/                               # BadgeDocument, ... refactorés avec prop `event`
    staff/                               # Composants spécifiques staff (StaffBanner, etc.)
    public/                              # PublicRegistrationForm, BadgeVerifyPage

  lib/
    prisma.ts                            # Client Prisma (singleton)
    auth.ts                              # requireStaff, requireOrgRole, requireEventPermission,
                                         #   requireEventRole, getEffectiveEventRoles,
                                         #   loadUserContext, assertNotLastOwner,
                                         #   assertNotLastSuperAdmin
    settings.ts                          # resolveSettings (cascade non-SMTP), resolvePublicSettings,
                                         #   getPlatformSmtp (lecture directe PlatformSettings)
    activity-log.ts                      # logActivity, logStaffActionOnClient
    mail.ts                              # Refonte multi-tenant
    storage.ts                           # Abstraction (local d'abord, S3 plus tard)
    qrcode.ts                            # inchangé
    generate-id.ts                       # inchangé
    format-badge-name.ts                 # inchangé
    format-date.ts                       # inchangé
    image-to-dataurl.ts                  # inchangé

  middleware.ts                          # Protection /admin/*, /staff/*, /profile

  types/
    index.ts                             # Types partagés
    next-auth.d.ts                       # JWT minimal (userId, isStaff)

prisma/
  schema.prisma                          # Schéma v2 complet
  seed.ts                                # Seed minimal (1 staff initial)
  migrations/                            # Migrations v2 depuis zéro
```

## Sécurité

### Authentification

- Provider Credentials (email + mot de passe)
- Sessions JWT (NextAuth)
- JWT minimal : `{ id, email, name, isStaff }` — pas de `role` (résolu serveur à chaque requête)
- Hash bcrypt 12 rounds, longueur minimale 6 caractères
- Chaque connexion réussie : log `USER_LOGIN`

### Contrôle d'accès (RBAC)

Trois niveaux résolus serveur via `lib/auth.ts` :

1. **Staff applicatif** (`isStaff=true`) : hiérarchie linéaire `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`. Helper `requireStaff(minRole)`. `SUPER_ADMIN` est le seul à pouvoir promouvoir/démouvoir un `STAFF_ADMIN` ou un autre `SUPER_ADMIN`, et à effectuer un hard delete d'organisation.
2. **Organisation** : `OrgMembership(role=OWNER|MANAGER|AUDITOR)`, hiérarchie linéaire `OWNER ⊃ MANAGER ⊃ AUDITOR`. Helper `requireOrgRole(userId, orgId, role)` avec bypass staff. Invariant : ≥ 1 `OWNER` actif par org non archivée.
3. **Événement** : `EventMembership(role=ADMIN|OPERATOR|PRINTER|VIEWER)`, hiérarchie **partielle** (`ADMIN ⊃ OPERATOR ⊃ {PRINTER, VIEWER}` ; `PRINTER` et `VIEWER` disjoints). Helper `requireEventPermission(userId, eventId, permission)` avec bypass staff + héritage : `OWNER`/`MANAGER` de l'org parent agissent comme `ADMIN` event, `AUDITOR` comme `VIEWER` event.

Defense in depth : le middleware filtre par route, chaque route API re-vérifie via les helpers.

Voir [matrice de permissions complète](features/multi-tenancy-rbac.md).

### Audit

Toute mutation est loguée dans `ActivityLog` :

- `userId`, `orgId`, `eventId` (selon scope)
- `staffActor=true` si action staff sur données client
- `ipAddress`, `userAgent`

Les membres org (OWNER, MANAGER, AUDITOR) voient les `staffActor=true` dans leur `/activity` (transparence).

### Protection anti-bot

reCAPTCHA v3 sur `/e/[slug]` si activé dans les settings résolus en cascade.

### Routes publiques

- `/e/[slug]` (inscription)
- `/verify/[badgeId]` (vérification)
- `/edit-registration/[token]` (édition après rejet)
- `/api/public/*`

Toutes vérifient `archived=false` et `registrationOpen=true` (selon le cas) avant de servir.

## Stockage de fichiers

Local d'abord, abstrait pour migration future :

```
uploads/
  events/
    [eventId]/
      photos/
      idDocuments/
  logos/
    [eventId].png
  org-assets/
    [orgId]/
```

Interface `storage.ts` :

```typescript
interface Storage {
  uploadFile(file: Buffer, path: string, mime: string): Promise<string>;
  getFile(path: string): Promise<Buffer | null>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
}
```

Implémentation v2 : `LocalStorage` qui écrit sur disque (`uploads/`).
Implémentation future : `S3Storage` (sans changement du code consommateur).

Contraintes : taille max 5 Mo, types JPEG/PNG/WebP/PDF. ACL via le path (vérifié dans `/api/files/[...path]`).

## Dépendances externes

- **Google Fonts (Montserrat)** : le rendu PDF des badges (`@react-pdf/renderer`) charge la police Montserrat depuis `https://fonts.googleapis.com/`. Le serveur applicatif doit disposer d'un accès sortant vers ce domaine pour produire les PDF. En cas d'environnement hors-ligne, prévoir une mise en cache locale ou un fournisseur de police alternatif.

## Flux de données principaux

Détaillés dans chaque sous-spec :

- **Onboarding client B2B** → [Spec 2 — Espace Staff](features/espace-staff.md)
- **Création d'événement par OWNER** → [Spec 3 — Espace Organisation](features/espace-organisation.md)
- **Inscription publique** → [Spec 5 — Inscription publique](features/inscription-publique.md)
- **Approbation et impression badge** → [Spec 4 — Espace Événement](features/espace-evenement.md)
- **Scan QR aux points de contrôle** → [Spec 4 — Espace Événement](features/espace-evenement.md)
- **Impersonation staff** → [Spec 2 — Espace Staff](features/espace-staff.md)

## Infrastructure

Identique à la v1 :

- **Caddy** : reverse proxy HTTPS automatique
- **Next.js** standalone
- **MySQL 8** : healthcheck
- **phpMyAdmin** : interface admin BDD
- **Mailpit** (dev uniquement) : capture d'emails

Pas de changement Docker majeur ; les containers sont déjà renommés `badge-*` (cf. commit `a71ac1b`).

## Conventions

- **Soft delete** partout (`archived` + `archivedAt`). Hard delete = script staff.
- **Slugs** : générés depuis le nom (slugify) avec suffixe numérique si collision. `Event.slug` est unique globalement, `Organization.slug` est unique globalement.
- **IDs** : cuid (cohérent v1) sauf `Registration.id` qui reste 12 chars personnalisé (pour les badges).
- **Index Prisma** : sur toutes les FK fréquentes (`orgId`, `eventId`, `userId`, `categoryId`).
- **Tests** : Vitest pour la logique pure (helpers d'autorisation, résolveur settings, formatage). Pas de mock Prisma sur les règles RBAC critiques.

## État au lot C (post-Plan 3 espace organisation, 2026-05-31)

Plan 3 (espace organisation OWNER) terminé. Disponible :

- Wrapper d'API `withOrgAuth(role, handler)` (`src/lib/with-org-auth.ts`) qui résout l'`orgId` depuis le path, appelle `requireOrgRole`, et passe `{ orgId, session }` au handler. Réutilisé par toutes les routes scope-org.
- Layout `OrgShell` (`src/components/admin/`) — sidebar (Dashboard / Événements / Membres / Modèles catégories / Paramètres / Journal), header avec `OrgSelector` (dropdown multi-org + persistance `localStorage` `badge.lastOrgId`) et `StaffBanner` (bandeau "Mode staff" si accès via `isStaff` sans `OrgMembership`).
- Pages `/admin/[orgId]/{dashboard, settings, members, templates, events, events/new, activity}` (Server Components). `/admin/[orgId]/events/[eventId]/*` est laissé au Plan 4.
- API REST scope-org :
  - `GET / PATCH /api/admin/[orgId]` — l'`OrgSettings` ayant été fusionné dans `Organization` (2026-05-31), le `PATCH` accepte tous les champs administratifs (`name`, `legalName`, adresse complète, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` pour OWNER ; `slug`, `quotaMax*` pour staff uniquement). Schéma Zod `.strict()` qui rejette tout champ SMTP / reCAPTCHA legacy (défense en profondeur — secrets vivent dans `PlatformSettings` uniquement). Audit `ORG_UPDATED`.
  - `GET / POST /api/admin/[orgId]/members` + `DELETE [userId]` — invitation idempotente (alreadyMember=200 si déjà membre), `sendUserInvitation` appelé uniquement pour nouvel utilisateur, garde-fou `LAST_OWNER` 409 sur le dernier OWNER. Audit `MEMBERSHIP_ADDED` / `MEMBERSHIP_REMOVED` / `USER_CREATED`.
  - `GET / POST / PATCH / DELETE /api/admin/[orgId]/templates[/[id]]` — CRUD `CategoryTemplate`. Validations : `color` regex `/^#[0-9a-fA-F]{6}$/`, `number` 0-999.
  - `GET / POST /api/admin/[orgId]/events` — `GET` filtré (`archived`, `registrationOpen`, `_count.registrations`). `POST` applique quota (`409 QUOTA_EXCEEDED`), alloue slug global unique (`uniqueEventSlug` via `src/lib/slugify-event.ts` avec suffixage `-2`/`-3`...), copie `CategoryTemplate` sélectionnés en `Category` avec renumérotation `1..N`, `registrationOpen=false` par défaut. Audit `EVENT_CREATED`.
  - `POST /api/admin/[orgId]/events/[eventId]/{archive,restore}` — `archived` + `archivedAt`, force `registrationOpen=false` à l'archive. Scope-check `404` si event hors org. Audit `EVENT_ARCHIVED` / `EVENT_RESTORED`.
  - `GET /api/admin/[orgId]/activity` — filtres `type` / `from` / `to` / `eventId` / `userId`, pagination cursor `take=50` (max 200), include user.
- Wizard `EventCreationWizard` 3 étapes (`src/components/admin/`) : (1) Infos + slug suggéré modifiable, (2) Catégories (mode template ou manuel), (3) Récap + soumission.
- Dispatcher post-login `resolveHomeRedirect(ctx, lastOrgIdHint)` (`src/lib/org-redirect.ts` + tests 8/8) : null → `/login` ; staff sans hint → `/staff` ; staff avec hint → `/admin/[hint]` ; client sans org → `/profile?message=no-org` ; client avec hint valide → `/admin/[hint]` ; client mono-org → `/admin/[onlyOrgId]` ; client multi-org → `/select`. Page `/` (`src/app/page.tsx`) appelle `resolveHomeRedirect(ctx, null)` (le `lastOrgId` localStorage n'est pas lu côté serveur ; `OrgSelector` côté client navigue entre orgs). `src/lib/staff-redirect.ts` (Plan 2) supprimé (superseded).
- Page `/select` : liste les orgs OWNER + entrée "Espace staff" si `isStaff`. Cas dégénérés gérés (mono-org → redirect direct, zéro org non-staff → `/profile?message=no-org`).
- Tests : 303 tests Vitest verts (Plan 1 + 2 + 3). Le bloc d'intégration `owner-journey.test.ts` (2 tests) couvre le golden path OWNER (création event → invitation OWNER → archive) + un test "staff acting on org → `staffActor=true`".

Dette résiduelle :

- Les stubs Plan 6 (`sendUserInvitation`, `sendSmtpTest`, `sendPasswordResetEmail` dans `src/lib/mail.ts`) restent en place ; Plan v2-06 (Lot D) les remplacera par les vraies implémentations email. La Task 18 (vérification "aucun stub Plan 6 résiduel") est en attente du Plan v2-06.
- `/admin/[orgId]/events/[eventId]/*` (page event-admin et ses routes) sera livré par le Plan v2-04 (espace événement).

## État au lot B (post-Plan 2 espace staff, 2026-05-31)

Plan 2 (espace staff applicatif) terminé. Disponible :

- **Auth wrapper** : `withStaffAuth(handler, { minRole? })` (`src/lib/with-staff-auth.ts`) protège toutes les routes `/api/staff/*`.
- **Dispatcher post-login** : `computeStaffRedirect(ctx)` (`src/lib/staff-redirect.ts`) — `staff → /staff`, single-org → `/admin/[orgId]`, multi/event → `/select`, sinon `/profile`. Branchée dans `src/app/page.tsx`.
- **Layout `/staff/*`** : `StaffShell` (`src/components/staff/StaffShell.tsx`) + `src/app/staff/layout.tsx` (auth check + dispatch). Sidebar : Dashboard / Organisations / Utilisateurs / Paramètres / Journal. Badge de niveau staff visible (`SUPER_ADMIN/STAFF_ADMIN/STAFF_SUPPORT/STAFF_OBSERVER`).
- **Dashboard `/staff`** : KPI plateforme (orgs actives/archivées, events actifs, inscriptions cumulées, top 5 orgs du mois, 10 dernières entrées ActivityLog).
- **Organisations** :
  - `GET /api/staff/organizations` (paginé, filtres `q`/`archived`)
  - `POST` (STAFF_ADMIN+, crée org + OWNER avec inviteToken via stub `sendUserInvitation`)
  - `GET/PATCH/DELETE /api/staff/organizations/[orgId]` — DELETE = SUPER_ADMIN only avec confirmation slug
  - `POST archive/restore`
  - Pages `/staff/organizations`, `/staff/organizations/new`, `/staff/organizations/[orgId]`
- **Utilisateurs** :
  - `GET/POST /api/staff/users` (filtres search/type/archived, règles strictes de création staff selon rôle créateur)
  - `GET/PATCH/DELETE /api/staff/users/[userId]` — PATCH avec garde-fou `assertNotLastSuperAdmin` (HTTP 409 LAST_SUPER_ADMIN)
  - `POST /api/staff/users/[userId]/reset-password` (régénère inviteToken)
  - Pages `/staff/users`, `/staff/users/new`, `/staff/users/[userId]`
- **PlatformSettings** :
  - `GET /api/staff/settings` (sans secrets, expose booléens `*Set`)
  - `PATCH` (Zod strict, secrets jamais dans `details` d'audit, `smtpPassword=""` préserve l'ancien)
  - `POST /api/staff/settings/test-smtp` (body `to` ou session fallback)
  - Page `/staff/settings` + `PlatformSettingsForm` + `TestSmtpForm`. Section reCAPTCHA INCLUSE.
- **ActivityLog** :
  - `GET /api/staff/activity` (filtres type/orgId/eventId/userId/staffActor/from/to/page/pageSize)
  - Page `/staff/activity` Server Component avec form GET.
- **Setup password public** :
  - `POST /api/auth/setup-password` (route publique, anti-énumération sur token invalide/expiré/user archivé)
  - Page `/setup-password?token=...` + `SetupPasswordForm`. Hash bcrypt 12 rounds, log `USER_PASSWORD_SET`.

**Tests Vitest** : 240+ tests verts (cumul Lots A + B). Couverture API staff complète + cas piège PRINTER/scan, héritages MANAGER/AUDITOR, garde-fous LAST_OWNER / LAST_SUPER_ADMIN, secrets jamais exposés.

**Dette en attente** :
- Stubs `sendUserInvitation` / `sendPasswordResetEmail` / `sendSmtpTest` dans `src/lib/mail.ts` → seront remplacés par les vraies implémentations du Plan v2-06 (Lot D). Task 15 du plan v2-02 ne peut pas être exécutée tant que Plan 6 n'a pas mergé.
- Routes v1 cassées dans `src/app/api/{teams,registrations,scan,users,settings,event,activity-logs}/*` et pages `src/app/admin/{layout,page}.tsx` (importent encore `checkRole` / `Role` v1) → seront supprimées ou réécrites par Plans v2-03/04/05.

## État au lot A (post-Plan 1, 2026-05-31)

Plan 1 (multi-tenancy & RBAC) terminé. Les fondations sont en place :

- Schéma Prisma v2 + seed `SUPER_ADMIN` (`investiture` DB, 14 tables)
- Types : `next-auth.d.ts` (JWT minimal `userId` + `isStaff`), `auth.ts` (`SessionUser`, `UserContext`, `OrgMembershipLite`, `EventMembershipLite`, `EffectiveEventRole`)
- Helpers : `loadUserContext`, `auth-helpers.ts` (purs : `staffRoleAtLeast`, `orgRoleAtLeast`, `hasOrgRole`, `effectiveEventRole`, `hasEventPermission` avec matrice `EVENT_PERMISSION_ROLES` à 16 permissions), `auth-guards.ts` (DB-aware : `requireStaff`, `requireOrgRole`, `requireEventRole`, `requireEventPermission`, `getEffectiveEventRole`, `assertNotLastOwner`, `assertNotLastSuperAdmin`)
- `settings.ts` : cascade contact `Event → Organization → Platform` + lectures directes `getPlatformSmtp` / `getPlatformRecaptcha` / `getPlatformPublicRecaptcha`
- `activity-log.ts` v2 : auto-dérive `orgId` depuis `eventId`, marque `staffActor=true` sur action staff vs données client
- `auth.ts` : `authOptions` NextAuth Credentials, JWT minimal, log `USER_LOGIN`
- `middleware.ts` : scope-aware (`/admin`, `/staff`, `/profile` + isStaff)
- Tests : 85+ tests Vitest verts (user-context, auth-helpers, auth-guards, settings, activity-log)

Les routes API et pages héritées de la v1 (`src/app/api/**/*.ts`, `src/app/admin/**/*.tsx`) ne compilent plus à ce stade — elles importent `checkRole` / `Role` v1 qui n'existent plus. Elles seront supprimées ou réécrites par les plans 2 à 5 :

- 20+ fichiers dans `src/app/api/` référencent `@/lib/auth` (ancien export `checkRole`)
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/api/activity-logs/route.ts` référencent le `Role` enum v1

`yarn tsc --noEmit` retourne donc de nombreuses erreurs au sortir du Lot A : c'est attendu et acceptable. Les imports `@/lib/auth` continuent de pointer vers le nouveau fichier (qui exporte uniquement `authOptions`), donc `checkRole` est resolved comme undefined → erreur de typage propre, non un crash module-resolution.
