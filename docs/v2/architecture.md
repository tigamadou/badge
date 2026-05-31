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
