# Multi-tenancy & RBAC — Implementation Plan

> **Mise à jour 2026-05-31 — Enrichissement des enums RBAC** : suite à l'alignement de la spec [docs/v2/features/multi-tenancy-rbac.md](../../v2/features/multi-tenancy-rbac.md) le 2026-05-31, les trois enums RBAC sont élargis pour matcher les rôles validés. `StaffRole` gagne `SUPER_ADMIN` au sommet (`SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`). `OrgRole` passe d'un mono-rôle `OWNER` à une hiérarchie linéaire `OWNER > MANAGER > AUDITOR`. `EventRole` passe de `{ ADMIN, OPERATOR }` à une hiérarchie partielle `ADMIN ⊃ OPERATOR ⊃ { PRINTER, VIEWER }` (PRINTER et VIEWER disjoints). Sections impactées : Task 1 (schéma Prisma : les trois enums), Task 4 (helpers purs : `STAFF_ORDER` inclut `SUPER_ADMIN`, `eventRoleAtLeast` n'a plus de sens en non-linéaire et est remplacé par une logique permission-based ; `effectiveEventRole` gère l'héritage MANAGER→ADMIN et AUDITOR→VIEWER), Task 8 (guards DB-aware : `requireOrgRole` hiérarchie OWNER>MANAGER>AUDITOR, nouveau `requireEventPermission` avec permissions atomiques, garde-fous `assertNotLastOwner` et `assertNotLastSuperAdmin`), Task 11 (intégration : un scénario par nouveau rôle). Statuts des tasks inchangés (plan non commencé). Le modèle `Registration` n'est **pas** touché par cette mise à jour — la refonte snapshots inline est sous la responsabilité du Lot D (spec v2-11).

> **Mise à jour 2026-05-31 — SMTP plateforme uniquement** : suite à la décision de design du 2026-05-31, les paramètres SMTP (`smtpHost`, `smtpPort`, `smtpFrom`, `smtpUser`, `smtpPassword`, `smtpSecure`) ne vivent **que** dans `PlatformSettings`. Aucun override possible côté `OrgSettings` ni `EventSettings`. Le branding contextuel non-SMTP (`contactEmail`, `contactPhone`, logo) reste cascadé Event → Org → Platform. Les sections Task 1 (schéma Prisma), Task 5 (résolveur settings), et leur code TDD ont été ajustés pour refléter cette décision. La spec source [docs/v2/features/multi-tenancy-rbac.md](../../v2/features/multi-tenancy-rbac.md) est la référence. Le reCAPTCHA suit la même logique que le SMTP : plateforme uniquement, lu directement depuis `PlatformSettings`. Retrait des champs `recaptcha*` d'`OrgSettings`.

> **Mise à jour 2026-05-31 — reCAPTCHA plateforme uniquement** : décision corrigée le même jour (une première formulation parlait à tort de "reCAPTCHA org-only"). Les paramètres reCAPTCHA (`recaptchaEnabled`, `recaptchaSiteKey`, `recaptchaSecretKey`) vivent **exclusivement** dans `PlatformSettings`, avec defaults non-nullables (`false`, `""`, `""`). Aucun champ reCAPTCHA dans `OrgSettings` ni `EventSettings`, et aucun override possible. La lecture se fait directement via `getPlatformRecaptcha()` (et `getPlatformPublicRecaptcha()` pour les Server Components publics, qui masque `recaptchaSecretKey`), sur le même modèle que `getPlatformSmtp()`. Les sections Task 1 (schéma Prisma : `OrgSettings` perd les champs `recaptcha*`), Task 5 (résolveur settings : `ResolvedSettings` ne contient plus de champs reCAPTCHA, ajout de `getPlatformRecaptcha()` / `getPlatformPublicRecaptcha()`) ont été ajustées en conséquence.

> **Mise à jour 2026-05-31 — Enrichissement d'`Organization` et suppression d'`OrgSettings`** : suite à la décision de design du 2026-05-31, le modèle `Organization` est enrichi avec les informations administratives (`legalName`, `addressLine1`, `addressLine2`, `postalCode`, `city`, `country`, `taxId`, `website`, `logo`) et de contact public (`contactEmail`, `contactPhone`). Le modèle `OrgSettings` est **supprimé** : ses deux champs (`contactEmail`, `contactPhone`) sont fusionnés dans `Organization`. La cascade contact lit désormais directement `event.organization.contactEmail` / `event.organization.contactPhone` (plus de jointure `event.organization.settings`). L'activity log utilise `ORG_UPDATED` (le type `ORG_SETTINGS_UPDATED` disparaît). Les sections Task 1 (schéma Prisma) et Task 5 (résolveur settings + tests + implémentation) ont été ajustées pour refléter cette décision. La spec source [docs/v2/features/multi-tenancy-rbac.md](../../v2/features/multi-tenancy-rbac.md) est la référence.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the multi-tenant foundation of Badge v2: Prisma schema (User/Org/Event/Memberships/Settings/ActivityLog), authorization helpers, settings cascade resolver, and the Next.js middleware that scopes requests by tenant.

**Architecture:** The v2 schema replaces v1 entirely. Users live globally (no per-tenant duplication); rights are reconstructed each request via `OrgMembership` + `EventMembership` joins. Helpers in `src/lib/auth.ts` centralize all permission checks. Middleware enforces route-level scoping (`/admin/[orgId]/*`, `/staff/*`), and each API route re-checks with helpers (defense in depth). NextAuth JWT stays minimal (`userId` + `isStaff`) — memberships are server-resolved per request.

**Tech Stack:** Prisma 6 (MySQL), Next.js 16 App Router middleware, NextAuth 4 (Credentials, JWT), TypeScript 5, Vitest 4, bcryptjs.

**Spec:** [docs/v2/features/multi-tenancy-rbac.md](../../v2/features/multi-tenancy-rbac.md)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [x] | 2026-05-31 | Step 0.1 OK (branche feat/v2-implementation, arbre propre). Step 0.2 skippe sur decision utilisateur (pas de donnees critiques en BDD dev). |
| 1 | [x] | 2026-05-31 | Schema v2 + seed (SUPER_ADMIN aligne sur spec, pas STAFF_ADMIN comme le plan disait). Migrations v1 supprimees. BDD `investiture` (DATABASE_URL legacy v1, conservee). 14 tables, 1 user SUPER_ADMIN seede. Step 1.7 (commit) skippe : commit final en fin de Lot A. |
| 2 | [x] | 2026-05-31 | next-auth.d.ts (JWT minimal userId+isStaff) + auth.ts (SessionUser/UserContext/OrgMembershipLite/EventMembershipLite/EffectiveEventRole). Step 2.3 commit skippe. |
| 3 | [x] | 2026-05-31 | user-context.ts + test (4/4 passent en 201ms). Ajoute l'alias `@/` a vitest.config.ts (manquant). Test bonus "archived user" en plus des 3 du plan. Step 3.5 commit skippe. |
| 4 | [x] | 2026-05-31 | auth-helpers.ts + test (38/38 passent en 137ms). Matrice EVENT_PERMISSION_ROLES (16 permissions), hierarchies staff/org/event, effectiveEventRole avec heritages MANAGER->ADMIN et AUDITOR->VIEWER. Step 4.5 commit skippe. |
| 5 | [x] | 2026-05-31 | settings.ts (resolveSettings cascade, getPlatformSmtp/Recaptcha) + test (9/9 passent). |
| 6 | [x] | 2026-05-31 | activity-log.ts refondu (auto-derive orgId, staffActor) + test (4/4 passent). |
| 7 | [x] | 2026-05-31 | src/lib/auth.ts reecrit : authOptions NextAuth avec JWT minimal (userId, isStaff), authorize log USER_LOGIN. checkRole v1 supprime. Routes v1 casseront (attendu, Task 10 nettoie). |
| 8 | [x] | 2026-05-31 | auth-guards.ts : AuthError, requireStaff, requireOrgRole, requireEventRole (hierarchie partielle), requireEventPermission, getEffectiveEventRole, assertNotLastOwner, assertNotLastSuperAdmin. Tests 30/30 passent en 226ms. |
| 9 | [x] | 2026-05-31 | src/middleware.ts reecrit (scope checks /admin, /staff, /profile + isStaff). Smoke test curl skippe (routes v1 cassent encore, Task 10 nettoie). |
| 10 | [x] | 2026-05-31 | Identification des imports v1 casses (20+ fichiers api/, 3 pages admin/). Annotation faite dans docs/v2/architecture.md (section "Etat au lot A"). Pas de modification de routes (Plans 2-5 nettoient). |
| 11 | [x] | 2026-05-31 | integration.test.ts : 11 scenarios couvrant SUPER_ADMIN/STAFF_ADMIN/OWNER/MANAGER/AUDITOR/PRINTER/VIEWER + last-owner + last-super-admin. 11/11 passent en 743ms. |
| 12 | [x] | 2026-05-31 | Full suite : 123/131 passent. Les 8 fails sont dans 2 fichiers v1 obsoletes (auth.test.ts v1 sur checkRole, mail.test.ts v1 sur prisma.settings) - cohérent avec Task 10 (Plans 2-5 nettoient). Idempotence vérifiée (DROP investiture + push + seed + 96/96 tests v2 verts). Step 12.3 (git log) skippé : commit final en fin de Lot A. |

**Derniere session** : 2026-05-31 - Lot A complet (Tasks 0-12). 96 tests v2 verts (user-context, auth-helpers, auth-guards, settings, activity-log, integration). 8 fails dans 2 fichiers v1 obsoletes (auth.test.ts, mail.test.ts) - attendus, nettoyes par Plans 2-5.
**Prochaine etape** : Lot B Plan v2-02 espace staff (terminé). ~~Plan v2-07 reset~~ — **abandonné 2026-05-31** : pas de déploiement prod planifié. Suite : Lot C Plan v2-03 espace organisation (terminé 2026-05-31). Prochaine : Plan v2-04 espace événement.

> **Note conteneurs** : les conteneurs docker-compose s'appellent `badge-mysql-1`, `badge-app-1`, etc. (avec suffixe `-1`), pas `badge-db` / `badge-app`. Les commandes `docker exec badge-db ...` du plan doivent etre adaptees a `docker exec badge-mysql-1 ...`.

> **Note BDD** : la BDD effective s'appelle `investiture` (heritage v1, conservee via DATABASE_URL dans .env), pas `badge` comme le plan suppose. Les commandes du plan referencant `badge` doivent cibler `investiture`. Aucun impact fonctionnel.

> **Note seed** : le seed cree un `SUPER_ADMIN` (aligne sur la spec deploiement-initial.md) avec env vars `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`, alors que le plan disait `STAFF_ADMIN` / `SEED_STAFF_*`. Ecart justifie : le seed amorce la plateforme avec le role au sommet.

**Notes** :
- 2026-05-31 — Mise à jour du plan suite à la décision SMTP plateforme uniquement (voir note en tête). Statuts des tasks inchangés (plan non commencé). Sections impactées : Task 1 (schéma Prisma `OrgSettings` / `EventSettings`), Task 5 (résolveur settings + tests + type `ResolvedSettings` + nouvelle fonction `getPlatformSmtp()`).
- 2026-05-31 — Mise à jour du plan suite à la décision reCAPTCHA plateforme uniquement (corrige une première formulation erronée "reCAPTCHA org-only" du même jour). Statuts des tasks inchangés (plan non commencé). Sections impactées : Task 1 (schéma Prisma : retrait des champs `recaptcha*` d'`OrgSettings`, `PlatformSettings` conserve les 3 champs reCAPTCHA), Task 5 (résolveur settings : `ResolvedSettings` ne contient plus de champs reCAPTCHA, ajout de `getPlatformRecaptcha()` et `getPlatformPublicRecaptcha()` sur le même modèle que `getPlatformSmtp()`, tests adaptés).
- 2026-05-31 — Mise à jour du plan suite à la décision d'enrichissement d'`Organization` (legalName, adresse structurée, taxId, website, logo, contact) et suppression du modèle `OrgSettings`. La cascade contact lit directement `Organization`. Statuts des tasks inchangés (plan non commencé). Sections impactées : Task 1 (schéma Prisma : enrichissement d'`Organization`, suppression complète du modèle `OrgSettings`, type `ORG_SETTINGS_UPDATED` retiré au profit de `ORG_UPDATED`), Task 5 (tests + implémentation `resolveSettings` : remplacement des `prisma.orgSettings.*` par `prisma.organization.*`, lecture directe de `contactEmail`/`contactPhone` depuis `Organization`).
- 2026-05-31 — Enrichissement des enums RBAC pour aligner sur la spec validée. `StaffRole` ajoute `SUPER_ADMIN` au sommet, `OrgRole` ajoute `MANAGER` et `AUDITOR`, `EventRole` ajoute `PRINTER` et `VIEWER` (hiérarchie partielle). Statuts des tasks inchangés (plan non commencé). Sections impactées : Task 1 (schéma Prisma : 3 enums élargis), Task 4 (helpers purs : `STAFF_ORDER` inclut `SUPER_ADMIN`, refonte `effectiveEventRole` et `hasEventPermission` pour gérer la hiérarchie partielle event + héritages MANAGER→ADMIN et AUDITOR→VIEWER), Task 8 (guards DB-aware : `requireOrgRole` couvre la hiérarchie linéaire OWNER>MANAGER>AUDITOR, nouveau `requireEventPermission` permission-based, garde-fous `assertNotLastOwner` et `assertNotLastSuperAdmin`), Task 11 (intégration : un scénario par nouveau rôle MANAGER/AUDITOR/PRINTER/VIEWER/SUPER_ADMIN). Le modèle `Registration` reste inchangé (refonte snapshots inline → Lot D, spec v2-11).

---

## File Structure

**Files to create:**

- `prisma/schema.prisma` (full rewrite, replaces v1)
- `src/lib/auth.ts` (full rewrite — v1 logic obsolete)
- `src/lib/settings.ts` (new — cascade resolver)
- `src/lib/activity-log.ts` (rewrite — orgId/eventId/staffActor)
- `src/lib/user-context.ts` (new — loadUserContext helper)
- `src/lib/__tests__/auth.test.ts` (new — RBAC tests)
- `src/lib/__tests__/settings.test.ts` (new — cascade tests)
- `src/lib/__tests__/activity-log.test.ts` (new — log scoping tests)
- `src/middleware.ts` (rewrite — scope checks)
- `src/types/next-auth.d.ts` (rewrite — JWT minimal)
- `src/types/index.ts` (extend — new types)
- `src/types/auth.ts` (new — Session/UserContext types)

**Files removed:**

- Old v1-specific role logic in `src/lib/auth.ts` (full rewrite)

**Tests will live in `src/lib/__tests__/` (existing convention from v1).**

---

## Pre-flight

### Task 0: Verify clean working tree on the v2 branch

- [ ] **Step 0.1: Confirm branch**

Run: `git status && git branch --show-current`
Expected: `On branch feat/v2-sass`, working tree clean (or only this plan staged).

- [ ] **Step 0.2: Backup local v1 DB (precaution)**

Run inside the dev container if running, or via mysql client:

```bash
docker exec badge-db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" badge' > /tmp/badge-v1-precaution.sql
```

Expected: file `/tmp/badge-v1-precaution.sql` created.

> If the container is not running, run `make dev` first.

---

## Task 1: Reset Prisma schema and DB to v2 baseline

**Files:**
- Modify: `prisma/schema.prisma` (full rewrite)
- Modify: `prisma/seed.ts` (full rewrite — bootstrap a STAFF_ADMIN)

- [ ] **Step 1.1: Replace `prisma/schema.prisma`**

Overwrite with the v2 schema. Full content (no placeholders):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// =====================================================
//  Identity & RBAC
// =====================================================

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  password          String
  name              String
  isStaff           Boolean  @default(false)
  staffRole         StaffRole?
  inviteToken       String?  @unique
  inviteTokenExpiry DateTime?
  archived          Boolean  @default(false)
  archivedAt        DateTime?
  createdAt         DateTime @default(now())

  orgMemberships    OrgMembership[]
  eventMemberships  EventMembership[]
  activityLogs      ActivityLog[]
}

enum StaffRole {
  // Hierarchie lineaire : SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER.
  // SUPER_ADMIN au sommet (decision 2026-05-31) : tous les droits, y compris hard delete
  // org et promotion STAFF_ADMIN / SUPER_ADMIN, et actions metier sur donnees client
  // (avec audit staffActor=true). En v1, SUPER_ADMIN avait des restrictions metier ;
  // cette restriction disparait en v2.
  SUPER_ADMIN
  STAFF_ADMIN
  STAFF_SUPPORT
  STAFF_OBSERVER
}

// =====================================================
//  Organization
// =====================================================

model Organization {
  id                       String   @id @default(cuid())
  name                     String
  legalName                String?
  slug                     String   @unique

  // Adresse postale structuree
  addressLine1             String?
  addressLine2             String?
  postalCode               String?
  city                     String?
  country                  String?

  // Administratif
  taxId                    String?
  website                  String?
  logo                     String?

  // Contact public (anciennement OrgSettings - fusionne 2026-05-31)
  contactEmail             String?
  contactPhone             String?

  archived                 Boolean  @default(false)
  archivedAt               DateTime?
  createdAt                DateTime @default(now())

  quotaMaxEvents           Int?
  quotaMaxRegistrations    Int?
  quotaMaxStorageMB        Int?

  memberships              OrgMembership[]
  events                   Event[]
  categoryTemplates        CategoryTemplate[]
}

model OrgMembership {
  id           String       @id @default(cuid())
  userId       String
  orgId        String
  role         OrgRole
  createdAt    DateTime     @default(now())
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
  @@index([orgId])
}

enum OrgRole {
  // Hierarchie lineaire : OWNER > MANAGER > AUDITOR (decision 2026-05-31).
  // OWNER : pleins pouvoirs sur l'org (infos administratives, archivage, membres org).
  // MANAGER : gere les events de l'org (create/archive event, membres event,
  //           CategoryTemplate), mais ne touche pas aux infos org ni a la facturation.
  // AUDITOR : lecture seule sur tout, y compris activity log (DPO, commanditaire).
  // Heritages event : OWNER et MANAGER agissent comme ADMIN event sur les events de
  // l'org parent ; AUDITOR agit comme VIEWER event.
  OWNER
  MANAGER
  AUDITOR
}

// =====================================================
//  Event
// =====================================================

model Event {
  id               String   @id @default(cuid())
  orgId            String
  organization     Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  title            String
  slug             String   @unique
  location         String
  date             DateTime
  logo             String?
  registrationOpen Boolean  @default(false)
  archived         Boolean  @default(false)
  archivedAt       DateTime?
  createdAt        DateTime @default(now())

  memberships      EventMembership[]
  categories       Category[]
  registrations    Registration[]
  blockedEmails    BlockedEmail[]
  blockedDocuments BlockedDocument[]
  settings         EventSettings?

  @@index([orgId])
}

model EventMembership {
  id        String    @id @default(cuid())
  userId    String
  eventId   String
  role      EventRole
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  event     Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
  @@index([eventId])
}

enum EventRole {
  // Hierarchie PARTIELLE (decision 2026-05-31) : ADMIN > OPERATOR > { PRINTER, VIEWER }.
  // PRINTER et VIEWER sont DISJOINTS : ni l'un n'inclut l'autre. Consequence :
  // un simple "role minimum" lineaire ne suffit plus ; les checks metier s'expriment
  // par permissions atomiques (cf. requireEventPermission dans la spec).
  // - ADMIN     : tous les droits event.
  // - OPERATOR  : lecture detaillee + approbations + scan + impression badge ;
  //               ne supprime pas, ne cree pas manuellement, ne configure pas l'event.
  // - PRINTER   : ecran d'impression badge uniquement (recherche par nom/badgeId,
  //               impression). Pas d'acces a la liste detaillee, pas de scan.
  // - VIEWER    : liste agregee uniquement (compteurs, noms, categorie, statut).
  //               Pas de details personnels (email, doc, photo), pas d'impression.
  ADMIN
  OPERATOR
  PRINTER
  VIEWER
}

// =====================================================
//  Categories (replaces v1 Team)
// =====================================================

model Category {
  id            String   @id @default(cuid())
  eventId       String
  event         Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name          String
  color         String
  number        Int
  neutralBadge  Boolean  @default(false)
  anonymous     Boolean  @default(false)
  registrations Registration[]

  @@unique([eventId, number])
  @@unique([eventId, name])
}

model CategoryTemplate {
  id           String       @id @default(cuid())
  orgId        String
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name         String
  color        String
  number       Int
  neutralBadge Boolean      @default(false)
  anonymous    Boolean      @default(false)
  createdAt    DateTime     @default(now())

  @@index([orgId])
}

// =====================================================
//  Registration (scoped to event)
// =====================================================

model Registration {
  id                 String             @id
  eventId            String
  event              Event              @relation(fields: [eventId], references: [id], onDelete: Cascade)
  categoryId         String
  category           Category           @relation(fields: [categoryId], references: [id])
  email              String
  lastName           String
  firstName          String
  structure          String
  photo              String?
  idDocumentType     String
  idDocumentNumber   String
  idDocument         String?
  status             RegistrationStatus @default(PENDING)
  badgePrinted       Boolean            @default(false)
  badgePrintedAt     DateTime?
  allAccessGranted   Boolean            @default(false)
  rejectionReason    String?
  rejectionDetails   String?            @db.Text
  editToken          String?            @unique
  editTokenExpiresAt DateTime?
  createdAt          DateTime           @default(now())

  snapshots          SubmissionSnapshot[]

  @@index([eventId])
  @@index([eventId, email])
  @@index([categoryId])
}

model SubmissionSnapshot {
  id               String       @id @default(cuid())
  registrationId   String
  registration     Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  lastName         String
  firstName        String
  email            String
  structure        String
  categoryId       String
  idDocumentType   String
  idDocumentNumber String
  photo            String?
  idDocument       String?
  createdAt        DateTime     @default(now())

  @@index([registrationId])
}

enum RegistrationStatus {
  PENDING
  APPROVED
  REJECTED
}

model BlockedEmail {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  email     String
  reason    String?
  createdAt DateTime @default(now())

  @@unique([eventId, email])
}

model BlockedDocument {
  id             String   @id @default(cuid())
  eventId        String
  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  documentNumber String
  reason         String?
  createdAt      DateTime @default(now())

  @@unique([eventId, documentNumber])
}

// =====================================================
//  Settings cascade
// =====================================================

model PlatformSettings {
  id                 String  @id @default("singleton")
  smtpHost           String  @default("")
  smtpPort           Int     @default(587)
  smtpFrom           String  @default("noreply@badge.local")
  smtpUser           String  @default("")
  smtpPassword       String  @default("")
  smtpSecure         Boolean @default(false)
  // Note (2026-05-31) : reCAPTCHA est exclusivement configure ici (PlatformSettings),
  // meme logique que le SMTP. Aucun override Org/Event possible. Lecture via
  // getPlatformRecaptcha() / getPlatformPublicRecaptcha().
  recaptchaEnabled   Boolean @default(false)
  recaptchaSiteKey   String  @default("")
  recaptchaSecretKey String  @default("")
}

// Note (2026-05-31) : le modele OrgSettings a ete supprime. Ses champs
// (contactEmail, contactPhone) ont ete fusionnes dans Organization. La cascade
// contact lit desormais directement event.organization.contactEmail.

model EventSettings {
  id           String  @id @default(cuid())
  eventId      String  @unique
  event        Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // Note (2026-05-31) : pas de champs SMTP ici. Le SMTP est exclusivement
  // configure au niveau PlatformSettings (decision de design SMTP plateforme uniquement).
  contactEmail String?
  contactPhone String?
}

// =====================================================
//  Activity log
// =====================================================

model ActivityLog {
  id         String       @id @default(cuid())
  type       ActivityType
  userId     String?
  user       User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  orgId      String?
  eventId    String?
  targetId   String?
  details    Json?
  staffActor Boolean      @default(false)
  ipAddress  String?
  userAgent  String?      @db.Text
  createdAt  DateTime     @default(now())

  @@index([type])
  @@index([orgId])
  @@index([eventId])
  @@index([userId])
  @@index([createdAt])
}

enum ActivityType {
  REGISTRATION_CREATED
  REGISTRATION_APPROVED
  REGISTRATION_REJECTED
  REGISTRATION_UPDATED
  REGISTRATION_DELETED
  REGISTRATION_RESUBMITTED
  BADGE_PRINTED
  BADGE_BATCH_PRINTED
  BADGE_ALL_ACCESS_TOGGLED
  BADGE_EXPORTED
  BADGE_BATCH_EXPORTED
  BADGE_SCANNED
  USER_CREATED
  USER_UPDATED
  USER_DELETED
  USER_PASSWORD_SET
  USER_LOGIN
  CATEGORY_CREATED
  CATEGORY_UPDATED
  CATEGORY_DELETED
  CATEGORY_TEMPLATE_CREATED
  CATEGORY_TEMPLATE_UPDATED
  CATEGORY_TEMPLATE_DELETED
  ORG_CREATED
  ORG_UPDATED
  ORG_ARCHIVED
  ORG_RESTORED
  EVENT_CREATED
  EVENT_UPDATED
  EVENT_ARCHIVED
  EVENT_RESTORED
  EVENT_REGISTRATION_OPENED
  EVENT_REGISTRATION_CLOSED
  MEMBERSHIP_ADDED
  MEMBERSHIP_REMOVED
  MEMBERSHIP_ROLE_CHANGED
  PLATFORM_SETTINGS_UPDATED
  EVENT_SETTINGS_UPDATED
  EDIT_LINK_SENT
}
```

- [ ] **Step 1.2: Replace `prisma/seed.ts`**

Overwrite with minimal v2 seed (STAFF_ADMIN + PlatformSettings only — no orgs/events):

```typescript
import { PrismaClient, StaffRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      smtpHost: process.env.PLATFORM_SMTP_HOST || "mailpit",
      smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || "1025", 10),
      smtpFrom: process.env.PLATFORM_SMTP_FROM || "noreply@badge.local",
      smtpUser: process.env.PLATFORM_SMTP_USER || "",
      smtpPassword: process.env.PLATFORM_SMTP_PASSWORD || "",
      smtpSecure: process.env.PLATFORM_SMTP_SECURE === "true",
    },
    update: {},
  });

  const email = process.env.SEED_STAFF_EMAIL || "admin@badge.local";
  const password = process.env.SEED_STAFF_PASSWORD || "admin123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: "Staff Admin",
        isStaff: true,
        staffRole: StaffRole.STAFF_ADMIN,
      },
    });
    console.log(`STAFF_ADMIN created: ${email}`);
  } else {
    console.log(`STAFF_ADMIN already exists: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 1.3: Drop and recreate the local DB**

Inside the dev container:

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"'
```

Expected: success, no output (or "Query OK").

- [ ] **Step 1.4: Push v2 schema**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db push --accept-data-loss
```

Expected: "Your database is now in sync with your Prisma schema. Done in Xs."

- [ ] **Step 1.5: Generate Prisma client**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma generate
```

Expected: "Generated Prisma Client (vX.X.X) to ./node_modules/@prisma/client"

- [ ] **Step 1.6: Seed**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db seed
```

Expected: `STAFF_ADMIN created: admin@badge.local`

- [ ] **Step 1.7: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts
git commit -m "feat(v2): schema Prisma v2 + seed minimal STAFF_ADMIN"
```

---

## Task 2: Type definitions for session and user context

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Create: `src/types/auth.ts`

- [ ] **Step 2.1: Replace `src/types/next-auth.d.ts`**

```typescript
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isStaff: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    isStaff: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    isStaff: boolean;
  }
}
```

- [ ] **Step 2.2: Create `src/types/auth.ts`**

```typescript
import type { StaffRole, OrgRole, EventRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
};

export type OrgMembershipLite = { orgId: string; role: OrgRole };
export type EventMembershipLite = { eventId: string; role: EventRole };

export type UserContext = {
  user: { id: string; email: string; name: string };
  isStaff: boolean;
  staffRole: StaffRole | null;
  orgMemberships: OrgMembershipLite[];
  eventMemberships: EventMembershipLite[];
};

export type EffectiveEventRole = EventRole | "STAFF" | null;
```

- [ ] **Step 2.3: Commit**

```bash
git add src/types/next-auth.d.ts src/types/auth.ts
git commit -m "feat(v2): types Session/UserContext pour le RBAC v2"
```

---

## Task 3: `loadUserContext` — single source of truth for permission resolution

**Files:**
- Create: `src/lib/user-context.ts`
- Create: `src/lib/__tests__/user-context.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create `src/lib/__tests__/user-context.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";

describe("loadUserContext", () => {
  beforeEach(async () => {
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("returns staff role for a staff user", async () => {
    const u = await prisma.user.create({
      data: {
        email: "s@x",
        password: "x",
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.isStaff).toBe(true);
    expect(ctx?.staffRole).toBe("STAFF_ADMIN");
    expect(ctx?.orgMemberships).toEqual([]);
    expect(ctx?.eventMemberships).toEqual([]);
  });

  it("returns memberships for a client user", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e", location: "L", date: new Date() },
    });
    const u = await prisma.user.create({
      data: { email: "u@x", password: "x", name: "U" },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });

    const ctx = await loadUserContext(u.id);
    expect(ctx?.isStaff).toBe(false);
    expect(ctx?.staffRole).toBeNull();
    expect(ctx?.orgMemberships).toEqual([{ orgId: org.id, role: "OWNER" }]);
    expect(ctx?.eventMemberships).toEqual([{ eventId: event.id, role: "OPERATOR" }]);
  });

  it("returns null for unknown user", async () => {
    const ctx = await loadUserContext("missing");
    expect(ctx).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run the test to verify it fails**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/user-context.test.ts
```

Expected: FAIL with `Cannot find module '@/lib/user-context'`.

- [ ] **Step 3.3: Implement `src/lib/user-context.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import type { UserContext } from "@/types/auth";

export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      orgMemberships: { select: { orgId: true, role: true } },
      eventMemberships: { select: { eventId: true, role: true } },
    },
  });

  if (!user || user.archived) return null;

  return {
    user: { id: user.id, email: user.email, name: user.name },
    isStaff: user.isStaff,
    staffRole: user.staffRole,
    orgMemberships: user.orgMemberships,
    eventMemberships: user.eventMemberships,
  };
}
```

- [ ] **Step 3.4: Run the test to verify it passes**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/user-context.test.ts
```

Expected: 3 passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/user-context.ts src/lib/__tests__/user-context.test.ts
git commit -m "feat(v2): loadUserContext (resolveur memberships + staff)"
```

---

## Task 4: Authorization helpers — `requireStaff` and `staffRoleAtLeast`

**Files:**
- Create: `src/lib/auth-helpers.ts` (pure helpers, no IO)
- Create: `src/lib/__tests__/auth-helpers.test.ts`

> Pure functions go into `auth-helpers.ts` to be unit-testable without a DB. `auth.ts` (Task 8) will compose them with DB-aware checks.

- [ ] **Step 4.1: Write failing tests**

Create `src/lib/__tests__/auth-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  staffRoleAtLeast,
  orgRoleAtLeast,
  hasOrgRole,
  effectiveEventRole,
  hasEventPermission,
  type EventPermission,
} from "@/lib/auth-helpers";
import type { UserContext } from "@/types/auth";

const baseCtx = (over: Partial<UserContext> = {}): UserContext => ({
  user: { id: "u1", email: "u@x", name: "U" },
  isStaff: false,
  staffRole: null,
  orgMemberships: [],
  eventMemberships: [],
  ...over,
});

describe("staffRoleAtLeast", () => {
  it("SUPER_ADMIN >= STAFF_ADMIN", () => {
    expect(staffRoleAtLeast("SUPER_ADMIN", "STAFF_ADMIN")).toBe(true);
  });
  it("SUPER_ADMIN >= SUPER_ADMIN", () => {
    expect(staffRoleAtLeast("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });
  it("STAFF_ADMIN < SUPER_ADMIN", () => {
    expect(staffRoleAtLeast("STAFF_ADMIN", "SUPER_ADMIN")).toBe(false);
  });
  it("STAFF_ADMIN >= STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_ADMIN", "STAFF_SUPPORT")).toBe(true);
  });
  it("STAFF_SUPPORT >= STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_SUPPORT", "STAFF_SUPPORT")).toBe(true);
  });
  it("STAFF_OBSERVER < STAFF_SUPPORT", () => {
    expect(staffRoleAtLeast("STAFF_OBSERVER", "STAFF_SUPPORT")).toBe(false);
  });
});

describe("orgRoleAtLeast", () => {
  // Hierarchie lineaire OWNER > MANAGER > AUDITOR
  it("OWNER >= MANAGER", () => {
    expect(orgRoleAtLeast("OWNER", "MANAGER")).toBe(true);
  });
  it("MANAGER >= AUDITOR", () => {
    expect(orgRoleAtLeast("MANAGER", "AUDITOR")).toBe(true);
  });
  it("AUDITOR >= AUDITOR", () => {
    expect(orgRoleAtLeast("AUDITOR", "AUDITOR")).toBe(true);
  });
  it("MANAGER < OWNER", () => {
    expect(orgRoleAtLeast("MANAGER", "OWNER")).toBe(false);
  });
  it("AUDITOR < MANAGER", () => {
    expect(orgRoleAtLeast("AUDITOR", "MANAGER")).toBe(false);
  });
});

describe("hasOrgRole", () => {
  // hasOrgRole verifie le niveau MINIMUM (linear chain OWNER > MANAGER > AUDITOR).
  it("returns true if membership exactly matches", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "OWNER")).toBe(true);
  });
  it("OWNER satisfies MANAGER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "MANAGER")).toBe(true);
  });
  it("OWNER and MANAGER satisfy AUDITOR requirement", () => {
    const ctxOwner = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    const ctxManager = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasOrgRole(ctxOwner, "o1", "AUDITOR")).toBe(true);
    expect(hasOrgRole(ctxManager, "o1", "AUDITOR")).toBe(true);
  });
  it("MANAGER does not satisfy OWNER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasOrgRole(ctx, "o1", "OWNER")).toBe(false);
  });
  it("AUDITOR does not satisfy MANAGER requirement", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(hasOrgRole(ctx, "o1", "MANAGER")).toBe(false);
  });
  it("returns true for staff regardless of membership", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_SUPPORT" });
    expect(hasOrgRole(ctx, "any", "OWNER")).toBe(true);
  });
  it("returns false if no membership and not staff", () => {
    expect(hasOrgRole(baseCtx(), "o1", "OWNER")).toBe(false);
  });
});

describe("effectiveEventRole", () => {
  // Hierarchie partielle event : ADMIN > OPERATOR > { PRINTER, VIEWER }.
  // PRINTER et VIEWER sont disjoints ; on retourne le role explicite tel quel,
  // sauf cas d'heritage staff/org (qui mappent vers STAFF, ADMIN, ou VIEWER).
  it("returns STAFF for staff user", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns STAFF for SUPER_ADMIN", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "SUPER_ADMIN" });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns ADMIN when user is OWNER of parent org", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("ADMIN");
  });
  it("returns ADMIN when user is MANAGER of parent org (heritage)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("ADMIN");
  });
  it("returns VIEWER when user is AUDITOR of parent org (heritage)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("VIEWER");
  });
  it("returns explicit EventMembership.role when present", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("OPERATOR");
  });
  it("returns PRINTER for explicit PRINTER membership", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "PRINTER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("PRINTER");
  });
  it("returns VIEWER for explicit VIEWER membership", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "VIEWER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("VIEWER");
  });
  it("STAFF wins over OWNER and explicit", () => {
    const ctx = baseCtx({
      isStaff: true,
      staffRole: "STAFF_ADMIN",
      orgMemberships: [{ orgId: "o1", role: "OWNER" }],
      eventMemberships: [{ eventId: "e1", role: "OPERATOR" }],
    });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns null when no rights", () => {
    expect(effectiveEventRole(baseCtx(), "e1", "o1")).toBeNull();
  });
});

describe("hasEventPermission", () => {
  // Source de verite : matrice de permissions atomiques de la spec.
  // Permissions testees : badge.print, event.read.detailed, event.read.aggregated,
  // scan.check-in, registration.approve, registration.delete, event.update.

  // Cas piege classique : PRINTER peut imprimer mais ne scanne pas
  it("PRINTER can badge.print but not scan.check-in", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "PRINTER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "scan.check-in")).toBe(false);
  });

  // VIEWER : seulement lecture agregee
  it("VIEWER can read.aggregated but not read.detailed nor badge.print", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "VIEWER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.aggregated")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(false);
  });

  // OPERATOR : detail + approbation + impression + scan, mais pas de mutation event
  it("OPERATOR can read.detailed, approve, badge.print, scan.check-in", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.approve")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "scan.check-in")).toBe(true);
  });
  it("OPERATOR cannot delete registration nor update event", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(false);
  });

  // ADMIN : tout
  it("ADMIN can do everything (sample)", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "ADMIN" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(true);
  });

  // Heritage org -> event
  it("OWNER of parent org has all event permissions", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });
  it("MANAGER of parent org has all event permissions (heritage symetrique a OWNER)", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "MANAGER" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.update")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });
  it("AUDITOR of parent org : event.read.aggregated only, refuses detailed", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "AUDITOR" }] });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.aggregated")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(false);
    expect(hasEventPermission(ctx, "e1", "o1", "badge.print")).toBe(false);
  });

  // Staff bypass
  it("staff bypasses any event permission check", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_OBSERVER" });
    expect(hasEventPermission(ctx, "e1", "o1", "event.read.detailed")).toBe(true);
    expect(hasEventPermission(ctx, "e1", "o1", "registration.delete")).toBe(true);
  });

  it("no rights returns false", () => {
    expect(hasEventPermission(baseCtx(), "e1", "o1", "event.read.aggregated")).toBe(false);
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-helpers.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4.3: Implement `src/lib/auth-helpers.ts`**

```typescript
import type { StaffRole, OrgRole, EventRole } from "@prisma/client";
import type { UserContext, EffectiveEventRole } from "@/types/auth";

// Hierarchie lineaire staff : SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER.
const STAFF_ORDER: Record<StaffRole, number> = {
  STAFF_OBSERVER: 1,
  STAFF_SUPPORT: 2,
  STAFF_ADMIN: 3,
  SUPER_ADMIN: 4,
};

// Hierarchie lineaire org : OWNER > MANAGER > AUDITOR (decision 2026-05-31).
const ORG_ORDER: Record<OrgRole, number> = {
  AUDITOR: 1,
  MANAGER: 2,
  OWNER: 3,
};

// Permissions atomiques event (cf. spec docs/v2/features/multi-tenancy-rbac.md).
// La hierarchie event etant partielle (ADMIN > OPERATOR > { PRINTER, VIEWER }),
// les checks metier s'expriment par permission et non par "role minimum".
export type EventPermission =
  | "event.read.aggregated"
  | "event.read.detailed"
  | "registration.approve"
  | "registration.create"
  | "registration.delete"
  | "registration.export"
  | "registration.block"
  | "badge.print"
  | "scan.check-in"
  | "event.update"
  | "event.archive"
  | "event.registration_toggle"
  | "event.settings.update"
  | "event.categories.manage"
  | "event.members.manage"
  | "event.activity.read";

// Roles event qui satisfont chaque permission. Source : matrice "Niveau evenement"
// dans docs/v2/features/multi-tenancy-rbac.md. La table est exhaustive et inclut
// l'heritage interne (OPERATOR herite des lectures, ADMIN herite de tout).
const EVENT_PERMISSION_ROLES: Record<EventPermission, ReadonlyArray<EventRole>> = {
  "event.read.aggregated":   ["ADMIN", "OPERATOR", "VIEWER"],
  "event.read.detailed":     ["ADMIN", "OPERATOR"],
  "registration.approve":    ["ADMIN", "OPERATOR"],
  "registration.create":     ["ADMIN"],
  "registration.delete":     ["ADMIN"],
  "registration.export":     ["ADMIN"],
  "registration.block":      ["ADMIN"],
  "badge.print":             ["ADMIN", "OPERATOR", "PRINTER"],
  "scan.check-in":           ["ADMIN", "OPERATOR"],
  "event.update":            ["ADMIN"],
  "event.archive":           ["ADMIN"],
  "event.registration_toggle": ["ADMIN"],
  "event.settings.update":   ["ADMIN"],
  "event.categories.manage": ["ADMIN"],
  "event.members.manage":    ["ADMIN"],
  "event.activity.read":     ["ADMIN"],
};

export function staffRoleAtLeast(actual: StaffRole, required: StaffRole): boolean {
  return STAFF_ORDER[actual] >= STAFF_ORDER[required];
}

export function orgRoleAtLeast(actual: OrgRole, required: OrgRole): boolean {
  return ORG_ORDER[actual] >= ORG_ORDER[required];
}

// Verifie le niveau MINIMUM en suivant la chaine OWNER > MANAGER > AUDITOR.
// Un OWNER satisfait MANAGER et AUDITOR ; un MANAGER satisfait AUDITOR.
export function hasOrgRole(ctx: UserContext, orgId: string, role: OrgRole): boolean {
  if (ctx.isStaff) return true;
  return ctx.orgMemberships.some(
    (m) => m.orgId === orgId && orgRoleAtLeast(m.role, role),
  );
}

// Resout le role effectif d'un user sur un event en appliquant les heritages :
//   - staff (n'importe quel staffRole) => "STAFF"
//   - OWNER ou MANAGER de l'org parent => "ADMIN" (heritage symetrique)
//   - AUDITOR de l'org parent => "VIEWER" (lecture seule agregee)
//   - sinon, EventMembership explicite si presente
//   - null sinon
export function effectiveEventRole(
  ctx: UserContext,
  eventId: string,
  orgId: string,
): EffectiveEventRole {
  if (ctx.isStaff) return "STAFF";

  const orgMembership = ctx.orgMemberships.find((m) => m.orgId === orgId);
  if (orgMembership) {
    if (orgMembership.role === "OWNER" || orgMembership.role === "MANAGER") {
      return "ADMIN";
    }
    if (orgMembership.role === "AUDITOR") {
      return "VIEWER";
    }
  }

  const m = ctx.eventMemberships.find((x) => x.eventId === eventId);
  return m ? m.role : null;
}

// Verifie une permission atomique. Source de verite : EVENT_PERMISSION_ROLES.
// Staff bypass. L'heritage org est resolu via effectiveEventRole.
export function hasEventPermission(
  ctx: UserContext,
  eventId: string,
  orgId: string,
  permission: EventPermission,
): boolean {
  const eff = effectiveEventRole(ctx, eventId, orgId);
  if (eff === "STAFF") return true;
  if (eff === null) return false;
  return EVENT_PERMISSION_ROLES[permission].includes(eff);
}
```

> **Note** : `eventRoleAtLeast` n'existe plus en v2. La hierarchie event etant partielle (PRINTER et VIEWER disjoints), un simple ordre numerique est trompeur. Les contextes UI qui ont besoin d'un check "role minimum" doivent passer par `hasEventPermission` avec la permission appropriee. Pour le seul cas residuel "le user est-il au moins ADMIN ?", on peut comparer `effectiveEventRole(...) === "ADMIN" || ... === "STAFF"` explicitement.

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-helpers.test.ts
```

Expected: tous les tests passent (staff hierarchie, org hierarchie, hasOrgRole, effectiveEventRole, hasEventPermission, y compris cas piege PRINTER vs scan).

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/auth-helpers.ts src/lib/__tests__/auth-helpers.test.ts
git commit -m "feat(v2): helpers RBAC purs (staffRoleAtLeast, orgRoleAtLeast, hasOrgRole, effectiveEventRole, hasEventPermission)"
```

---

## Task 5: Settings cascade resolver

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/lib/__tests__/settings.test.ts`

- [ ] **Step 5.1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resolveSettings,
  resolvePublicSettings,
  getPlatformSmtp,
  getPlatformRecaptcha,
  getPlatformPublicRecaptcha,
} from "@/lib/settings";

describe("resolveSettings", () => {
  beforeEach(async () => {
    await prisma.eventSettings.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "platform-smtp",
        smtpPort: 587,
        smtpFrom: "platform@badge.local",
        smtpUser: "",
        smtpPassword: "PLATFORM_PW",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
  });

  it("returns platform contact defaults when no org/event override", async () => {
    const s = await resolveSettings();
    expect(s.contactEmail).toBe("");
    expect(s.contactPhone).toBe("");
  });

  it("never exposes SMTP fields in the resolved settings", async () => {
    const s = await resolveSettings();
    // SMTP n'est plus cascade : il est lu directement via getPlatformSmtp()
    expect("smtpHost" in s).toBe(false);
    expect("smtpPort" in s).toBe(false);
    expect("smtpFrom" in s).toBe(false);
    expect("smtpUser" in s).toBe(false);
    expect("smtpPassword" in s).toBe(false);
    expect("smtpSecure" in s).toBe(false);
  });

  it("never exposes reCAPTCHA fields in the resolved settings", async () => {
    const s = await resolveSettings();
    // reCAPTCHA n'est plus cascade : il est lu directement via getPlatformRecaptcha()
    expect("recaptchaEnabled" in s).toBe(false);
    expect("recaptchaSiteKey" in s).toBe(false);
    expect("recaptchaSecretKey" in s).toBe(false);
  });

  it("org contactEmail override wins over platform", async () => {
    const org = await prisma.organization.create({
      data: { name: "O", slug: "o", contactEmail: "org@x" },
    });
    const s = await resolveSettings(undefined, org.id);
    expect(s.contactEmail).toBe("org@x");
  });

  it("event contactEmail override wins over org", async () => {
    const org = await prisma.organization.create({
      data: { name: "O", slug: "o2", contactEmail: "org@x" },
    });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e2", location: "L", date: new Date() },
    });
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "event@x" },
    });

    const s = await resolveSettings(event.id);
    expect(s.contactEmail).toBe("event@x");
  });
});

describe("getPlatformSmtp", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "platform-smtp",
        smtpPort: 587,
        smtpFrom: "platform@badge.local",
        smtpUser: "u",
        smtpPassword: "PLATFORM_PW",
        smtpSecure: false,
      },
    });
  });

  it("reads SMTP directly from PlatformSettings, no cascade", async () => {
    const smtp = await getPlatformSmtp();
    expect(smtp.smtpHost).toBe("platform-smtp");
    expect(smtp.smtpPort).toBe(587);
    expect(smtp.smtpFrom).toBe("platform@badge.local");
    expect(smtp.smtpUser).toBe("u");
    expect(smtp.smtpPassword).toBe("PLATFORM_PW");
    expect(smtp.smtpSecure).toBe(false);
  });
});

describe("getPlatformRecaptcha", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        recaptchaEnabled: true,
        recaptchaSiteKey: "SITE_KEY",
        recaptchaSecretKey: "SECRET_KEY",
      },
    });
  });

  it("reads reCAPTCHA directly from PlatformSettings, no cascade", async () => {
    const r = await getPlatformRecaptcha();
    expect(r.recaptchaEnabled).toBe(true);
    expect(r.recaptchaSiteKey).toBe("SITE_KEY");
    expect(r.recaptchaSecretKey).toBe("SECRET_KEY");
  });
});

describe("getPlatformPublicRecaptcha", () => {
  beforeEach(async () => {
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        recaptchaEnabled: true,
        recaptchaSiteKey: "SITE_KEY",
        recaptchaSecretKey: "SECRET_KEY",
      },
    });
  });

  it("returns enabled + site key but never the secret key", async () => {
    const r = await getPlatformPublicRecaptcha();
    expect(r.recaptchaEnabled).toBe(true);
    expect(r.recaptchaSiteKey).toBe("SITE_KEY");
    expect("recaptchaSecretKey" in r).toBe(false);
  });
});

describe("resolvePublicSettings", () => {
  it("never exposes SMTP nor reCAPTCHA fields", async () => {
    const s = await resolvePublicSettings();
    // SMTP n'est pas dans ResolvedSettings, donc absent par construction
    expect("smtpPassword" in s).toBe(false);
    expect("smtpUser" in s).toBe(false);
    expect("smtpHost" in s).toBe(false);
    // reCAPTCHA non plus : lecture via getPlatformPublicRecaptcha()
    expect("recaptchaEnabled" in s).toBe(false);
    expect("recaptchaSiteKey" in s).toBe(false);
    expect("recaptchaSecretKey" in s).toBe(false);
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/settings.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 5.3: Implement `src/lib/settings.ts`**

```typescript
import { prisma } from "@/lib/prisma";

// Note (2026-05-31) : ResolvedSettings ne contient ni champs SMTP ni champs reCAPTCHA.
// Decision de design : SMTP et reCAPTCHA sont exclusivement geres au niveau
// PlatformSettings (pas d'override Org/Event). Voir docs/v2/features/multi-tenancy-rbac.md.
// Pour acceder au SMTP, utiliser getPlatformSmtp().
// Pour acceder au reCAPTCHA, utiliser getPlatformRecaptcha() (avec secret) ou
// getPlatformPublicRecaptcha() (sans secret, pour les Server Components publics).
export type ResolvedSettings = {
  contactEmail: string;
  contactPhone: string;
};

export type PublicSettings = ResolvedSettings;

export type PlatformSmtp = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
};

export type PlatformRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
};

export type PublicRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
};

function pick<T>(...candidates: (T | null | undefined)[]): T | undefined {
  for (const c of candidates) {
    if (c !== null && c !== undefined) return c;
  }
  return undefined;
}

export async function resolveSettings(
  eventId?: string,
  orgId?: string,
): Promise<ResolvedSettings> {
  let eventSettings: Awaited<ReturnType<typeof prisma.eventSettings.findUnique>> = null;
  let event: { orgId: string } | null = null;
  if (eventId) {
    eventSettings = await prisma.eventSettings.findUnique({ where: { eventId } });
    event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  }

  // Note (2026-05-31) : OrgSettings supprime. Le contact org est lu directement
  // depuis Organization (contactEmail, contactPhone fusionnes dans le modele).
  const effectiveOrgId = orgId ?? event?.orgId;
  let organization: { contactEmail: string | null; contactPhone: string | null } | null = null;
  if (effectiveOrgId) {
    organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { contactEmail: true, contactPhone: true },
    });
  }

  // Cascade Event > Org pour le contact uniquement.
  // SMTP et reCAPTCHA ne sont PAS cascades (lecture directe via getPlatformSmtp() /
  // getPlatformRecaptcha()).
  return {
    contactEmail: pick(eventSettings?.contactEmail, organization?.contactEmail) ?? "",
    contactPhone: pick(eventSettings?.contactPhone, organization?.contactPhone) ?? "",
  };
}

export async function resolvePublicSettings(
  eventId?: string,
  orgId?: string,
): Promise<PublicSettings> {
  return resolveSettings(eventId, orgId);
}

// Lecture directe du SMTP depuis PlatformSettings (pas de cascade).
// Utilise par src/lib/mail.ts pour resoudre le transporter.
export async function getPlatformSmtp(): Promise<PlatformSmtp> {
  const platform = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!platform) {
    throw new Error("PlatformSettings singleton is missing. Run prisma db seed.");
  }
  return {
    smtpHost: platform.smtpHost,
    smtpPort: platform.smtpPort,
    smtpFrom: platform.smtpFrom,
    smtpUser: platform.smtpUser,
    smtpPassword: platform.smtpPassword,
    smtpSecure: platform.smtpSecure,
  };
}

// Lecture directe du reCAPTCHA depuis PlatformSettings (pas de cascade).
// Variante "publique" pour les Server Components qui rendent du HTML cote client :
// elle masque recaptchaSecretKey.
export async function getPlatformRecaptcha(): Promise<PlatformRecaptcha> {
  const platform = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!platform) {
    throw new Error("PlatformSettings singleton is missing. Run prisma db seed.");
  }
  return {
    recaptchaEnabled: platform.recaptchaEnabled,
    recaptchaSiteKey: platform.recaptchaSiteKey,
    recaptchaSecretKey: platform.recaptchaSecretKey,
  };
}

export async function getPlatformPublicRecaptcha(): Promise<PublicRecaptcha> {
  const { recaptchaEnabled, recaptchaSiteKey } = await getPlatformRecaptcha();
  return { recaptchaEnabled, recaptchaSiteKey };
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/settings.test.ts
```

Expected: 9 passed.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts
git commit -m "feat(v2): resolveSettings (cascade contact) + getPlatformSmtp + getPlatformRecaptcha"
```

---

## Task 6: Activity log v2 (orgId, eventId, staffActor)

**Files:**
- Modify: `src/lib/activity-log.ts` (rewrite)
- Create: `src/lib/__tests__/activity-log.test.ts`

- [ ] **Step 6.1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

describe("logActivity", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("auto-derives orgId from eventId", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "ola" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evt-a", location: "", date: new Date() },
    });
    await logActivity({ type: "REGISTRATION_CREATED", eventId: event.id });
    const log = await prisma.activityLog.findFirst();
    expect(log?.orgId).toBe(org.id);
    expect(log?.eventId).toBe(event.id);
  });

  it("marks staffActor=true when actor is staff and target is client data", async () => {
    const staff = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "olb" } });

    await logActivity({ type: "ORG_UPDATED", userId: staff.id, orgId: org.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(true);
  });

  it("staffActor=false for platform actions (no orgId)", async () => {
    const staff = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await logActivity({ type: "PLATFORM_SETTINGS_UPDATED", userId: staff.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "PLATFORM_SETTINGS_UPDATED" } });
    expect(log?.staffActor).toBe(false);
  });

  it("staffActor=false for non-staff client action", async () => {
    const owner = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "olc" } });
    await logActivity({ type: "ORG_UPDATED", userId: owner.id, orgId: org.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/activity-log.test.ts
```

Expected: FAIL (current v1 implementation does not support orgId/eventId/staffActor).

- [ ] **Step 6.3: Rewrite `src/lib/activity-log.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import type { ActivityType, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

export type LogActivityInput = {
  type: ActivityType;
  userId?: string;
  orgId?: string;
  eventId?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  req?: NextRequest;
};

function extractRequestMeta(req?: NextRequest) {
  if (!req) return { ipAddress: undefined, userAgent: undefined };
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  let { orgId, eventId, userId, type, targetId, details, req } = input;

  if (eventId && !orgId) {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { orgId: true },
    });
    orgId = ev?.orgId ?? undefined;
  }

  let staffActor = false;
  if (userId && orgId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { isStaff: true },
    });
    staffActor = !!u?.isStaff;
  }

  const meta = extractRequestMeta(req);

  await prisma.activityLog.create({
    data: {
      type,
      userId: userId ?? null,
      orgId: orgId ?? null,
      eventId: eventId ?? null,
      targetId: targetId ?? null,
      details: details ?? undefined,
      staffActor,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/activity-log.test.ts
```

Expected: 4 passed.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/activity-log.ts src/lib/__tests__/activity-log.test.ts
git commit -m "feat(v2): activity-log v2 (orgId/eventId derives + staffActor)"
```

---

## Task 7: NextAuth options refactor (JWT minimal)

**Files:**
- Modify: `src/lib/auth.ts` (rewrite — keep `authOptions`, remove v1 `checkRole`)

> The v1 `auth.ts` exports `authOptions` *and* the old `checkRole(role, required)`. We replace both. The DB-aware role checks live in Task 8.

- [ ] **Step 7.1: Rewrite `src/lib/auth.ts` (NextAuth options only)**

```typescript
import { compare } from "bcryptjs";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || user.archived) return null;
        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;

        await logActivity({ type: "USER_LOGIN", userId: user.id });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isStaff: user.isStaff,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isStaff = user.isStaff;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        isStaff: token.isStaff,
      };
      return session;
    },
  },
};
```

- [ ] **Step 7.2: Remove v1 `checkRole` from `auth.ts` if present**

The file is fully replaced in Step 7.1; no `checkRole` export remains.

- [ ] **Step 7.3: Verify the app type-checks**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit
```

Expected: type errors are present at this stage because many v1 routes still call `checkRole`. **Do not fix them now** — those routes are scheduled for deletion in Plan 2-5. Only `src/lib/auth.ts` should compile cleanly when isolated.

To verify only the new file compiles:

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit --project tsconfig.json 2>&1 | grep "src/lib/auth.ts"
```

Expected: no output (the file is clean).

- [ ] **Step 7.4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(v2): authOptions NextAuth avec JWT minimal (userId, isStaff)"
```

---

## Task 8: DB-aware require* helpers

**Files:**
- Create: `src/lib/auth-guards.ts` (DB-aware permission guards, throws on failure)
- Create: `src/lib/__tests__/auth-guards.test.ts`

- [ ] **Step 8.1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  requireStaff,
  requireOrgRole,
  requireEventRole,
  requireEventPermission,
  getEffectiveEventRole,
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  AuthError,
} from "@/lib/auth-guards";

async function setupOrgEvent() {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}-${Math.random()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}-${Math.random()}`, location: "", date: new Date() },
  });
  return { org, event };
}

async function resetAll() {
  await prisma.activityLog.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
}

describe("requireStaff", () => {
  beforeEach(resetAll);

  it("throws AuthError if user not found", async () => {
    await expect(requireStaff("missing", "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws if user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await expect(requireStaff(u.id, "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
  });

  // Hierarchie SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER
  it("requireStaff(SUPER_ADMIN) accepts a SUPER_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(requireStaff(u.id, "SUPER_ADMIN")).resolves.toBeUndefined();
  });

  it("requireStaff(SUPER_ADMIN) rejects a STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "SUPER_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireStaff(STAFF_ADMIN) accepts a SUPER_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).resolves.toBeUndefined();
  });

  it("requireStaff(STAFF_ADMIN) accepts a STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a2@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).resolves.toBeUndefined();
  });

  it("passes for STAFF_ADMIN when STAFF_SUPPORT required", async () => {
    const u = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_SUPPORT")).resolves.toBeUndefined();
  });

  it("throws for STAFF_OBSERVER when STAFF_ADMIN required", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireOrgRole", () => {
  beforeEach(resetAll);

  // Hierarchie lineaire OWNER > MANAGER > AUDITOR

  it("requireOrgRole(OWNER) accepts OWNER, rejects MANAGER and AUDITOR", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "OWNER")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "OWNER")).rejects.toBeInstanceOf(AuthError);
    await expect(requireOrgRole(aud.id, org.id, "OWNER")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireOrgRole(MANAGER) accepts OWNER and MANAGER, rejects AUDITOR", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "MANAGER")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "MANAGER")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "MANAGER")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireOrgRole(AUDITOR) accepts all three org roles", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "AUDITOR")).resolves.toBeUndefined();
  });

  it("passes for staff (bypass)", async () => {
    const { org } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    await expect(requireOrgRole(s.id, org.id, "OWNER")).resolves.toBeUndefined();
  });

  it("throws for non-member, non-staff", async () => {
    const { org } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "x@x", password: "x", name: "X" } });
    await expect(requireOrgRole(u.id, org.id, "AUDITOR")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireEventRole", () => {
  beforeEach(resetAll);

  it("passes for OWNER of parent org when ADMIN required (heritage)", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("passes for MANAGER of parent org when ADMIN required (heritage symetrique)", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "MANAGER" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("AUDITOR of parent org is VIEWER on event, refused on ADMIN/OPERATOR/PRINTER", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await expect(requireEventRole(u.id, event.id, "VIEWER")).resolves.toBeUndefined();
    await expect(requireEventRole(u.id, event.id, "ADMIN")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(u.id, event.id, "OPERATOR")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(u.id, event.id, "PRINTER")).rejects.toBeInstanceOf(AuthError);
  });

  it("passes for explicit ADMIN membership", async () => {
    const { event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("PRINTER refuses VIEWER and inversement (disjonction)", async () => {
    const { event: e1 } = await setupOrgEvent();
    const { event: e2 } = await setupOrgEvent();
    const printer = await prisma.user.create({ data: { email: "p@x", password: "x", name: "P" } });
    const viewer = await prisma.user.create({ data: { email: "v@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: printer.id, eventId: e1.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: viewer.id, eventId: e2.id, role: "VIEWER" } });

    // requireEventRole strict : PRINTER ne satisfait pas VIEWER, et inversement.
    await expect(requireEventRole(printer.id, e1.id, "VIEWER")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(viewer.id, e2.id, "PRINTER")).rejects.toBeInstanceOf(AuthError);
  });

  it("getEffectiveEventRole returns STAFF for staff", async () => {
    const { event } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    expect(await getEffectiveEventRole(s.id, event.id)).toBe("STAFF");
  });
});

describe("requireEventPermission", () => {
  beforeEach(resetAll);

  it("badge.print accepted for ADMIN, OPERATOR, PRINTER ; refused for VIEWER", async () => {
    const { event } = await setupOrgEvent();
    const admin = await prisma.user.create({ data: { email: "ad@x", password: "x", name: "A" } });
    const op = await prisma.user.create({ data: { email: "op@x", password: "x", name: "O" } });
    const pr = await prisma.user.create({ data: { email: "pr@x", password: "x", name: "P" } });
    const vw = await prisma.user.create({ data: { email: "vw@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: admin.id, eventId: event.id, role: "ADMIN" } });
    await prisma.eventMembership.create({ data: { userId: op.id, eventId: event.id, role: "OPERATOR" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });

    await expect(requireEventPermission(admin.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(op.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(pr.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(vw.id, event.id, "badge.print")).rejects.toBeInstanceOf(AuthError);
  });

  it("scan.check-in refused for PRINTER (cas piege)", async () => {
    const { event } = await setupOrgEvent();
    const pr = await prisma.user.create({ data: { email: "pr2@x", password: "x", name: "P" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await expect(requireEventPermission(pr.id, event.id, "scan.check-in")).rejects.toBeInstanceOf(AuthError);
  });

  it("event.read.aggregated accepted for ADMIN, OPERATOR, VIEWER ; refused for PRINTER", async () => {
    const { event } = await setupOrgEvent();
    const pr = await prisma.user.create({ data: { email: "pr3@x", password: "x", name: "P" } });
    const vw = await prisma.user.create({ data: { email: "vw3@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });
    await expect(requireEventPermission(vw.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(pr.id, event.id, "event.read.aggregated")).rejects.toBeInstanceOf(AuthError);
  });

  it("AUDITOR of parent org : aggregated accepted, detailed refused", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "ad@x", password: "x", name: "AUD" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await expect(requireEventPermission(u.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(u.id, event.id, "event.read.detailed")).rejects.toBeInstanceOf(AuthError);
  });

  it("staff bypass on any permission", async () => {
    const { event } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await expect(requireEventPermission(s.id, event.id, "registration.delete")).resolves.toBeUndefined();
  });
});

describe("assertNotLastOwner", () => {
  beforeEach(resetAll);

  it("rejects if removing the last active OWNER of a non-archived org", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("accepts if another active OWNER remains", async () => {
    const { org } = await setupOrgEvent();
    const o1 = await prisma.user.create({ data: { email: "o1@x", password: "x", name: "O1" } });
    const o2 = await prisma.user.create({ data: { email: "o2@x", password: "x", name: "O2" } });
    await prisma.orgMembership.create({ data: { userId: o1.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: o2.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, o1.id)).resolves.toBeUndefined();
  });

  it("MANAGER does not count as fallback (must be OWNER)", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("does not block when the org itself is archived", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.organization.update({ where: { id: org.id }, data: { archived: true } });

    await expect(assertNotLastOwner(org.id, owner.id)).resolves.toBeUndefined();
  });
});

describe("assertNotLastSuperAdmin", () => {
  beforeEach(resetAll);

  it("rejects if removing the SUPER_ADMIN of the only user holding it", async () => {
    const u = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(u.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("accepts if another active SUPER_ADMIN remains", async () => {
    const u1 = await prisma.user.create({
      data: { email: "sa1@x", password: "x", name: "SA1", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA2", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(u1.id)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-guards.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 8.3: Implement `src/lib/auth-guards.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import type { StaffRole, OrgRole, EventRole } from "@prisma/client";
import {
  staffRoleAtLeast,
  hasOrgRole,
  hasEventPermission,
  effectiveEventRole as effectiveEventRolePure,
  type EventPermission,
} from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import type { EffectiveEventRole } from "@/types/auth";

export class AuthError extends Error {
  constructor(
    public code:
      | "NOT_AUTHENTICATED"
      | "NOT_STAFF"
      | "INSUFFICIENT_STAFF_ROLE"
      | "ORG_FORBIDDEN"
      | "EVENT_FORBIDDEN"
      | "EVENT_NOT_FOUND"
      | "LAST_OWNER"
      | "LAST_SUPER_ADMIN",
    public httpStatus: 401 | 403 | 404 | 409 = 403,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function requireStaff(userId: string, minRole: StaffRole): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  if (!ctx.isStaff || !ctx.staffRole) throw new AuthError("NOT_STAFF", 403);
  if (!staffRoleAtLeast(ctx.staffRole, minRole)) {
    throw new AuthError("INSUFFICIENT_STAFF_ROLE", 403);
  }
}

// Hierarchie lineaire OWNER > MANAGER > AUDITOR. hasOrgRole applique le niveau minimum
// (un OWNER satisfait MANAGER et AUDITOR ; un MANAGER satisfait AUDITOR).
export async function requireOrgRole(
  userId: string,
  orgId: string,
  role: OrgRole,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  if (!hasOrgRole(ctx, orgId, role)) throw new AuthError("ORG_FORBIDDEN", 403);
}

// Variante "role minimum" sur event, conservee pour les contextes UI/sidebar.
// La hierarchie event etant partielle (PRINTER et VIEWER disjoints), un user PRINTER
// ne satisfait PAS un check VIEWER (et inversement). Pour les checks metier API,
// preferer requireEventPermission.
export async function requireEventRole(
  userId: string,
  eventId: string,
  role: EventRole,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) throw new AuthError("EVENT_NOT_FOUND", 404);

  const eff = effectiveEventRolePure(ctx, eventId, event.orgId);
  if (eff === "STAFF") return;
  if (eff === null) throw new AuthError("EVENT_FORBIDDEN", 403);

  // Verification stricte du role demande, en respectant la hierarchie partielle :
  //   ADMIN satisfait OPERATOR, PRINTER et VIEWER (englobe tous).
  //   OPERATOR satisfait PRINTER et VIEWER (englobe les deux sous-roles).
  //   PRINTER ne satisfait que PRINTER.
  //   VIEWER ne satisfait que VIEWER.
  const satisfied =
    eff === role ||
    (eff === "ADMIN") ||
    (eff === "OPERATOR" && (role === "PRINTER" || role === "VIEWER"));
  if (!satisfied) throw new AuthError("EVENT_FORBIDDEN", 403);
}

// Check par permission atomique : source de verite pour les routes API metier.
// Voir docs/v2/features/multi-tenancy-rbac.md > matrice "Niveau evenement".
export async function requireEventPermission(
  userId: string,
  eventId: string,
  permission: EventPermission,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) throw new AuthError("EVENT_NOT_FOUND", 404);
  if (!hasEventPermission(ctx, eventId, event.orgId, permission)) {
    throw new AuthError("EVENT_FORBIDDEN", 403);
  }
}

export async function getEffectiveEventRole(
  userId: string,
  eventId: string,
): Promise<EffectiveEventRole> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) return null;
  return effectiveEventRolePure(ctx, eventId, event.orgId);
}

// Garde-fou : refuse l'operation si elle retirerait le dernier OWNER actif
// d'une organisation non archivee. Ignore les users archives. Si l'org est elle-meme
// archivee, le garde-fou ne bloque pas (l'invariant ne s'applique qu'aux orgs vivantes).
export async function assertNotLastOwner(
  orgId: string,
  userIdBeingRemoved: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { archived: true },
  });
  if (!org || org.archived) return;

  const remainingOwners = await prisma.orgMembership.count({
    where: {
      orgId,
      role: "OWNER",
      userId: { not: userIdBeingRemoved },
      user: { archived: false },
    },
  });
  if (remainingOwners === 0) {
    throw new AuthError("LAST_OWNER", 409);
  }
}

// Garde-fou : refuse l'operation si elle retirerait le SUPER_ADMIN au dernier user
// qui le porte (au moins un SUPER_ADMIN actif doit exister en permanence).
export async function assertNotLastSuperAdmin(userIdBeingChanged: string): Promise<void> {
  const remaining = await prisma.user.count({
    where: {
      id: { not: userIdBeingChanged },
      staffRole: "SUPER_ADMIN",
      archived: false,
    },
  });
  if (remaining === 0) {
    throw new AuthError("LAST_SUPER_ADMIN", 409);
  }
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-guards.test.ts
```

Expected: tous les tests passent (couverture hierarchie staff complete avec SUPER_ADMIN, hierarchie org OWNER/MANAGER/AUDITOR, requireEventPermission avec cas piege PRINTER vs scan, heritages org->event, garde-fous last-owner et last-super-admin).

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/auth-guards.ts src/lib/__tests__/auth-guards.test.ts
git commit -m "feat(v2): guards requireStaff/Org/Event/EventPermission + assertNotLastOwner + assertNotLastSuperAdmin"
```

---

## Task 9: Middleware (`src/middleware.ts`)

**Files:**
- Modify: `src/middleware.ts` (rewrite)

> The middleware uses `getToken` from `next-auth/jwt` (Edge-runtime compatible). DB-aware checks happen in route handlers (Task 8 helpers). The middleware only filters by path + JWT presence + `isStaff` flag.

- [ ] **Step 9.1: Replace `src/middleware.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/admin", "/staff", "/profile"];
const STAFF_ONLY_PREFIXES = ["/staff"];
const API_PROTECTED_PREFIXES = ["/api/admin", "/api/staff", "/api/profile"];
const API_STAFF_ONLY_PREFIXES = ["/api/staff"];

function pathStartsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedPage = pathStartsWithAny(pathname, PROTECTED_PREFIXES);
  const isProtectedApi = pathStartsWithAny(pathname, API_PROTECTED_PREFIXES);
  if (!isProtectedPage && !isProtectedApi) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isStaffArea =
    pathStartsWithAny(pathname, STAFF_ONLY_PREFIXES) ||
    pathStartsWithAny(pathname, API_STAFF_ONLY_PREFIXES);

  if (isStaffArea && !token.isStaff) {
    if (isProtectedApi) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/profile/:path*", "/api/admin/:path*", "/api/staff/:path*", "/api/profile/:path*"],
};
```

- [ ] **Step 9.2: Verify the middleware compiles**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit --project tsconfig.json 2>&1 | grep "src/middleware.ts"
```

Expected: no output.

- [ ] **Step 9.3: Manual smoke test**

Start the dev server (if not already running) and test:

```bash
curl -i http://localhost:3000/staff
```

Expected: HTTP 307 redirect to `/login?callbackUrl=%2Fstaff`.

```bash
curl -i http://localhost:3000/api/staff/organizations
```

Expected: HTTP 401 with `{"error":"Unauthorized"}`.

- [ ] **Step 9.4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(v2): middleware scope-aware (admin/staff/profile + isStaff check)"
```

---

## Task 10: Clean stale v1 references (do not yet rewrite routes)

> Many `/api/admin/*` and `/admin/*` v1 routes import the deleted `checkRole`. They are scheduled for full rewrite in plans 2-5. For this plan, we just verify what's broken so the next plans know what to delete or rewrite.

**Files:**
- (no file changes)

- [ ] **Step 10.1: Identify broken v1 imports**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'grep -rln "from \"@/lib/auth\"" src/app | head'
docker compose -f docker-compose.dev.yml exec app sh -c 'grep -rn "checkRole" src/' || true
```

Document the list — these files will be addressed by plans 2-5. Do not fix here.

- [ ] **Step 10.2: Type-check (expected: many errors, acceptable for this plan)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | tail -50
```

Expected: errors in `src/app/api/**/*.ts` and `src/app/admin/**/*.tsx` referencing v1 `Role`, `Team`, `checkRole`, `Settings.contactEmail`, etc.

These errors are **expected** at the end of Plan 1 and are resolved by Plans 2-5.

- [ ] **Step 10.3: Annotate the situation in `docs/v2/architecture.md`**

Add a short note at the end of the file (before the last section) listing that Plan 1 is complete but v1 route files are temporarily broken:

```markdown
## État au lot A (post-Plan 1)

Plan 1 (multi-tenancy & RBAC) terminé. Les fondations sont en place :

- Schéma Prisma v2 + seed STAFF_ADMIN
- Helpers d'autorisation + résolveur settings + activity-log v2
- Middleware scope-aware

Les routes API et pages héritées de la v1 (`src/app/api/**/*.ts`, `src/app/admin/**/*.tsx`) ne compilent plus à ce stade — elles seront supprimées ou réécrites par les plans 2 à 5.
```

- [ ] **Step 10.4: Commit**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): note d'avancement post-Plan 1 (lot A complet)"
```

---

## Task 11: Integration test — end-to-end auth flow

**Files:**
- Create: `src/lib/__tests__/integration.test.ts`

> Smoke-style integration test that exercises the full chain : seed staff, login, JWT, requireStaff, requireOrgRole.

- [ ] **Step 11.1: Write the integration test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  requireStaff,
  requireOrgRole,
  requireEventPermission,
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  AuthError,
} from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";

describe("v2 RBAC integration", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.eventSettings.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("STAFF_ADMIN can act across orgs without OrgMembership", async () => {
    const staff = await prisma.user.create({
      data: {
        email: "s@x",
        password: await hash("pw", 12),
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-o" } });

    await expect(requireStaff(staff.id, "STAFF_OBSERVER")).resolves.toBeUndefined();
    await expect(requireOrgRole(staff.id, org.id, "OWNER")).resolves.toBeUndefined();
  });

  // SUPER_ADMIN : tout autorise, y compris hard delete + promotion staff
  it("SUPER_ADMIN passes requireStaff(SUPER_ADMIN) and toutes les operations sensibles", async () => {
    const sa = await prisma.user.create({
      data: {
        email: "sa@x",
        password: await hash("pw", 12),
        name: "SA",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });
    const otherSa = await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA2", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-sa" } });

    await expect(requireStaff(sa.id, "SUPER_ADMIN")).resolves.toBeUndefined();
    await expect(requireStaff(sa.id, "STAFF_ADMIN")).resolves.toBeUndefined();
    await expect(requireOrgRole(sa.id, org.id, "OWNER")).resolves.toBeUndefined();
    // assertNotLastSuperAdmin accepte la mutation car il reste otherSa.
    await expect(assertNotLastSuperAdmin(sa.id)).resolves.toBeUndefined();
  });

  it("STAFF_ADMIN ne satisfait pas requireStaff(SUPER_ADMIN)", async () => {
    const a = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(a.id, "SUPER_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });

  it("OWNER scoped to its org only", async () => {
    const owner = await prisma.user.create({
      data: { email: "o@x", password: await hash("pw", 12), name: "O" },
    });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "int-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "int-b" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: orgA.id, role: "OWNER" } });

    await expect(requireOrgRole(owner.id, orgA.id, "OWNER")).resolves.toBeUndefined();
    await expect(requireOrgRole(owner.id, orgB.id, "OWNER")).rejects.toMatchObject({
      code: "ORG_FORBIDDEN",
    });
  });

  // MANAGER : peut creer/archiver event, mais pas modifier les infos org (OWNER required)
  it("MANAGER can act on events (heritage ADMIN) mais pas sur les infos org", async () => {
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-mgr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-mgr-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });

    // Heritage MANAGER -> ADMIN event : peut modifier l'event et supprimer une inscription.
    await expect(requireEventPermission(mgr.id, event.id, "event.update")).resolves.toBeUndefined();
    await expect(requireEventPermission(mgr.id, event.id, "registration.delete")).resolves.toBeUndefined();
    // Niveau org : OWNER refuse, MANAGER accepte
    await expect(requireOrgRole(mgr.id, org.id, "OWNER")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
    await expect(requireOrgRole(mgr.id, org.id, "MANAGER")).resolves.toBeUndefined();
  });

  // AUDITOR : lecture seule sur tout (org + events de l'org en vue agregee)
  it("AUDITOR sees aggregated event data but no detail nor mutation", async () => {
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-aud" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-aud-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(aud.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "MANAGER")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
    // Heritage AUDITOR -> VIEWER event
    await expect(requireEventPermission(aud.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(aud.id, event.id, "event.read.detailed")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    await expect(requireEventPermission(aud.id, event.id, "registration.approve")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  // PRINTER : peut imprimer mais pas approuver une inscription
  it("PRINTER can print badges but cannot approve registrations", async () => {
    const printer = await prisma.user.create({ data: { email: "p@x", password: "x", name: "P" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-pr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-pr-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: printer.id, eventId: event.id, role: "PRINTER" } });

    await expect(requireEventPermission(printer.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(printer.id, event.id, "registration.approve")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    // Cas piege : PRINTER n'est pas autorise au scan check-in
    await expect(requireEventPermission(printer.id, event.id, "scan.check-in")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  // VIEWER : voit la vue agregee mais pas les details personnels
  it("VIEWER sees aggregated only, no detail, no badge print", async () => {
    const vw = await prisma.user.create({ data: { email: "v@x", password: "x", name: "V" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-vw" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-vw-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });

    await expect(requireEventPermission(vw.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(vw.id, event.id, "event.read.detailed")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    await expect(requireEventPermission(vw.id, event.id, "badge.print")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  // Garde-fou : suppression du dernier OWNER refusee
  it("assertNotLastOwner blocks removing the last active OWNER", async () => {
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-lo" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  // Garde-fou : suppression du dernier SUPER_ADMIN refusee
  it("assertNotLastSuperAdmin blocks removing the SUPER_ADMIN from the only user", async () => {
    const sa = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(sa.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("loadUserContext returns full memberships", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x", password: "pw", name: "U" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-c" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });

    const ctx = await loadUserContext(u.id);
    expect(ctx?.orgMemberships).toHaveLength(1);
    expect(ctx?.eventMemberships).toHaveLength(1);
  });
});
```

- [ ] **Step 11.2: Run all tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run
```

Expected: all tests of Plan 1 pass.

- [ ] **Step 11.3: Commit**

```bash
git add src/lib/__tests__/integration.test.ts
git commit -m "test(v2): integration RBAC bout-en-bout"
```

---

## Task 12: Final verification + branch summary

- [ ] **Step 12.1: Run full test suite**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run
```

Expected: all tests pass.

- [ ] **Step 12.2: Reset and reseed to confirm idempotency**

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE badge; CREATE DATABASE badge;"'
docker compose -f docker-compose.dev.yml exec app npx prisma db push --accept-data-loss
docker compose -f docker-compose.dev.yml exec app npx prisma db seed
docker compose -f docker-compose.dev.yml exec app yarn vitest run
```

Expected: seed ok, tests ok.

- [ ] **Step 12.3: Confirm git log**

```bash
git log --oneline | head -15
```

Expected: a series of `feat(v2)` and `test(v2)` commits since the spec commit.

---

## Done

Plan 1 (multi-tenancy & RBAC) is complete. The fondation est en place pour Plans 2-7.

**Next plan:** [Plan 7 — Reset & déploiement initial](2026-05-28-v2-07-deploiement-initial.md) (déjà partiellement fait localement par Plan 1 ; le Plan 7 décrit la procédure de reset prod).
