# Multi-tenancy & RBAC

## Description fonctionnelle

L'application v2 supporte plusieurs organisations clientes, chacune organisant plusieurs événements. Les utilisateurs peuvent appartenir à plusieurs organisations et événements simultanément. Trois niveaux de rôles coexistent :

- **Staff applicatif** (global) : `SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT`, `STAFF_OBSERVER` — hiérarchie linéaire.
- **Organisation** : `OWNER`, `MANAGER`, `AUDITOR` — hiérarchie linéaire (`OWNER ⊃ MANAGER ⊃ AUDITOR` en termes de permissions).
- **Événement** : `ADMIN`, `OPERATOR`, `PRINTER`, `VIEWER` — hiérarchie partielle (`ADMIN ⊃ OPERATOR ⊃ {PRINTER, VIEWER}` ; `PRINTER` et `VIEWER` sont disjoints).

Cette feature pose les fondations de tout le reste : modèle de données tenant, helpers d'autorisation, middleware de scoping. Toutes les autres sous-spécifications en dépendent.

## Périmètre

Inclus :

- Modèles Prisma : `User`, `Organization`, `Event`, `OrgMembership`, `EventMembership`, `EventSettings`, `PlatformSettings`, `CategoryTemplate`, `Category` (ex-`Team`). Note : `OrgSettings` n'existe plus en v2 (fusionné dans `Organization`, décision 2026-05-31).
- Enums : `StaffRole`, `OrgRole`, `EventRole`
- Helpers d'autorisation (`src/lib/auth.ts`)
- Middleware Next.js de scoping (`src/middleware.ts`)
- Résolveur de settings en cascade (`src/lib/settings.ts`)
- Activity log enrichi (`src/lib/activity-log.ts`)

Exclu (autres sous-specs) :

- Pages UI (specs 2, 3, 4, 5)
- Routes API métier (specs 2, 3, 4)
- Templates email (spec 6)
- Procédure de déploiement (spec 7)

## Modèle de données

### Identité

```prisma
model User {
  id                  String   @id @default(cuid())
  email               String   @unique
  password            String                       // bcrypt 12 rounds
  name                String
  isStaff             Boolean  @default(false)
  staffRole           StaffRole?
  inviteToken         String?  @unique
  inviteTokenExpiry   DateTime?
  archived            Boolean  @default(false)
  archivedAt          DateTime?
  createdAt           DateTime @default(now())

  orgMemberships      OrgMembership[]
  eventMemberships    EventMembership[]
  activityLogs        ActivityLog[]
}

enum StaffRole {
  SUPER_ADMIN
  STAFF_ADMIN
  STAFF_SUPPORT
  STAFF_OBSERVER
}
```

**Invariants** :

- `isStaff=true ⇒ staffRole NOT NULL`
- `isStaff=false ⇒ staffRole=NULL`
- `archived=true ⇒ inviteToken=NULL` (révocation)

### Organisation

```prisma
model Organization {
  id                       String   @id @default(cuid())

  // Identite
  name                     String                          // nom commercial / d'usage
  legalName                String?                         // nom legal si different de name
  slug                     String   @unique               // /e/[slug] indirectement via events

  // Adresse postale structuree
  addressLine1             String?
  addressLine2             String?
  postalCode               String?
  city                     String?
  country                  String?                         // ISO-3166-1 alpha-2 recommande (FR, CI, SN...)

  // Identification administrative
  taxId                    String?                         // SIRET (FR), IFU (CI/SN/BJ), VAT/EIN... format libre
  website                  String?                         // URL https://...
  logo                     String?                         // uploads/org-assets/[orgId]/logo.*

  // Contact public (affiche dans emails et footer pages publiques)
  contactEmail             String?
  contactPhone             String?

  // Quotas (staff uniquement)
  quotaMaxEvents           Int?
  quotaMaxRegistrations    Int?
  quotaMaxStorageMB        Int?

  // Etat
  archived                 Boolean  @default(false)
  archivedAt               DateTime?
  createdAt                DateTime @default(now())

  // Relations
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
  OWNER
  MANAGER
  AUDITOR
}
```

### Événement

```prisma
model Event {
  id               String       @id @default(cuid())
  orgId            String
  organization     Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  title            String
  slug             String       @unique         // /e/[slug] global
  location         String
  date             DateTime
  logo             String?
  registrationOpen Boolean      @default(false) // OFF par défaut
  archived         Boolean      @default(false)
  archivedAt       DateTime?
  createdAt        DateTime     @default(now())

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
  ADMIN
  OPERATOR
  PRINTER
  VIEWER
}
```

### Catégories (anciennement Team)

```prisma
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
```

### Settings en cascade

```prisma
model PlatformSettings {
  id                 String  @id @default("singleton")
  smtpHost           String  @default("")
  smtpPort           Int     @default(587)
  smtpFrom           String  @default("noreply@badge.local")
  smtpUser           String  @default("")
  smtpPassword       String  @default("")
  smtpSecure         Boolean @default(false)
  recaptchaEnabled   Boolean @default(false)
  recaptchaSiteKey   String  @default("")
  recaptchaSecretKey String  @default("")
}

model EventSettings {
  id           String  @id @default(cuid())
  eventId      String  @unique
  event        Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)

  contactEmail String?
  contactPhone String?
}
```

**Règle de résolution** : pour une clé cascadable (contact uniquement), on parcourt `EventSettings → Organization → PlatformSettings`, premier non-null gagne. `OrgSettings` **n'existe plus en v2** (décision 2026-05-31) — les champs contact ex-`OrgSettings` ont fusionné dans `Organization` (cf. modèle ci-dessus). Les valeurs sensibles (`smtpPassword`, `recaptchaSecretKey`) ne sont jamais exposées dans les réponses API.

**SMTP = plateforme uniquement** (décision 2026-05-31) : les paramètres SMTP (`smtpHost`, `smtpPort`, `smtpFrom`, `smtpUser`, `smtpPassword`, `smtpSecure`) ne sont configurables qu'au niveau `PlatformSettings`. Aucun override possible au niveau Org ou Event. Le branding contextuel non-SMTP (logo via `Event.logo`, `contactEmail`, `contactPhone`) reste cascadé : les emails affichent toujours le bon logo et contact selon le contexte, mais partent tous avec la même identité d'expéditeur plateforme.

**reCAPTCHA = plateforme uniquement** (décision 2026-05-31, même logique que SMTP) : les paramètres reCAPTCHA (`recaptchaEnabled`, `recaptchaSiteKey`, `recaptchaSecretKey`) ne sont configurables qu'au niveau `PlatformSettings`. Aucun champ reCAPTCHA dans `Organization` ni `EventSettings`. La plateforme Badge porte une seule clé Google reCAPTCHA partagée par tous les events de toutes les organisations clientes. Si la plateforme n'a pas activé reCAPTCHA, le widget n'apparaît sur aucun formulaire public.

### Périmètre des overrides Settings

| Clé | Platform | Org | Event |
|---|:---:|:---:|:---:|
| `smtpHost` | ✓ | — | — |
| `smtpPort` | ✓ | — | — |
| `smtpUser` | ✓ | — | — |
| `smtpPassword` | ✓ | — | — |
| `smtpSecure` | ✓ | — | — |
| `smtpFrom` | ✓ | — | — |
| `contactEmail` | — | ✓ (champ `Organization.contactEmail`) | ✓ |
| `contactPhone` | — | ✓ (champ `Organization.contactPhone`) | ✓ |
| `recaptchaSiteKey` | ✓ | — | — |
| `recaptchaSecretKey` | ✓ | — | — |
| `recaptchaEnabled` | ✓ | — | — |

> **Note** : le SMTP n'est jamais overridable hors plateforme — toute configuration de connexion vit dans `PlatformSettings` uniquement. Le reCAPTCHA suit la même logique — une seule clé Google partagée, plateforme uniquement, pas d'override possible. Seules les clés explicitement listées dans `EventSettings` (cf. modèle Prisma plus haut) peuvent être surchargées au niveau event ; toutes les autres ne cascadent qu'Org → Platform pour les clés cascadables (contact uniquement).

### Activity log

```prisma
model ActivityLog {
  id        String       @id @default(cuid())
  type      ActivityType
  userId    String?
  user      User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  orgId     String?
  eventId   String?
  targetId  String?
  details   Json?
  staffActor Boolean     @default(false)        // true si action staff sur données client
  ipAddress String?
  userAgent String?      @db.Text
  createdAt DateTime     @default(now())

  @@index([type])
  @@index([orgId])
  @@index([eventId])
  @@index([userId])
  @@index([createdAt])
}
```

Les `ActivityType` héritent de v1 (REGISTRATION_*, BADGE_*, USER_*, etc.) plus :

- `ORG_CREATED`, `ORG_UPDATED`, `ORG_ARCHIVED`, `ORG_RESTORED`
- `EVENT_CREATED`, `EVENT_ARCHIVED`, `EVENT_RESTORED`, `EVENT_REGISTRATION_OPENED`, `EVENT_REGISTRATION_CLOSED`
- `MEMBERSHIP_ADDED`, `MEMBERSHIP_REMOVED`, `MEMBERSHIP_ROLE_CHANGED`
- `PLATFORM_SETTINGS_UPDATED`, `EVENT_SETTINGS_UPDATED` (l'ancien `ORG_SETTINGS_UPDATED` disparaît — toute modification d'infos administratives de l'org passe par `ORG_UPDATED`)
- `CATEGORY_TEMPLATE_CREATED`, `CATEGORY_TEMPLATE_UPDATED`, `CATEGORY_TEMPLATE_DELETED`

## Matrice des permissions par rôle

Cette matrice est la **source de vérité** : les helpers d'autorisation (`requireOrgRole`, `requireEventPermission`) en dérivent leurs règles, et chaque route API doit pouvoir être tracée à une cellule.

### Hiérarchie staff (linéaire)

`SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`. Les droits d'un rôle incluent ceux des rôles inférieurs. Spécifiques par rôle :

| Action plateforme | SUPER_ADMIN | STAFF_ADMIN | STAFF_SUPPORT | STAFF_OBSERVER |
|---|:---:|:---:|:---:|:---:|
| Lire tous les tenants (orgs, events, users) | ✓ | ✓ | ✓ | ✓ |
| Agir sur données client (approbations, badges, ...) avec audit | ✓ | ✓ | ✓ | — |
| Créer / archiver / restaurer une organisation | ✓ | ✓ | — | — |
| Modifier les quotas d'une organisation | ✓ | ✓ | — | — |
| Créer un utilisateur client | ✓ | ✓ | ✓ | — |
| Créer un utilisateur staff (`STAFF_SUPPORT`, `STAFF_OBSERVER`) | ✓ | ✓ | — | — |
| Promouvoir / démouvoir un `STAFF_ADMIN` ou `SUPER_ADMIN` | ✓ | — | — | — |
| Hard delete d'une organisation | ✓ | — | — | — |
| Modifier `PlatformSettings` (SMTP, reCAPTCHA) | ✓ | ✓ | — | — |
| Réinitialiser le mot de passe d'un user | ✓ | ✓ | ✓ | — |

**Note v2 vs v1** : en v1, `SUPER_ADMIN` ne pouvait ni approuver/rejeter/supprimer une inscription, ni imprimer un badge (séparation forte des rôles). Cette restriction **disparaît en v2** : `SUPER_ADMIN` a tous les droits sans restriction, y compris les actions métier (avec audit `staffActor=true`).

### Niveau organisation (linéaire, `OWNER ⊃ MANAGER ⊃ AUDITOR`)

| Action organisation | OWNER | MANAGER | AUDITOR |
|---|:---:|:---:|:---:|
| Lire les infos org (identité, adresse, taxId, website, logo, contact), quotas | ✓ | ✓ | ✓ |
| Lire l'activity log de l'org | ✓ | ✓ | ✓ |
| Lire la liste des events et des membres | ✓ | ✓ | ✓ |
| Créer un event | ✓ | ✓ | — |
| Archiver / restaurer un event de l'org | ✓ | ✓ | — |
| Inviter / retirer des membres event (sur events de l'org) | ✓ | ✓ | — |
| Gérer les `CategoryTemplate` de l'org | ✓ | ✓ | — |
| Modifier les infos administratives de l'org (nom, legalName, adresse, taxId, website, logo, contact public) | ✓ | — | — |
| Archiver / restaurer l'org | ✓ | — | — |
| Inviter / retirer / changer rôle de membres org | ✓ | — | — |

Notes :
- `MANAGER` ne touche **jamais** à la facturation (hors-app) ni à l'archivage de l'org elle-même. Le SMTP et le reCAPTCHA sont plateforme-only (cf. décisions 2026-05-31 dans la section Settings) — ni OWNER ni MANAGER n'y accèdent ; seul le staff configure ces paramètres.
- `AUDITOR` est lecture seule sur **tout**, y compris l'activity log — c'est sa raison d'être (DPO, cabinet comptable, commanditaire).
- Le slug d'org reste réservé au staff (cf. `espace-organisation.md`).

### Niveau événement (partielle)

`ADMIN ⊃ OPERATOR ⊃ {PRINTER, VIEWER}`. `PRINTER` et `VIEWER` sont des sous-ensembles disjoints d'`OPERATOR` (ni l'un ni l'autre n'inclut le second).

| Action événement | ADMIN | OPERATOR | PRINTER | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Lire la liste des inscriptions (détails complets) | ✓ | ✓ | — | — |
| Lire la liste des inscriptions (agrégée : compteurs, nom, catégorie, statut) | ✓ | ✓ | — | ✓ |
| Lire le détail complet d'une inscription | ✓ | ✓ | — | — |
| Approuver / rejeter une inscription | ✓ | ✓ | — | — |
| Imprimer un badge | ✓ | ✓ | ✓ | — |
| Scanner un QR (check-in) | ✓ | ✓ | — | — |
| Créer manuellement une inscription | ✓ | — | — | — |
| Supprimer une inscription | ✓ | — | — | — |
| Exporter les inscriptions (CSV/PDF) | ✓ | — | — | — |
| Bloquer un email / un document | ✓ | — | — | — |
| Renvoyer un lien d'édition | ✓ | — | — | — |
| Modifier l'event (titre, lieu, date, logo) | ✓ | — | — | — |
| Archiver / restaurer event | ✓ | — | — | — |
| Ouvrir / fermer les inscriptions | ✓ | — | — | — |
| Modifier `EventSettings` | ✓ | — | — | — |
| Gérer les `Category` de l'event | ✓ | — | — | — |
| Inviter / retirer des membres event | ✓ | — | — | — |
| Lire l'activity log de l'event | ✓ | (ses propres scans) | — | — |

Notes :
- `PRINTER` ne voit **que** l'écran d'impression badge (recherche d'un inscrit approuvé par nom ou badgeId, impression, marquage imprimé). Pas d'accès à la liste détaillée ni aux coordonnées.
- `VIEWER` accède à une **liste agrégée seulement** : compteurs par statut, noms, catégorie, statut. Pas de détails personnels (email, téléphone, document d'identité, photo). Voir `espace-evenement.md` pour la liste exacte des champs masqués.
- Le `slug` d'event reste réservé au staff.

### Héritages transverses

- **Staff** : `SUPER_ADMIN`, `STAFF_ADMIN`, `STAFF_SUPPORT` (avec audit) peuvent agir sur n'importe quelle org/event sans membership. `STAFF_OBSERVER` lit seulement.
- **OWNER → ADMIN event** : un `OWNER` d'org agit comme `ADMIN` sur **tous** les events de cette org, sans `EventMembership` explicite.
- **MANAGER → ADMIN event** : un `MANAGER` d'org agit comme `ADMIN` sur **tous** les events de cette org (héritage symétrique à `OWNER`, parce que `MANAGER` peut déjà créer/archiver les events).
- **AUDITOR → VIEWER event** : un `AUDITOR` d'org accède à la vue agrégée de **tous** les events de cette org, sans `EventMembership`. Il n'a jamais accès aux détails complets. Le rôle `VIEWER` au niveau event reste utile pour donner accès à un commanditaire externe **sans** lui donner d'`OrgMembership` sur l'org entière.

### Invariants

1. `isStaff=true ⇔ staffRole NOT NULL` (déjà énoncé plus haut).
2. **Au moins un `OWNER` actif (`User.archived=false`)** par organisation non archivée. Toute mutation qui violerait cette règle (`MEMBERSHIP_REMOVED`, `MEMBERSHIP_ROLE_CHANGED`, `USER_ARCHIVED`) est refusée avec HTTP 409 et `code=LAST_OWNER`.
3. **Au moins un `SUPER_ADMIN` actif** sur la plateforme. Toute action qui supprimerait le dernier `SUPER_ADMIN` est refusée (HTTP 409, `code=LAST_SUPER_ADMIN`).
4. Un `STAFF_ADMIN` ne peut ni se promouvoir lui-même ni promouvoir un autre user en `STAFF_ADMIN` ou `SUPER_ADMIN`. Seul un `SUPER_ADMIN` peut faire ces opérations.

## Helpers d'autorisation (`src/lib/auth.ts`)

```typescript
// Session minimale (JWT NextAuth)
type SessionUser = { id: string; email: string; name: string; isStaff: boolean };

// Vérifie que l'utilisateur courant est staff avec un rôle minimal
function requireStaff(session: SessionUser, minRole: StaffRole): asserts session is StaffSession;

// Hiérarchie staff : SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER
function staffRoleAtLeast(actual: StaffRole, required: StaffRole): boolean;

// Vérifie que l'utilisateur courant a un rôle org au moins égal (chaîne linéaire OWNER > MANAGER > AUDITOR)
// Bypass : staff (tout rôle staff répond ✓ avec audit).
async function requireOrgRole(userId: string, orgId: string, role: OrgRole): Promise<void>;

// Permissions atomiques événement — la hiérarchie n'étant pas linéaire,
// chaque route métier exprime ce qu'elle vérifie par permission, pas par rôle.
type EventPermission =
  | 'event.read.aggregated'      // VIEWER, OPERATOR, ADMIN
  | 'event.read.detailed'        // OPERATOR, ADMIN
  | 'registration.approve'       // OPERATOR, ADMIN
  | 'registration.create'        // ADMIN
  | 'registration.delete'        // ADMIN
  | 'registration.export'        // ADMIN
  | 'registration.block'         // ADMIN
  | 'badge.print'                // PRINTER, OPERATOR, ADMIN
  | 'scan.check-in'              // OPERATOR, ADMIN
  | 'event.update'               // ADMIN
  | 'event.archive'              // ADMIN
  | 'event.registration_toggle'  // ADMIN
  | 'event.settings.update'      // ADMIN
  | 'event.categories.manage'    // ADMIN
  | 'event.members.manage'       // ADMIN
  | 'event.activity.read';       // ADMIN (OPERATOR voit uniquement ses scans, via 'event.activity.read.own')

// Bypass : staff (avec audit). Héritage : OWNER et MANAGER de l'org parent considérés comme ADMIN event.
// AUDITOR de l'org parent considéré comme VIEWER event.
async function requireEventPermission(
  userId: string,
  eventId: string,
  permission: EventPermission,
): Promise<void>;

// Variante "rôle minimum" conservée pour les contextes UI ou les checks de sidebar.
// Hiérarchie partielle : ADMIN > OPERATOR > { PRINTER, VIEWER }. PRINTER et VIEWER sont disjoints :
// requireEventRole(ev, 'PRINTER') refuse un VIEWER, et inversement.
async function requireEventRole(userId: string, eventId: string, role: EventRole): Promise<void>;

// Résout le(s) rôle(s) effectif(s) d'un user sur un event (utile pour l'UI)
async function getEffectiveEventRoles(
  userId: string,
  eventId: string,
): Promise<{ staff: boolean; roles: EventRole[] }>;

// Charge l'utilisateur + ses memberships (cached par requête)
async function loadUserContext(userId: string): Promise<UserContext>;

type UserContext = {
  user: User;
  orgMemberships: { orgId: string; role: OrgRole }[];
  eventMemberships: { eventId: string; role: EventRole }[];
  staff: { role: StaffRole } | null;
};

// Garde-fou last-owner : appelé par les routes API qui modifient une OrgMembership.
async function assertNotLastOwner(orgId: string, userIdBeingRemoved: string): Promise<void>;
// Garde-fou last-super-admin : appelé par les routes API qui modifient un staffRole.
async function assertNotLastSuperAdmin(userIdBeingChanged: string): Promise<void>;
```

**Tests requis** (`src/lib/__tests__/auth.test.ts`) :

- Staff
  - `requireStaff` rejette un non-staff
  - `requireStaff(STAFF_ADMIN)` accepte un `SUPER_ADMIN`
  - `requireStaff(SUPER_ADMIN)` rejette un `STAFF_ADMIN`
- Org
  - `requireOrgRole(OWNER)` accepte un `OWNER`, rejette un `MANAGER` et un `AUDITOR`
  - `requireOrgRole(MANAGER)` accepte un `OWNER` et un `MANAGER`, rejette un `AUDITOR`
  - `requireOrgRole(AUDITOR)` accepte les trois rôles org
  - `requireOrgRole(*)` accepte un staff sans `OrgMembership`
- Event (permissions)
  - `requireEventPermission('badge.print')` accepte `ADMIN`, `OPERATOR`, `PRINTER` ; rejette `VIEWER`
  - `requireEventPermission('event.read.detailed')` accepte `ADMIN`, `OPERATOR` ; rejette `PRINTER` et `VIEWER`
  - `requireEventPermission('event.read.aggregated')` accepte les quatre rôles event
  - `requireEventPermission('scan.check-in')` rejette `PRINTER` (cas piège classique)
  - `requireEventPermission(*)` accepte un staff
  - Héritage : `requireEventPermission('event.update')` accepte un `OWNER` de l'org parent même sans `EventMembership`
  - Héritage : `requireEventPermission('event.read.aggregated')` accepte un `AUDITOR` de l'org parent ; **rejette** sur `event.read.detailed`
- Last-owner / last-super-admin
  - `assertNotLastOwner` rejette si suppression du dernier `OWNER` actif d'une org non archivée
  - `assertNotLastSuperAdmin` rejette si on tente de retirer le `SUPER_ADMIN` du dernier user qui le porte
- `getEffectiveEventRoles` retourne `{ staff: true, roles: [] }` pour un staff
- `getEffectiveEventRoles` retourne `{ staff: false, roles: ['ADMIN'] }` pour un `OWNER` ou `MANAGER` de l'org parent
- `getEffectiveEventRoles` retourne `{ staff: false, roles: [] }` si aucun droit

## Middleware (`src/middleware.ts`)

Le middleware Next.js intercepte chaque requête sur les routes protégées :

```typescript
// Matcher : /admin/*, /staff/*, /profile, /api/admin/*, /api/staff/*

// Étapes :
1. Récupérer le JWT (NextAuth getToken)
2. Si pas de token → redirect /login (ou 401 pour les routes /api/*)
3. Si /staff/* ou /api/staff/* → require isStaff=true
4. Si /admin/[orgId]/* :
     - Charger orgMemberships (cache par requête)
     - Require staff OU memberOf(orgId)
5. Si /admin/[orgId]/events/[eventId]/* :
     - Vérifier que event.orgId === orgId du path
     - Require staff OU OWNER(orgId) OU eventMembership(eventId)
6. Cache du contexte utilisateur dans `request.headers['x-user-context']`
   (transmis aux route handlers via getServerSession())
```

**Sécurité** : le middleware *protège* mais chaque route API doit *re-vérifier* la permission exacte requise (defense in depth) via `requireOrgRole` / `requireEventPermission`.

## Résolveur de settings (`src/lib/settings.ts`)

```typescript
// Cascade : EventSettings → Organization → PlatformSettings, premier non-null gagne
// Ne couvre PAS les champs SMTP ni reCAPTCHA, qui sont lus directement depuis PlatformSettings.
// OrgSettings a ete supprime en v2 : la cascade lit directement Organization.contactEmail/Phone.
async function resolveSettings(
  eventId?: string,
  orgId?: string,
): Promise<ResolvedSettings>;

type ResolvedSettings = {
  // Cascade EventSettings → Organization → PlatformSettings pour le contact
  contactEmail: string;
  contactPhone: string;
};

// Variante publique (sans secrets) pour les Server Components
async function resolvePublicSettings(eventId?: string, orgId?: string): Promise<PublicSettings>;

// Lectures directes de PlatformSettings (pas de cascade)
async function getPlatformSmtp(): Promise<PlatformSmtp>;
async function getPlatformRecaptcha(): Promise<PlatformRecaptcha>;
async function getPlatformPublicRecaptcha(): Promise<PublicRecaptcha>; // sans secret, pour les Server Components publics

type PlatformSmtp = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;  // jamais exposé via API
  smtpSecure: boolean;
};

type PlatformRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;  // jamais exposé via API
};

type PublicRecaptcha = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
};
```

Quand `eventId` est fourni, `orgId` est résolu automatiquement via `event.orgId`. Si ni l'un ni l'autre, ne lit que `PlatformSettings`. Le SMTP et le reCAPTCHA n'ont pas de variante "résolue" : il y a une seule source de vérité pour chacun, `PlatformSettings`.

## Activity log enrichi (`src/lib/activity-log.ts`)

```typescript
async function logActivity(input: {
  type: ActivityType;
  userId?: string;
  orgId?: string;        // déduit de eventId si fourni
  eventId?: string;
  targetId?: string;
  details?: Json;
  req?: NextRequest;     // pour ipAddress + userAgent
}): Promise<void>;

// Helper : marque automatiquement staffActor=true si le user actuel est staff
async function logStaffActionOnClient(input: { ...; orgId: string; }): Promise<void>;
```

**Règle clé** : `staffActor=true` n'est mis que si l'action staff porte sur des données *client* (orgId non null). Les actions plateforme pures (création d'org, modif `PlatformSettings`) ont `staffActor=false` car ce sont des actions staff sur leur propre périmètre.

## Routes API impactées (squelette)

Toutes les routes API doivent utiliser les helpers d'autorisation. Chaque route exprime la **permission** qu'elle vérifie, pas le rôle minimum (la matrice ci-dessus est la source). Exemple type :

```typescript
// src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });

  // Lecture détaillée : ADMIN, OPERATOR, ou héritage OWNER/MANAGER ; rejette VIEWER, PRINTER.
  await requireEventPermission(session.user.id, params.eventId, 'event.read.detailed');

  // ... requête Prisma filtrée par eventId
}

// src/app/api/admin/[orgId]/events/[eventId]/badges/[badgeId]/print/route.ts
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });

  // Impression : ADMIN, OPERATOR, PRINTER ; rejette VIEWER.
  await requireEventPermission(session.user.id, params.eventId, 'badge.print');

  // ...
}
```

## Critères d'acceptation

1. Un user staff peut accéder à `/admin/[orgId]/...` de n'importe quelle org via le middleware (avec audit `staffActor=true` sur les mutations).
2. Un `OWNER` ou `MANAGER` accède à toutes les routes des events de son org sans `EventMembership` explicite.
3. Un `AUDITOR` accède aux pages org en lecture seule et aux events de son org en vue agrégée seulement.
4. Un `OPERATOR` n'a accès qu'à `/admin/[orgId]/events/[eventId]/registrations` (liste + détail + approbation/rejet), `/scan`, `/badges` et son profil.
5. Un `PRINTER` n'a accès qu'à l'écran d'impression badge (recherche + impression) et à son profil.
6. Un `VIEWER` n'a accès qu'à la vue agrégée des inscriptions (compteurs, noms, catégorie, statut), aucun détail personnel.
7. Un user sans aucun droit est redirigé vers `/login` (ou reçoit 403 sur les routes API).
8. Toute mutation génère un `ActivityLog` correctement scopé (`orgId`/`eventId`).
9. Les actions staff sur données client (`orgId IS NOT NULL`) ont `staffActor=true`.
10. Les valeurs sensibles (`smtpPassword`, `recaptchaSecretKey`) ne sortent jamais des routes API publiques. Les champs SMTP et reCAPTCHA ne sortent jamais des routes `/api/admin/*` ni `/api/public/*` : ils ne sont consultables qu'à travers `/api/staff/settings` (lecture sans secret) ou `/api/staff/settings` PATCH (réservé `STAFF_ADMIN`+). Seul le `recaptchaSiteKey` (clé publique) est exposé aux Server Components publics via `getPlatformPublicRecaptcha()`.
11. Suppression du dernier `OWNER` d'une org non archivée renvoie HTTP 409 (`code=LAST_OWNER`).
12. Suppression du dernier `SUPER_ADMIN` de la plateforme renvoie HTTP 409 (`code=LAST_SUPER_ADMIN`).
13. Un `STAFF_ADMIN` qui tente de promouvoir un user en `STAFF_ADMIN` ou `SUPER_ADMIN` reçoit HTTP 403.
14. Tests unitaires des helpers d'autorisation passent (couverture des cas hiérarchie + héritage + bypass staff + non-linéarité event + last-owner + last-super-admin).

## Dépendances en aval

Toutes les sous-spec (2 à 7) dépendent de cette fondation. Aucune ne peut être développée avant que les helpers d'autorisation et le middleware soient en place.

## Mise à jour v2-11 (rôle implicite participant)

Plan v2-11 introduit le **rôle implicite participant** : tout `User` qui n'est ni staff ni membre d'org ni membre d'event reste néanmoins un compte valide pour s'inscrire à un événement public. La validation des accès aux routes `/api/account/*` et `/api/events/[slug]/register` passe par `requireAuth` (helper `src/lib/auth-participant.ts`), pas par les helpers staff/org/event.

Champs ajoutés sur `User` (tous nullable sauf `blocked`) :

- **Vérification email** : `emailVerifiedAt`, `emailVerifyToken @unique`, `emailVerifyTokenExpiry` (TTL 24h).
- **Reset password self-service** : `passwordResetToken @unique`, `passwordResetExpiry` (TTL 1h). Distinct du `inviteToken` qui reste utilisé pour l'invitation/reset staff.
- **Profil participant** : `firstName?`, `lastName?`, `structure?`, `photo?`, `idDocumentType?`, `idDocumentNumber?`, `idDocument?`, `participantProfileCompletedAt?`. Snapshoté dans chaque `Registration` au moment de la soumission/resoumission.
- **Modération** : `blocked Boolean default(false)`, `blockedReason?`. `authorize` NextAuth refuse le login si `!emailVerifiedAt || blocked`.

`ActivityType` enrichi (`USER_REGISTERED`, `USER_EMAIL_VERIFIED`, `USER_PASSWORD_RESET_REQUESTED`, `USER_PASSWORD_RESET_COMPLETED`, `USER_PROFILE_UPDATED`, `USER_BLOCKED`, `USER_UNBLOCKED`). `EDIT_LINK_SENT` supprimé.
