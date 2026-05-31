# Multi-tenancy & RBAC — Implementation Plan

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
| 0 | [ ] | -- | -- |
| 1 | [ ] | -- | -- |
| 2 | [ ] | -- | -- |
| 3 | [ ] | -- | -- |
| 4 | [ ] | -- | -- |
| 5 | [ ] | -- | -- |
| 6 | [ ] | -- | -- |
| 7 | [ ] | -- | -- |
| 8 | [ ] | -- | -- |
| 9 | [ ] | -- | -- |
| 10 | [ ] | -- | -- |
| 11 | [ ] | -- | -- |
| 12 | [ ] | -- | -- |

**Derniere session** : aucune, plan jamais commence.
**Prochaine etape** : Task 1.

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

enum OrgRole {
  OWNER
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
  ADMIN
  OPERATOR
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
  ORG_SETTINGS_UPDATED
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
  eventRoleAtLeast,
  hasOrgRole,
  effectiveEventRole,
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

describe("eventRoleAtLeast", () => {
  it("ADMIN >= OPERATOR", () => {
    expect(eventRoleAtLeast("ADMIN", "OPERATOR")).toBe(true);
  });
  it("OPERATOR < ADMIN", () => {
    expect(eventRoleAtLeast("OPERATOR", "ADMIN")).toBe(false);
  });
});

describe("hasOrgRole", () => {
  it("returns true if membership matches", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(hasOrgRole(ctx, "o1", "OWNER")).toBe(true);
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
  it("returns STAFF for staff user", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("STAFF");
  });
  it("returns ADMIN when user is OWNER of parent org", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "o1", role: "OWNER" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("ADMIN");
  });
  it("returns explicit EventMembership.role when present", () => {
    const ctx = baseCtx({ eventMemberships: [{ eventId: "e1", role: "OPERATOR" }] });
    expect(effectiveEventRole(ctx, "e1", "o1")).toBe("OPERATOR");
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

const STAFF_ORDER: Record<StaffRole, number> = {
  STAFF_OBSERVER: 1,
  STAFF_SUPPORT: 2,
  STAFF_ADMIN: 3,
};

const EVENT_ORDER: Record<EventRole, number> = {
  OPERATOR: 1,
  ADMIN: 2,
};

export function staffRoleAtLeast(actual: StaffRole, required: StaffRole): boolean {
  return STAFF_ORDER[actual] >= STAFF_ORDER[required];
}

export function eventRoleAtLeast(actual: EventRole, required: EventRole): boolean {
  return EVENT_ORDER[actual] >= EVENT_ORDER[required];
}

export function hasOrgRole(ctx: UserContext, orgId: string, role: OrgRole): boolean {
  if (ctx.isStaff) return true;
  return ctx.orgMemberships.some((m) => m.orgId === orgId && m.role === role);
}

export function effectiveEventRole(
  ctx: UserContext,
  eventId: string,
  orgId: string,
): EffectiveEventRole {
  if (ctx.isStaff) return "STAFF";
  if (ctx.orgMemberships.some((m) => m.orgId === orgId && m.role === "OWNER")) {
    return "ADMIN";
  }
  const m = ctx.eventMemberships.find((x) => x.eventId === eventId);
  return m ? m.role : null;
}

export function hasEventRole(
  ctx: UserContext,
  eventId: string,
  orgId: string,
  required: EventRole,
): boolean {
  const eff = effectiveEventRole(ctx, eventId, orgId);
  if (eff === "STAFF") return true;
  if (eff === null) return false;
  return eventRoleAtLeast(eff, required);
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-helpers.test.ts
```

Expected: 11 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/auth-helpers.ts src/lib/__tests__/auth-helpers.test.ts
git commit -m "feat(v2): helpers RBAC purs (staffRoleAtLeast, hasOrgRole, effectiveEventRole)"
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
import { resolveSettings, resolvePublicSettings } from "@/lib/settings";

describe("resolveSettings", () => {
  beforeEach(async () => {
    await prisma.eventSettings.deleteMany();
    await prisma.orgSettings.deleteMany();
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

  it("returns platform values when no org/event", async () => {
    const s = await resolveSettings();
    expect(s.smtpHost).toBe("platform-smtp");
    expect(s.smtpFrom).toBe("platform@badge.local");
  });

  it("org override wins over platform", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o" } });
    await prisma.orgSettings.create({
      data: { orgId: org.id, smtpHost: "org-smtp", smtpFrom: "org@x" },
    });
    const s = await resolveSettings(undefined, org.id);
    expect(s.smtpHost).toBe("org-smtp");
    expect(s.smtpFrom).toBe("org@x");
    expect(s.smtpPort).toBe(587);
  });

  it("event override wins over org", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    await prisma.orgSettings.create({
      data: { orgId: org.id, smtpFrom: "org@x" },
    });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e2", location: "L", date: new Date() },
    });
    await prisma.eventSettings.create({
      data: { eventId: event.id, smtpFrom: "event@x" },
    });

    const s = await resolveSettings(event.id);
    expect(s.smtpFrom).toBe("event@x");
  });
});

describe("resolvePublicSettings", () => {
  it("omits sensitive fields (smtpPassword, recaptchaSecretKey)", async () => {
    const s = await resolvePublicSettings();
    expect("smtpPassword" in s).toBe(false);
    expect("recaptchaSecretKey" in s).toBe(false);
    expect("smtpUser" in s).toBe(false);
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

export type ResolvedSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  contactEmail: string;
  contactPhone: string;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
};

export type PublicSettings = Omit<
  ResolvedSettings,
  "smtpPassword" | "recaptchaSecretKey" | "smtpUser"
>;

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

  const effectiveOrgId = orgId ?? event?.orgId;
  let orgSettings: Awaited<ReturnType<typeof prisma.orgSettings.findUnique>> = null;
  if (effectiveOrgId) {
    orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: effectiveOrgId } });
  }

  const platform = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!platform) {
    throw new Error("PlatformSettings singleton is missing. Run prisma db seed.");
  }

  return {
    smtpHost: pick(orgSettings?.smtpHost, platform.smtpHost) ?? "",
    smtpPort: pick(orgSettings?.smtpPort, platform.smtpPort) ?? 587,
    smtpFrom:
      pick(eventSettings?.smtpFrom, orgSettings?.smtpFrom, platform.smtpFrom) ?? "",
    smtpUser: pick(orgSettings?.smtpUser, platform.smtpUser) ?? "",
    smtpPassword: pick(orgSettings?.smtpPassword, platform.smtpPassword) ?? "",
    smtpSecure: pick(orgSettings?.smtpSecure, platform.smtpSecure) ?? false,
    contactEmail: pick(eventSettings?.contactEmail, orgSettings?.contactEmail) ?? "",
    contactPhone: pick(eventSettings?.contactPhone, orgSettings?.contactPhone) ?? "",
    recaptchaEnabled: pick(orgSettings?.recaptchaEnabled, platform.recaptchaEnabled) ?? false,
    recaptchaSiteKey: pick(orgSettings?.recaptchaSiteKey, platform.recaptchaSiteKey) ?? "",
    recaptchaSecretKey:
      pick(orgSettings?.recaptchaSecretKey, platform.recaptchaSecretKey) ?? "",
  };
}

export async function resolvePublicSettings(
  eventId?: string,
  orgId?: string,
): Promise<PublicSettings> {
  const full = await resolveSettings(eventId, orgId);
  const { smtpPassword, recaptchaSecretKey, smtpUser, ...pub } = full;
  return pub;
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/settings.test.ts
```

Expected: 4 passed.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts
git commit -m "feat(v2): resolveSettings (cascade Platform > Org > Event)"
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
  getEffectiveEventRole,
  AuthError,
} from "@/lib/auth-guards";

async function setupOrgEvent() {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "", date: new Date() },
  });
  return { org, event };
}

describe("requireStaff", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("throws AuthError if user not found", async () => {
    await expect(requireStaff("missing", "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws if user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await expect(requireStaff(u.id, "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
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
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("passes for OWNER", async () => {
    const { org } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await expect(requireOrgRole(u.id, org.id, "OWNER")).resolves.toBeUndefined();
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
    await expect(requireOrgRole(u.id, org.id, "OWNER")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireEventRole", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("passes for OWNER of parent org when ADMIN required", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("passes for explicit ADMIN membership", async () => {
    const { event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("OPERATOR cannot satisfy ADMIN requirement", async () => {
    const { event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).rejects.toBeInstanceOf(AuthError);
  });

  it("ADMIN satisfies OPERATOR requirement", async () => {
    const { event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await expect(requireEventRole(u.id, event.id, "OPERATOR")).resolves.toBeUndefined();
  });

  it("getEffectiveEventRole returns STAFF for staff", async () => {
    const { event } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    expect(await getEffectiveEventRole(s.id, event.id)).toBe("STAFF");
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
  hasEventRole,
  effectiveEventRole as effectiveEventRolePure,
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
      | "EVENT_NOT_FOUND",
    public httpStatus: 401 | 403 | 404 = 403,
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

export async function requireOrgRole(
  userId: string,
  orgId: string,
  role: OrgRole,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  if (!hasOrgRole(ctx, orgId, role)) throw new AuthError("ORG_FORBIDDEN", 403);
}

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
  if (!hasEventRole(ctx, eventId, event.orgId, role)) {
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
```

- [ ] **Step 8.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-guards.test.ts
```

Expected: 11 passed.

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/auth-guards.ts src/lib/__tests__/auth-guards.test.ts
git commit -m "feat(v2): guards requireStaff/Org/Event + AuthError"
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
import { requireStaff, requireOrgRole, AuthError } from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";

describe("v2 RBAC integration", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.eventSettings.deleteMany();
    await prisma.orgSettings.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("staff can act across orgs without OrgMembership", async () => {
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
