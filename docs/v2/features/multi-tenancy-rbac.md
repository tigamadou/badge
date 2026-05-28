# Multi-tenancy & RBAC

## Description fonctionnelle

L'application v2 supporte plusieurs organisations clientes, chacune organisant plusieurs événements. Les utilisateurs peuvent appartenir à plusieurs organisations et événements simultanément. Trois niveaux de rôles coexistent : staff applicatif (global), organisation (OWNER), événement (ADMIN, OPERATOR).

Cette feature pose les fondations de tout le reste : modèle de données tenant, helpers d'autorisation, middleware de scoping. Toutes les autres sous-spécifications en dépendent.

## Périmètre

Inclus :

- Modèles Prisma : `User`, `Organization`, `Event`, `OrgMembership`, `EventMembership`, `OrgSettings`, `EventSettings`, `PlatformSettings`, `CategoryTemplate`, `Category` (ex-`Team`)
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
  name                     String
  slug                     String   @unique
  archived                 Boolean  @default(false)
  archivedAt               DateTime?
  createdAt                DateTime @default(now())

  quotaMaxEvents           Int?
  quotaMaxRegistrations    Int?
  quotaMaxStorageMB        Int?

  memberships              OrgMembership[]
  events                   Event[]
  settings                 OrgSettings?
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

enum OrgRole { OWNER }      // extensible (BILLING, AUDITOR, ...) plus tard
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

model OrgSettings {
  id                 String       @id @default(cuid())
  orgId              String       @unique
  organization       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  smtpHost           String?
  smtpPort           Int?
  smtpFrom           String?
  smtpUser           String?
  smtpPassword       String?
  smtpSecure         Boolean?
  contactEmail       String?
  contactPhone       String?
  recaptchaEnabled   Boolean?
  recaptchaSiteKey   String?
  recaptchaSecretKey String?
}

model EventSettings {
  id           String  @id @default(cuid())
  eventId      String  @unique
  event        Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)

  smtpFrom     String?
  contactEmail String?
  contactPhone String?
}
```

**Règle de résolution** : pour une clé donnée, on parcourt `EventSettings → OrgSettings → PlatformSettings`, premier non-null gagne. Les valeurs sensibles (`smtpPassword`, `recaptchaSecretKey`) ne sont jamais exposées dans les réponses API.

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
- `PLATFORM_SETTINGS_UPDATED`, `ORG_SETTINGS_UPDATED`, `EVENT_SETTINGS_UPDATED`
- `CATEGORY_TEMPLATE_CREATED`, `CATEGORY_TEMPLATE_UPDATED`, `CATEGORY_TEMPLATE_DELETED`

## Helpers d'autorisation (`src/lib/auth.ts`)

```typescript
// Session minimale (JWT NextAuth)
type SessionUser = { id: string; email: string; name: string; isStaff: boolean };

// Vérifie que l'utilisateur courant est staff avec un rôle minimal
function requireStaff(session: SessionUser, minRole: StaffRole): asserts session is StaffSession;

// Hiérarchie staff : STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER
function staffRoleAtLeast(actual: StaffRole, required: StaffRole): boolean;

// Vérifie que l'utilisateur courant est OWNER de l'org (ou staff)
async function requireOrgRole(userId: string, orgId: string, role: OrgRole): Promise<void>;

// Vérifie que l'utilisateur courant a un rôle effectif sur l'event :
//   1. staff (toute action) → autorisé
//   2. OWNER de l'org parent → considéré comme ADMIN
//   3. EventMembership.role >= role requis
async function requireEventRole(userId: string, eventId: string, role: EventRole): Promise<void>;

// Résout le rôle effectif d'un user sur un event (utile pour l'UI)
async function getEffectiveEventRole(
  userId: string,
  eventId: string,
): Promise<EventRole | 'STAFF' | null>;

// Charge l'utilisateur + ses memberships (cached par requête)
async function loadUserContext(userId: string): Promise<UserContext>;

type UserContext = {
  user: User;
  orgMemberships: { orgId: string; role: OrgRole }[];
  eventMemberships: { eventId: string; role: EventRole }[];
  staff: { role: StaffRole } | null;
};
```

**Tests requis** (`src/lib/__tests__/auth.test.ts`) :

- `requireStaff` rejette un non-staff
- `requireStaff` rejette si rôle staff < requis
- `requireOrgRole` accepte le OWNER explicite
- `requireOrgRole` accepte un staff même sans OrgMembership
- `requireEventRole(ADMIN)` accepte le OWNER de l'org parent même sans EventMembership
- `requireEventRole(ADMIN)` accepte un OPERATOR ? Non, doit échouer
- `requireEventRole(OPERATOR)` accepte un ADMIN event (hiérarchie)
- `getEffectiveEventRole` retourne 'STAFF' pour un staff
- `getEffectiveEventRole` retourne 'ADMIN' pour un OWNER de l'org parent
- `getEffectiveEventRole` retourne `null` si aucun droit

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

**Sécurité** : le middleware *protège* mais chaque route API doit *re-vérifier* le rôle exact requis (defense in depth) via `requireOrgRole` / `requireEventRole`.

## Résolveur de settings (`src/lib/settings.ts`)

```typescript
// Cascade : Event → Org → Platform, premier non-null gagne
async function resolveSettings(
  eventId?: string,
  orgId?: string,
): Promise<ResolvedSettings>;

type ResolvedSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;        // jamais exposé via API
  smtpSecure: boolean;
  contactEmail: string;
  contactPhone: string;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;  // jamais exposé via API
};

// Variante publique (sans secrets) pour les Server Components
async function resolvePublicSettings(eventId?: string, orgId?: string): Promise<PublicSettings>;
```

Quand `eventId` est fourni, `orgId` est résolu automatiquement via `event.orgId`. Si ni l'un ni l'autre, ne lit que `PlatformSettings`.

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

Toutes les routes API doivent utiliser les helpers d'autorisation. Exemple type :

```typescript
// src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });

  await requireEventRole(session.user.id, params.eventId, 'ADMIN');

  // ... requête Prisma filtrée par eventId
}
```

## Critères d'acceptation

1. Un user staff peut accéder à `/admin/[orgId]/...` de n'importe quelle org via le middleware.
2. Un OWNER accède à toutes les routes de ses orgs et de ses events sans EventMembership explicite.
3. Un OPERATOR n'a accès qu'à `/admin/[orgId]/events/[eventId]/scan` et son propre profil.
4. Un user sans aucun droit est redirigé vers `/login` (ou reçoit 403 sur les routes API).
5. Toute mutation génère un `ActivityLog` correctement scopé (orgId/eventId).
6. Les actions staff sur données client (`orgId IS NOT NULL`) ont `staffActor=true`.
7. Les valeurs sensibles (`smtpPassword`, `recaptchaSecretKey`) ne sortent jamais des routes API publiques.
8. Tests unitaires des helpers d'autorisation passent (couverture des cas hiérarchie + héritage + bypass staff).

## Dépendances en aval

Toutes les sous-spec (2 à 7) dépendent de cette fondation. Aucune ne peut être développée avant que les helpers d'autorisation et le middleware soient en place.
