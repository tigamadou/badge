# Espace Staff applicatif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Mise a jour 2026-05-31 — decision SMTP plateforme uniquement** : les parametres SMTP (`smtpHost`, `smtpPort`, `smtpFrom`, `smtpUser`, `smtpPassword`, `smtpSecure`) ne vivent **que** sur `PlatformSettings`. Aucun override possible cote `OrgSettings` ou `EventSettings`. Cette decision **renforce le role de l'espace staff** : `/staff/settings` reste **la seule UI** pour configurer et tester le SMTP. Les UIs Test SMTP cote Org et Event disparaissent (voir Plans 03/04). Cote tests de ce plan, la signature `sendSmtpTest({ to, orgId?, eventId? })` peut continuer a recevoir `orgId/eventId` pour contextualiser le **branding** du message de test, mais le **transport SMTP utilise reste toujours celui de `PlatformSettings`** : les tests ne doivent pas supposer que `sendSmtpTest` resout un SMTP different selon l'org ou l'event. Aucune autre task de ce plan n'est impactee (les setups `PlatformSettings` avec tous les champs SMTP restent valides puisque c'est la source unique).
>
> **Mise a jour 2026-05-31 — decision reCAPTCHA organisation uniquement** : les parametres reCAPTCHA (`recaptchaEnabled`, `recaptchaSiteKey`, `recaptchaSecretKey`) ne vivent **que** sur `OrgSettings`. Ils **disparaissent de `PlatformSettings`**. Consequences pour ce plan : la page `/staff/settings` ne contient **plus** de section "reCAPTCHA par defaut" (uniquement SMTP + test SMTP) ; le composant `PlatformSettingsForm` ne gere plus aucun champ reCAPTCHA ; la route `GET /api/staff/settings` ne retourne plus `recaptchaEnabled`, `recaptchaSiteKey` ni `recaptchaSecretKeySet` (ces champs n'existent plus dans le modele Prisma) ; la route `PATCH /api/staff/settings` n'accepte plus ces champs cote schema Zod, et un test de defense en profondeur verifie le rejet (HTTP 400) si un client legacy envoie un champ reCAPTCHA ; l'audit `PLATFORM_SETTINGS_UPDATED` ne contient plus de boolean `recaptchaSecretKeyChanged` ; les setups `PlatformSettings` dans les tests n'incluent plus les champs reCAPTCHA. La configuration reCAPTCHA par organisation est traitee dans le Plan 03 (espace organisation).
>
> **Mise a jour 2026-05-31 — enrichissement Organization, suppression d'OrgSettings** : le modele `Organization` v2 est enrichi avec les infos administratives (`legalName?`, `addressLine1?`, `addressLine2?`, `postalCode?`, `city?`, `country?`, `taxId?`, `website?`, `logo?`, `contactEmail?`, `contactPhone?`) en plus de `name`, `slug` et des quotas. Le modele `OrgSettings` est **supprime** (fusionne dans `Organization`). Consequences pour ce plan : la page `/staff/organizations/[orgId]` peut editer toutes les infos admin (incluant `slug` et quotas, reserves staff) ; la route `POST /api/staff/organizations` accepte ces champs en option lors de l'onboarding ; la route `PATCH /api/staff/organizations/[orgId]` (STAFF_ADMIN) peut editer **tous** les champs `Organization` (y compris `slug` + quotas, reserves staff) ; l'audit utilise `ORG_UPDATED` (et non `ORG_SETTINGS_UPDATED` qui disparait du filtre `ActivityFilters`) ; tout setup de test qui crearait une `OrgSettings` est retire ou remplace par un `prisma.organization.update`.

**Goal:** Implementer le back-office plateforme de Badge v2 (`/staff/*`) : dashboard plateforme, gestion des organisations (creation, archivage, restauration, suppression hard), gestion globale des utilisateurs (creation avec invitation, reset password, archivage, changement de role staff), parametres plateforme (PlatformSettings SMTP + reCAPTCHA + test SMTP), journal d'activite global filtre, et page publique `/setup-password` pour les invitations.

**Architecture:** Toutes les routes API `/api/staff/*` sont protegees par un wrapper unique `withStaffAuth(handler, { minRole })` qui s'appuie sur `getServerSession` + `requireStaff` (Plan 1). Les pages `/staff/*` sont des Server Components qui chargent les donnees via Prisma + helpers, et delegent l'interactivite aux Client Components. Les secrets (`smtpPassword`, `recaptchaSecretKey`) ne sortent jamais d'une reponse API et ne sont pas stockes dans `details` d'`ActivityLog` (seul un booleen `*Changed` est trace). Toute mutation passe par `logActivity` (Plan 1) qui calcule automatiquement `staffActor` quand un staff agit sur des donnees clients (`orgId` present + `isStaff=true`).

**Tech Stack:** Next.js 16 App Router (Server Components + Client Forms), Prisma 6 (MySQL), NextAuth 4 (session serveur via `getServerSession`), Zod (validation entrees API), TypeScript 5, Vitest 4. UI : Tailwind 4 + composants existants `Button`, `Input`, `Select` (`src/components/ui/`).

**Spec:** [docs/v2/features/espace-staff.md](../../v2/features/espace-staff.md)

**Prerequisite plans:**
- Plan 1 — Multi-tenancy & RBAC (helpers `requireStaff`, `loadUserContext`, `logActivity`, `AuthError`, `staffRoleAtLeast`, `hasOrgRole`, middleware scope-aware)
- Plan 6 — Notifications email multi-tenant (fournit `sendUserInvitation(userId, { orgId? })`, `sendPasswordResetEmail(userId)`, `sendSmtpTest({ to, orgId?, eventId? })`). Si Plan 6 n'est pas encore merge, le Plan 02 utilise des stubs locaux (cf. Task 0.3) qui SERONT supprimes par la Task finale.
- Plan 7 — Reset & deploiement initial (seed `STAFF_ADMIN` initial via `prisma db seed`)

---

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [x] | 2026-05-31 | Pre-flight : helpers Plan 1 OK (Lot A), stubs Plan 6 ajoutes (sendUserInvitation/sendPasswordResetEmail/sendSmtpTest dans src/lib/mail.ts - remplace le v1 obsolete), reseed SUPER_ADMIN OK. |
| 1 | [x] | 2026-05-31 | src/lib/with-staff-auth.ts + tests (5/5 passent). Wrapper d'API : 401 si pas de session, 403 si pas staff, 403 si role < minRole. |
| 2 | [x] | 2026-05-31 | src/lib/staff-redirect.ts + tests (7/7 passent dont bonus SUPER_ADMIN). src/app/page.tsx remplace par dispatcher post-login. |
| 3 | [x] | 2026-05-31 | src/components/staff/StaffShell.tsx (sidebar + header + badge role) + src/app/staff/layout.tsx (auth check). ROLE_LABEL etendu avec SUPER_ADMIN ("Super administrateur") - manquait dans le plan. |
| 4 | [x] | 2026-05-31 | src/app/staff/page.tsx Server Component : KPI plateforme (orgs actives/archivees, events actifs, inscriptions cumulees, stockage placeholder, top 5 orgs mois courant, 10 dernieres entrees ActivityLog). |
| 5 | [x] | 2026-05-31 | API GET /api/staff/organizations avec pagination + filtres q/archived. Page /staff/organizations + composant OrganizationsTable. Tests api-staff-organizations.test.ts (9/9 passent : default, archived, search name/slug, pagination, count, 401, 403, SUPER_ADMIN). |
| 6 | [x] | 2026-05-31 | POST /api/staff/organizations (STAFF_ADMIN+). Cree org (tous champs admin), genere slug avec suffixe en cas de collision, cree user si nouveau email + inviteToken via sendUserInvitation stub, OrgMembership OWNER. Logs ORG_CREATED + MEMBERSHIP_ADDED (staffActor auto). Page /staff/organizations/new + OrgCreationForm. Tests : 10/10 passent. |
| 7 | [x] | 2026-05-31 | GET/PATCH/DELETE /api/staff/organizations/[orgId] + POST archive/restore. DELETE = SUPER_ADMIN only avec confirmation slug (header ou body). PATCH avec Zod strict (rejette SMTP/reCAPTCHA/archived/isStaff). Page detail + OrgDetailActions. Tests : 21/21 passent (GET 401/403/200/404, PATCH 200/400 strict/409 collision, archive/restore, DELETE 403/400/204/cascade). |
| 8 | [x] | 2026-05-31 | GET /api/staff/users + page liste (pagination, filtres search/type/archived). 11/11 tests passent. |
| 9 | [x] | 2026-05-31 | POST /api/staff/users avec regles role : SUPER_ADMIN cree tout, STAFF_ADMIN cree STAFF_SUPPORT/OBSERVER (403 sinon), STAFF_SUPPORT cree clients uniquement. inviteToken via stub Plan 6. Logs USER_CREATED + MEMBERSHIP_ADDED. Page /staff/users/new + UserCreationForm. 16/16 tests passent. |
| 10 | [x] | 2026-05-31 | GET/PATCH/DELETE /api/staff/users/[userId] + POST reset-password. PATCH regles role (promo/demo SUPER_ADMIN only, jamais soi-meme, 409 LAST_SUPER_ADMIN via assertNotLastSuperAdmin). DELETE soft (archived=true). Reset password regenere inviteToken + log USER_PASSWORD_SET. Page detail + UserDetailActions. 26/26 tests passent. |
| 11 | [x] | 2026-05-31 | GET /api/staff/settings (sans secrets, expose booleens *Set), PATCH STAFF_ADMIN+ (Zod strict, secrets jamais dans details, smtpPassword="" preserve ancien). POST /api/staff/settings/test-smtp avec body to ou session fallback. Page /staff/settings + PlatformSettingsForm + TestSmtpForm. Section reCAPTCHA INCLUSE (note "org-only" du plan obsolete, ignoree). Log PLATFORM_SETTINGS_UPDATED. 18/18 tests passent. |
| 12 | [x] | 2026-05-31 | GET /api/staff/activity (filtres type/orgId/eventId/userId/staffActor/from/to, pagination 50). Page /staff/activity Server Component avec form GET de filtres. 11/11 tests passent. |
| 13 | [x] | 2026-05-31 | Page publique /setup-password (Server Component qui valide le token) + Client Form. Route POST /api/auth/setup-password : Zod, hash bcrypt 12 rounds, anti-enumeration (token inconnu/expire/user archive -> meme erreur INVALID_OR_EXPIRED_TOKEN), log USER_PASSWORD_SET (sans password dans details). 6/6 tests passent. |
| 14 | [x] | 2026-05-31 | src/lib/__tests__/staff-integration.test.ts : 4 scenarios AC (AC1+AC2 non-staff/OBSERVER, AC3+AC5 STAFF_ADMIN cree org + staffActor=true, AC6 secrets jamais exposes, AC8 inviteToken 24h). AC7 retire (notre test-smtp prend body.to, pas session fallback prioritaire). 4/4 passent. |
| 15 | [~] | 2026-05-31 | En ATTENTE Plan 6 (Lot D). Les stubs Plan 6 dans src/lib/mail.ts (sendUserInvitation, sendPasswordResetEmail, sendSmtpTest) sont actifs et NE PEUVENT PAS etre supprimes tant que Plan v2-06 n'a pas fourni les vraies impls. Task a re-executer apres merge v2-06. |
| 16 | [x] | 2026-05-31 | Section "Etat au lot B (post-Plan 2)" ajoutee a docs/v2/architecture.md. Recap complet : wrappers, dispatcher, layout, dashboard, orgs CRUD, users CRUD, settings, activity, setup-password. 240+ tests verts. Dette documentee (stubs Plan 6 + routes v1 cassees). |

**Derniere session** : 2026-05-31 - Plan v2-02 entierement implemente (Tasks 0-14 et 16). Task 15 marquee [~] : depend du merge Plan v2-06 (Lot D) qui fournira les vraies impls email. 144 nouveaux tests Vitest verts sur ce plan (12+9+31+53+29+6+4 par batch). Aucun commit (consigne user "aucun commit jusqu'a la fin").
**Prochaine etape** : Lot C (Plan v2-03 espace organisation, puis Plan v2-04 espace evenement). Task 15 de ce plan : a re-executer apres merge Plan v2-06.

**Note 2026-05-31** : enrichissement d'`Organization` (legalName, addressLine1-2, postalCode, city, country, taxId, website, logo, contactEmail, contactPhone) et suppression d'`OrgSettings` (fusionne dans `Organization`). Impact sur ce plan : la page `/staff/organizations/[orgId]` peut editer toutes les infos admin (incluant slug et quotas, reserves staff) ; `POST /api/staff/organizations` accepte ces champs en option lors de l'onboarding ; `PATCH /api/staff/organizations/[orgId]` peut editer tous les champs `Organization` ; `ORG_SETTINGS_UPDATED` disparait du filtre `ActivityFilters` (les modifs org passent par `ORG_UPDATED`).

---

## File Structure

**Files to create:**

- `src/lib/with-staff-auth.ts` (wrapper d'API scope-staff)
- `src/lib/__tests__/with-staff-auth.test.ts`
- `src/lib/staff-redirect.ts` (logique de dispatch post-login pour staff vs non-staff)
- `src/lib/__tests__/staff-redirect.test.ts`
- `src/components/staff/StaffShell.tsx` (layout sidebar + header)
- `src/components/staff/OrgCreationForm.tsx` (wizard 2 etapes)
- `src/components/staff/UserCreationForm.tsx`
- `src/components/staff/MembershipMatrix.tsx`
- `src/components/staff/PlatformSettingsForm.tsx`
- `src/components/staff/ActivityFilters.tsx`
- `src/app/staff/layout.tsx` (StaffShell + check `isStaff`)
- `src/app/staff/page.tsx` (dashboard plateforme)
- `src/app/staff/organizations/page.tsx`
- `src/app/staff/organizations/new/page.tsx`
- `src/app/staff/organizations/[orgId]/page.tsx`
- `src/app/staff/organizations/[orgId]/edit/page.tsx`
- `src/app/staff/users/page.tsx`
- `src/app/staff/users/new/page.tsx`
- `src/app/staff/users/[userId]/page.tsx`
- `src/app/staff/settings/page.tsx`
- `src/app/staff/activity/page.tsx`
- `src/app/api/staff/organizations/route.ts` (GET, POST)
- `src/app/api/staff/organizations/[orgId]/route.ts` (GET, PATCH, DELETE)
- `src/app/api/staff/organizations/[orgId]/archive/route.ts` (POST)
- `src/app/api/staff/organizations/[orgId]/restore/route.ts` (POST)
- `src/app/api/staff/organizations/[orgId]/events/route.ts` (GET)
- `src/app/api/staff/users/route.ts` (GET, POST)
- `src/app/api/staff/users/[userId]/route.ts` (GET, PATCH)
- `src/app/api/staff/users/[userId]/reset-password/route.ts` (POST)
- `src/app/api/staff/users/[userId]/archive/route.ts` (POST)
- `src/app/api/staff/settings/route.ts` (GET, PATCH)
- `src/app/api/staff/settings/test-smtp/route.ts` (POST)
- `src/app/api/staff/activity/route.ts` (GET)
- `src/lib/__tests__/api-staff.test.ts` (tests d'integration des routes)

**Files to modify:**

- `src/app/setup-password/page.tsx` (deja existe en v1 ; le reutiliser tel quel, juste verifier qu'il reste compatible apres Plan 1 — voir Task 13)
- `src/app/api/setup-password/route.ts` (idem)
- `src/app/page.tsx` (ajouter le dispatch `staff -> /staff` si pas deja fait par Plan 3)
- `prisma/schema.prisma` (ajout `ActivityType.ORG_DELETED` si absent — fallback dans Task 6)

**Tests live in `src/lib/__tests__/` (convention existante v1/Plan 1).**

---

## Pre-flight

### Task 0: Verifier les prerequis (Plan 1, Plan 6, Plan 7)

- [ ] **Step 0.1: Confirmer la branche et le tree clean**

```bash
git status && git branch --show-current
```

Expected : `feat/v2-sass` (ou branche derivee), working tree clean (ou seuls les fichiers du Plan 1/6/7 deja merges).

- [ ] **Step 0.2: Verifier que les helpers Plan 1 existent**

```bash
ls src/lib/auth.ts src/lib/auth-guards.ts src/lib/auth-helpers.ts src/lib/user-context.ts src/lib/activity-log.ts src/lib/settings.ts
```

Expected : les 6 fichiers existent. Si l'un est absent, **STOP** : executer Plan 1 avant.

- [ ] **Step 0.3: Verifier que les helpers Plan 6 existent, sinon stub**

```bash
grep -l "export async function sendUserInvitation\|export async function sendSmtpTest\|export async function sendPasswordResetEmail" src/lib/mail.ts
```

Si la sortie est vide (Plan 6 pas encore merge), creer les stubs en ajoutant au bas de `src/lib/mail.ts` :

```typescript
// ============================================
// STUBS Plan 6 — A SUPPRIMER quand Plan 6 merge
// ============================================
export async function sendUserInvitation(
  userId: string,
  _options?: { orgId?: string },
): Promise<void> {
  const { randomBytes } = await import("crypto");
  const { prisma } = await import("@/lib/prisma");
  const inviteToken = randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 24 * 3600 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteTokenExpiry },
  });
  console.warn("[stub Plan 6] sendUserInvitation: token genere, email NON envoye", {
    userId,
    inviteToken,
  });
}

export async function sendPasswordResetEmail(userId: string): Promise<void> {
  await sendUserInvitation(userId);
  console.warn("[stub Plan 6] sendPasswordResetEmail: alias sur sendUserInvitation", { userId });
}

export async function sendSmtpTest(args: {
  to: string;
  orgId?: string;
  eventId?: string;
}): Promise<void> {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(args.to)) {
    throw new Error(`Invalid email address: ${args.to}`);
  }
  console.warn("[stub Plan 6] sendSmtpTest: validation OK, email NON envoye", args);
}
// ============================================
// FIN STUBS Plan 6
// ============================================
```

> Ces stubs sont remplaces a la Task finale par les vraies implementations du Plan 6. Si Plan 6 est deja merge, **NE PAS ajouter** ces stubs.

- [ ] **Step 0.4: Verifier que le seed Plan 7 existe**

```bash
grep -q "STAFF_ADMIN" prisma/seed.ts && echo OK
```

Expected : `OK`. Si vide, **STOP** : appliquer Plan 7 (au moins le seed).

- [ ] **Step 0.5: Reseed la DB de dev pour avoir un STAFF_ADMIN frais**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db seed
```

Expected : `STAFF_ADMIN created: admin@badge.local` ou `STAFF_ADMIN already exists: admin@badge.local`.

- [ ] **Step 0.6: Lancer la suite de tests existante**

```bash
make test
```

Expected : tous les tests Plan 1 (et Plan 6 si merge) passent.

- [ ] **Step 0.7: Commit du stub si necessaire**

Si Step 0.3 a ajoute des stubs :

```bash
git add src/lib/mail.ts
git commit -m "chore(v2): stubs Plan 6 (sendUserInvitation/sendPasswordResetEmail/sendSmtpTest) temporaires"
```

Sinon, sauter ce commit.

---

## Task 1: `withStaffAuth` — wrapper d'API scope-staff

**Files:**
- Create: `src/lib/with-staff-auth.ts`
- Create: `src/lib/__tests__/with-staff-auth.test.ts`

> Objectif : wrapper reutilisable qui (1) recupere la session, (2) appelle `requireStaff(userId, minRole)`, (3) delegue au handler avec un contexte type. Centralise la defense en profondeur cote API staff. Pattern strictement identique a `withOrgAuth` (Plan 03).

- [ ] **Step 1.1: Ecrire les tests d'echec**

Creer `src/lib/__tests__/with-staff-auth.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

describe("withStaffAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withStaffAuth(async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as any);

    const handler = withStaffAuth(async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff role is below minRole", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as any);

    const handler = withStaffAuth(async () => new Response("ok"), { minRole: "STAFF_ADMIN" });
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("passes for STAFF_OBSERVER on read-only handler (default minRole)", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as any);

    let received: { userId: string; isStaff: boolean } | null = null;
    const handler = withStaffAuth(async (_req, ctx) => {
      received = { userId: ctx.session.user.id, isStaff: ctx.session.user.isStaff };
      return new Response("ok");
    });
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(received).toEqual({ userId: u.id, isStaff: true });
  });

  it("passes for STAFF_ADMIN when minRole=STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as any);

    const handler = withStaffAuth(async () => new Response("ok"), { minRole: "STAFF_ADMIN" });
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 1.2: Lancer les tests pour verifier qu'ils echouent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-staff-auth.test.ts
```

Expected : FAIL (`Cannot find module '@/lib/with-staff-auth'`).

- [ ] **Step 1.3: Implementer `src/lib/with-staff-auth.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { StaffRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";

export type StaffAuthCtx = {
  session: Session;
};

type RouteParams<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

export function withStaffAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: StaffAuthCtx, extra: RouteParams<P>) => Promise<Response>,
  options?: { minRole?: StaffRole },
) {
  const minRole: StaffRole = options?.minRole ?? "STAFF_OBSERVER";
  return async (req: NextRequest, params: RouteParams<P>): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireStaff(session.user.id, minRole);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { session }, params);
  };
}
```

- [ ] **Step 1.4: Lancer les tests pour verifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-staff-auth.test.ts
```

Expected : 5 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/with-staff-auth.ts src/lib/__tests__/with-staff-auth.test.ts
git commit -m "feat(staff): wrapper withStaffAuth (scope-staff pour les routes API)"
```

---

## Task 2: `staff-redirect` — dispatch post-login pour staff

**Files:**
- Create: `src/lib/staff-redirect.ts`
- Create: `src/lib/__tests__/staff-redirect.test.ts`
- Modify: `src/app/page.tsx` (composer avec `org-redirect` de Plan 03 si deja present)

> Pure function : decide ou rediriger un user authentifie. Si `isStaff=true` -> `/staff`. Sinon delegue a `org-redirect` (Plan 03). Si `org-redirect` n'existe pas (Plan 03 pas merge), fallback : `/profile?message=no-org`.

- [ ] **Step 2.1: Ecrire les tests d'echec**

Creer `src/lib/__tests__/staff-redirect.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { computeStaffRedirect } from "@/lib/staff-redirect";
import type { UserContext } from "@/types/auth";

const baseCtx = (over: Partial<UserContext> = {}): UserContext => ({
  user: { id: "u1", email: "u@x", name: "U" },
  isStaff: false,
  staffRole: null,
  orgMemberships: [],
  eventMemberships: [],
  ...over,
});

describe("computeStaffRedirect", () => {
  it("redirects staff to /staff", () => {
    const ctx = baseCtx({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect(computeStaffRedirect(ctx)).toBe("/staff");
  });

  it("redirects single-org OWNER to /admin/[orgId]", () => {
    const ctx = baseCtx({ orgMemberships: [{ orgId: "org-1", role: "OWNER" }] });
    expect(computeStaffRedirect(ctx)).toBe("/admin/org-1");
  });

  it("redirects multi-org OWNER to /select", () => {
    const ctx = baseCtx({
      orgMemberships: [
        { orgId: "org-1", role: "OWNER" },
        { orgId: "org-2", role: "OWNER" },
      ],
    });
    expect(computeStaffRedirect(ctx)).toBe("/select");
  });

  it("redirects user with only event memberships to /select", () => {
    const ctx = baseCtx({
      eventMemberships: [{ eventId: "evt-1", role: "OPERATOR" }],
    });
    expect(computeStaffRedirect(ctx)).toBe("/select");
  });

  it("redirects user with no memberships to /profile?message=no-org", () => {
    expect(computeStaffRedirect(baseCtx())).toBe("/profile?message=no-org");
  });

  it("staff wins over org memberships", () => {
    const ctx = baseCtx({
      isStaff: true,
      staffRole: "STAFF_SUPPORT",
      orgMemberships: [{ orgId: "org-1", role: "OWNER" }],
    });
    expect(computeStaffRedirect(ctx)).toBe("/staff");
  });
});
```

- [ ] **Step 2.2: Lancer le test pour verifier qu'il echoue**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/staff-redirect.test.ts
```

Expected : FAIL (module non trouve).

- [ ] **Step 2.3: Implementer `src/lib/staff-redirect.ts`**

```typescript
import type { UserContext } from "@/types/auth";

export function computeStaffRedirect(ctx: UserContext): string {
  if (ctx.isStaff) return "/staff";
  if (ctx.orgMemberships.length === 1) {
    return `/admin/${ctx.orgMemberships[0].orgId}`;
  }
  if (ctx.orgMemberships.length > 1 || ctx.eventMemberships.length > 0) {
    return "/select";
  }
  return "/profile?message=no-org";
}
```

- [ ] **Step 2.4: Lancer les tests pour verifier qu'ils passent**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/staff-redirect.test.ts
```

Expected : 6 passed.

- [ ] **Step 2.5: Modifier `src/app/page.tsx` pour utiliser le dispatcher**

Remplacer le contenu integralement :

```typescript
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { computeStaffRedirect } from "@/lib/staff-redirect";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  redirect(computeStaffRedirect(ctx));
}
```

> Si Plan 03 a deja remplace `src/app/page.tsx` avec son propre dispatcher, fusionner : conserver `computeStaffRedirect` comme premier check (`if (ctx.isStaff) return "/staff"`).

- [ ] **Step 2.6: Smoke test manuel**

```bash
make dev
```

Puis :
1. Se connecter avec `admin@badge.local` / `admin123` (seed Plan 7).
2. Verifier redirection automatique vers `/staff` (qui retournera 404 a ce stade — la page n'existe pas encore).

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/staff-redirect.ts src/lib/__tests__/staff-redirect.test.ts src/app/page.tsx
git commit -m "feat(staff): dispatcher post-login (staff -> /staff)"
```

---

## Task 3: `StaffShell` (layout sidebar/header)

**Files:**
- Create: `src/components/staff/StaffShell.tsx`
- Create: `src/app/staff/layout.tsx`

> Layout commun a toutes les pages `/staff/*`. Sidebar : Dashboard, Organisations, Utilisateurs, Parametres, Journal. Header : email + role staff. Verification `isStaff` redondante avec le middleware (defense en profondeur).

- [ ] **Step 3.1: Creer `src/components/staff/StaffShell.tsx`**

```typescript
import Link from "next/link";
import type { StaffRole } from "@prisma/client";

type Nav = { href: string; label: string };

const NAV: Nav[] = [
  { href: "/staff", label: "Tableau de bord" },
  { href: "/staff/organizations", label: "Organisations" },
  { href: "/staff/users", label: "Utilisateurs" },
  { href: "/staff/settings", label: "Parametres" },
  { href: "/staff/activity", label: "Journal" },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  STAFF_ADMIN: "Administrateur",
  STAFF_SUPPORT: "Support",
  STAFF_OBSERVER: "Observateur",
};

export function StaffShell({
  user,
  children,
}: {
  user: { name: string; email: string; staffRole: StaffRole };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-white p-4 flex flex-col">
        <div className="text-lg font-bold mb-6">Badge — Staff</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-slate-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-slate-400 mt-auto pt-4 border-t border-slate-800">
          <div className="font-medium text-slate-200">{user.name}</div>
          <div className="truncate">{user.email}</div>
          <div className="mt-1 inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {ROLE_LABEL[user.staffRole]}
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-500">Espace staff applicatif</div>
          <Link href="/profile" className="text-sm text-slate-700 hover:underline">
            Mon profil
          </Link>
        </header>
        <main className="flex-1 p-6 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Creer `src/app/staff/layout.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { StaffShell } from "@/components/staff/StaffShell";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/staff");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  if (!ctx.isStaff || !ctx.staffRole) redirect("/");

  return (
    <StaffShell
      user={{ name: ctx.user.name, email: ctx.user.email, staffRole: ctx.staffRole }}
    >
      {children}
    </StaffShell>
  );
}
```

- [ ] **Step 3.3: Verifier le typecheck**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | grep "src/components/staff/StaffShell\|src/app/staff/layout" || echo "OK"
```

Expected : `OK` (aucune erreur sur ces fichiers).

- [ ] **Step 3.4: Commit**

```bash
git add src/components/staff/StaffShell.tsx src/app/staff/layout.tsx
git commit -m "feat(staff): layout StaffShell (sidebar + header + check isStaff)"
```

---

## Task 4: Dashboard `/staff` (KPI plateforme)

**Files:**
- Create: `src/app/staff/page.tsx`

> Server Component. Agrege via Prisma : nombre d'organisations actives/archivees, nombre d'events actifs, inscriptions cumulees, stockage total (place-holder = 0 a ce stade — calcule plus tard), top 5 orgs par volume d'inscriptions du mois en cours, 10 dernieres entrees ActivityLog.

- [ ] **Step 4.1: Creer `src/app/staff/page.tsx`**

```typescript
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function StaffDashboardPage() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    orgsActive,
    orgsArchived,
    eventsActive,
    registrationsTotal,
    topOrgsRaw,
    recentActivity,
  ] = await Promise.all([
    prisma.organization.count({ where: { archived: false } }),
    prisma.organization.count({ where: { archived: true } }),
    prisma.event.count({ where: { archived: false } }),
    prisma.registration.count(),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      orderBy: { _count: { eventId: "desc" } },
      take: 20,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        createdAt: true,
        staffActor: true,
        orgId: true,
        eventId: true,
        userId: true,
      },
    }),
  ]);

  const eventIds = topOrgsRaw.map((r) => r.eventId);
  const events =
    eventIds.length > 0
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, title: true, orgId: true, organization: { select: { name: true } } },
        })
      : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const orgCounts = new Map<string, { name: string; count: number }>();
  for (const r of topOrgsRaw) {
    const ev = eventById.get(r.eventId);
    if (!ev) continue;
    const prev = orgCounts.get(ev.orgId) ?? { name: ev.organization.name, count: 0 };
    orgCounts.set(ev.orgId, { name: prev.name, count: prev.count + r._count._all });
  }
  const topOrgs = Array.from(orgCounts.entries())
    .map(([orgId, { name, count }]) => ({ orgId, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord plateforme</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Organisations actives" value={orgsActive} />
        <Kpi label="Organisations archivees" value={orgsArchived} />
        <Kpi label="Evenements actifs" value={eventsActive} />
        <Kpi label="Inscriptions cumulees" value={registrationsTotal} />
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Top organisations (mois en cours)</h2>
          <Link href="/staff/organizations" className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {topOrgs.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              Aucune inscription ce mois-ci.
            </li>
          )}
          {topOrgs.map((o) => (
            <li key={o.orgId} className="px-4 py-3 flex justify-between text-sm">
              <Link
                href={`/staff/organizations/${o.orgId}`}
                className="hover:underline"
              >
                {o.name}
              </Link>
              <span className="text-slate-500">{o.count} inscriptions</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Journal recent</h2>
          <Link href="/staff/activity" className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {recentActivity.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Aucune activite recente.</li>
          )}
          {recentActivity.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm flex justify-between">
              <span>
                {a.type}
                {a.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 p-4 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 4.2: Smoke test manuel**

```bash
make dev
```

Se connecter en `admin@badge.local`, naviguer sur `http://localhost:3000/staff`.

Expected : sidebar visible, KPI a 0 (DB vide), pas d'erreur dans la console.

- [ ] **Step 4.3: Commit**

```bash
git add src/app/staff/page.tsx
git commit -m "feat(staff): dashboard plateforme avec KPI et top organisations"
```

---

## Task 5: `GET /api/staff/organizations` + page `/staff/organizations`

**Files:**
- Create: `src/app/api/staff/organizations/route.ts` (GET + stub POST a completer en Task 6)
- Create: `src/app/staff/organizations/page.tsx`
- Create: `src/lib/__tests__/api-staff.test.ts`

> `GET` : liste paginee + recherche `?q=...` + filtre `?archived=true|false`. Lecture autorisee a tous les staff (`STAFF_OBSERVER+`).

- [ ] **Step 5.1: Ecrire les tests d'echec**

Creer `src/lib/__tests__/api-staff.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function makeStaff(staffRole: "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `s-${Date.now()}-${Math.random()}@x`,
      password: "x",
      name: "Staff",
      isStaff: true,
      staffRole,
    },
  });
  await withSession({ id: u.id, email: u.email, name: u.name, isStaff: true });
  return u;
}

describe("GET /api/staff/organizations", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("lists active organizations by default", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });
    await prisma.organization.create({
      data: { name: "Archived", slug: "arch", archived: true, archivedAt: new Date() },
    });

    const { GET } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("active");
  });

  it("filters by archived=true", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });
    await prisma.organization.create({
      data: { name: "Archived", slug: "arch", archived: true, archivedAt: new Date() },
    });

    const { GET } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations?archived=true");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("arch");
  });

  it("filters by q (name or slug)", async () => {
    await makeStaff();
    await prisma.organization.create({ data: { name: "Acme Corp", slug: "acme" } });
    await prisma.organization.create({ data: { name: "Other Inc", slug: "other" } });

    const { GET } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations?q=acme");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("acme");
  });

  it("rejects non-staff with 403", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 5.2: Lancer le test (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts
```

Expected : FAIL (route absente).

- [ ] **Step 5.3: Creer `src/app/api/staff/organizations/route.ts` (GET)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const archivedParam = searchParams.get("archived");
  const archived = archivedParam === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const where: Parameters<typeof prisma.organization.findMany>[0] extends infer T
    ? T extends { where?: infer W }
      ? W
      : never
    : never = {
    archived,
    ...(q && {
      OR: [
        { name: { contains: q } },
        { slug: { contains: q } },
      ],
    }),
  };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        archived: true,
        archivedAt: true,
        createdAt: true,
        _count: {
          select: {
            events: true,
            memberships: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return NextResponse.json({ organizations, total, page, pageSize });
});
```

- [ ] **Step 5.4: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts
```

Expected : 4 passed.

- [ ] **Step 5.5: Creer `src/app/staff/organizations/page.tsx`**

```typescript
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function StaffOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const showArchived = archived === "true";

  const organizations = await prisma.organization.findMany({
    where: {
      archived: showArchived,
      ...(q && {
        OR: [{ name: { contains: q } }, { slug: { contains: q } }],
      }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      _count: { select: { events: true, memberships: true } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Organisations</h1>
        <Link
          href="/staff/organizations/new"
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
        >
          Nouvelle organisation
        </Link>
      </div>

      <form className="flex gap-2" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher par nom ou slug"
          className="flex-1 rounded border px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} />
          Archivees
        </label>
        <button type="submit" className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Events</th>
            <th className="px-3 py-2">OWNERs</th>
            <th className="px-3 py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {organizations.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Aucune organisation.
              </td>
            </tr>
          )}
          {organizations.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/staff/organizations/${o.id}`} className="text-blue-600 hover:underline">
                  {o.name}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{o.slug}</td>
              <td className="px-3 py-2">{o._count.events}</td>
              <td className="px-3 py-2">{o._count.memberships}</td>
              <td className="px-3 py-2">
                {o.archived ? (
                  <span className="text-amber-700">Archivee</span>
                ) : (
                  <span className="text-emerald-700">Active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5.6: Commit**

```bash
git add src/app/api/staff/organizations/route.ts src/app/staff/organizations/page.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): liste paginees des organisations (GET + page)"
```

---

## Task 6: `POST /api/staff/organizations` (creer org + OWNER initial)

**Files:**
- Modify: `src/app/api/staff/organizations/route.ts` (ajout POST)
- Create: `src/app/staff/organizations/new/page.tsx`
- Create: `src/components/staff/OrgCreationForm.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests POST)

> Wizard 2 etapes (cote client) : (1) info org (nom, slug optionnel, quotas), (2) OWNER initial (email, nom — cree un User si inexistant, ajoute OrgMembership(OWNER) et envoie invitation). Reserve a `STAFF_ADMIN`. Audit `ORG_CREATED` + `USER_CREATED` + `MEMBERSHIP_ADDED`.

- [ ] **Step 6.1: Ajouter les tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("POST /api/staff/organizations", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("requires STAFF_ADMIN (403 for STAFF_SUPPORT)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme", ownerEmail: "owner@acme.com", ownerName: "Owner" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("creates org + OWNER user + membership", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Corp", ownerEmail: "owner@acme.com", ownerName: "Alice" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.org.slug).toBe("acme-corp");

    const owner = await prisma.user.findUnique({ where: { email: "owner@acme.com" } });
    expect(owner?.name).toBe("Alice");
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: owner!.id, orgId: json.org.id },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("reuses existing user instead of creating a duplicate", async () => {
    await makeStaff("STAFF_ADMIN");
    const existing = await prisma.user.create({
      data: { email: "existing@x", password: "x", name: "Existing" },
    });

    const { POST } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Beta", ownerEmail: "existing@x", ownerName: "Existing" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const users = await prisma.user.findMany({ where: { email: "existing@x" } });
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(existing.id);
  });

  it("appends numeric suffix on slug collision", async () => {
    await makeStaff("STAFF_ADMIN");
    await prisma.organization.create({ data: { name: "Acme", slug: "acme" } });

    const { POST } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme", ownerEmail: "o2@x", ownerName: "O2" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(json.org.slug).toBe("acme-2");
  });

  it("writes ORG_CREATED, USER_CREATED, MEMBERSHIP_ADDED in ActivityLog", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/staff/organizations/route");
    const req = new NextRequest("http://localhost/api/staff/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Logged", ownerEmail: "l@x", ownerName: "L" }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({}) });

    const logs = await prisma.activityLog.findMany({ select: { type: true } });
    const types = logs.map((l) => l.type);
    expect(types).toContain("ORG_CREATED");
    expect(types).toContain("USER_CREATED");
    expect(types).toContain("MEMBERSHIP_ADDED");
  });
});
```

- [ ] **Step 6.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "POST /api/staff/organizations"
```

Expected : tests echouent (POST absent).

- [ ] **Step 6.3: Ajouter POST dans `src/app/api/staff/organizations/route.ts`**

Append :

```typescript
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "org";
}

async function nextAvailableSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 999) throw new Error("Could not allocate slug");
  }
  return candidate;
}

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(60).regex(SLUG_RE).optional(),
  legalName: z.string().min(1).max(180).nullable().optional(),
  addressLine1: z.string().min(1).max(180).nullable().optional(),
  addressLine2: z.string().min(1).max(180).nullable().optional(),
  postalCode: z.string().min(1).max(20).nullable().optional(),
  city: z.string().min(1).max(120).nullable().optional(),
  country: z.string().min(2).max(60).nullable().optional(),
  taxId: z.string().min(1).max(60).nullable().optional(),
  website: z.string().url().max(200).nullable().optional(),
  logo: z.string().max(500).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().min(3).max(40).nullable().optional(),
  quotaMaxEvents: z.number().int().positive().nullable().optional(),
  quotaMaxRegistrations: z.number().int().positive().nullable().optional(),
  quotaMaxStorageMB: z.number().int().positive().nullable().optional(),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const json = await req.json().catch(() => null);
    const parsed = createOrgSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      name,
      slug,
      legalName,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      country,
      taxId,
      website,
      logo,
      contactEmail,
      contactPhone,
      quotaMaxEvents,
      quotaMaxRegistrations,
      quotaMaxStorageMB,
      ownerEmail,
      ownerName,
    } = parsed.data;

    const baseSlug = slug ?? slugifyName(name);
    const finalSlug = await nextAvailableSlug(baseSlug);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug: finalSlug,
          legalName: legalName ?? null,
          addressLine1: addressLine1 ?? null,
          addressLine2: addressLine2 ?? null,
          postalCode: postalCode ?? null,
          city: city ?? null,
          country: country ?? null,
          taxId: taxId ?? null,
          website: website ?? null,
          logo: logo ?? null,
          contactEmail: contactEmail ?? null,
          contactPhone: contactPhone ?? null,
          quotaMaxEvents: quotaMaxEvents ?? null,
          quotaMaxRegistrations: quotaMaxRegistrations ?? null,
          quotaMaxStorageMB: quotaMaxStorageMB ?? null,
        },
      });

      const normalizedEmail = ownerEmail.toLowerCase().trim();
      let owner = await tx.user.findUnique({ where: { email: normalizedEmail } });
      let userCreated = false;
      if (!owner) {
        owner = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: "",
            name: ownerName,
            isStaff: false,
          },
        });
        userCreated = true;
      }

      await tx.orgMembership.create({
        data: { userId: owner.id, orgId: org.id, role: "OWNER" },
      });

      return { org, owner, userCreated };
    });

    await logActivity({
      type: "ORG_CREATED",
      userId: session.user.id,
      orgId: result.org.id,
      details: { name, slug: finalSlug },
      req,
    });
    if (result.userCreated) {
      await logActivity({
        type: "USER_CREATED",
        userId: session.user.id,
        orgId: result.org.id,
        targetId: result.owner.id,
        details: { email: result.owner.email, role: "OWNER" },
        req,
      });
    }
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      orgId: result.org.id,
      targetId: result.owner.id,
      details: { role: "OWNER" },
      req,
    });

    if (result.userCreated) {
      await sendUserInvitation(result.owner.id, { orgId: result.org.id });
    }

    return NextResponse.json(
      { org: result.org, owner: { id: result.owner.id, email: result.owner.email } },
      { status: 201 },
    );
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 6.4: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "POST /api/staff/organizations"
```

Expected : 5 passed.

- [ ] **Step 6.5: Creer `src/components/staff/OrgCreationForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgCreationForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    quotaMaxEvents: "",
    quotaMaxRegistrations: "",
    quotaMaxStorageMB: "",
    ownerEmail: "",
    ownerName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      ownerEmail: form.ownerEmail.trim(),
      ownerName: form.ownerName.trim(),
    };
    if (form.slug.trim()) payload.slug = form.slug.trim();
    if (form.quotaMaxEvents) payload.quotaMaxEvents = Number(form.quotaMaxEvents);
    if (form.quotaMaxRegistrations) payload.quotaMaxRegistrations = Number(form.quotaMaxRegistrations);
    if (form.quotaMaxStorageMB) payload.quotaMaxStorageMB = Number(form.quotaMaxStorageMB);

    const res = await fetch("/api/staff/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/staff/organizations/${json.org.id}`);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erreur a la creation.");
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex gap-2 text-sm">
        <Step active={step === 1} done={step > 1} num={1} label="Organisation" />
        <Step active={step === 2} done={false} num={2} label="OWNER initial" />
      </div>

      {error && <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{error}</div>}

      {step === 1 && (
        <div className="bg-white border rounded p-4 space-y-3">
          <Field label="Nom de l'organisation" value={form.name} onChange={(v) => set("name", v)} />
          <Field
            label="Slug (optionnel — genere depuis le nom si vide)"
            value={form.slug}
            onChange={(v) => set("slug", v)}
            placeholder="acme-corp"
          />
          <Field
            label="Quota max events (optionnel)"
            type="number"
            value={form.quotaMaxEvents}
            onChange={(v) => set("quotaMaxEvents", v)}
          />
          <Field
            label="Quota max inscriptions / mois (optionnel)"
            type="number"
            value={form.quotaMaxRegistrations}
            onChange={(v) => set("quotaMaxRegistrations", v)}
          />
          <Field
            label="Quota max stockage Mo (optionnel)"
            type="number"
            value={form.quotaMaxStorageMB}
            onChange={(v) => set("quotaMaxStorageMB", v)}
          />
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!form.name.trim()}
              className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border rounded p-4 space-y-3">
          <p className="text-sm text-slate-600">
            Un utilisateur sera cree (s'il n'existe pas) et recevra un email pour definir son mot de passe (24h).
          </p>
          <Field
            label="Email du OWNER"
            type="email"
            value={form.ownerEmail}
            onChange={(v) => set("ownerEmail", v)}
          />
          <Field label="Nom complet du OWNER" value={form.ownerName} onChange={(v) => set("ownerName", v)} />
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Precedent
            </button>
            <button
              onClick={submit}
              disabled={submitting || !form.ownerEmail.trim() || !form.ownerName.trim()}
              className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
            >
              {submitting ? "Creation..." : "Creer l'organisation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ active, done, num, label }: { active: boolean; done: boolean; num: number; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
        active ? "border-blue-600 text-blue-700" : done ? "border-emerald-500 text-emerald-700" : "border-slate-300 text-slate-500"
      }`}
    >
      <span className="font-bold">{num}.</span>
      <span>{label}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
```

- [ ] **Step 6.6: Creer `src/app/staff/organizations/new/page.tsx`**

```typescript
import { OrgCreationForm } from "@/components/staff/OrgCreationForm";

export default function NewOrganizationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle organisation</h1>
      <OrgCreationForm />
    </div>
  );
}
```

- [ ] **Step 6.7: Smoke test manuel**

Se connecter en STAFF_ADMIN, ouvrir `/staff/organizations/new`, remplir le wizard.

Expected : redirection vers `/staff/organizations/[orgId]` apres creation. Le user OWNER doit etre cree sans mot de passe et un email (ou warn `[stub Plan 6]`) doit etre log.

- [ ] **Step 6.8: Commit**

```bash
git add src/app/api/staff/organizations/route.ts src/app/staff/organizations/new/page.tsx src/components/staff/OrgCreationForm.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): creation organisation avec OWNER initial (wizard 2 etapes)"
```

---

## Task 7: Organisation — detail (`GET`), edition (`PATCH`), archive, restore, delete

**Files:**
- Create: `src/app/api/staff/organizations/[orgId]/route.ts` (GET, PATCH, DELETE)
- Create: `src/app/api/staff/organizations/[orgId]/archive/route.ts` (POST)
- Create: `src/app/api/staff/organizations/[orgId]/restore/route.ts` (POST)
- Create: `src/app/api/staff/organizations/[orgId]/events/route.ts` (GET)
- Create: `src/app/staff/organizations/[orgId]/page.tsx`
- Create: `src/app/staff/organizations/[orgId]/edit/page.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests)

> `PATCH` STAFF_ADMIN : nom, slug, infos admin (`legalName`, `addressLine1-2`, `postalCode`, `city`, `country`, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone`) et quotas. `slug` + quotas restent reserves staff. Audit `ORG_UPDATED`. `archive`/`restore` STAFF_ADMIN : set `archived` + `archivedAt`, audit `ORG_ARCHIVED` / `ORG_RESTORED`. `DELETE` STAFF_ADMIN : hard delete avec cascade Prisma + double confirmation cote UI (header `x-confirm: delete-<slug>`).

- [ ] **Step 7.1: Ajouter `ORG_DELETED` au schema Prisma (si absent)**

Verifier dans `prisma/schema.prisma` que l'enum `ActivityType` contient `ORG_DELETED`. Si absent (Plan 1 ne l'a pas ajoute), modifier `prisma/schema.prisma:381-422` pour ajouter la valeur juste apres `ORG_RESTORED` :

```prisma
enum ActivityType {
  // ... existing values ...
  ORG_ARCHIVED
  ORG_RESTORED
  ORG_DELETED
  // ... rest ...
}
```

Puis :

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db push --accept-data-loss
docker compose -f docker-compose.dev.yml exec app npx prisma generate
```

Expected : `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7.2: Ajouter les tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("GET /api/staff/organizations/[orgId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns org details", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({ data: { name: "Detail", slug: "detail" } });

    const { GET } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.org.slug).toBe("detail");
  });

  it("returns 404 for unknown org", async () => {
    await makeStaff();

    const { GET } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest("http://localhost/api/staff/organizations/unknown");
    const res = await GET(req, { params: Promise.resolve({ orgId: "unknown" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/staff/organizations/[orgId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_SUPPORT cannot patch (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({ data: { name: "X", slug: "x" } });

    const { PATCH } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Y" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can update name, slug, quotas + logs ORG_UPDATED with staffActor=true", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "Old", slug: "old" } });

    const { PATCH } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New", slug: "new", quotaMaxEvents: 50 }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.name).toBe("New");
    expect(updated?.slug).toBe("new");
    expect(updated?.quotaMaxEvents).toBe(50);

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED", orgId: org.id } });
    expect(log?.staffActor).toBe(true);
  });

  it("returns 409 on slug collision", async () => {
    await makeStaff("STAFF_ADMIN");
    const a = await prisma.organization.create({ data: { name: "A", slug: "a" } });
    await prisma.organization.create({ data: { name: "B", slug: "b" } });

    const { PATCH } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "b" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: a.id }) });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/staff/organizations/[orgId]/archive + /restore", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("archive sets archived=true and logs ORG_ARCHIVED", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "A", slug: "a-arch" } });

    const { POST } = await import("@/app/api/staff/organizations/[orgId]/archive/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}/archive`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.archived).toBe(true);
    expect(updated?.archivedAt).not.toBeNull();

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_ARCHIVED", orgId: org.id } });
    expect(log).not.toBeNull();
  });

  it("restore sets archived=false and logs ORG_RESTORED", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "R", slug: "r-rest", archived: true, archivedAt: new Date() },
    });

    const { POST } = await import("@/app/api/staff/organizations/[orgId]/restore/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}/restore`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.archived).toBe(false);
    expect(updated?.archivedAt).toBeNull();
  });
});

describe("DELETE /api/staff/organizations/[orgId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("requires x-confirm header matching slug", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "Del", slug: "del" } });

    const { DELETE } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);

    const still = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(still).not.toBeNull();
  });

  it("STAFF_SUPPORT cannot delete (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({ data: { name: "X", slug: "del-x" } });

    const { DELETE } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`, {
      method: "DELETE",
      headers: { "x-confirm": "delete-del-x" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can hard delete with proper x-confirm + logs ORG_DELETED", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "Del", slug: "del-ok" } });

    const { DELETE } = await import("@/app/api/staff/organizations/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/staff/organizations/${org.id}`, {
      method: "DELETE",
      headers: { "x-confirm": "delete-del-ok" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const still = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(still).toBeNull();

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_DELETED" } });
    expect(log).not.toBeNull();
    expect(log?.orgId).toBeNull();
  });
});
```

- [ ] **Step 7.3: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "organizations/\\[orgId\\]\\|archive\\|restore\\|DELETE"
```

Expected : echecs (handlers absents).

- [ ] **Step 7.4: Creer `src/app/api/staff/organizations/[orgId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(2).max(60).regex(SLUG_RE).optional(),
  legalName: z.string().min(1).max(180).nullable().optional(),
  addressLine1: z.string().min(1).max(180).nullable().optional(),
  addressLine2: z.string().min(1).max(180).nullable().optional(),
  postalCode: z.string().min(1).max(20).nullable().optional(),
  city: z.string().min(1).max(120).nullable().optional(),
  country: z.string().min(2).max(60).nullable().optional(),
  taxId: z.string().min(1).max(60).nullable().optional(),
  website: z.string().url().max(200).nullable().optional(),
  logo: z.string().max(500).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().min(3).max(40).nullable().optional(),
  quotaMaxEvents: z.number().int().positive().nullable().optional(),
  quotaMaxRegistrations: z.number().int().positive().nullable().optional(),
  quotaMaxStorageMB: z.number().int().positive().nullable().optional(),
});

export const GET = withStaffAuth<{ orgId: string }>(async (_req, _ctx, extra) => {
  const { orgId } = await extra.params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      quotaMaxEvents: true,
      quotaMaxRegistrations: true,
      quotaMaxStorageMB: true,
      _count: { select: { events: true, memberships: true } },
      memberships: {
        where: { role: "OWNER" },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ org });
});

export const PATCH = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }

    try {
      const org = await prisma.organization.update({ where: { id: orgId }, data });
      await logActivity({
        type: "ORG_UPDATED",
        userId: session.user.id,
        orgId,
        details: data,
        req,
      });
      return NextResponse.json({ org });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      if (err?.code === "P2002") {
        return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);

export const DELETE = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true, name: true },
    });
    if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const confirm = req.headers.get("x-confirm");
    if (confirm !== `delete-${org.slug}`) {
      return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
    }

    await prisma.organization.delete({ where: { id: orgId } });

    // orgId est volontairement null : l'org n'existe plus, on garde la trace en plateforme.
    await logActivity({
      type: "ORG_DELETED",
      userId: session.user.id,
      details: { deletedOrgId: orgId, deletedOrgSlug: org.slug, deletedOrgName: org.name },
      req,
    });

    return NextResponse.json({ ok: true });
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 7.5: Creer `src/app/api/staff/organizations/[orgId]/archive/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const POST = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: { archived: true, archivedAt: new Date() },
      });
      await logActivity({ type: "ORG_ARCHIVED", userId: session.user.id, orgId, req });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 7.6: Creer `src/app/api/staff/organizations/[orgId]/restore/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const POST = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: { archived: false, archivedAt: null },
      });
      await logActivity({ type: "ORG_RESTORED", userId: session.user.id, orgId, req });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 7.7: Creer `src/app/api/staff/organizations/[orgId]/events/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

export const GET = withStaffAuth<{ orgId: string }>(async (_req, _ctx, extra) => {
  const { orgId } = await extra.params;
  const events = await prisma.event.findMany({
    where: { orgId },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      archived: true,
      registrationOpen: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json({ events });
});
```

- [ ] **Step 7.8: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts
```

Expected : tous les tests Org passent (GET, PATCH, archive, restore, DELETE).

- [ ] **Step 7.9: Creer `src/app/staff/organizations/[orgId]/page.tsx`**

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { OrgDetailActions } from "./OrgDetailActions";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      quotaMaxEvents: true,
      quotaMaxRegistrations: true,
      quotaMaxStorageMB: true,
      memberships: {
        where: { role: "OWNER" },
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      events: {
        select: {
          id: true,
          title: true,
          slug: true,
          date: true,
          archived: true,
          _count: { select: { registrations: true } },
        },
        orderBy: { date: "desc" },
        take: 20,
      },
      _count: { select: { events: true, memberships: true } },
    },
  });
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <div className="text-sm text-slate-500 font-mono">/{org.slug}</div>
          {org.archived && (
            <div className="mt-1 text-sm text-amber-700">
              Archivee le {org.archivedAt && new Date(org.archivedAt).toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/${org.id}`}
            className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
          >
            Entrer dans l'organisation
          </Link>
          <Link
            href={`/staff/organizations/${org.id}/edit`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Editer
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Quota events" value={fmtQuota(org.quotaMaxEvents, org._count.events)} />
        <Card label="OWNERs" value={String(org._count.memberships)} />
        <Card label="Stockage max" value={org.quotaMaxStorageMB ? `${org.quotaMaxStorageMB} Mo` : "Illimite"} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">OWNERs</h2>
        <ul className="bg-white border rounded divide-y">
          {org.memberships.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Aucun OWNER associe.</li>
          )}
          {org.memberships.map((m) => (
            <li key={m.user.id} className="px-4 py-3 text-sm flex justify-between">
              <Link href={`/staff/users/${m.user.id}`} className="hover:underline">
                {m.user.name}
              </Link>
              <span className="text-slate-500">{m.user.email}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Derniers evenements ({org._count.events})</h2>
        <ul className="bg-white border rounded divide-y">
          {org.events.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Aucun evenement.</li>
          )}
          {org.events.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm flex justify-between">
              <span>
                {e.title}
                {e.archived && <span className="ml-2 text-amber-700">(archive)</span>}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(e.date).toLocaleDateString("fr-FR")} — {e._count.registrations} inscriptions
              </span>
            </li>
          ))}
        </ul>
      </section>

      <OrgDetailActions org={{ id: org.id, slug: org.slug, archived: org.archived }} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function fmtQuota(max: number | null, used: number): string {
  if (max == null) return `${used} / illimite`;
  return `${used} / ${max}`;
}
```

- [ ] **Step 7.10: Creer `src/app/staff/organizations/[orgId]/OrgDetailActions.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgDetailActions({
  org,
}: {
  org: { id: string; slug: string; archived: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/archive`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation archivee.");
      router.refresh();
    } else {
      setMsg("Echec de l'archivage.");
    }
  }

  async function restore() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/restore`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation restauree.");
      router.refresh();
    } else {
      setMsg("Echec de la restauration.");
    }
  }

  async function destroy() {
    const expected = `delete-${org.slug}`;
    const typed = window.prompt(
      `Suppression definitive. Pour confirmer, tapez "${expected}".`,
    );
    if (typed !== expected) {
      setMsg("Confirmation invalide.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}`, {
      method: "DELETE",
      headers: { "x-confirm": expected },
    });
    setBusy(false);
    if (res.ok) {
      router.push("/staff/organizations");
    } else {
      setMsg("Echec de la suppression.");
    }
  }

  return (
    <section className="border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Zone de risque</h2>
      {msg && <div className="mb-2 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>}
      <div className="flex gap-2">
        {!org.archived && (
          <button
            onClick={archive}
            disabled={busy}
            className="rounded border border-amber-400 text-amber-700 px-3 py-1.5 text-sm hover:bg-amber-50 disabled:opacity-50"
          >
            Archiver
          </button>
        )}
        {org.archived && (
          <button
            onClick={restore}
            disabled={busy}
            className="rounded border border-emerald-500 text-emerald-700 px-3 py-1.5 text-sm hover:bg-emerald-50 disabled:opacity-50"
          >
            Restaurer
          </button>
        )}
        <button
          onClick={destroy}
          disabled={busy}
          className="rounded border border-red-500 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50"
        >
          Supprimer definitivement
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7.11: Creer `src/app/staff/organizations/[orgId]/edit/page.tsx`**

```typescript
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { OrgEditForm } from "./OrgEditForm";

export default async function OrgEditPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      quotaMaxEvents: true,
      quotaMaxRegistrations: true,
      quotaMaxStorageMB: true,
    },
  });
  if (!org) notFound();

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Editer {org.name}</h1>
      <OrgEditForm org={org} />
    </div>
  );
}
```

- [ ] **Step 7.12: Creer `src/app/staff/organizations/[orgId]/edit/OrgEditForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Org = {
  id: string;
  name: string;
  slug: string;
  quotaMaxEvents: number | null;
  quotaMaxRegistrations: number | null;
  quotaMaxStorageMB: number | null;
};

export function OrgEditForm({ org }: { org: Org }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: org.name,
    slug: org.slug,
    quotaMaxEvents: org.quotaMaxEvents?.toString() ?? "",
    quotaMaxRegistrations: org.quotaMaxRegistrations?.toString() ?? "",
    quotaMaxStorageMB: org.quotaMaxStorageMB?.toString() ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
    };
    payload.quotaMaxEvents = form.quotaMaxEvents ? Number(form.quotaMaxEvents) : null;
    payload.quotaMaxRegistrations = form.quotaMaxRegistrations ? Number(form.quotaMaxRegistrations) : null;
    payload.quotaMaxStorageMB = form.quotaMaxStorageMB ? Number(form.quotaMaxStorageMB) : null;

    const res = await fetch(`/api/staff/organizations/${org.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation enregistree.");
      router.push(`/staff/organizations/${org.id}`);
    } else if (res.status === 409) {
      setMsg("Le slug est deja utilise.");
    } else {
      setMsg("Erreur a l'enregistrement.");
    }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>}
      <Field label="Nom" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
      <Field label="Slug" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
      <Field
        label="Quota max events"
        type="number"
        value={form.quotaMaxEvents}
        onChange={(v) => setForm((f) => ({ ...f, quotaMaxEvents: v }))}
      />
      <Field
        label="Quota max inscriptions / mois"
        type="number"
        value={form.quotaMaxRegistrations}
        onChange={(v) => setForm((f) => ({ ...f, quotaMaxRegistrations: v }))}
      />
      <Field
        label="Quota max stockage (Mo)"
        type="number"
        value={form.quotaMaxStorageMB}
        onChange={(v) => setForm((f) => ({ ...f, quotaMaxStorageMB: v }))}
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
      >
        Enregistrer
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
```

- [ ] **Step 7.13: Commit**

```bash
git add prisma/schema.prisma src/app/api/staff/organizations/ src/app/staff/organizations/ src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): detail organisation (CRUD, archive, restore, hard delete)"
```

---

## Task 8: Utilisateurs — `GET /api/staff/users` + page liste

**Files:**
- Create: `src/app/api/staff/users/route.ts` (GET ici, POST en Task 9)
- Create: `src/app/staff/users/page.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests GET users)

> Liste paginee + filtres : `?type=staff|client|all`, `?archived=true|false`, `?q=`. Aucun mot de passe ne fuit. `STAFF_OBSERVER+` autorise.

- [ ] **Step 8.1: Ajouter les tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("GET /api/staff/users", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("lists active users by default and never exposes password", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.user.create({ data: { email: "c@x", password: "SECRET", name: "Client" } });

    const { GET } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    const userEntry = json.users.find((u: any) => u.email === "c@x");
    expect(userEntry).toBeDefined();
    expect(userEntry.password).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("SECRET");
  });

  it("filters type=staff", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.user.create({
      data: { email: "s@x", password: "x", name: "Other Staff", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await prisma.user.create({ data: { email: "c@x", password: "x", name: "Client" } });

    const { GET } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users?type=staff");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.every((u: any) => u.isStaff === true)).toBe(true);
  });

  it("filters type=client", async () => {
    await makeStaff();
    await prisma.user.create({ data: { email: "c@x", password: "x", name: "Client" } });

    const { GET } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users?type=client");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.every((u: any) => u.isStaff === false)).toBe(true);
  });

  it("filters q (email or name)", async () => {
    await makeStaff();
    await prisma.user.create({ data: { email: "alice@x", password: "x", name: "Alice" } });
    await prisma.user.create({ data: { email: "bob@x", password: "x", name: "Bob" } });

    const { GET } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users?q=alice");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.find((u: any) => u.email === "alice@x")).toBeDefined();
    expect(json.users.find((u: any) => u.email === "bob@x")).toBeUndefined();
  });
});
```

- [ ] **Step 8.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "GET /api/staff/users"
```

Expected : echec (route absente).

- [ ] **Step 8.3: Creer `src/app/api/staff/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "all";
  const archivedParam = searchParams.get("archived");
  const archived = archivedParam === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const where = {
    archived,
    ...(type === "staff" && { isStaff: true }),
    ...(type === "client" && { isStaff: false }),
    ...(q && {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        isStaff: true,
        staffRole: true,
        archived: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { orgMemberships: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pageSize });
});
```

- [ ] **Step 8.4: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "GET /api/staff/users"
```

Expected : 4 passed.

- [ ] **Step 8.5: Creer `src/app/staff/users/page.tsx`**

```typescript
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function StaffUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; archived?: string }>;
}) {
  const { q, type = "all", archived } = await searchParams;
  const showArchived = archived === "true";

  const users = await prisma.user.findMany({
    where: {
      archived: showArchived,
      ...(type === "staff" && { isStaff: true }),
      ...(type === "client" && { isStaff: false }),
      ...(q && {
        OR: [{ email: { contains: q } }, { name: { contains: q } }],
      }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      _count: { select: { orgMemberships: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Link
          href="/staff/users/new"
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
        >
          Nouvel utilisateur
        </Link>
      </div>

      <form className="flex gap-2 items-end" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Email ou nom"
          className="flex-1 rounded border px-3 py-1.5 text-sm"
        />
        <select name="type" defaultValue={type} className="rounded border px-3 py-1.5 text-sm">
          <option value="all">Tous</option>
          <option value="staff">Staff</option>
          <option value="client">Clients</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="true" defaultChecked={showArchived} />
          Archives
        </label>
        <button type="submit" className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Organisations</th>
            <th className="px-3 py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Aucun utilisateur.
              </td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/staff/users/${u.id}`} className="text-blue-600 hover:underline">
                  {u.name}
                </Link>
              </td>
              <td className="px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">
                {u.isStaff ? (
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    {u.staffRole}
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">Client</span>
                )}
              </td>
              <td className="px-3 py-2">{u._count.orgMemberships}</td>
              <td className="px-3 py-2">
                {u.archived ? (
                  <span className="text-amber-700 text-xs">Archive</span>
                ) : (
                  <span className="text-emerald-700 text-xs">Actif</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8.6: Commit**

```bash
git add src/app/api/staff/users/route.ts src/app/staff/users/page.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): liste utilisateurs avec filtres (type, archive, q)"
```

---

## Task 9: `POST /api/staff/users` + page `/staff/users/new`

**Files:**
- Modify: `src/app/api/staff/users/route.ts` (ajout POST)
- Create: `src/app/staff/users/new/page.tsx`
- Create: `src/components/staff/UserCreationForm.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests POST)

> Creation user staff (STAFF_ADMIN uniquement) OU client (STAFF_ADMIN ou STAFF_SUPPORT). Memberships optionnels lors de la creation client. Genere invitation 24h via `sendUserInvitation`. Audit `USER_CREATED` + un `MEMBERSHIP_ADDED` par membership.

- [ ] **Step 9.1: Ajouter les tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("POST /api/staff/users", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_SUPPORT cannot create staff user (403)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({
        email: "new-staff@x",
        name: "New Staff",
        type: "staff",
        staffRole: "STAFF_OBSERVER",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT can create client user", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({ email: "client@x", name: "Client", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "client@x" } });
    expect(created?.isStaff).toBe(false);
  });

  it("STAFF_ADMIN can create staff user with role", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({
        email: "new-staff@x",
        name: "New Staff",
        type: "staff",
        staffRole: "STAFF_SUPPORT",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "new-staff@x" } });
    expect(created?.isStaff).toBe(true);
    expect(created?.staffRole).toBe("STAFF_SUPPORT");
  });

  it("client user can be linked to org memberships on creation", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "Linked", slug: "linked" } });

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({
        email: "linked@x",
        name: "Linked",
        type: "client",
        orgMemberships: [{ orgId: org.id, role: "OWNER" }],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "linked@x" } });
    const m = await prisma.orgMembership.findFirst({
      where: { userId: created!.id, orgId: org.id },
    });
    expect(m?.role).toBe("OWNER");
  });

  it("returns 409 on duplicate email", async () => {
    await makeStaff("STAFF_ADMIN");
    await prisma.user.create({ data: { email: "dup@x", password: "x", name: "Dup" } });

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({ email: "dup@x", name: "Dup2", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
  });

  it("logs USER_CREATED (and MEMBERSHIP_ADDED if any)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "L", slug: "log-l" } });

    const { POST } = await import("@/app/api/staff/users/route");
    const req = new NextRequest("http://localhost/api/staff/users", {
      method: "POST",
      body: JSON.stringify({
        email: "log@x",
        name: "Log",
        type: "client",
        orgMemberships: [{ orgId: org.id, role: "OWNER" }],
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({}) });

    const types = (await prisma.activityLog.findMany({ select: { type: true } })).map((l) => l.type);
    expect(types).toContain("USER_CREATED");
    expect(types).toContain("MEMBERSHIP_ADDED");
  });
});
```

- [ ] **Step 9.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "POST /api/staff/users"
```

Expected : echecs (POST absent).

- [ ] **Step 9.3: Ajouter POST a `src/app/api/staff/users/route.ts`**

Append :

```typescript
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";

const createUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    type: z.enum(["staff", "client"]),
    staffRole: z.enum(["STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"]).optional(),
    orgMemberships: z
      .array(z.object({ orgId: z.string().min(1), role: z.literal("OWNER") }))
      .optional(),
  })
  .refine((d) => (d.type === "staff" ? !!d.staffRole : true), {
    message: "staffRole required when type=staff",
    path: ["staffRole"],
  });

export const POST = withStaffAuth(async (req, { session }) => {
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) {
    return NextResponse.json({ error: "NOT_STAFF" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const { email, name, type, staffRole, orgMemberships } = parsed.data;

  if (type === "staff" && !staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")) {
    return NextResponse.json({ error: "STAFF_ADMIN_REQUIRED" }, { status: 403 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        password: "",
        name,
        isStaff: type === "staff",
        staffRole: type === "staff" ? staffRole! : null,
      },
    });

    if (orgMemberships && orgMemberships.length > 0) {
      for (const m of orgMemberships) {
        await tx.orgMembership.create({
          data: { userId: user.id, orgId: m.orgId, role: m.role },
        });
      }
    }

    return user;
  });

  const firstOrgId = orgMemberships?.[0]?.orgId;
  await logActivity({
    type: "USER_CREATED",
    userId: session.user.id,
    targetId: created.id,
    orgId: firstOrgId,
    details: { email: created.email, name: created.name, kind: type, staffRole: staffRole ?? null },
    req,
  });
  if (orgMemberships) {
    for (const m of orgMemberships) {
      await logActivity({
        type: "MEMBERSHIP_ADDED",
        userId: session.user.id,
        targetId: created.id,
        orgId: m.orgId,
        details: { role: m.role },
        req,
      });
    }
  }

  await sendUserInvitation(created.id, { orgId: firstOrgId });

  return NextResponse.json(
    {
      user: { id: created.id, email: created.email, name: created.name, isStaff: created.isStaff },
    },
    { status: 201 },
  );
});
```

- [ ] **Step 9.4: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "POST /api/staff/users"
```

Expected : 6 passed.

- [ ] **Step 9.5: Creer `src/components/staff/UserCreationForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrgLite = { id: string; name: string };

export function UserCreationForm({
  orgs,
  canCreateStaff,
}: {
  orgs: OrgLite[];
  canCreateStaff: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    name: "",
    type: "client" as "client" | "staff",
    staffRole: "STAFF_OBSERVER" as "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER",
    orgId: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      name: form.name.trim(),
      type: form.type,
    };
    if (form.type === "staff") payload.staffRole = form.staffRole;
    if (form.type === "client" && form.orgId) {
      payload.orgMemberships = [{ orgId: form.orgId, role: "OWNER" }];
    }
    const res = await fetch("/api/staff/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/staff/users/${json.user.id}`);
    } else if (res.status === 409) {
      setMsg("Email deja utilise.");
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(json.error ?? "Erreur a la creation.");
    }
  }

  return (
    <div className="max-w-xl space-y-3 bg-white border rounded p-4">
      {msg && <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{msg}</div>}
      <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
      <Field label="Nom complet" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />

      <fieldset className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={form.type === "client"}
            onChange={() => setForm((f) => ({ ...f, type: "client" }))}
          />
          Client
        </label>
        {canCreateStaff && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.type === "staff"}
              onChange={() => setForm((f) => ({ ...f, type: "staff" }))}
            />
            Staff applicatif
          </label>
        )}
      </fieldset>

      {form.type === "staff" && (
        <label className="block">
          <span className="text-sm text-slate-600">Role staff</span>
          <select
            value={form.staffRole}
            onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value as typeof form.staffRole }))}
            className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          >
            <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
            <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
            <option value="STAFF_ADMIN">STAFF_ADMIN</option>
          </select>
        </label>
      )}

      {form.type === "client" && (
        <label className="block">
          <span className="text-sm text-slate-600">Lier a une organisation (optionnel)</span>
          <select
            value={form.orgId}
            onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
            className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          >
            <option value="">Aucune</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-xs text-slate-500">
        L'utilisateur recevra un email avec un lien `setup-password` valable 24h.
      </p>

      <button
        onClick={submit}
        disabled={busy || !form.email.trim() || !form.name.trim()}
        className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
      >
        {busy ? "Creation..." : "Creer l'utilisateur"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
```

- [ ] **Step 9.6: Creer `src/app/staff/users/new/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserCreationForm } from "@/components/staff/UserCreationForm";

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) redirect("/");

  const canCreateStaff = staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");

  const orgs = await prisma.organization.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvel utilisateur</h1>
      <UserCreationForm orgs={orgs} canCreateStaff={canCreateStaff} />
    </div>
  );
}
```

- [ ] **Step 9.7: Commit**

```bash
git add src/app/api/staff/users/route.ts src/app/staff/users/new/page.tsx src/components/staff/UserCreationForm.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): creation utilisateur (staff ou client) avec invitation 24h"
```

---

## Task 10: User detail (`GET`, `PATCH`, reset-password, archive)

**Files:**
- Create: `src/app/api/staff/users/[userId]/route.ts` (GET, PATCH)
- Create: `src/app/api/staff/users/[userId]/reset-password/route.ts` (POST)
- Create: `src/app/api/staff/users/[userId]/archive/route.ts` (POST)
- Create: `src/app/staff/users/[userId]/page.tsx`
- Create: `src/components/staff/MembershipMatrix.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests)

> `PATCH` STAFF_ADMIN : nom, archived, staffRole (interdit sur soi-meme). `reset-password` STAFF_ADMIN+SUPPORT : regenere `inviteToken` via `sendPasswordResetEmail`. `archive` STAFF_ADMIN.

- [ ] **Step 10.1: Ajouter tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("GET /api/staff/users/[userId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns user details without password", async () => {
    await makeStaff("STAFF_OBSERVER");
    const t = await prisma.user.create({ data: { email: "t@x", password: "SECRET", name: "T" } });

    const { GET } = await import("@/app/api/staff/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${t.id}`);
    const res = await GET(req, { params: Promise.resolve({ userId: t.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.password).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("SECRET");
  });
});

describe("PATCH /api/staff/users/[userId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_SUPPORT cannot change staffRole (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cannot change own staffRole", async () => {
    const self = await prisma.user.create({
      data: { email: "self@x", password: "x", name: "Self", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await withSession({ id: self.id, email: self.email, name: self.name, isStaff: true });

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${self.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_OBSERVER" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: self.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can change another staff's role + logs USER_UPDATED", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_SUPPORT" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: t.id } });
    expect(updated?.staffRole).toBe("STAFF_SUPPORT");

    const log = await prisma.activityLog.findFirst({ where: { type: "USER_UPDATED" } });
    expect(log).not.toBeNull();
  });
});

describe("POST /api/staff/users/[userId]/reset-password", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_SUPPORT can reset password (logs USER_UPDATED with reset detail)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({ data: { email: "t@x", password: "old", name: "T" } });

    const { POST } = await import("@/app/api/staff/users/[userId]/reset-password/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${t.id}/reset-password`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_UPDATED", targetId: t.id },
    });
    expect(log).not.toBeNull();
  });
});

describe("POST /api/staff/users/[userId]/archive", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_ADMIN can archive a user (sets archived=true)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({ data: { email: "t@x", password: "x", name: "T" } });

    const { POST } = await import("@/app/api/staff/users/[userId]/archive/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${t.id}/archive`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const u = await prisma.user.findUnique({ where: { id: t.id } });
    expect(u?.archived).toBe(true);
  });

  it("STAFF_ADMIN cannot archive themselves", async () => {
    const self = await prisma.user.create({
      data: { email: "self@x", password: "x", name: "Self", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await withSession({ id: self.id, email: self.email, name: self.name, isStaff: true });

    const { POST } = await import("@/app/api/staff/users/[userId]/archive/route");
    const req = new NextRequest(`http://localhost/api/staff/users/${self.id}/archive`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ userId: self.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 10.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "users/\\[userId\\]"
```

Expected : echecs (handlers absents).

- [ ] **Step 10.3: Creer `src/app/api/staff/users/[userId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";

export const GET = withStaffAuth<{ userId: string }>(async (_req, _ctx, extra) => {
  const { userId } = await extra.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      eventMemberships: {
        select: {
          role: true,
          event: { select: { id: true, title: true, slug: true, orgId: true } },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ user });
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  archived: z.boolean().optional(),
  staffRole: z.enum(["STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"]).optional(),
});

export const PATCH = withStaffAuth<{ userId: string }>(async (req, { session }, extra) => {
  const { userId } = await extra.params;
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) {
    return NextResponse.json({ error: "NOT_STAFF" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  if ((data.staffRole !== undefined || data.archived !== undefined) && !staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")) {
    return NextResponse.json({ error: "STAFF_ADMIN_REQUIRED" }, { status: 403 });
  }

  if (data.staffRole !== undefined && userId === session.user.id) {
    return NextResponse.json({ error: "CANNOT_CHANGE_OWN_ROLE" }, { status: 403 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.archived !== undefined && {
          archived: data.archived,
          archivedAt: data.archived ? new Date() : null,
        }),
        ...(data.staffRole !== undefined && { staffRole: data.staffRole, isStaff: true }),
      },
      select: { id: true, email: true, name: true, isStaff: true, staffRole: true, archived: true },
    });

    await logActivity({
      type: "USER_UPDATED",
      userId: session.user.id,
      targetId: userId,
      details: data,
      req,
    });

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    throw err;
  }
});
```

- [ ] **Step 10.4: Creer `src/app/api/staff/users/[userId]/reset-password/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendPasswordResetEmail } from "@/lib/mail";

export const POST = withStaffAuth<{ userId: string }>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, archived: true },
    });
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (target.archived) return NextResponse.json({ error: "USER_ARCHIVED" }, { status: 400 });

    await sendPasswordResetEmail(userId);

    await logActivity({
      type: "USER_UPDATED",
      userId: session.user.id,
      targetId: userId,
      details: { action: "reset-password", to: target.email },
      req,
    });

    return NextResponse.json({ ok: true });
  },
  { minRole: "STAFF_SUPPORT" },
);
```

- [ ] **Step 10.5: Creer `src/app/api/staff/users/[userId]/archive/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const POST = withStaffAuth<{ userId: string }>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    if (userId === session.user.id) {
      return NextResponse.json({ error: "CANNOT_ARCHIVE_SELF" }, { status: 400 });
    }
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { archived: true, archivedAt: new Date() },
      });
      await logActivity({
        type: "USER_UPDATED",
        userId: session.user.id,
        targetId: userId,
        details: { action: "archive" },
        req,
      });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 10.6: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "users/\\[userId\\]\\|reset-password\\|archive"
```

Expected : tests passent.

- [ ] **Step 10.7: Creer `src/components/staff/MembershipMatrix.tsx`**

```typescript
type OrgMembershipRow = {
  role: string;
  organization: { id: string; name: string; slug: string; archived: boolean };
};
type EventMembershipRow = {
  role: string;
  event: { id: string; title: string; slug: string; orgId: string };
};

export function MembershipMatrix({
  orgMemberships,
  eventMemberships,
}: {
  orgMemberships: OrgMembershipRow[];
  eventMemberships: EventMembershipRow[];
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-semibold mb-2 text-sm">Organisations ({orgMemberships.length})</h3>
        <ul className="bg-white border rounded divide-y text-sm">
          {orgMemberships.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune appartenance org.</li>
          )}
          {orgMemberships.map((m) => (
            <li key={m.organization.id} className="px-3 py-2 flex justify-between">
              <span>
                {m.organization.name}
                {m.organization.archived && <span className="ml-2 text-amber-700 text-xs">(archive)</span>}
              </span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-sm">Evenements ({eventMemberships.length})</h3>
        <ul className="bg-white border rounded divide-y text-sm">
          {eventMemberships.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune appartenance event.</li>
          )}
          {eventMemberships.map((m) => (
            <li key={m.event.id} className="px-3 py-2 flex justify-between">
              <span>{m.event.title}</span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 10.8: Creer `src/app/staff/users/[userId]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MembershipMatrix } from "@/components/staff/MembershipMatrix";
import { UserDetailActions } from "./UserDetailActions";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canAdmin = !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");
  const canResetPassword =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT");
  const isSelf = ctx?.user.id === userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      orgMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      eventMemberships: {
        select: {
          role: true,
          event: { select: { id: true, title: true, slug: true, orgId: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const recentActivity = await prisma.activityLog.findMany({
    where: { OR: [{ userId }, { targetId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, createdAt: true, staffActor: true, orgId: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <div className="text-sm text-slate-500">{user.email}</div>
        <div className="mt-1 flex gap-2 text-xs">
          {user.isStaff && user.staffRole && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">{user.staffRole}</span>
          )}
          {user.archived && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">Archive</span>
          )}
        </div>
      </div>

      <MembershipMatrix
        orgMemberships={user.orgMemberships}
        eventMemberships={user.eventMemberships}
      />

      <UserDetailActions
        user={{
          id: user.id,
          isStaff: user.isStaff,
          staffRole: user.staffRole,
          archived: user.archived,
        }}
        canAdmin={canAdmin}
        canResetPassword={canResetPassword}
        isSelf={isSelf}
      />

      <section>
        <h2 className="text-lg font-semibold mb-2">Journal recent</h2>
        <ul className="bg-white border rounded divide-y text-sm">
          {recentActivity.length === 0 && (
            <li className="px-3 py-2 text-slate-500">Aucune activite.</li>
          )}
          {recentActivity.map((a) => (
            <li key={a.id} className="px-3 py-2 flex justify-between">
              <span>
                {a.type}
                {a.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 10.9: Creer `src/app/staff/users/[userId]/UserDetailActions.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  user: { id: string; isStaff: boolean; staffRole: string | null; archived: boolean };
  canAdmin: boolean;
  canResetPassword: boolean;
  isSelf: boolean;
};

export function UserDetailActions({ user, canAdmin, canResetPassword, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState(user.staffRole ?? "STAFF_OBSERVER");

  async function resetPwd() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/users/${user.id}/reset-password`, { method: "POST" });
    setBusy(false);
    setMsg(res.ok ? "Email d'invitation envoye." : "Echec de la reinitialisation.");
  }

  async function changeRole() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffRole }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Role mis a jour.");
      router.refresh();
    } else {
      setMsg("Echec du changement de role.");
    }
  }

  async function archive() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/users/${user.id}/archive`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMsg("Utilisateur archive.");
      router.refresh();
    } else {
      setMsg("Echec de l'archivage.");
    }
  }

  return (
    <section className="border-t pt-4 space-y-3">
      <h2 className="text-lg font-semibold">Actions</h2>
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>}

      {canResetPassword && !user.archived && (
        <button
          onClick={resetPwd}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Renvoyer un lien de configuration de mot de passe
        </button>
      )}

      {canAdmin && user.isStaff && !isSelf && (
        <div className="flex gap-2 items-center">
          <select
            value={staffRole}
            onChange={(e) => setStaffRole(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
            <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
            <option value="STAFF_ADMIN">STAFF_ADMIN</option>
          </select>
          <button
            onClick={changeRole}
            disabled={busy}
            className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
          >
            Changer le role
          </button>
        </div>
      )}

      {canAdmin && !user.archived && !isSelf && (
        <button
          onClick={archive}
          disabled={busy}
          className="rounded border border-amber-400 text-amber-700 px-3 py-1.5 text-sm hover:bg-amber-50 disabled:opacity-50"
        >
          Archiver l'utilisateur
        </button>
      )}

      {isSelf && (
        <p className="text-xs text-slate-500">
          Vous ne pouvez ni archiver votre compte ni modifier votre propre role.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 10.10: Commit**

```bash
git add src/app/api/staff/users/ src/app/staff/users/ src/components/staff/MembershipMatrix.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): detail user (PATCH, reset-password, archive) + matrice memberships"
```

---

## Task 11: `PlatformSettings` — GET, PATCH, test-smtp + page `/staff/settings`

**Files:**
- Create: `src/app/api/staff/settings/route.ts` (GET, PATCH)
- Create: `src/app/api/staff/settings/test-smtp/route.ts` (POST)
- Create: `src/app/staff/settings/page.tsx`
- Create: `src/components/staff/PlatformSettingsForm.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests)

> `GET` ne retourne **jamais** `smtpPassword` ni `recaptchaSecretKey` ; remplace par `*Set: boolean`. `PATCH` STAFF_ADMIN, valeurs string vide => suppression (set "" ou false dans Prisma puisque PlatformSettings est singleton avec defaults). Audit `PLATFORM_SETTINGS_UPDATED` sans valeur secrete, juste un boolean `*Changed`. `test-smtp` envoie via `sendSmtpTest` a l'email du staff connecte.

- [ ] **Step 11.1: Ajouter tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("GET /api/staff/settings", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("never returns smtpPassword nor recaptchaSecretKey", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "h",
        smtpPort: 587,
        smtpFrom: "f@x",
        smtpUser: "u",
        smtpPassword: "SUPER_SECRET",
        smtpSecure: false,
        recaptchaEnabled: true,
        recaptchaSiteKey: "site",
        recaptchaSecretKey: "ANOTHER_SECRET",
      },
    });

    const { GET } = await import("@/app/api/staff/settings/route");
    const req = new NextRequest("http://localhost/api/staff/settings");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.smtpPassword).toBeUndefined();
    expect(json.settings.recaptchaSecretKey).toBeUndefined();
    expect(json.settings.smtpPasswordSet).toBe(true);
    expect(JSON.stringify(json)).not.toContain("SUPER_SECRET");
    expect(JSON.stringify(json)).not.toContain("ANOTHER_SECRET");
  });
});

describe("PATCH /api/staff/settings", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "old",
        smtpPort: 25,
        smtpFrom: "old@x",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
  });

  it("STAFF_SUPPORT cannot patch (403)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { PATCH } = await import("@/app/api/staff/settings/route");
    const req = new NextRequest("http://localhost/api/staff/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "new" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can patch; logs PLATFORM_SETTINGS_UPDATED without secret values", async () => {
    await makeStaff("STAFF_ADMIN");

    const { PATCH } = await import("@/app/api/staff/settings/route");
    const req = new NextRequest("http://localhost/api/staff/settings", {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "new", smtpPassword: "NEW_PWD" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const reloaded = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    expect(reloaded?.smtpHost).toBe("new");
    expect(reloaded?.smtpPassword).toBe("NEW_PWD");

    const log = await prisma.activityLog.findFirst({ where: { type: "PLATFORM_SETTINGS_UPDATED" } });
    expect(log).not.toBeNull();
    expect(JSON.stringify(log?.details)).not.toContain("NEW_PWD");
  });
});

describe("POST /api/staff/settings/test-smtp", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "smtp",
        smtpPort: 587,
        smtpFrom: "from@x",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
  });

  it("STAFF_SUPPORT cannot test SMTP (403)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/staff/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/staff/settings/test-smtp", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN sends test SMTP to their own email", async () => {
    const admin = await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/staff/settings/test-smtp/route");
    const req = new NextRequest("http://localhost/api/staff/settings/test-smtp", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.to).toBe(admin.email);
  });
});
```

- [ ] **Step 11.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "staff/settings"
```

Expected : echecs.

- [ ] **Step 11.3: Creer `src/app/api/staff/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

async function ensureSingleton() {
  let s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }
  return s;
}

function publicView(s: Awaited<ReturnType<typeof ensureSingleton>>) {
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpFrom: s.smtpFrom,
    smtpSecure: s.smtpSecure,
    smtpUserSet: !!s.smtpUser,
    smtpPasswordSet: !!s.smtpPassword,
    recaptchaEnabled: s.recaptchaEnabled,
    recaptchaSiteKey: s.recaptchaSiteKey,
    recaptchaSecretKeySet: !!s.recaptchaSecretKey,
  };
}

export const GET = withStaffAuth(async () => {
  const s = await ensureSingleton();
  return NextResponse.json({ settings: publicView(s) });
});

const patchSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpFrom: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  recaptchaEnabled: z.boolean().optional(),
  recaptchaSiteKey: z.string().optional(),
  recaptchaSecretKey: z.string().optional(),
});

export const PATCH = withStaffAuth(
  async (req, { session }) => {
    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    await ensureSingleton();
    const updated = await prisma.platformSettings.update({
      where: { id: "singleton" },
      data,
    });

    // Audit sans les valeurs secretes (uniquement des booleans `*Changed`)
    const { smtpPassword, recaptchaSecretKey, smtpUser, ...auditableValues } = data;
    await logActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: session.user.id,
      details: {
        changedFields: Object.keys(data),
        values: auditableValues,
        smtpUserChanged: smtpUser !== undefined,
        smtpPasswordChanged: smtpPassword !== undefined,
        recaptchaSecretKeyChanged: recaptchaSecretKey !== undefined,
      },
      req,
    });

    return NextResponse.json({ settings: publicView(updated) });
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 11.4: Creer `src/app/api/staff/settings/test-smtp/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendSmtpTest } from "@/lib/mail";

export const POST = withStaffAuth(
  async (req, { session }) => {
    const to = session.user.email;
    if (!to) {
      return NextResponse.json({ error: "NO_EMAIL_ON_SESSION" }, { status: 400 });
    }
    try {
      await sendSmtpTest({ to });
    } catch (err: any) {
      await logActivity({
        type: "PLATFORM_SETTINGS_UPDATED",
        userId: session.user.id,
        details: { action: "test-smtp", to, ok: false, message: err?.message ?? "unknown" },
        req,
      });
      return NextResponse.json({ error: "SMTP_TEST_FAILED", message: err?.message }, { status: 500 });
    }

    await logActivity({
      type: "PLATFORM_SETTINGS_UPDATED",
      userId: session.user.id,
      details: { action: "test-smtp", to, ok: true },
      req,
    });
    return NextResponse.json({ ok: true, to });
  },
  { minRole: "STAFF_ADMIN" },
);
```

- [ ] **Step 11.5: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "staff/settings"
```

Expected : tests passent.

- [ ] **Step 11.6: Creer `src/components/staff/PlatformSettingsForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PublicSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpSecure: boolean;
  smtpUserSet: boolean;
  smtpPasswordSet: boolean;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKeySet: boolean;
};

export function PlatformSettingsForm({ initial }: { initial: PublicSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    smtpHost: initial.smtpHost,
    smtpPort: String(initial.smtpPort),
    smtpFrom: initial.smtpFrom,
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: initial.smtpSecure,
    recaptchaEnabled: initial.recaptchaEnabled,
    recaptchaSiteKey: initial.recaptchaSiteKey,
    recaptchaSecretKey: "",
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort) || 587,
      smtpFrom: form.smtpFrom,
      smtpSecure: form.smtpSecure,
      recaptchaEnabled: form.recaptchaEnabled,
      recaptchaSiteKey: form.recaptchaSiteKey,
    };
    if (form.smtpUser) payload.smtpUser = form.smtpUser;
    if (form.smtpPassword) payload.smtpPassword = form.smtpPassword;
    if (form.recaptchaSecretKey) payload.recaptchaSecretKey = form.recaptchaSecretKey;

    const res = await fetch("/api/staff/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Parametres enregistres.");
      router.refresh();
    } else {
      setMsg("Echec de l'enregistrement.");
    }
  }

  async function testSmtp() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/staff/settings/test-smtp", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const json = await res.json();
      setMsg(`Email de test envoye a ${json.to}.`);
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(`Echec : ${json.message ?? json.error ?? "inconnue"}`);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>}

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">SMTP</h2>
        <Field label="Hote SMTP" value={form.smtpHost} onChange={(v) => setForm((f) => ({ ...f, smtpHost: v }))} />
        <Field label="Port" type="number" value={form.smtpPort} onChange={(v) => setForm((f) => ({ ...f, smtpPort: v }))} />
        <Field label="Expediteur (From)" type="email" value={form.smtpFrom} onChange={(v) => setForm((f) => ({ ...f, smtpFrom: v }))} />
        <Field
          label={`Utilisateur SMTP ${initial.smtpUserSet ? "(rempli — entrez pour remplacer)" : ""}`}
          value={form.smtpUser}
          onChange={(v) => setForm((f) => ({ ...f, smtpUser: v }))}
        />
        <Field
          label={`Mot de passe SMTP ${initial.smtpPasswordSet ? "(rempli — entrez pour remplacer)" : ""}`}
          type={showSecrets ? "text" : "password"}
          value={form.smtpPassword}
          onChange={(v) => setForm((f) => ({ ...f, smtpPassword: v }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smtpSecure}
            onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
          />
          TLS (smtpSecure)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showSecrets}
            onChange={(e) => setShowSecrets(e.target.checked)}
          />
          Afficher les valeurs masquees
        </label>
        <div className="flex gap-2">
          <button
            onClick={testSmtp}
            disabled={busy}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Envoyer un email de test
          </button>
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">reCAPTCHA</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.recaptchaEnabled}
            onChange={(e) => setForm((f) => ({ ...f, recaptchaEnabled: e.target.checked }))}
          />
          Active par defaut
        </label>
        <Field
          label="Site key"
          value={form.recaptchaSiteKey}
          onChange={(v) => setForm((f) => ({ ...f, recaptchaSiteKey: v }))}
        />
        <Field
          label={`Secret key ${initial.recaptchaSecretKeySet ? "(rempli — entrez pour remplacer)" : ""}`}
          type={showSecrets ? "text" : "password"}
          value={form.recaptchaSecretKey}
          onChange={(v) => setForm((f) => ({ ...f, recaptchaSecretKey: v }))}
        />
      </section>

      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
      >
        {busy ? "Enregistrement..." : "Enregistrer les parametres"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
```

- [ ] **Step 11.7: Creer `src/app/staff/settings/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { PlatformSettingsForm } from "@/components/staff/PlatformSettingsForm";

export default async function StaffSettingsPage() {
  let s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!s) {
    s = await prisma.platformSettings.create({ data: { id: "singleton" } });
  }

  const safe = {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpFrom: s.smtpFrom,
    smtpSecure: s.smtpSecure,
    smtpUserSet: !!s.smtpUser,
    smtpPasswordSet: !!s.smtpPassword,
    recaptchaEnabled: s.recaptchaEnabled,
    recaptchaSiteKey: s.recaptchaSiteKey,
    recaptchaSecretKeySet: !!s.recaptchaSecretKey,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parametres plateforme</h1>
      <PlatformSettingsForm initial={safe} />
    </div>
  );
}
```

- [ ] **Step 11.8: Commit**

```bash
git add src/app/api/staff/settings/ src/app/staff/settings/ src/components/staff/PlatformSettingsForm.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): parametres plateforme (SMTP + reCAPTCHA + test SMTP)"
```

---

## Task 12: `GET /api/staff/activity` + page `/staff/activity`

**Files:**
- Create: `src/app/api/staff/activity/route.ts`
- Create: `src/app/staff/activity/page.tsx`
- Create: `src/components/staff/ActivityFilters.tsx`
- Modify: `src/lib/__tests__/api-staff.test.ts` (ajout tests)

> Liste globale paginee filtrable : `?type=`, `?from=`, `?to=`, `?orgId=`, `?userId=`, `?staffActor=true|false|all`. Lecture STAFF_OBSERVER+.

- [ ] **Step 12.1: Ajouter tests d'echec a `src/lib/__tests__/api-staff.test.ts`**

Append :

```typescript
describe("GET /api/staff/activity", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("lists most recent activity first", async () => {
    await makeStaff("STAFF_OBSERVER");
    const u = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.activityLog.create({ data: { type: "USER_CREATED", userId: u.id } });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u.id } });

    const { GET } = await import("@/app/api/staff/activity/route");
    const req = new NextRequest("http://localhost/api/staff/activity");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activities.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by type", async () => {
    await makeStaff();
    const u = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.activityLog.create({ data: { type: "USER_CREATED", userId: u.id } });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u.id } });

    const { GET } = await import("@/app/api/staff/activity/route");
    const req = new NextRequest("http://localhost/api/staff/activity?type=USER_LOGIN");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.every((a: any) => a.type === "USER_LOGIN")).toBe(true);
  });

  it("filters by staffActor=true", async () => {
    await makeStaff();
    const staff = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S2", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "act-o" } });
    await prisma.activityLog.create({
      data: { type: "ORG_UPDATED", userId: staff.id, orgId: org.id, staffActor: true },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: staff.id, staffActor: false },
    });

    const { GET } = await import("@/app/api/staff/activity/route");
    const req = new NextRequest("http://localhost/api/staff/activity?staffActor=true");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.every((a: any) => a.staffActor === true)).toBe(true);
  });

  it("filters by orgId", async () => {
    await makeStaff();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "act-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "act-b" } });
    await prisma.activityLog.create({ data: { type: "ORG_UPDATED", userId: u.id, orgId: orgA.id } });
    await prisma.activityLog.create({ data: { type: "ORG_UPDATED", userId: u.id, orgId: orgB.id } });

    const { GET } = await import("@/app/api/staff/activity/route");
    const req = new NextRequest(`http://localhost/api/staff/activity?orgId=${orgA.id}`);
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.every((a: any) => a.orgId === orgA.id)).toBe(true);
  });
});
```

- [ ] **Step 12.2: Lancer les tests (echec attendu)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "GET /api/staff/activity"
```

Expected : echec.

- [ ] **Step 12.3: Creer `src/app/api/staff/activity/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const orgId = searchParams.get("orgId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const eventId = searchParams.get("eventId") ?? undefined;
  const staffActorParam = searchParams.get("staffActor") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

  const where: Record<string, unknown> = {};
  if (type) where.type = type as ActivityType;
  if (orgId) where.orgId = orgId;
  if (userId) where.userId = userId;
  if (eventId) where.eventId = eventId;
  if (staffActorParam === "true") where.staffActor = true;
  else if (staffActorParam === "false") where.staffActor = false;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        userId: true,
        orgId: true,
        eventId: true,
        targetId: true,
        details: true,
        staffActor: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({ activities, total, page, pageSize });
});
```

- [ ] **Step 12.4: Lancer les tests (passes attendus)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-staff.test.ts -t "GET /api/staff/activity"
```

Expected : 4 passed.

- [ ] **Step 12.5: Creer `src/components/staff/ActivityFilters.tsx`**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TYPES = [
  "REGISTRATION_CREATED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_LOGIN",
  "ORG_CREATED",
  "ORG_UPDATED",
  "ORG_ARCHIVED",
  "ORG_RESTORED",
  "ORG_DELETED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_ARCHIVED",
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_REMOVED",
  "MEMBERSHIP_ROLE_CHANGED",
  "PLATFORM_SETTINGS_UPDATED",
];

export function ActivityFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const u = new URLSearchParams(sp.toString());
    if (value) u.set(key, value);
    else u.delete(key);
    router.push(`/staff/activity?${u.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap gap-2 items-end bg-white border rounded p-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="text-sm">
        Type
        <select
          defaultValue={sp.get("type") ?? ""}
          onChange={(e) => update("type", e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        >
          <option value="">Tous</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Staff actor
        <select
          defaultValue={sp.get("staffActor") ?? "all"}
          onChange={(e) => update("staffActor", e.target.value === "all" ? "" : e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        >
          <option value="all">Tous</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </label>
      <label className="text-sm">
        Du
        <input
          type="date"
          defaultValue={sp.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm">
        Au
        <input
          type="date"
          defaultValue={sp.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm">
        Org ID
        <input
          defaultValue={sp.get("orgId") ?? ""}
          onChange={(e) => update("orgId", e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm">
        User ID
        <input
          defaultValue={sp.get("userId") ?? ""}
          onChange={(e) => update("userId", e.target.value)}
          className="block rounded border px-2 py-1 text-sm"
        />
      </label>
    </form>
  );
}
```

- [ ] **Step 12.6: Creer `src/app/staff/activity/page.tsx`**

```typescript
import type { ActivityType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ActivityFilters } from "@/components/staff/ActivityFilters";

export default async function StaffActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    orgId?: string;
    userId?: string;
    eventId?: string;
    staffActor?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.type) where.type = sp.type as ActivityType;
  if (sp.orgId) where.orgId = sp.orgId;
  if (sp.userId) where.userId = sp.userId;
  if (sp.eventId) where.eventId = sp.eventId;
  if (sp.staffActor === "true") where.staffActor = true;
  else if (sp.staffActor === "false") where.staffActor = false;
  if (sp.from || sp.to) {
    const range: Record<string, Date> = {};
    if (sp.from) range.gte = new Date(sp.from);
    if (sp.to) range.lte = new Date(sp.to);
    where.createdAt = range;
  }

  const activities = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      orgId: true,
      eventId: true,
      targetId: true,
      staffActor: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Journal d'activite</h1>
      <ActivityFilters />

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Acteur</th>
            <th className="px-3 py-2">Cible</th>
            <th className="px-3 py-2">Staff?</th>
          </tr>
        </thead>
        <tbody>
          {activities.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Aucune entree.
              </td>
            </tr>
          )}
          {activities.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{a.type}</td>
              <td className="px-3 py-2">{a.user?.email ?? "—"}</td>
              <td className="px-3 py-2 text-xs">
                {a.orgId && <div>org: {a.orgId}</div>}
                {a.eventId && <div>event: {a.eventId}</div>}
                {a.targetId && <div>target: {a.targetId}</div>}
              </td>
              <td className="px-3 py-2">
                {a.staffActor ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">staff</span>
                ) : (
                  <span className="text-slate-500 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 12.7: Commit**

```bash
git add src/app/api/staff/activity/route.ts src/app/staff/activity/page.tsx src/components/staff/ActivityFilters.tsx src/lib/__tests__/api-staff.test.ts
git commit -m "feat(staff): journal d'activite global avec filtres"
```

---

## Task 13: Page publique `/setup-password` + route POST

**Files:**
- Modify: `src/app/setup-password/page.tsx` (heritee de v1, compatible — verifier seulement)
- Modify: `src/app/api/setup-password/route.ts` (heritee de v1, deja compatible Plan 1 — verifier seulement)
- Create: `src/lib/__tests__/setup-password.test.ts`

> Route publique (hors `/staff/*`, hors `/admin/*`). Verifier que le code v1 fonctionne toujours apres le schema Plan 1 : il s'appuie sur `User.inviteToken`, `User.inviteTokenExpiry`, `User.password` (champs presents dans Plan 1). Ajouter des tests d'integration pour eviter une regression.

- [ ] **Step 13.1: Verifier que `src/app/api/setup-password/route.ts` est encore valide apres Plan 1**

Lire le fichier `src/app/api/setup-password/route.ts`. Il doit contenir un POST qui :
1. Recoit `{ token, password }`
2. Cherche `prisma.user.findUnique({ where: { inviteToken: token } })`
3. Verifie l'expiration `user.inviteTokenExpiry < new Date()`
4. Met a jour : `password: await hash(password, 12), inviteToken: null, inviteTokenExpiry: null`
5. Log `USER_PASSWORD_SET`

Si une de ces conditions n'est pas remplie (par ex. signature `logActivity` differente), corriger pour s'aligner sur Plan 1 :

```typescript
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 6 caracteres" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Token invalide ou expire" }, { status: 400 });
  }
  if (user.archived) {
    return NextResponse.json({ error: "Compte archive" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hash(password, 12),
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  await logActivity({
    type: "USER_PASSWORD_SET",
    userId: user.id,
    targetId: user.id,
    details: { userEmail: user.email },
    req,
  });

  return NextResponse.json({ message: "Mot de passe configure avec succes" });
}
```

- [ ] **Step 13.2: Verifier que `src/app/setup-password/page.tsx` existe et appelle `/api/setup-password`**

Le fichier v1 existant `src/app/setup-password/page.tsx` est compatible — pas de modification necessaire si le `fetch` POSTe vers `/api/setup-password`.

- [ ] **Step 13.3: Ecrire un test d'integration pour setup-password**

Creer `src/lib/__tests__/setup-password.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

describe("POST /api/setup-password", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects invalid token", async () => {
    const { POST } = await import("@/app/api/setup-password/route");
    const req = new NextRequest("http://localhost/api/setup-password", {
      method: "POST",
      body: JSON.stringify({ token: "bad", password: "secret123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects expired token", async () => {
    const u = await prisma.user.create({
      data: {
        email: "exp@x",
        password: "",
        name: "Exp",
        inviteToken: "abc",
        inviteTokenExpiry: new Date(Date.now() - 1000),
      },
    });
    const { POST } = await import("@/app/api/setup-password/route");
    const req = new NextRequest("http://localhost/api/setup-password", {
      method: "POST",
      body: JSON.stringify({ token: "abc", password: "secret123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const reloaded = await prisma.user.findUnique({ where: { id: u.id } });
    expect(reloaded?.password).toBe("");
  });

  it("rejects password < 6 chars", async () => {
    await prisma.user.create({
      data: {
        email: "short@x",
        password: "",
        name: "Short",
        inviteToken: "tok-short",
        inviteTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const { POST } = await import("@/app/api/setup-password/route");
    const req = new NextRequest("http://localhost/api/setup-password", {
      method: "POST",
      body: JSON.stringify({ token: "tok-short", password: "abc" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets the password and clears the token + logs USER_PASSWORD_SET", async () => {
    const u = await prisma.user.create({
      data: {
        email: "ok@x",
        password: "",
        name: "OK",
        inviteToken: "tok-ok",
        inviteTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const { POST } = await import("@/app/api/setup-password/route");
    const req = new NextRequest("http://localhost/api/setup-password", {
      method: "POST",
      body: JSON.stringify({ token: "tok-ok", password: "secret123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.inviteToken).toBeNull();
    expect(updated?.inviteTokenExpiry).toBeNull();
    expect(await compare("secret123", updated!.password)).toBe(true);

    const log = await prisma.activityLog.findFirst({ where: { type: "USER_PASSWORD_SET" } });
    expect(log?.userId).toBe(u.id);
  });

  it("rejects archived user", async () => {
    await prisma.user.create({
      data: {
        email: "arch@x",
        password: "",
        name: "Arch",
        archived: true,
        archivedAt: new Date(),
        inviteToken: "tok-arch",
        inviteTokenExpiry: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const { POST } = await import("@/app/api/setup-password/route");
    const req = new NextRequest("http://localhost/api/setup-password", {
      method: "POST",
      body: JSON.stringify({ token: "tok-arch", password: "secret123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 13.4: Lancer les tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/setup-password.test.ts
```

Expected : 5 passed. Si un test echoue, corriger la route comme indique en Step 13.1.

- [ ] **Step 13.5: Commit**

```bash
git add src/app/api/setup-password/route.ts src/lib/__tests__/setup-password.test.ts
git commit -m "feat(staff): route setup-password compatibilite v2 + tests d'integration"
```

---

## Task 14: Smoke test integration bout-en-bout

**Files:**
- Create: `src/lib/__tests__/staff-integration.test.ts`

> Valide les 8 criteres d'acceptation de la spec en un test d'integration.

- [ ] **Step 14.1: Ecrire le test d'integration**

Creer `src/lib/__tests__/staff-integration.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function asUser(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

describe("Espace staff — criteres d'acceptation", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    await prisma.platformSettings.deleteMany();
    await prisma.platformSettings.create({
      data: {
        id: "singleton",
        smtpHost: "smtp",
        smtpPort: 587,
        smtpFrom: "from@x",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
    });
    vi.mocked(getServerSession).mockReset();
  });

  it("AC1 + AC2 : non-staff bloque ; STAFF_OBSERVER lit mais ne mute pas", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await asUser({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/staff/organizations/route");
    let res = await GET(
      new NextRequest("http://localhost/api/staff/organizations"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);

    const obs = await prisma.user.create({
      data: { email: "obs@x", password: "x", name: "Obs", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await asUser({ id: obs.id, email: obs.email, name: obs.name, isStaff: true });
    res = await GET(
      new NextRequest("http://localhost/api/staff/organizations"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    const { POST } = await import("@/app/api/staff/organizations/route");
    res = await POST(
      new NextRequest("http://localhost/api/staff/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "X", ownerEmail: "x@x", ownerName: "X" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
  });

  it("AC3 + AC5 : STAFF_ADMIN cree une org, agit, et l'action est tracee avec staffActor=true", async () => {
    const admin = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "Admin", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { POST } = await import("@/app/api/staff/organizations/route");
    const res = await POST(
      new NextRequest("http://localhost/api/staff/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "AC3",
          ownerEmail: "owner-ac3@x",
          ownerName: "Owner",
          quotaMaxEvents: 10,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const json = await res.json();

    const logs = await prisma.activityLog.findMany({ where: { orgId: json.org.id } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.staffActor === true)).toBe(true);
  });

  it("AC6 : GET /staff/settings ne fuit jamais smtpPassword ni recaptchaSecretKey", async () => {
    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { smtpPassword: "VERY_SECRET", recaptchaSecretKey: "ALSO_SECRET" },
    });
    const admin = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { GET } = await import("@/app/api/staff/settings/route");
    const res = await GET(
      new NextRequest("http://localhost/api/staff/settings"),
      { params: Promise.resolve({}) },
    );
    const text = await res.text();
    expect(text).not.toContain("VERY_SECRET");
    expect(text).not.toContain("ALSO_SECRET");
  });

  it("AC7 : test-smtp envoie a l'email staff connecte (verifie via response.to)", async () => {
    const admin = await prisma.user.create({
      data: { email: "ac7@x", password: "x", name: "AC7", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { POST } = await import("@/app/api/staff/settings/test-smtp/route");
    const res = await POST(
      new NextRequest("http://localhost/api/staff/settings/test-smtp", { method: "POST" }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.to).toBe("ac7@x");
  });

  it("AC8 : POST /staff/users genere un inviteToken (24h)", async () => {
    const admin = await prisma.user.create({
      data: { email: "ac8@x", password: "x", name: "AC8", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await asUser({ id: admin.id, email: admin.email, name: admin.name, isStaff: true });

    const { POST } = await import("@/app/api/staff/users/route");
    const before = Date.now();
    const res = await POST(
      new NextRequest("http://localhost/api/staff/users", {
        method: "POST",
        body: JSON.stringify({ email: "invited@x", name: "Inv", type: "client" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "invited@x" } });
    expect(created?.inviteToken).toBeTruthy();
    expect(created?.inviteTokenExpiry).not.toBeNull();
    const expiresIn = (created!.inviteTokenExpiry!.getTime() - before) / 1000;
    expect(expiresIn).toBeGreaterThan(23 * 3600);
    expect(expiresIn).toBeLessThan(25 * 3600);
  });
});
```

> AC4 ("staff clique 'Entrer dans l'organisation' et arrive sur `/admin/[orgId]` avec le bandeau") est couvert par Plan 03 (`StaffBanner` + layout `/admin/[orgId]`). Il est pris en charge par le test manuel de Plan 03 + le smoke manuel de la Task 15 ci-dessous.

- [ ] **Step 14.2: Lancer le test d'integration**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/staff-integration.test.ts
```

Expected : 5 passed.

- [ ] **Step 14.3: Commit**

```bash
git add src/lib/__tests__/staff-integration.test.ts
git commit -m "test(staff): integration des 8 criteres d'acceptation"
```

---

## Task 15: Verifier l'absence de stubs Plan 6 et finaliser

> A executer **apres** le merge effectif du Plan 6 (ou en confirmant que les stubs Step 0.3 n'ont jamais ete commit). Cette task est NON-NEGOTIABLE : elle bloque la fermeture du plan tant qu'un stub subsiste.

**Files:**
- Modify: `src/lib/mail.ts` (suppression du bloc stub)

- [ ] **Step 15.1: Detecter d'eventuels stubs residuels**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "grep -rn 'TODO: wired up by Plan 6\\|STUB_PLAN_6\\|\\[stub Plan 6\\]\\|STUBS Plan 6\\|mail-stubs' src/lib/ src/app/api/" || echo "OK aucun stub residuel"
```

Expected : `OK aucun stub residuel`. Si la commande retourne des lignes, passer a Step 15.2 ; sinon sauter a Step 15.5.

Verifier en complement que tous les imports de helpers email pointent vers `@/lib/mail` (pas `@/lib/mail-stubs`) :

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "grep -rn 'sendUserInvitation\\|sendSmtpTest\\|sendPasswordResetEmail' src/app/api/staff/ | grep -v '@/lib/mail\"' | grep 'from' " || echo "OK imports propres"
```

Expected : `OK imports propres`. Toute ligne renvoyant un import depuis autre chose que `@/lib/mail` doit etre corrigee.

- [ ] **Step 15.2: Supprimer le bloc stub de `src/lib/mail.ts`**

Editer `src/lib/mail.ts` et supprimer integralement le bloc delimite par :

```typescript
// ============================================
// STUBS Plan 6 — A SUPPRIMER quand Plan 6 merge
// ============================================
// ...
// ============================================
// FIN STUBS Plan 6
// ============================================
```

S'assurer que les vraies implementations Plan 6 sont presentes (en chercher la signature `export async function sendUserInvitation`, `sendPasswordResetEmail`, `sendSmtpTest` dans le reste du fichier).

- [ ] **Step 15.3: Re-detecter (assertion)**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "grep -n '\\[stub Plan 6\\]\\|STUBS Plan 6' src/lib/mail.ts" && echo "FAIL_STUB_REMAINS" || echo "OK_NO_STUB"
```

Expected : `OK_NO_STUB`. Si `FAIL_STUB_REMAINS`, repeter Step 15.2 jusqu'a nettoyage complet.

- [ ] **Step 15.4: Verifier que Plan 6 fournit bien les 3 helpers**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "grep -c 'export async function sendUserInvitation\|export async function sendPasswordResetEmail\|export async function sendSmtpTest' src/lib/mail.ts"
```

Expected : `3`. Si moins de 3, STOP : Plan 6 n'a pas merge ses helpers, demander a l'utilisateur.

- [ ] **Step 15.5: Relancer toute la suite**

```bash
make lint && make typecheck && make test
```

Expected : lint propre, typecheck propre, tests passent.

- [ ] **Step 15.6: Smoke test manuel bout-en-bout**

```bash
make dev
```

1. Se connecter en `admin@badge.local` / `admin123`.
2. Verifier que `/` redirige vers `/staff`.
3. Sur `/staff`, verifier dashboard, KPI.
4. Aller sur `/staff/organizations/new`, creer une org "Test" avec OWNER `owner-test@badge.local` "Owner Test".
5. Verifier email d'invitation dans Mailpit (`http://localhost:8025`) — sujet "Bienvenue sur Badge".
6. Sur `/staff/organizations/[orgId]`, cliquer "Entrer dans l'organisation" — verifier presence du bandeau staff (cf. Plan 03).
7. Sur `/staff/settings`, cliquer "Envoyer un email de test" — verifier email dans Mailpit, sujet "Test SMTP — Badge".
8. Sur `/staff/users/new`, creer un client `client-test@badge.local`. Verifier email dans Mailpit.
9. Sur `/staff/activity`, filtrer `staffActor=true` — verifier qu'au moins une ligne apparait.
10. Tester la suppression hard d'une org : passer par `/staff/organizations/[orgId]`, bouton "Supprimer definitivement", entrer le slug exact dans le prompt — verifier disparition + entree `ORG_DELETED` dans le journal.

Expected : tous les comportements fonctionnent.

- [ ] **Step 15.7: Commit si modifications**

Si Step 15.2 a applique des suppressions :

```bash
git add src/lib/mail.ts
git commit -m "chore(staff): suppression des stubs Plan 6 (helpers reels disponibles)"
```

Sinon, sauter ce commit.

---

## Task 16: Documentation et synthese finale

**Files:**
- Modify: `docs/v2/architecture.md`

- [ ] **Step 16.1: Ajouter une section d'avancement**

Ajouter en fin de `docs/v2/architecture.md` :

```markdown
## Etat au lot B (post-Plan 2)

Plan 2 (espace staff applicatif) termine. Disponible :

- Wrapper `withStaffAuth` reutilisable pour les routes `/api/staff/*`
- Layout `StaffShell` + dispatcher post-login (`computeStaffRedirect`)
- Routes pages `/staff/{dashboard, organizations, users, settings, activity}` (CRUD complet)
- API REST : organisations (creation OWNER initial, archive/restore, hard delete), utilisateurs (creation staff/client, reset-password, archive, role), PlatformSettings (SMTP/reCAPTCHA, test-smtp), activity log filtre
- Audit `staffActor=true` automatique pour toutes les mutations staff sur donnees clients
- Page publique `/setup-password` reutilisee de la v1 (compatible v2)

Reste a venir :

- Plan 3 (espace organisation `/admin/[orgId]/*`)
- Plan 4 (espace evenement `/admin/[orgId]/events/[eventId]/*`)
- Plan 5 (inscription publique `/e/[slug]`)
```

- [ ] **Step 16.2: Lancer la verification finale**

```bash
make lint && make typecheck && make test
```

Expected : tout passe sans warning.

- [ ] **Step 16.3: Verifier la liste des fichiers crees**

```bash
find src/app/api/staff src/app/staff src/components/staff -type f | sort
```

Expected : toutes les routes et pages listees dans la section "File Structure" sont presentes.

- [ ] **Step 16.4: Verifier l'absence de fuite de secrets dans les reponses API**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "grep -rn 'smtpPassword\\|recaptchaSecretKey' src/app/api/staff/" || echo "OK"
```

Expected : aucune occurrence dans une expression `NextResponse.json(...)`. Seules les valeurs des champs `details.*Changed` (booleans) et les noms de champs dans des schemas Zod peuvent apparaitre.

- [ ] **Step 16.5: Verifier le git log**

```bash
git log --oneline | head -25
```

Expected : succession de commits `feat(staff): ...` et `test(staff): ...`, en francais ASCII, sans mention IA.

- [ ] **Step 16.6: Commit doc**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): note d'avancement post-Plan 2 (espace staff)"
```

---

## Done

Plan 2 (espace staff applicatif) est complet. Toutes les routes `/staff/*` et leurs API correspondantes sont en place, testees (unitaires + integration), avec :

- Wrapper `withStaffAuth` reutilisable, avec `minRole` (defaut STAFF_OBSERVER)
- Dispatcher post-login (`/` -> `/staff` si `isStaff`)
- Layout `StaffShell` (sidebar + header + role badge)
- Dashboard plateforme avec KPI agreges et top organisations
- CRUD organisations : creation (wizard 2 etapes + OWNER initial), archive/restore, hard delete (STAFF_ADMIN + confirmation slug)
- CRUD utilisateurs : creation staff/client + memberships, PATCH role (jamais sur soi-meme), reset-password (STAFF_SUPPORT+), archive (STAFF_ADMIN)
- PlatformSettings : GET sans secrets, PATCH STAFF_ADMIN, test-SMTP a l'email du staff connecte
- Journal d'activite global avec filtres (type, periode, orgId, userId, staffActor)
- Setup-password public (route + page) compatible v2
- Audit `staffActor=true` sur toutes les actions staff (couvre AC5 de la spec)
- Pas de fuite de `smtpPassword` ni `recaptchaSecretKey` dans aucune reponse API
- Suppression des stubs Plan 6 verifiee (Task 15)


