# Spec maîtresse — Badge v2 (SaaS multi-organisation)

> **Statut** : conception validée — 2026-05-28, révisée 2026-05-31
> **Type** : refonte structurelle majeure (mono-événement → SaaS B2B multi-organisation)
> **Successeur de** : Badge v1 (mono-événement, déployé en prod)
> **Successeur** : la v2 est étendue par la [v3](../../v3/README.md) pour les chantiers post-MVP (tests + CI, stockage S3, déploiement Kamal)

## Contexte et objectifs

Badge v1 est une application mono-événement déployée pour une cérémonie d'investiture présidentielle : un seul `Event` (singleton), une table `User` à 4 rôles globaux, une table `Registration` autonome qui stocke ses propres infos personnelles avec un mécanisme de jeton d'édition à usage unique (`editToken`).

La v2 transforme cette base en SaaS B2B multi-organisation :

- Le **staff applicatif** (Anthropic-like) onboard manuellement les organisations clientes (pas de signup public ni de facturation intégrée).
- Chaque **organisation cliente** peut organiser plusieurs événements en parallèle.
- Chaque **événement** a ses propres administrateurs, opérateurs, catégories, inscriptions et badges, avec son branding et ses settings propres.
- Un **utilisateur unique** peut appartenir à plusieurs organisations et événements, avec des rôles différents dans chacun.
- Les **participants** ont un **compte unifié et global** : un seul couple email + mot de passe pour s'inscrire à n'importe quel événement de n'importe quelle organisation, sans ressaisir leurs infos personnelles ni dépendre d'un jeton d'édition.
- Les **badges PDF** sont rendus via un **registry de templates** sélectionnable en cascade (`Event → Org → Platform`), avec support natif des badges mono-face ou multi-face.

## Modèle conceptuel

```
Staff applicatif (global, hors-org)
    SUPER_ADMIN | STAFF_ADMIN | STAFF_SUPPORT | STAFF_OBSERVER
                │
                ▼ crée, gère
            USER (entité globale)
                │  ├─ isStaff: bool
                │  ├─ staffRole: StaffRole?
                │  └─ profil participant : firstName, lastName, photo, ID document...
                │
        ┌───────┼────────┬─────────────────┐
        ▼       ▼        ▼                 ▼
    OrgMembership   EventMembership   Registration (snapshot inline)
    (User × Org)    (User × Event)    (User × Event)
        │               │                 │
        ▼               ▼                 ▼
    ORGANIZATION ──────────────────▶  EVENT
        │                                 │
        ├─ OrgSettings                    ├─ EventSettings (override)
        │   └─ badgeTemplateId?           │   └─ badgeTemplateId?
        ├─ CategoryTemplates              ├─ Categories
        └─ Quotas                         ├─ BlockedEmails / BlockedDocuments
                                          ├─ Members (EventMembership)
                                          └─ Registrations (avec snapshot)

PlatformSettings (singleton, racine de la cascade)
    └─ badgeTemplateId (NOT NULL, défaut "default-v1")
```

### Principes structurants

1. **User vit en dehors des organisations.** Les droits sont reconstruits à chaque requête depuis les Memberships. Le JWT NextAuth ne contient que l'identité (`userId` + `isStaff`).
2. **User unifié pour staff, membres d'org/event, ET participants.** Un même compte peut être staff sur la plateforme, OWNER d'une organisation, et participant à un event d'une autre org — sans duplication. Voir [v2-11](../features/comptes-participants.md).
3. **OWNER hérite implicitement d'ADMIN** sur tous les events de son organisation, sans `EventMembership` explicite.
4. **Staff applicatif a accès complet aux données client**, avec audit obligatoire (`ActivityLog.staffActor=true`) visible par les OWNERs.
5. **Settings en cascade** : `PlatformSettings → OrgSettings → EventSettings`, premier non-null en remontant. S'applique au branding contextuel (logo via `Event.logo`, contact email/téléphone) et au `badgeTemplateId`. **Deux exceptions** (décisions 2026-05-31) : le SMTP et le reCAPTCHA sont plateforme uniquement (lus directement depuis `PlatformSettings` via `getPlatformSmtp()` et `getPlatformRecaptcha()`, pas de cascade).
6. **Soft delete partout** : `archived: bool` + `archivedAt: DateTime?` sur `User`, `Organization`, `Event`. Hard delete réservé aux scripts staff.
7. **Slug global unique** pour `Event` (`/e/[slug]`) : évite tout besoin de sous-domaine et permet le partage public de l'URL.
8. **Registration porte un snapshot des infos profil au moment de la soumission.** L'édition se fait via `/account/profile` (compte requis), plus de `editToken` à usage unique. Le snapshot garantit l'audit immuable du badge délivré.
9. **Badge PDF résolu via registry de templates.** Un champ `badgeTemplateId` à chaque niveau de la cascade pointe vers une entrée du registry codé dans `src/lib/badge-templates/`. Voir [v2-12](../features/templates-badges.md).

## Rôles et hiérarchie

| Niveau | Rôles | Portée |
|---|---|---|
| **Plateforme** | `SUPER_ADMIN` > `STAFF_ADMIN` > `STAFF_SUPPORT` > `STAFF_OBSERVER` | Toutes les organisations, audit obligatoire. `SUPER_ADMIN` a tous les droits sans restriction métier (différence avec v1 où SUPER_ADMIN n'avait pas le droit d'actions métier). |
| **Organisation** | `OWNER` > `MANAGER` > `AUDITOR` | Une org spécifique. `OWNER` hérite d'`ADMIN` sur ses events. `MANAGER` gère events + membres event. `AUDITOR` lecture seule. |
| **Événement** | `ADMIN` > `OPERATOR` > `PRINTER` > `VIEWER` | Un event spécifique. `PRINTER` peut imprimer les badges sans accès aux données sensibles. `VIEWER` vue agrégée. |
| **Participant** | (implicite, sans Membership) | Toute personne authentifiée qui s'inscrit à un event. Pas de rôle staff/org/event. Accès limité à `/account/*`. |

Voir la matrice complète dans [`docs/v2/features/multi-tenancy-rbac.md`](../features/multi-tenancy-rbac.md).

## Routing

### Pages publiques (sans authentification)

- `/e/[slug]` — page de présentation d'un événement (titre, date, lieu, catégories, bouton « S'inscrire »)
- `/verify/[badgeId]` — vérification publique d'un badge via QR code
- `/login`, `/register` — connexion et création de compte (staff + participant unifié)
- `/forgot-password`, `/reset-password/[token]`, `/verify-email/[token]` — flux mot de passe et vérification email

### Pages authentifiées (compte participant)

- `/account` — dashboard, liste des inscriptions
- `/account/profile` — édition des infos personnelles (nom, photo, document d'identité, structure)
- `/account/profile/complete` — variante guidée pour la première complétion
- `/account/registrations/[id]` — détail d'une inscription, action « resoumettre » si rejetée
- `/e/[slug]/register` — formulaire d'inscription à un event (compte requis, profil complet requis)
- `/e/[slug]/success` — page de confirmation post-inscription

### Pages authentifiées (administration)

- `/staff/*` — espace staff applicatif (gestion plateforme, orgs, users, settings globaux, template badge plateforme)
- `/admin/[orgId]/*` — espace organisation (events, OrgSettings, templates de catégories, template badge org, membres)
- `/admin/[orgId]/events/[eventId]/*` — espace événement (registrations, catégories, scan, badges, members, EventSettings, template badge event)
- `/profile` — profil de l'utilisateur connecté (champs RBAC, déconnexion)

### Pages supprimées (par rapport à v1)

- `/edit-registration/[token]` — supprimée par v2-11 (remplacée par `/account/registrations/[id]` avec compte requis)

## Architecture technique

| Composant | Version v2 |
|---|---|
| Framework | Next.js 16 App Router (monolithe front + back, Server Components par défaut) |
| Runtime | Node.js 22+ |
| UI | React 19 + Tailwind CSS 4 |
| Langage | TypeScript 5 |
| ORM | Prisma 6 |
| Base de données | MySQL 8 |
| Auth | NextAuth.js (CredentialsProvider, JWT) |
| PDF | @react-pdf/renderer 4 + registry de templates (`src/lib/badge-templates/`) |
| QR code | qrcode + html5-qrcode |
| Email | nodemailer avec résolveur SMTP en cascade |
| Hash mot de passe | bcryptjs (12 rounds, min 6 caractères) |
| CAPTCHA | react-google-recaptcha v3 |
| Tests | Vitest 4 (politique de tests détaillée en v3-03) |
| Stockage fichiers | Disque local sous `uploads/events/[eventId]/...`, abstraction `src/lib/storage.ts` (migration S3 traitée en v3-01) |
| Déploiement | docker-compose + Caddy (Kamal traité en v3-02) |
| Package manager | Yarn via Corepack |

## Décomposition en sous-spécifications

Neuf sous-spécifications couvrent le périmètre v2. Chacune a sa propre spec (le *pourquoi*) dans `docs/v2/specs/` et sa propre feature doc (le *quoi*) dans `docs/v2/features/`, plus un plan d'implémentation dans `docs/v2/plans/`.

| # | Sous-spec | Feature doc | Description |
|---|---|---|---|
| 1 | — | [Multi-tenancy & RBAC](../features/multi-tenancy-rbac.md) | Modèles Prisma `User/Organization/Event/*Membership`, helpers d'autorisation (`requireStaff/requireOrgRole/requireEventRole`), middleware de scoping |
| 2 | — | [Espace Staff applicatif](../features/espace-staff.md) | Routes `/staff/*`, création org/user, gestion plateforme, PlatformSettings (dont template badge par défaut) |
| 3 | — | [Espace Organisation](../features/espace-organisation.md) | Routes `/admin/[orgId]/*`, events, OrgSettings (dont template badge org), templates de catégories, quotas, membres |
| 4 | — | [Espace Événement](../features/espace-evenement.md) | Inscriptions, badges (PDF via registry), catégories, scan, journal, EventSettings (dont template badge event), members |
| 5 | — | [Inscription publique scopée](../features/inscription-publique.md) | `/e/[slug]` (publique présentation), `/e/[slug]/register` (compte requis), `/verify/[badgeId]`, branding, cascade Settings — **partiellement superseded par v2-11** (suppression `/edit-registration/[token]`, refonte du flux d'inscription) |
| 6 | — | [Notifications email multi-tenant](../features/notifications-email.md) | Résolveur SMTP en cascade, templates, expéditeur dynamique (étendu par v2-11 : nouveaux templates `account-verify-email`, `account-password-reset`, `registration-resubmitted`) |
| 7 | — | [Reset & déploiement initial](../features/deploiement-initial.md) | Reset prod, seed staff + participant, smoke tests, rollback |
| 11 | [v2-11](2026-05-31-v2-11-comptes-participants.md) | [Comptes participants](../features/comptes-participants.md) | Compte unifié global, vérification email, reset password, snapshot Registration, suppression `editToken`/`SubmissionSnapshot`, refonte flux `/e/[slug]` |
| 12 | [v2-12](2026-05-31-v2-12-templates-badges.md) | [Templates de badges multi-faces](../features/templates-badges.md) | Registry de templates React-PDF dans le code, cascade `Event → Org → Platform`, support mono-face / multi-face, preview PNG, 3 pages de sélection (event/org/staff) |

> **Note** : les sous-specs v2-01 à v2-07 n'ont pas de fichier `specs/` dédié (le *pourquoi* est capturé directement dans leur feature doc). v2-11 et v2-12 introduisent des décisions structurelles plus tardives qui justifient un ADR séparé.

## Ordre d'implémentation

```
Lot A — Fondations
    └─ Spec 1 (multi-tenancy + RBAC) ──┐
                                       ▼
Lot B — Auth & staff
    ├─ Spec 7 (reset + seed)
    └─ Spec 2 (espace staff)
                                       ▼
Lot C — Org & event
    ├─ Spec 3 (espace org)
    └─ Spec 4 (espace event)
                                       ▼
Lot D — Public, comptes et emails
    ├─ Spec 5 (inscription publique — base)
    ├─ Spec 6 (emails — templates de base)
    └─ Spec 11 (comptes participants — refonte 5 et 6)
                                       ▼
Lot E — Templates badges
    └─ Spec 12 (templates badges multi-faces)
                                       ▼
[Mise en prod v2]
                                       ▼
Lot F — Chantiers post-MVP (version v3)
    ├─ Spec v3-01 (stockage S3 / MinIO)
    ├─ Spec v3-02 (déploiement Kamal)
    └─ Spec v3-03 (politique de tests + CI GitHub Actions)
```

Spec 11 (comptes participants) doit être implémentée **après** Spec 5 (inscription publique de base), mais elle en refonde une partie. Pour éviter le double travail, l'option pragmatique est d'implémenter Spec 5 dans sa version *post*-v2-11 directement (en lisant les deux specs ensemble). La sous-spec 5 est marquée "partiellement superseded" pour signaler cette dépendance.

Chaque sous-spec a son plan d'implémentation détaillé (`docs/v2/plans/`) avec tracker `## Progression` en tête, TDD obligatoire pour la logique critique, et tasks numérotées avec commits dédiés.

## Conventions transverses

- **Stockage de fichiers** : disque local sous `uploads/events/[eventId]/...` pour la v2. L'interface `src/lib/storage.ts` est conçue pour être abstraite (migration MinIO/S3 traitée en v3-01).
- **Soft delete** : `archived: bool` + `archivedAt: DateTime?` sur `User`, `Organization`, `Event`. Hard delete = script staff explicite.
- **Audit** : toute mutation côté staff sur des données client génère un `ActivityLog` avec `staffActor=true`, visible par les OWNERs. Helper centralisé `logActivity({ type, userId, targetId, orgId?, eventId?, details?, req? })`.
- **Sessions NextAuth** : JWT contient `userId` + `isStaff`. Les Memberships sont résolus serveur à chaque requête (pas dans le JWT) pour permettre des changements de droits instantanés sans déconnexion.
- **Helpers d'autorisation** (`src/lib/auth.ts`) : `requireStaff()`, `requireOrgRole(orgId, roles)`, `requireEventRole(eventId, roles)`, `requireEventPermission(eventId, perm)`, `getEffectiveEventRoles()`, `loadUserContext()`. Staff bypass et héritage OWNER y sont centralisés.
- **Résolution Settings** : `resolveSettings(eventId?, orgId?)` cascade `Event → Org → Platform`, premier non-null gagne — pour les champs cascadables (contact, badgeTemplateId). `resolvePublicSettings(...)` masque les secrets côté public. Les configs SMTP et reCAPTCHA ne sont pas cascadées : `getPlatformSmtp()` et `getPlatformRecaptcha()` lisent directement `PlatformSettings` (décisions 2026-05-31).
- **Authentification participant** : NextAuth `CredentialsProvider` refuse si `!emailVerifiedAt` ou `user.blocked`. Pas de tables d'auth séparées entre staff et participants.
- **Mot de passe** : bcryptjs avec **12 rounds**, longueur minimale **6 caractères**. Vérification email obligatoire avant premier login.
- **Uploads** : taille max **5 Mo**, types **JPEG / PNG / WebP / PDF** uniquement.
- **Snapshot Registration** : à chaque création ou resoumission, les infos profil du `User` sont copiées inline dans `Registration` (`snapshotFirstName`, `snapshotPhoto`, etc.). Audit immuable du badge délivré.
- **Tests** : Vitest sur la logique pure des helpers. Pas de mock Prisma sur les règles RBAC critiques — utiliser une BDD de test. Politique de tests obligatoire (3 couches : unitaires, intégration API, E2E Playwright) **traitée intégralement en v3-03** ; en v2, les tests sont ad hoc.
- **Langue** : UI/emails en **français avec accents complets** (é, è, à, ç, î, …) ; code/types/identifiants en anglais ; noms de fichiers/branches/commits en ASCII.
- **API** : REST (cohérent avec v1, pas de GraphQL).
- **Pas de migration v1 → v2** : reset complet de la prod, redéploiement propre. Validé explicitement par l'utilisateur.

## Hors-scope v2 (reporté à v3 ou ultérieur)

### Reporté à v3 (chantiers post-MVP)

| Sujet | Spec v3 | Raison du report |
|---|---|---|
| Stockage S3 / MinIO | [v3-01](../../v3/specs/2026-05-31-v3-01-stockage-s3-et-backups.md) | L'interface `storage.ts` est abstraite en v2, l'impl locale suffit pour MVP. Migration S3 + pipeline de backups hebdomadaires viennent en v3. |
| Déploiement Kamal (zero-downtime) | [v3-02](../../v3/specs/2026-05-31-v3-02-deploiement-kamal.md) | docker-compose + Caddy de v1 reste en place pour v2. Kamal apporte le zero-downtime et un meilleur swap atomique mais ajoute une dépendance infra non triviale. |
| Politique de tests + CI GitHub Actions | [v3-03](../../v3/specs/2026-05-31-v3-03-tests-et-ci.md) | Tests unitaires Vitest existent en v2 ; les couches intégration API + E2E Playwright + workflow CI 4 jobs bloquants sont structurés en v3. |

### Reporté sine die (hors v3 actuel)

- **Billing intégré** (Stripe, plans tarifaires) — facturation hors-app pour la v2 et la v3.
- **Self-service signup public** côté organisation — onboarding manuel par le staff uniquement.
- **Custom domains par organisation** (`badge.org-client.com`) — slug global unique suffit pour MVP.
- **Multi-langue UI** — français uniquement.
- **API GraphQL** — REST suffit.
- **2FA / SSO** — login email+password uniquement.
- **OAuth participant** (Google, Microsoft) — pas de besoin business identifié.
- **Suppression / export RGPD côté UI** (droit à l'oubli automatisé) — spec RGPD dédiée à venir.
- **Fusion de comptes participants** (un participant a créé deux comptes avec des emails différents) — staff peut bloquer un compte manuellement.
- **Éditeur visuel WYSIWYG de templates badge** — les templates sont du code, ajoutés par PR.
- **Custom fields par event** injectés dans le badge — `TemplateContext` standard fixe au démarrage.

## Risques principaux

| Risque | Mitigation |
|---|---|
| Complexité du RBAC à 3 niveaux + participants | Centralisation dans `src/lib/auth.ts`, tests exhaustifs du résolveur, helpers nommés et explicites par scope |
| Slug global d'event = collisions | Vérification unicité côté création + suggestion auto basée sur titre |
| Accès staff aux données client = abus interne | Audit `ActivityLog` avec `staffActor` visible côté client (OWNERs et MANAGERs) |
| Cascade Settings (3 niveaux) = bugs subtils | Résolveur centralisé `resolveSettings(eventId?, orgId?)`, tests par cas, `resolveBadgeTemplateId()` dédié pour le template |
| Reset prod = perte de données v1 | Validé par l'utilisateur (décision explicite, pas un accident) |
| Confusion staff ↔ participant sur le même `User` | RBAC déjà en place rejette les participants tentant d'accéder à `/staff/*` ou `/admin/*` ; pas besoin de modèles séparés |
| Snapshot Registration vs profil compte = divergence | Snapshot inline immuable, profil compte éditable. Doc claire : le badge livré reflète l'état au moment de l'approbation, pas l'état courant du compte |
| Template badge orphelin en BDD (id pointant vers un template supprimé du registry) | Garde-fou runtime : fallback sur `default-v1` + log warn. Script `validate-badge-templates.ts` en v3-03 vérifie l'intégrité en CI |
| Refonte v2-05 par v2-11 = code mort si pas coordonné | Marque explicite "partiellement superseded" dans v2-05, lecture conjointe obligatoire avant impl |

## Évolution depuis v1

| Aspect | v1 | v2 |
|---|---|---|
| Événements | 1 seul (singleton) | N événements multi-organisation |
| Rôles | 4 globaux (SUPER_ADMIN, ADMIN, MODERATEUR, OPERATOR) avec séparation forte (SUPER_ADMIN sans actions métier) | 3 niveaux : staff (4 : SUPER_ADMIN/STAFF_ADMIN/SUPPORT/OBSERVER), org (3 : OWNER/MANAGER/AUDITOR), event (4 : ADMIN/OPERATOR/PRINTER/VIEWER). Pas de séparation forte : SUPER_ADMIN a tous les droits. Plus une catégorie implicite : participant |
| Compte participant | N/A — chaque `Registration` autonome avec `editToken` à usage unique | Compte unifié global, login email + mot de passe + vérification email, snapshot inline `Registration` |
| Settings | Globaux (singleton) | Cascade `Platform / Org / Event` |
| Catégories | Globales (anciennement « Team ») | Par event + templates au niveau org |
| Blocages email/document | Globaux | Par event (event-scoped) |
| URL d'inscription | Page d'accueil | `/e/[slug]` (présentation publique) + `/e/[slug]/register` (compte requis) |
| Édition après rejet | `/edit-registration/[token]` (token jetable email) | `/account/registrations/[id]` + bouton « Resoumettre » (compte requis) |
| Badge PDF | Hardcodé (un seul rendu) | Registry de templates (`default-v1`, `recto-verso-v1`, ...), cascade `Event → Org → Platform`, mono-face ou multi-face |
| Stockage | `/uploads/` plat | `/uploads/events/[eventId]/` |
| Migration | — | Pas de migration : reset complet |

## Suivi

- **2026-05-28** — Brainstorming initial v2, décomposition en 7 sous-specs (multi-tenancy, staff, org, event, inscription, emails, déploiement)
- **2026-05-28** — Spec maîtresse v2 rédigée et validée
- **2026-05-29** — 7 sous-spec features rédigées et 7 plans d'impl associés
- **2026-05-31** — Ajout sous-spec v2-11 (comptes participants) et v2-12 (templates badges) après brainstorming
- **2026-05-31** — Réorganisation : sortie de v2-08 (stockage S3), v2-09 (Kamal), v2-10 (tests + CI) vers la nouvelle version [v3](../../v3/README.md) (chantiers post-MVP, non bloquants pour la livraison v2)
- **2026-05-31** — Cette spec maîtresse réécrite pour refléter le périmètre v2 final (9 sous-specs : 1-7, 11, 12)
- **2026-05-31** — Décision SMTP plateforme uniquement : retrait des champs SMTP de `OrgSettings` et `EventSettings`, simplification du résolveur, suppression des UIs Test SMTP côté Org/Event. Specs 1, 3, 4, 5, 6 et plans associés mis à jour.
- **2026-05-31** — Décision reCAPTCHA plateforme uniquement (même logique que SMTP) : retrait des champs reCAPTCHA d'`OrgSettings`, conservation dans `PlatformSettings` comme source unique. UI configurée dans `/staff/settings`. `getPlatformRecaptcha()` lit directement `PlatformSettings`. Specs 1, 2, 3, 5 et plans associés mis à jour. *Note* : la décision avait d'abord été formulée comme « reCAPTCHA org-only » puis corrigée le même jour vers « platform-only » (version définitive).
- Implémentation : à démarrer
- Smoke tests : à venir
- Mise en production : à venir (puis enchaînement avec v3)

## Voir aussi

- [`docs/v2/README.md`](../README.md) — index des sous-specs et plans v2
- [`docs/v3/README.md`](../../v3/README.md) — chantiers post-MVP (tests + CI, stockage S3, déploiement Kamal)
- [`docs/v1/README.md`](../../v1/README.md) — version actuellement déployée
- [`docs/README.md`](../../README.md) — index des versions
- [`CLAUDE.md`](../../../CLAUDE.md) — instructions pour les outils IA (spécificités projet)
