# Espace Organisation (OWNER) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the OWNER workspace of Badge v2 (`/admin/[orgId]/*`) : dashboard, paramètres administratifs de l'organisation (fusionnés dans le modèle `Organization`), membres OWNER, modèles de catégories, liste/création d'events (wizard 3 étapes), archive/restore, journal d'activité, et la logique de sélection d'org post-login (multi-org + bandeau staff).

> **Mise à jour 2026-05-31 — SMTP plateforme uniquement** : par décision de design, les paramètres SMTP vivent **exclusivement** au niveau `PlatformSettings`. Aucun champ SMTP ni override SMTP n'existe dans `OrgSettings`. En conséquence :
> - La Task 5 (`OrgSettings` GET/PATCH + page) est simplifiée : `OrgSettings` ne contient plus que **contact** (`contactEmail`, `contactPhone`). Les tests, le schéma Zod, la réponse GET et l'audit ont été ajustés ; un test "defense in depth" rejette (HTTP 400) tout PATCH legacy qui tenterait d'envoyer des champs SMTP.
> - La Task 6 (`POST /api/admin/[orgId]/settings/test-smtp`) est **supprimée**. La fonction `sendSmtpTest` reste fournie par Plan 6, mais elle n'est appelée que par les routes staff (`/staff/*`). Aucune UI "Tester SMTP" n'existe côté OWNER.
> - Sources : `docs/v2/features/espace-organisation.md` et `docs/v2/features/multi-tenancy-rbac.md` mises à jour le même jour.
>
> **Mise à jour 2026-05-31 — reCAPTCHA plateforme uniquement** : le reCAPTCHA suit la même logique que le SMTP : plateforme uniquement (cf. décision 2026-05-31, `multi-tenancy-rbac.md`). Retrait de toute UI/route/test reCAPTCHA dans `/admin/[orgId]/*`. `OrgSettings` ne contient désormais que `contactEmail` et `contactPhone`.
>
> **Mise à jour 2026-05-31 — Enrichissement d'`Organization` et suppression d'`OrgSettings`** : `Organization` est enrichi avec les infos administratives (`legalName`, `addressLine1`, `addressLine2`, `postalCode`, `city`, `country`, `taxId`, `website`, `logo`) et de contact public (`contactEmail`, `contactPhone`). Le modèle `OrgSettings` est **supprimé**. En conséquence, la Task 5 est refondue : la route `GET/PATCH /api/admin/[orgId]/settings` **disparaît** et tous les champs administratifs sont édités via la route principale `PATCH /api/admin/[orgId]`. Cette route accepte désormais tous les champs `Organization` éditables — `name`, `legalName`, `addressLine1/2`, `postalCode`, `city`, `country`, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` (tous réservés à `OWNER`), plus `slug` et `quotaMax*` (réservés au staff). Audit `ORG_UPDATED` (le type `ORG_SETTINGS_UPDATED` disparaît). La page `/admin/[orgId]/settings` reste, mais devient un formulaire complet (sections Identité, Adresse, Administratif, Contact public) qui POST sur la route principale ; plus de fallback/cascade affiché — tout est direct.

**Architecture:** Toutes les routes sont protégées par un wrapper `withOrgAuth` qui résout l'`orgId` depuis le path, appelle `requireOrgRole` (Plan 1) et délègue ensuite au handler. Les pages serveur (`Server Components`) consomment les routes via `fetch` côté client uniquement pour les actions ; les lectures initiales se font directement via Prisma + helpers. `Organization` ne contient aucun secret (depuis 2026-05-31 : SMTP et reCAPTCHA sont gérés au niveau `PlatformSettings` uniquement ; le modèle `OrgSettings` a été supprimé et ses champs contact fusionnés dans `Organization`). Toute mutation produit un `logActivity({ orgId, … })` avec `staffActor` auto-calculé par Plan 1. La création d'event applique la cascade : vérification du quota → génération d'un slug global unique → copie des `CategoryTemplate` sélectionnés en `Category`.

**Tech Stack:** Next.js 16 App Router (Server Components + Client Forms), Prisma 6, NextAuth 4 (session côté serveur via `getServerSession`), Zod (validation), TypeScript 5, Vitest 4. UI : composants existants `Button`, `Input`, `Select`, `Table`, `Modal`, `StatusBadge` (réutilisés depuis `src/components/ui/`).

**Spec:** [docs/v2/features/espace-organisation.md](../../v2/features/espace-organisation.md)

**Prerequisite plans:**
- Plan 1 — Multi-tenancy & RBAC (helpers `requireOrgRole`, `requireStaff`, `loadUserContext`, `logActivity`, `resolveSettings`, `AuthError`)
- Plan 6 — Notifications email multi-tenant (fournit `sendUserInvitation(userId, { orgId? })` ; `sendSmtpTest` reste utilisé uniquement par les routes staff `/staff/*` — plus aucun appel depuis `/admin/[orgId]/*` depuis la décision 2026-05-31)

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [x] | 2026-05-31 | Pre-flight + nettoyage v1. Helpers Plan 1 OK, stub `sendUserInvitation` OK. Fix bloquant : `vitest.config.ts` passe en `fileParallelism: false` (16 fichiers tests partagent une BDD unique avec `deleteMany`, collisions inter-fichiers). Suppression v1 (dette documentée Lot A Task 10) : 21 routes API (`api/{activity-logs,edit-registration,event,profile,registrations,scan,settings,teams,users,verify}/*`), pages admin v1 (`app/admin/*`), `app/scan/*`, `app/verify/[id]/*`, `app/badge-preview/[id]/*`, `components/admin/EventForm.tsx`, fichiers de tests v1 morts (`auth.test.ts`, `mail.test.ts`). Composants `components/badge/*` conservés (réutilisés par v2-12). Baseline : 269/269 tests, typecheck OK, lint OK (13 warnings mineurs). |
| 1 | [x] | 2026-05-31 | src/lib/with-org-auth.ts + tests (4/4 passent). Wrapper d'API : 401 si pas de session, 403 si pas OWNER et pas staff, 200 pour OWNER (ctx exposé), 200 pour staff sans OrgMembership. |
| 2 | [x] | 2026-05-31 | OrgSelector (dropdown multi-org + localStorage badge.lastOrgId), StaffBanner (bandeau amber si accès staff), OrgShell (sidebar Dashboard/Événements/Membres/Modèles/Paramètres/Journal + header). Typecheck OK. |
| 3 | [x] | 2026-05-31 | src/app/admin/[orgId]/{layout,page}.tsx + src/app/api/admin/[orgId]/route.ts (GET). Layout : redirect login si pas session, notFound si org absente, redirect /select si pas OWNER ni staff, isStaffMode si staff sans OrgMembership. Dashboard : 4 KPI (events actifs/archives/insc mois courant/quota), 5 derniers events, 10 dernieres entrees ActivityLog. GET API retourne l'org avec _count events+memberships et quotas. Typecheck OK. |
| 4 | [x] | 2026-05-31 | PATCH /api/admin/[orgId] base (name OWNER, slug staff). 3 tests Task 4 passent. Implementation fusionnee avec Task 5 directement (schema etendu, gain de temps). |
| 5 | [x] | 2026-05-31 | PATCH etendu : Zod .strict() rejette les champs SMTP/reCAPTCHA legacy (HTTP 400, defense in depth). OWNER_FIELDS = name/legalName/addr/postalCode/city/country/taxId/website/logo/contactEmail/contactPhone. STAFF_FIELDS = slug/quotaMax*. Log ORG_UPDATED avec changedFields. Page /admin/[orgId]/settings + SettingsClient (4 sections : Identite / Adresse / Administratif / Contact public ; slug en disabled, indication staff-only). 8/8 tests passent (3 Task 4 + 5 Task 5). |
| 6 | [-] | 2026-05-31 | Supprimee : decision "SMTP plateforme uniquement" ; aucune route test-smtp scope org. |
| 7 | [x] | 2026-05-31 | Routes GET/POST members + DELETE [userId]. GET inclut lastLogin (via ActivityLog USER_LOGIN). POST cree user (avec inviteToken 24h via stub Plan 6) si email absent, sinon ajoute juste OrgMembership (sans toucher au token — corrige le comportement du stub Plan 6 qui regenere systematiquement). Idempotence : alreadyMember=true si OrgMembership existe. DELETE refuse 409 LAST_OWNER si seul OWNER. OrgMemberForm + MembersClient (tableau + bouton retirer + form invite). 12/12 tests api-org passent (3 Task 4 + 5 Task 5 + 2 Task 7 POST + 2 Task 7 DELETE). |
| 8 | [x] | 2026-05-31 | CRUD CategoryTemplate complet : GET/POST routes + PATCH/DELETE [id] (404 si template d'une autre org). Validations Zod : color regex /^#[0-9a-fA-F]{6}$/, number int 0-999, name 1-120 chars. CategoryTemplateForm + TemplatesClient (tableau avec edition/suppression inline). Audit CATEGORY_TEMPLATE_{CREATED,UPDATED,DELETED}. 14/14 tests passent (+2 Task 8). |
| 9 | [x] | 2026-05-31 | GET /api/admin/[orgId]/events avec filtres archived/registrationOpen (Prisma.EventWhereInput type-safe), include _count.registrations. Page liste avec tableau + bouton "Nouvel evenement" + status badges (Archive/Inscriptions ouvertes/Ferme). |
| 10 | [x] | 2026-05-31 | slugify-event.ts (NFD + diacritiques + lowercase + alphanum + dashes) + uniqueEventSlug (suffixage -2/-3 global). 7/7 tests slugify passent. POST /api/admin/[orgId]/events : quota check 409 QUOTA_EXCEEDED, slug global unique, copie CategoryTemplate -> Category (renumerotation 1..N pour unicite), manualCategories optionnel, audit EVENT_CREATED. 4/4 tests POST events passent. 25 tests api-org+slugify cumules. |
| 11 | [x] | 2026-05-31 | EventCreationWizard 3 etapes (Infos / Categories / Recap) + page /admin/[orgId]/events/new. Slug suggere automatiquement depuis titre (modifiable), mode template (cases a cocher des CategoryTemplate) ou manual (categories ajoutees a la volee). Gestion erreurs QUOTA_EXCEEDED / SLUG_TAKEN avec messages utilisateurs. Redirige vers /events/[eventId]/settings (Plan 4 livrera cette page). |
| 12 | [x] | 2026-05-31 | Routes POST archive/restore. Archive : archived=true + archivedAt=now + registrationOpen=false. Restore : archived=false + archivedAt=null. 404 si l'event appartient a une autre org (scope check explicite). Audit EVENT_ARCHIVED / EVENT_RESTORED. 2/2 tests passent. |
| 13 | [x] | 2026-05-31 | GET /api/admin/[orgId]/activity (filtres type/from/to/eventId/userId + pagination cursor take=50, max 200). Page /admin/[orgId]/activity affiche les 100 dernieres entrees scope org avec badge "staff" pour les actions staff. Typage Prisma.ActivityLogWhereInput + Prisma.DateTimeFilter. |
| 14 | [x] | 2026-05-31 | src/app/select/page.tsx (Server Component). Liste les orgs OWNER + entree "Espace staff applicatif" si staff. Cas degeneres : redirect /admin/[orgId] si 1 seule org non-staff, redirect /profile?message=no-org si 0 org non-staff. |
| 15 | [x] | 2026-05-31 | src/lib/org-redirect.ts + tests (8/8). Logique pure : null ctx -> /login ; staff sans hint -> /staff ; staff avec hint -> /admin/[hint] ; client sans org -> /profile?message=no-org ; client avec hint valide -> /admin/[hint] ; client mono-org -> /admin/[onlyOrgId] ; client multi-org sans hint valide -> /select. src/app/page.tsx remplace computeStaffRedirect (Plan v2-02) par resolveHomeRedirect (plus complet). src/lib/staff-redirect.ts + son test supprimes (superseded). |
| 16 | [x] | 2026-05-31 | owner-journey.test.ts (integration via Prisma + fetch + mock `sendUserInvitation`). Test 1 : OWNER cree event "Conf 2026" -> invite Bob (sendUserInvitation appele 1x) -> archive event ; verifie ActivityLog contient EVENT_CREATED, MEMBERSHIP_ADDED, USER_CREATED, EVENT_ARCHIVED, tous staffActor=false. Test 2 : staff PATCH org -> ORG_UPDATED staffActor=true. 2/2 passent. |
| 17 | [x] | 2026-05-31 | Verification finale : 303/303 tests verts (26 fichiers), typecheck OK, lint OK (0 erreurs, 13 warnings mineurs sur badge components). Aucun secret SMTP/reCAPTCHA dans /api/admin/. Aucune reference residuelle OrgSettings (sauf 2 commentaires documentaires de migration). 9 routes API admin + 7 pages admin livrees, conformes a la spec. Doc architecture.md mise a jour avec section "Etat au lot C (post-Plan 3)". Fix infra : composant Input rendu compatible label optionnel (le pattern v2 utilise placeholder seul). |
| 18 | [~] | 2026-05-31 | EN ATTENTE Plan 6 (Lot D). Aucun marqueur `TODO: wired up by Plan 6` / `STUB_PLAN_6` dans le code (verification OK). Les stubs dans src/lib/mail.ts (sendUserInvitation, sendPasswordResetEmail, sendSmtpTest) restent en place et NE PEUVENT PAS etre supprimes tant que Plan v2-06 n'a pas fourni les vraies impls. Task a re-executer apres merge Plan v2-06. |

**Derniere session** : 2026-05-31 - Plan v2-03 entierement implemente (Tasks 0-17 toutes en [x] ; Task 6 [-] supprimee 2026-05-31). Task 18 marquee [~] : depend du merge Plan v2-06 (Lot D) qui fournira les vraies impls email pour remplacer les stubs `sendUserInvitation`/`sendSmtpTest`/`sendPasswordResetEmail` dans `src/lib/mail.ts`. 303/303 tests verts (26 fichiers), typecheck OK, lint OK (0 erreurs, 13 warnings mineurs sur badge components a conserver pour v2-12). Aucun commit (consigne user "continue sans commit").
**Prochaine etape** : Lot C suite -> Plan v2-04 (espace evenement `/admin/[orgId]/events/[eventId]/*`).

**Notes** :
- 2026-05-31 : decision "SMTP plateforme uniquement". Task 5 simplifiee (OrgSettings = contact + reCAPTCHA uniquement) ; Task 6 (`test-smtp` scope org) abandonnee. Voir l'en-tete du plan pour le detail.
- 2026-05-31 : decision "reCAPTCHA plateforme uniquement" (correction du meme jour). Task 5 re-simplifiee : OrgSettings = contact uniquement (`contactEmail`, `contactPhone`). Retrait de tout champ/UI/route/test reCAPTCHA dans `/admin/[orgId]/*`. Le test "defense in depth" du PATCH OrgSettings refuse desormais aussi tout champ reCAPTCHA (HTTP 400). Voir l'en-tete du plan pour le detail.
- 2026-05-31 : decision "enrichissement d'Organization, suppression d'OrgSettings". Task 5 refondue : la route `GET/PATCH /api/admin/[orgId]/settings` disparait, fusion dans la route principale `PATCH /api/admin/[orgId]` qui accepte desormais tous les champs Organization editables (`name`, `legalName`, adresse, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` en OWNER ; `slug` et `quotaMax*` en staff). Tests `prisma.orgSettings.*` remplaces par `prisma.organization.*`. Activity log `ORG_UPDATED` (`ORG_SETTINGS_UPDATED` retire). UI `SettingsClient.tsx` refondue (sections Identite / Adresse / Administratif / Contact public) et POST sur la route principale. Task 17 (greps) ajustee. Voir l'en-tete du plan pour le detail.

---

## File Structure

**Files to create:**

- `src/lib/with-org-auth.ts` (wrapper d'API scope-org)
- `src/lib/__tests__/with-org-auth.test.ts`
- `src/lib/slugify-event.ts` (slugify + suffixage anti-collision)
- `src/lib/__tests__/slugify-event.test.ts`
- `src/lib/org-redirect.ts` (logique de dispatch post-login)
- `src/lib/__tests__/org-redirect.test.ts`
- `src/components/admin/OrgShell.tsx` (layout sidebar/header scope org)
- `src/components/admin/OrgSelector.tsx` (dropdown multi-org + localStorage)
- `src/components/admin/StaffBanner.tsx` (bandeau si accès en mode staff)
- `src/components/admin/EventCreationWizard.tsx` (wizard 3 étapes)
- `src/components/admin/CategoryTemplateForm.tsx`
- `src/components/admin/OrgMemberForm.tsx`
- `src/app/admin/[orgId]/layout.tsx` (OrgShell + checks)
- `src/app/admin/[orgId]/page.tsx` (dashboard)
- `src/app/admin/[orgId]/settings/page.tsx`
- `src/app/admin/[orgId]/members/page.tsx`
- `src/app/admin/[orgId]/templates/page.tsx`
- `src/app/admin/[orgId]/events/page.tsx`
- `src/app/admin/[orgId]/events/new/page.tsx`
- `src/app/admin/[orgId]/activity/page.tsx`
- `src/app/select/page.tsx`
- `src/app/api/admin/[orgId]/route.ts` (GET, PATCH — toutes les infos administratives)
- `src/app/api/admin/[orgId]/members/route.ts` (GET, POST)
- `src/app/api/admin/[orgId]/members/[userId]/route.ts` (DELETE)
- `src/app/api/admin/[orgId]/templates/route.ts` (GET, POST)
- `src/app/api/admin/[orgId]/templates/[id]/route.ts` (PATCH, DELETE)
- `src/app/api/admin/[orgId]/events/route.ts` (GET, POST)
- `src/app/api/admin/[orgId]/events/[eventId]/archive/route.ts` (POST)
- `src/app/api/admin/[orgId]/events/[eventId]/restore/route.ts` (POST)
- `src/app/api/admin/[orgId]/activity/route.ts` (GET)
- `src/lib/__tests__/api-org.test.ts` (tests d'intégration des routes)
- `e2e/owner-journey.spec.ts` (test e2e Playwright optionnel)

**Files to modify:**

- `src/app/page.tsx` (dispatch post-login : staff → `/staff`, single-org → `/admin/[orgId]`, multi-org → `/select`)

**Tests live in `src/lib/__tests__/` (existing convention from v1/Plan 1).**

---

## Pre-flight

### Task 0: Verify Plan 1 and Plan 6 are merged

- [ ] **Step 0.1: Confirm branch and prerequisites**

```bash
git status && git branch --show-current
```

Expected: clean tree on `feat/v2-sass` (ou branche dérivée), with Plan 1 commits already present.

- [ ] **Step 0.2: Verify Plan 1 helpers exist**

```bash
ls src/lib/auth-guards.ts src/lib/user-context.ts src/lib/settings.ts src/lib/activity-log.ts
```

Expected: les 4 fichiers existent. Si l'un est absent, **STOP** : exécuter Plan 1 avant.

- [ ] **Step 0.3: Verify Plan 6 helpers exist (or stub)**

```bash
grep -l "sendUserInvitation" src/lib/mail.ts src/lib/email/ 2>/dev/null || true
```

Si Plan 6 n'est pas merge, créer un stub minimal dans `src/lib/mail.ts` (à supprimer une fois Plan 6 réel) :

```typescript
export async function sendUserInvitation(_userId: string, _opts?: { orgId?: string }): Promise<void> {
  console.warn("[stub] sendUserInvitation called — Plan 6 not yet implemented");
}
```

> Ce stub sera remplacé par la vraie implémentation du Plan 6. Ne pas commit le stub si Plan 6 est déjà mergé. `sendSmtpTest` n'est plus stubbé ici depuis la décision 2026-05-31 : aucune route `/admin/[orgId]/*` ne l'appelle, seules les routes `/staff/*` l'utilisent (couvertes par leur propre plan).

- [ ] **Step 0.4: Run existing tests**

```bash
make test
```

Expected: tous les tests Plan 1 passent.

---

## Task 1: `withOrgAuth` — wrapper d'API scope-org

**Files:**
- Create: `src/lib/with-org-auth.ts`
- Create: `src/lib/__tests__/with-org-auth.test.ts`

> Objectif : un wrapper réutilisable qui (1) récupère la session, (2) extrait `orgId` du path, (3) appelle `requireOrgRole`, (4) délègue au handler avec un contexte typé. Centralise la défense en profondeur côté API.

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/__tests__/with-org-auth.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

describe("withOrgAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/admin/org-1");
    const res = await handler(req, { params: Promise.resolve({ orgId: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not OWNER and not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o1" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("passes for OWNER and exposes ctx", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    let received: { orgId: string; userId: string; isStaff: boolean } | null = null;
    const handler = withOrgAuth("OWNER", async (_req, ctx) => {
      received = { orgId: ctx.orgId, userId: ctx.session.user.id, isStaff: ctx.session.user.isStaff };
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });

    expect(res.status).toBe(200);
    expect(received).toEqual({ orgId: org.id, userId: u.id, isStaff: false });
  });

  it("passes for staff without OrgMembership", async () => {
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o3" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.id, email: s.email, name: s.name, isStaff: true } } as any);

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-org-auth.test.ts
```

Expected: FAIL (`Cannot find module '@/lib/with-org-auth'`).

- [ ] **Step 1.3: Implement `src/lib/with-org-auth.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { OrgRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireOrgRole } from "@/lib/auth-guards";
import { AuthError } from "@/lib/auth-guards";

export type OrgAuthCtx = {
  orgId: string;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string }> };

export function withOrgAuth(
  role: OrgRole,
  handler: (req: NextRequest, ctx: OrgAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  return async (req: NextRequest, params: RouteParams): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params.params;
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    try {
      await requireOrgRole(session.user.id, orgId, role);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    return handler(req, { orgId, session }, params);
  };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-org-auth.test.ts
```

Expected: 4 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/with-org-auth.ts src/lib/__tests__/with-org-auth.test.ts
git commit -m "feat(v2): wrapper withOrgAuth (scope-org pour les routes API)"
```

---

## Task 2: `OrgShell` + `OrgSelector` + `StaffBanner`

**Files:**
- Create: `src/components/admin/OrgShell.tsx`
- Create: `src/components/admin/OrgSelector.tsx`
- Create: `src/components/admin/StaffBanner.tsx`

> Layout commun pour `/admin/[orgId]/*`. Sidebar (Dashboard, Événements, Membres, Modèles, Paramètres, Journal), header avec sélecteur multi-org et avatar user. Bandeau staff si l'accès vient de `isStaff` sans OrgMembership.

- [ ] **Step 2.1: Create `src/components/admin/OrgSelector.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Org = { id: string; name: string; slug: string };

export function OrgSelector({
  currentOrgId,
  orgs,
  isStaff,
}: {
  currentOrgId: string;
  orgs: Org[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem("badge.lastOrgId", currentOrgId);
    }
  }, [currentOrgId]);

  const current = orgs.find((o) => o.id === currentOrgId);

  function switchTo(orgId: string) {
    const newPath = pathname.replace(/^\/admin\/[^/]+/, `/admin/${orgId}`);
    router.push(newPath || `/admin/${orgId}`);
    setOpen(false);
  }

  // Si une seule org et pas staff, on n'affiche rien
  if (orgs.length <= 1 && !isStaff) {
    return <span className="text-sm font-medium">{current?.name}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        <span>{current?.name ?? "Sélectionner"}</span>
        <span aria-hidden>v</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border bg-white shadow-lg z-10">
          <ul className="py-1">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => switchTo(o.id)}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                    o.id === currentOrgId ? "font-semibold" : ""
                  }`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {isStaff && (
              <li className="border-t">
                <button
                  onClick={() => router.push("/staff")}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Toutes les organisations (mode staff)
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.2: Create `src/components/admin/StaffBanner.tsx`**

```typescript
export function StaffBanner({ orgName }: { orgName: string }) {
  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
      <strong>Mode staff</strong> — vous consultez l'organisation <em>{orgName}</em> en tant que
      membre du staff applicatif. Toutes vos actions sont auditées et visibles par le OWNER.
    </div>
  );
}
```

- [ ] **Step 2.3: Create `src/components/admin/OrgShell.tsx`**

```typescript
import Link from "next/link";
import { OrgSelector } from "./OrgSelector";
import { StaffBanner } from "./StaffBanner";

type Org = { id: string; name: string; slug: string };

export function OrgShell({
  org,
  user,
  orgs,
  isStaffMode,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  isStaffMode: boolean;
  children: React.ReactNode;
}) {
  const nav = [
    { href: `/admin/${org.id}`, label: "Tableau de bord" },
    { href: `/admin/${org.id}/events`, label: "Événements" },
    { href: `/admin/${org.id}/members`, label: "Membres" },
    { href: `/admin/${org.id}/templates`, label: "Modèles catégories" },
    { href: `/admin/${org.id}/settings`, label: "Paramètres" },
    { href: `/admin/${org.id}/activity`, label: "Journal" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <div className="text-lg font-bold mb-6">{org.name}</div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-gray-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">
          {user.name}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        {isStaffMode && <StaffBanner orgName={org.name} />}
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">Espace organisation</div>
          <div className="flex items-center gap-4">
            <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
            <Link href="/profile" className="text-sm text-gray-700 hover:underline">
              {user.email}
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4: Type-check**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | grep "src/components/admin/Org\|StaffBanner" || true
```

Expected: aucune erreur sur ces fichiers.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/admin/OrgShell.tsx src/components/admin/OrgSelector.tsx src/components/admin/StaffBanner.tsx
git commit -m "feat(v2): composants OrgShell / OrgSelector / StaffBanner"
```

---

## Task 3: Layout `/admin/[orgId]` + Dashboard

**Files:**
- Create: `src/app/admin/[orgId]/layout.tsx`
- Create: `src/app/admin/[orgId]/page.tsx`
- Create: `src/app/api/admin/[orgId]/route.ts`

> Le layout charge l'org, vérifie l'accès et passe les props à `OrgShell`. La page dashboard agrège des KPI via Prisma.

- [ ] **Step 3.1: Create `src/app/admin/[orgId]/layout.tsx`**

```typescript
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { OrgShell } from "@/components/admin/OrgShell";

export default async function OrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/admin/${orgId}`);

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, archived: true },
  });
  if (!org) notFound();

  if (!hasOrgRole(ctx, orgId, "OWNER")) {
    redirect("/select");
  }

  const orgs = await prisma.organization.findMany({
    where: ctx.isStaff
      ? {}
      : { memberships: { some: { userId: ctx.user.id, role: "OWNER" } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const isStaffMode = ctx.isStaff && !ctx.orgMemberships.some((m) => m.orgId === orgId);

  return (
    <OrgShell
      org={org}
      user={{ name: ctx.user.name, email: ctx.user.email, isStaff: ctx.isStaff }}
      orgs={orgs}
      isStaffMode={isStaffMode}
    >
      {children}
    </OrgShell>
  );
}
```

- [ ] **Step 3.2: Create `src/app/api/admin/[orgId]/route.ts` (GET)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

export const GET = withOrgAuth("OWNER", async (_req, { orgId }) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      createdAt: true,
      quotaMaxEvents: true,
      quotaMaxRegistrations: true,
      quotaMaxStorageMB: true,
      _count: {
        select: {
          events: true,
          memberships: true,
        },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ org });
});
```

- [ ] **Step 3.3: Create `src/app/admin/[orgId]/page.tsx` (dashboard)**

```typescript
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const [eventsActive, eventsArchived, registrationsThisMonth, latestEvents, recentActivity, org] =
    await Promise.all([
      prisma.event.count({ where: { orgId, archived: false } }),
      prisma.event.count({ where: { orgId, archived: true } }),
      prisma.registration.count({
        where: {
          event: { orgId },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.event.findMany({
        where: { orgId, archived: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, slug: true, date: true, registrationOpen: true },
      }),
      prisma.activityLog.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, createdAt: true, staffActor: true, details: true },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { quotaMaxEvents: true, quotaMaxRegistrations: true },
      }),
    ]);

  const eventsPct =
    org?.quotaMaxEvents != null ? Math.round((eventsActive / org.quotaMaxEvents) * 100) : null;
  const regsPct =
    org?.quotaMaxRegistrations != null
      ? Math.round((registrationsThisMonth / org.quotaMaxRegistrations) * 100)
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Événements actifs" value={eventsActive} />
        <Kpi label="Événements archivés" value={eventsArchived} />
        <Kpi label="Inscriptions ce mois" value={registrationsThisMonth} />
        <Kpi
          label="Quota events"
          value={org?.quotaMaxEvents != null ? `${eventsActive}/${org.quotaMaxEvents}` : "—"}
          warn={eventsPct != null && eventsPct > 80}
        />
      </div>

      {(eventsPct != null && eventsPct > 80) || (regsPct != null && regsPct > 80) ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Un quota dépasse 80 %. Contactez le support si vous prévoyez d'aller plus loin.
        </div>
      ) : null}

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Derniers événements</h2>
          <Link href={`/admin/${orgId}/events`} className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {latestEvents.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucun événement pour le moment.</li>
          )}
          {latestEvents.map((e) => (
            <li key={e.id} className="px-4 py-3 flex justify-between">
              <Link href={`/admin/${orgId}/events/${e.id}`} className="text-sm hover:underline">
                {e.title}
              </Link>
              <span className="text-xs text-gray-500">
                {new Date(e.date).toLocaleDateString("fr-FR")}
                {e.registrationOpen ? " — inscriptions ouvertes" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Journal récent</h2>
        <ul className="bg-white border rounded divide-y">
          {recentActivity.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucune activité récente.</li>
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
              <span className="text-gray-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div
      className={`rounded border p-4 bg-white ${
        warn ? "border-amber-400 bg-amber-50" : "border-gray-200"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3.4: Manual smoke test**

```bash
make dev
```

Puis se connecter en STAFF_ADMIN, créer manuellement une org + OrgMembership en DB, et ouvrir `http://localhost:3000/admin/<orgId>`.

Expected : sidebar OrgShell affichée, KPI à 0, bandeau "Mode staff" si le user est staff sans OrgMembership.

- [ ] **Step 3.5: Commit**

```bash
git add src/app/admin/[orgId]/layout.tsx src/app/admin/[orgId]/page.tsx src/app/api/admin/[orgId]/route.ts
git commit -m "feat(v2): layout /admin/[orgId] + dashboard org + GET /api/admin/[orgId]"
```

---

## Task 4: `PATCH /api/admin/[orgId]` — modifier nom (OWNER) / slug (staff)

**Files:**
- Modify: `src/app/api/admin/[orgId]/route.ts` (ajout PATCH)
- Create test entries in `src/lib/__tests__/api-org.test.ts`

> Règle (note 2026-05-31) : ce premier squelette du PATCH ne couvre que `name` (OWNER) et `slug` (staff). La Task 5, refondue le 2026-05-31 suite à la fusion `OrgSettings → Organization`, **étend** ce même handler pour gérer tous les autres champs administratifs (`legalName`, adresse, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` en OWNER ; `quotaMax*` en staff). Cette Task 4 reste donc le squelette de base ; les tests et le code complet vivent en Task 5. Audit `ORG_UPDATED` (staffActor auto).

- [ ] **Step 4.1: Write failing test in `src/lib/__tests__/api-org.test.ts`**

Create the file with the first test :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

describe("PATCH /api/admin/[orgId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OWNER can update name but not slug", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "old" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New", slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.name).toBe("New");
    expect(updated?.slug).toBe("old"); // slug ignored for non-staff
  });

  it("staff can update slug", async () => {
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "old" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.slug).toBe("new-slug");
  });

  it("ORG_UPDATED log written with staffActor=true for staff", async () => {
    const s = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "olda" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED", orgId: org.id } });
    expect(log?.staffActor).toBe(true);
  });
});
```

- [ ] **Step 4.2: Run test (expected to fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: FAIL (PATCH not exported yet).

- [ ] **Step 4.3: Add PATCH handler to `src/app/api/admin/[orgId]/route.ts`**

```typescript
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
});

export const PATCH = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const data: { name?: string; slug?: string } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.slug && session.user.isStaff) data.slug = parsed.data.slug;

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
    if (err.code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: 3 passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/app/api/admin/[orgId]/route.ts src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): PATCH /api/admin/[orgId] (nom OWNER, slug staff)"
```

---

## Task 5: `Organization` — GET / PATCH (infos administratives complètes)

**Files:**
- Modify: `src/app/api/admin/[orgId]/route.ts` (étend PATCH pour gérer toutes les infos administratives)
- Create: `src/app/admin/[orgId]/settings/page.tsx`
- Create: `src/app/admin/[orgId]/settings/SettingsClient.tsx`
- Add tests in `src/lib/__tests__/api-org.test.ts`

> **Refondue 2026-05-31** : suite à la décision de design 2026-05-31 (enrichissement d'`Organization`, suppression d'`OrgSettings`), la route `GET/PATCH /api/admin/[orgId]/settings` **disparaît**. Toutes les infos administratives sont éditées via la route principale `PATCH /api/admin/[orgId]` (Task 4), étendue ici pour accepter tous les champs `Organization` éditables : `name`, `legalName`, `addressLine1`, `addressLine2`, `postalCode`, `city`, `country`, `taxId`, `website`, `logo`, `contactEmail`, `contactPhone` (tous réservés à `OWNER`), ainsi que `slug` et `quotaMaxEvents`/`quotaMaxRegistrations`/`quotaMaxStorageMB` (réservés au **staff**). Tout champ SMTP ou reCAPTCHA envoyé par un client legacy est refusé en HTTP 400 (defense in depth — SMTP et reCAPTCHA vivent dans `PlatformSettings` uniquement). Audit `ORG_UPDATED` (le type `ORG_SETTINGS_UPDATED` n'existe plus).

- [ ] **Step 5.1: Add failing tests**

Append to `src/lib/__tests__/api-org.test.ts` :

```typescript
describe("PATCH /api/admin/[orgId] — infos administratives (Task 5)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OWNER updates legalName, address, taxId, website, logo, contact", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-admin" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        legalName: "Acme SAS",
        addressLine1: "1 rue de Paris",
        addressLine2: "Bat. A",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
        taxId: "FR12345678901",
        website: "https://acme.example",
        logo: "/uploads/acme.png",
        contactEmail: "contact@acme.example",
        contactPhone: "+33123456789",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.legalName).toBe("Acme SAS");
    expect(updated?.addressLine1).toBe("1 rue de Paris");
    expect(updated?.addressLine2).toBe("Bat. A");
    expect(updated?.postalCode).toBe("75001");
    expect(updated?.city).toBe("Paris");
    expect(updated?.country).toBe("FR");
    expect(updated?.taxId).toBe("FR12345678901");
    expect(updated?.website).toBe("https://acme.example");
    expect(updated?.logo).toBe("/uploads/acme.png");
    expect(updated?.contactEmail).toBe("contact@acme.example");
    expect(updated?.contactPhone).toBe("+33123456789");

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED", orgId: org.id } });
    expect(log).toBeTruthy();
    expect(log?.staffActor).toBe(false);
  });

  it("MANAGER (non-OWNER membership) is refused with HTTP 403", async () => {
    const u = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-mgr" } });
    // Pas d'OrgMembership pour ce user => requireOrgRole rejette.
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ legalName: "Acme SAS" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("OWNER cannot edit slug (silently ignored, only staff can)", async () => {
    const u = await prisma.user.create({ data: { email: "o2@x", password: "x", name: "O2" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "keep-slug" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "owner-attempt" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400); // NOTHING_TO_UPDATE car slug filtre cote serveur

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.slug).toBe("keep-slug");
  });

  it("OWNER cannot edit quotaMaxEvents (silently ignored, only staff can)", async () => {
    const u = await prisma.user.create({ data: { email: "o3@x", password: "x", name: "O3" } });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "keep-quota", quotaMaxEvents: 5 },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ quotaMaxEvents: 999 }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400); // NOTHING_TO_UPDATE car quota filtre cote serveur

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.quotaMaxEvents).toBe(5);
  });

  it("rejects legacy SMTP and reCAPTCHA fields with HTTP 400 (defense in depth)", async () => {
    // Depuis 2026-05-31, SMTP et reCAPTCHA sont geres uniquement au niveau PlatformSettings.
    // Un client legacy qui tenterait un PATCH avec smtpHost/smtpPassword ou recaptcha* doit etre refuse.
    const u = await prisma.user.create({ data: { email: "o4@x", password: "x", name: "O4" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "no-secrets" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");

    // SMTP refuse
    const reqSmtp = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "smtp.example.com", smtpPassword: "secret" }),
      headers: { "content-type": "application/json" },
    });
    const resSmtp = await PATCH(reqSmtp, { params: Promise.resolve({ orgId: org.id }) });
    expect(resSmtp.status).toBe(400);

    // reCAPTCHA refuse
    const reqCaptcha = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ recaptchaEnabled: true, recaptchaSiteKey: "sk", recaptchaSecretKey: "secret" }),
      headers: { "content-type": "application/json" },
    });
    const resCaptcha = await PATCH(reqCaptcha, { params: Promise.resolve({ orgId: org.id }) });
    expect(resCaptcha.status).toBe(400);
  });
});
```

- [ ] **Step 5.2: Run tests (expected to fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: FAIL (le PATCH de Task 4 ne gere encore que name + slug).

- [ ] **Step 5.3: Étendre `src/app/api/admin/[orgId]/route.ts`**

Remplacer le `patchSchema` et le handler PATCH par la version etendue qui couvre tous les champs administratifs. Le schema Zod utilise `.strict()` pour refuser tout champ inconnu (defense in depth contre SMTP/reCAPTCHA legacy).

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";

// Note (2026-05-31) : OrgSettings supprime. Tous les champs administratifs vivent
// dans Organization. Le schema .strict() refuse tout champ SMTP/reCAPTCHA legacy
// (SMTP et reCAPTCHA sont geres uniquement dans PlatformSettings).
const patchSchema = z
  .object({
    // OWNER editable
    name: z.string().min(1).max(120).optional(),
    legalName: z.string().max(200).nullable().optional(),
    addressLine1: z.string().max(200).nullable().optional(),
    addressLine2: z.string().max(200).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    taxId: z.string().max(50).nullable().optional(),
    website: z.string().url().max(255).nullable().optional(),
    logo: z.string().max(500).nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().max(50).nullable().optional(),
    // Staff-only
    slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
    quotaMaxEvents: z.number().int().min(0).nullable().optional(),
    quotaMaxRegistrations: z.number().int().min(0).nullable().optional(),
    quotaMaxStorageMB: z.number().int().min(0).nullable().optional(),
  })
  .strict();

const OWNER_FIELDS = [
  "name",
  "legalName",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "country",
  "taxId",
  "website",
  "logo",
  "contactEmail",
  "contactPhone",
] as const;

const STAFF_FIELDS = [
  "slug",
  "quotaMaxEvents",
  "quotaMaxRegistrations",
  "quotaMaxStorageMB",
] as const;

export const PATCH = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const isStaff = session.user.isStaff;
  const data: Record<string, unknown> = {};
  for (const k of OWNER_FIELDS) {
    if (k in parsed.data) data[k] = (parsed.data as Record<string, unknown>)[k];
  }
  if (isStaff) {
    for (const k of STAFF_FIELDS) {
      if (k in parsed.data) data[k] = (parsed.data as Record<string, unknown>)[k];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const org = await prisma.organization.update({ where: { id: orgId }, data });
    await logActivity({
      type: "ORG_UPDATED",
      userId: session.user.id,
      orgId,
      details: { changedFields: Object.keys(data) },
      req,
    });
    return NextResponse.json({ org });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 5.4: Create `src/app/admin/[orgId]/settings/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Note (2026-05-31) : OrgSettings supprime. On lit tout depuis Organization.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      taxId: true,
      website: true,
      logo: true,
      contactEmail: true,
      contactPhone: true,
    },
  });
  if (!org) throw new Error("Org not found");

  return <SettingsClient orgId={orgId} initialOrg={org} />;
}
```

- [ ] **Step 5.5: Create `src/app/admin/[orgId]/settings/SettingsClient.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type OrgForm = {
  name: string;
  legalName: string | null;
  slug: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  website: string | null;
  logo: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function SettingsClient({
  orgId,
  initialOrg,
}: {
  orgId: string;
  initialOrg: OrgForm;
}) {
  const [org, setOrg] = useState<OrgForm>(initialOrg);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
    setOrg((o) => ({ ...o, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    // PATCH sur la route principale (plus de /settings depuis 2026-05-31).
    // On envoie tous les champs editables OWNER. Slug et quotas sont filtres cote serveur (staff only).
    const res = await fetch(`/api/admin/${orgId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: org.name,
        legalName: org.legalName,
        addressLine1: org.addressLine1,
        addressLine2: org.addressLine2,
        postalCode: org.postalCode,
        city: org.city,
        country: org.country,
        taxId: org.taxId,
        website: org.website,
        logo: org.logo,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Paramètres enregistrés.");
    } else {
      setMsg("Erreur lors de l'enregistrement.");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres de l'organisation</h1>
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>}

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Identité</h2>
        <div>
          <label className="text-sm text-gray-600">Nom</label>
          <Input value={org.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Raison sociale</label>
          <Input
            value={org.legalName ?? ""}
            onChange={(e) => set("legalName", e.target.value || null)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Slug</label>
          <Input value={org.slug} disabled />
          <p className="text-xs text-gray-500 mt-1">Modifiable par le staff uniquement.</p>
        </div>
        <div>
          <label className="text-sm text-gray-600">Logo (URL)</label>
          <Input
            placeholder="/uploads/logo.png"
            value={org.logo ?? ""}
            onChange={(e) => set("logo", e.target.value || null)}
          />
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Adresse</h2>
        <Input
          placeholder="Ligne 1"
          value={org.addressLine1 ?? ""}
          onChange={(e) => set("addressLine1", e.target.value || null)}
        />
        <Input
          placeholder="Ligne 2"
          value={org.addressLine2 ?? ""}
          onChange={(e) => set("addressLine2", e.target.value || null)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Code postal"
            value={org.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value || null)}
          />
          <Input
            placeholder="Ville"
            value={org.city ?? ""}
            onChange={(e) => set("city", e.target.value || null)}
          />
        </div>
        <Input
          placeholder="Pays"
          value={org.country ?? ""}
          onChange={(e) => set("country", e.target.value || null)}
        />
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Administratif</h2>
        <div>
          <label className="text-sm text-gray-600">Numéro fiscal / SIRET</label>
          <Input
            value={org.taxId ?? ""}
            onChange={(e) => set("taxId", e.target.value || null)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Site web</label>
          <Input
            placeholder="https://exemple.fr"
            value={org.website ?? ""}
            onChange={(e) => set("website", e.target.value || null)}
          />
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Contact public</h2>
        <Input
          placeholder="contact@exemple.fr"
          value={org.contactEmail ?? ""}
          onChange={(e) => set("contactEmail", e.target.value || null)}
        />
        <Input
          placeholder="+33 1 23 45 67 89"
          value={org.contactPhone ?? ""}
          onChange={(e) => set("contactPhone", e.target.value || null)}
        />
      </section>

      <Button onClick={save} disabled={saving}>
        Enregistrer
      </Button>

      {/* Note 2026-05-31 : SMTP et reCAPTCHA vivent uniquement au niveau PlatformSettings (geres par le staff).
          Aucun formulaire SMTP, "Tester SMTP" ou reCAPTCHA n'est expose dans /admin/[orgId]/*. */}
    </div>
  );
}
```

- [ ] **Step 5.6: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: tests précédents + 5 nouveaux passent (OWNER edit toutes les infos, MANAGER 403, OWNER refuse slug, OWNER refuse quotaMaxEvents, refus SMTP/reCAPTCHA legacy HTTP 400).

- [ ] **Step 5.7: Commit**

```bash
git add src/app/api/admin/[orgId]/route.ts src/app/admin/[orgId]/settings src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): PATCH /api/admin/[orgId] etendu (infos administratives completes) + page settings"
```

---

## Task 6: `POST /api/admin/[orgId]/settings/test-smtp` — SUPPRIMEE (2026-05-31)

> **Statut** : `[-]` abandonnee. **Raison** : decision de design 2026-05-31 — le SMTP vit uniquement au niveau `PlatformSettings`. Aucun override SMTP au niveau organisation, donc aucune route "test SMTP" scope org. La fonction `sendSmtpTest` reste fournie par Plan 6, mais n'est appelee que par les routes staff (`/staff/*`, couvertes par leur propre plan). Voir l'en-tete de ce plan et `docs/v2/features/espace-organisation.md` pour le detail.
>
> Ne rien implementer pour cette task. Aucun fichier `src/app/api/admin/[orgId]/settings/test-smtp/route.ts` ne doit etre cree. Passer directement a la Task 7.

---

## Task 7: Routes `OrgMembership` (members)

**Files:**
- Create: `src/app/api/admin/[orgId]/members/route.ts` (GET, POST)
- Create: `src/app/api/admin/[orgId]/members/[userId]/route.ts` (DELETE)
- Create: `src/app/admin/[orgId]/members/page.tsx`
- Create: `src/components/admin/OrgMemberForm.tsx`
- Add tests in `src/lib/__tests__/api-org.test.ts`

> Règles :
> - `GET` : liste des OrgMembership (id, user.name, user.email, createdAt, lastLogin via `ActivityLog.USER_LOGIN`)
> - `POST` (invite) : si user existe → ajoute juste OrgMembership (email d'information) ; sinon crée user + inviteToken (24h) + envoie `sendUserInvitation(userId, { orgId })`
> - `DELETE` : refuse si c'est le dernier OWNER → HTTP 409 `code=LAST_OWNER`
> - Audit `MEMBERSHIP_ADDED`, `MEMBERSHIP_REMOVED`

- [ ] **Step 7.1: Append failing test in `src/lib/__tests__/api-org.test.ts`**

```typescript
describe("POST /api/admin/[orgId]/members", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates user + membership if user does not exist", async () => {
    const inviter = await prisma.user.create({ data: { email: "i@x", password: "x", name: "I" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "m-o" } });
    await prisma.orgMembership.create({ data: { userId: inviter.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: inviter.id, email: inviter.email, name: inviter.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "new@x", name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const u = await prisma.user.findUnique({ where: { email: "new@x" } });
    expect(u).not.toBeNull();
    expect(u?.inviteToken).not.toBeNull();
    const m = await prisma.orgMembership.findFirst({ where: { userId: u!.id, orgId: org.id } });
    expect(m?.role).toBe("OWNER");
  });

  it("adds membership only if user already exists", async () => {
    const inviter = await prisma.user.create({ data: { email: "i@x", password: "x", name: "I" } });
    const existing = await prisma.user.create({ data: { email: "existing@x", password: "x", name: "E" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "m-o2" } });
    await prisma.orgMembership.create({ data: { userId: inviter.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: inviter.id, email: inviter.email, name: inviter.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "existing@x", name: "E" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const u = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(u?.inviteToken).toBeNull(); // existing user not re-invited
  });
});

describe("DELETE /api/admin/[orgId]/members/[userId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("refuses to remove the last OWNER (409 LAST_OWNER)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "del-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/members/[userId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members/${u.id}`, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, userId: u.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("LAST_OWNER");
  });

  it("allows removing one OWNER when 2+ exist", async () => {
    const a = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const b = await prisma.user.create({ data: { email: "b@x", password: "x", name: "B" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "del-o2" } });
    await prisma.orgMembership.create({ data: { userId: a.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: b.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: a.id, email: a.email, name: a.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/members/[userId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members/${b.id}`, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, userId: b.id }) });
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 7.2: Run tests (expected to fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: FAIL (routes not created).

- [ ] **Step 7.3: Create `src/app/api/admin/[orgId]/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";

export const GET = withOrgAuth("OWNER", async (_req, { orgId }) => {
  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          archived: true,
          activityLogs: {
            where: { type: "USER_LOGIN" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items = memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    archived: m.user.archived,
    role: m.role,
    invitedAt: m.createdAt,
    lastLoginAt: m.user.activityLogs[0]?.createdAt ?? null,
  }));
  return NextResponse.json({ members: items });
});

const inviteSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  name: z.string().min(1).max(120),
});

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, name } = parsed.data;

  let user = await prisma.user.findUnique({ where: { email } });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const inviteToken = randomBytes(24).toString("hex");
    const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user = await prisma.user.create({
      data: {
        email,
        name,
        password: "", // forces password setup via inviteToken flow
        inviteToken,
        inviteTokenExpiry,
      },
    });
    await logActivity({
      type: "USER_CREATED",
      userId: session.user.id,
      orgId,
      targetId: user.id,
      details: { email, name, viaOrgInvite: true },
      req,
    });
  }

  // Idempotency : if already member, return existing without error
  const existingMembership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });
  if (existingMembership) {
    return NextResponse.json({ ok: true, alreadyMember: true }, { status: 200 });
  }

  await prisma.orgMembership.create({ data: { userId: user.id, orgId, role: "OWNER" } });

  await logActivity({
    type: "MEMBERSHIP_ADDED",
    userId: session.user.id,
    orgId,
    targetId: user.id,
    details: { role: "OWNER", isNewUser },
    req,
  });

  try {
    await sendUserInvitation(user.id, { orgId });
  } catch (err) {
    // log but do not fail the response
    console.error("[invite] email failed", err);
  }

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
});
```

- [ ] **Step 7.4: Create `src/app/api/admin/[orgId]/members/[userId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; userId: string }> };

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, userId } = await params;
  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    throw err;
  }

  const ownerCount = await prisma.orgMembership.count({ where: { orgId, role: "OWNER" } });
  const target = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (target.role === "OWNER" && ownerCount <= 1) {
    return NextResponse.json({ error: "Last OWNER cannot be removed", code: "LAST_OWNER" }, { status: 409 });
  }

  await prisma.orgMembership.delete({ where: { id: target.id } });
  await logActivity({
    type: "MEMBERSHIP_REMOVED",
    userId: session.user.id,
    orgId,
    targetId: userId,
    details: { role: target.role },
    req,
  });

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 7.5: Create `src/components/admin/OrgMemberForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function OrgMemberForm({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr("Échec de l'invitation.");
      return;
    }
    setEmail("");
    setName("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">Inviter un OWNER</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        type="email"
        placeholder="email@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi..." : "Inviter"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7.6: Create `src/app/admin/[orgId]/members/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./MembersClient";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true, archived: true } } },
    orderBy: { createdAt: "asc" },
  });

  const items = memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    archived: m.user.archived,
    role: m.role,
    invitedAt: m.createdAt.toISOString(),
  }));

  return <MembersClient orgId={orgId} initial={items} />;
}
```

- [ ] **Step 7.7: Create `src/app/admin/[orgId]/members/MembersClient.tsx`**

```typescript
"use client";

import { useState } from "react";
import { OrgMemberForm } from "@/components/admin/OrgMemberForm";
import { Button } from "@/components/ui/Button";

type Member = {
  userId: string;
  email: string;
  name: string;
  archived: boolean;
  role: string;
  invitedAt: string;
};

export function MembersClient({ orgId, initial }: { orgId: string; initial: Member[] }) {
  const [members, setMembers] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/members`);
    const json = await res.json();
    setMembers(
      (json.members as any[]).map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.name,
        archived: m.archived,
        role: m.role,
        invitedAt: new Date(m.invitedAt).toISOString(),
      })),
    );
  }

  async function remove(userId: string) {
    setErr(null);
    if (!confirm("Retirer ce membre ?")) return;
    const res = await fetch(`/api/admin/${orgId}/members/${userId}`, { method: "DELETE" });
    if (res.status === 409) {
      setErr("Impossible : c'est le dernier OWNER.");
      return;
    }
    if (!res.ok) {
      setErr("Échec.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Membres</h1>
      {err && <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}

      <OrgMemberForm orgId={orgId} onAdded={refresh} />

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Rôle</th>
            <th className="px-3 py-2">Invité le</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t">
              <td className="px-3 py-2">{m.name}</td>
              <td className="px-3 py-2">{m.email}</td>
              <td className="px-3 py-2">{m.role}</td>
              <td className="px-3 py-2">{new Date(m.invitedAt).toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(m.userId)}>
                  Retirer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7.8: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: tous les tests passent (incluant LAST_OWNER 409).

- [ ] **Step 7.9: Commit**

```bash
git add src/app/api/admin/[orgId]/members src/app/admin/[orgId]/members src/components/admin/OrgMemberForm.tsx src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): gestion des OWNER (GET/POST/DELETE) + page members"
```

---

## Task 8: `CategoryTemplate` — GET/POST/PATCH/DELETE

**Files:**
- Create: `src/app/api/admin/[orgId]/templates/route.ts` (GET, POST)
- Create: `src/app/api/admin/[orgId]/templates/[id]/route.ts` (PATCH, DELETE)
- Create: `src/app/admin/[orgId]/templates/page.tsx`
- Create: `src/components/admin/CategoryTemplateForm.tsx`
- Add tests in `src/lib/__tests__/api-org.test.ts`

> Validations : `number` entier ≥ 0, `color` regex `/^#[0-9a-fA-F]{6}$/`, `name` non vide. Audit `CATEGORY_TEMPLATE_*`.

- [ ] **Step 8.1: Append failing tests**

```typescript
describe("Templates CRUD", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates template and writes audit", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: "Délégué", color: "#ff0000", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const tpl = await prisma.categoryTemplate.findFirst({ where: { orgId: org.id } });
    expect(tpl?.name).toBe("Délégué");
    const log = await prisma.activityLog.findFirst({ where: { type: "CATEGORY_TEMPLATE_CREATED" } });
    expect(log?.orgId).toBe(org.id);
  });

  it("rejects invalid color", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-o2" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: "X", color: "red", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 8.2: Create `src/app/api/admin/[orgId]/templates/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  number: z.number().int().min(0).max(999),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export const GET = withOrgAuth("OWNER", async (_req, { orgId }) => {
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ templates });
});

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const template = await prisma.categoryTemplate.create({
    data: { orgId, ...parsed.data },
  });

  await logActivity({
    type: "CATEGORY_TEMPLATE_CREATED",
    userId: session.user.id,
    orgId,
    targetId: template.id,
    details: parsed.data,
    req,
  });

  return NextResponse.json({ template }, { status: 201 });
});
```

- [ ] **Step 8.3: Create `src/app/api/admin/[orgId]/templates/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  number: z.number().int().min(0).max(999).optional(),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

async function authorize(orgId: string): Promise<{ userId: string } | Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    throw err;
  }
  return { userId: session.user.id };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params;
  const auth = await authorize(orgId);
  if (auth instanceof Response) return auth;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.categoryTemplate.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const updated = await prisma.categoryTemplate.update({ where: { id }, data: parsed.data });
  await logActivity({
    type: "CATEGORY_TEMPLATE_UPDATED",
    userId: auth.userId,
    orgId,
    targetId: id,
    details: parsed.data,
    req,
  });
  return NextResponse.json({ template: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params;
  const auth = await authorize(orgId);
  if (auth instanceof Response) return auth;

  const existing = await prisma.categoryTemplate.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.categoryTemplate.delete({ where: { id } });
  await logActivity({
    type: "CATEGORY_TEMPLATE_DELETED",
    userId: auth.userId,
    orgId,
    targetId: id,
    details: { name: existing.name },
    req,
  });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 8.4: Create `src/components/admin/CategoryTemplateForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CategoryTemplateForm({
  orgId,
  initial,
  onSaved,
}: {
  orgId: string;
  initial?: { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#0066cc");
  const [number, setNumber] = useState(initial?.number ?? 0);
  const [neutralBadge, setNeutralBadge] = useState(initial?.neutralBadge ?? false);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const url = initial
      ? `/api/admin/${orgId}/templates/${initial.id}`
      : `/api/admin/${orgId}/templates`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, number, neutralBadge, anonymous }),
    });
    if (!res.ok) {
      setErr("Échec.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">{initial ? "Modifier" : "Nouveau"} modèle</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <Input
        type="number"
        value={number}
        onChange={(e) => setNumber(Number(e.target.value))}
        min={0}
        max={999}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={neutralBadge}
          onChange={(e) => setNeutralBadge(e.target.checked)}
        />
        Badge neutre
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        Anonyme (pas de photo/nom sur badge)
      </label>
      <Button type="submit">{initial ? "Mettre à jour" : "Créer"}</Button>
    </form>
  );
}
```

- [ ] **Step 8.5: Create `src/app/admin/[orgId]/templates/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "./TemplatesClient";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
  });
  return <TemplatesClient orgId={orgId} initial={templates.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))} />;
}
```

- [ ] **Step 8.6: Create `src/app/admin/[orgId]/templates/TemplatesClient.tsx`**

```typescript
"use client";

import { useState } from "react";
import { CategoryTemplateForm } from "@/components/admin/CategoryTemplateForm";
import { Button } from "@/components/ui/Button";

type Tpl = { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean; createdAt: string };

export function TemplatesClient({ orgId, initial }: { orgId: string; initial: Tpl[] }) {
  const [templates, setTemplates] = useState(initial);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/templates`);
    const json = await res.json();
    setTemplates(json.templates.map((t: any) => ({ ...t, createdAt: t.createdAt })));
    setEditing(null);
    setAdding(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce modèle ?")) return;
    await fetch(`/api/admin/${orgId}/templates/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Modèles de catégories</h1>
        {!adding && !editing && <Button onClick={() => setAdding(true)}>Nouveau modèle</Button>}
      </div>

      {adding && <CategoryTemplateForm orgId={orgId} onSaved={refresh} />}
      {editing && <CategoryTemplateForm orgId={orgId} initial={editing} onSaved={refresh} />}

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Couleur</th>
            <th className="px-3 py-2">Neutre</th>
            <th className="px-3 py-2">Anonyme</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-3 py-2">{t.number}</td>
              <td className="px-3 py-2">{t.name}</td>
              <td className="px-3 py-2">
                <span className="inline-block w-4 h-4 rounded mr-1 align-middle" style={{ background: t.color }} />
                {t.color}
              </td>
              <td className="px-3 py-2">{t.neutralBadge ? "oui" : "non"}</td>
              <td className="px-3 py-2">{t.anonymous ? "oui" : "non"}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <Button variant="secondary" onClick={() => setEditing(t)}>Éditer</Button>
                <Button variant="secondary" onClick={() => remove(t.id)}>Supprimer</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8.7: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: tous passent.

- [ ] **Step 8.8: Commit**

```bash
git add src/app/api/admin/[orgId]/templates src/app/admin/[orgId]/templates src/components/admin/CategoryTemplateForm.tsx src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): CRUD CategoryTemplate + page templates"
```

---

## Task 9: `GET /api/admin/[orgId]/events` + page liste

**Files:**
- Create: `src/app/api/admin/[orgId]/events/route.ts` (GET seulement pour l'instant)
- Create: `src/app/admin/[orgId]/events/page.tsx`

> Filtres acceptés en query : `archived` (`true`/`false`), `registrationOpen` (`true`/`false`). Inclut `_count.registrations`.

- [ ] **Step 9.1: Create `src/app/api/admin/[orgId]/events/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

export const GET = withOrgAuth("OWNER", async (req, { orgId }) => {
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived");
  const registrationOpen = url.searchParams.get("registrationOpen");

  const where: any = { orgId };
  if (archived !== null) where.archived = archived === "true";
  if (registrationOpen !== null) where.registrationOpen = registrationOpen === "true";

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      location: true,
      registrationOpen: true,
      archived: true,
      createdAt: true,
      _count: { select: { registrations: true } },
    },
  });
  return NextResponse.json({ events });
});
```

- [ ] **Step 9.2: Create `src/app/admin/[orgId]/events/page.tsx`**

```typescript
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";

export default async function EventsListPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const events = await prisma.event.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      location: true,
      registrationOpen: true,
      archived: true,
      _count: { select: { registrations: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Événements</h1>
        <Link href={`/admin/${orgId}/events/new`}>
          <Button>Nouvel événement</Button>
        </Link>
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Titre</th>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Lieu</th>
            <th className="px-3 py-2">Inscriptions</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                Aucun événement. Créez votre premier événement.
              </td>
            </tr>
          )}
          {events.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-3 py-2 font-medium">
                <Link href={`/admin/${orgId}/events/${e.id}`} className="hover:underline">
                  {e.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-500">{e.slug}</td>
              <td className="px-3 py-2">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-2">{e.location}</td>
              <td className="px-3 py-2">{e._count.registrations}</td>
              <td className="px-3 py-2">
                {e.archived ? (
                  <span className="px-2 py-0.5 rounded bg-gray-200 text-xs">Archivé</span>
                ) : e.registrationOpen ? (
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">Inscriptions ouvertes</span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">Fermé</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Link href={`/admin/${orgId}/events/${e.id}/settings`} className="text-blue-600 hover:underline text-sm">
                  Configurer
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 9.3: Commit**

```bash
git add src/app/api/admin/[orgId]/events/route.ts src/app/admin/[orgId]/events/page.tsx
git commit -m "feat(v2): GET /api/admin/[orgId]/events + page liste"
```

---

## Task 10: `slugifyEvent` helper + `POST /api/admin/[orgId]/events`

**Files:**
- Create: `src/lib/slugify-event.ts`
- Create: `src/lib/__tests__/slugify-event.test.ts`
- Modify: `src/app/api/admin/[orgId]/events/route.ts` (ajout POST)
- Add tests in `src/lib/__tests__/api-org.test.ts`

> Règles création :
> - Vérifier `quotaMaxEvents` via `prisma.event.count({ where: { orgId, archived: false } })`. Si dépassé → HTTP 409 `code=QUOTA_EXCEEDED`.
> - Générer slug global unique : `slugify(title)`, puis `-2`, `-3`, … si collision.
> - Si `templateIds` fournis → copier en `Category` (name, color, number, neutralBadge, anonymous).
> - Vérifier unicité de `number` au sein de l'event (les templates copiés peuvent avoir le même `number` → renuméroter à 1, 2, 3 dans l'ordre).
> - `registrationOpen=false` par défaut.
> - Audit `EVENT_CREATED`.

- [ ] **Step 10.1: Write failing tests for slugify-event**

Create `src/lib/__tests__/slugify-event.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { slugifyEvent, uniqueEventSlug } from "@/lib/slugify-event";

describe("slugifyEvent", () => {
  it("normalizes accents and case", () => {
    expect(slugifyEvent("Conférence À Paris")).toBe("conference-a-paris");
  });
  it("strips punctuation and special chars", () => {
    expect(slugifyEvent("Hello, World! / 2026")).toBe("hello-world-2026");
  });
  it("collapses spaces and trims dashes", () => {
    expect(slugifyEvent("  Multi   Space  ")).toBe("multi-space");
  });
  it("preserves digits", () => {
    expect(slugifyEvent("Edition 2026 Paris")).toBe("edition-2026-paris");
  });
});

describe("uniqueEventSlug", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("returns base slug if no collision", async () => {
    const slug = await uniqueEventSlug("Conférence Paris");
    expect(slug).toBe("conference-paris");
  });

  it("appends -2 on collision", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-uniq" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "conference-paris", location: "", date: new Date() },
    });
    const slug = await uniqueEventSlug("Conférence Paris");
    expect(slug).toBe("conference-paris-2");
  });

  it("appends -3 if -2 already taken", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-uniq2" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "x", location: "", date: new Date() },
    });
    await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "x-2", location: "", date: new Date() },
    });
    const slug = await uniqueEventSlug("X");
    expect(slug).toBe("x-3");
  });
});
```

- [ ] **Step 10.2: Implement `src/lib/slugify-event.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export function slugifyEvent(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export async function uniqueEventSlug(title: string): Promise<string> {
  const base = slugifyEvent(title) || "event";
  let candidate = base;
  let i = 2;
  // Loop until candidate is free
  // We tolerate small TOCTOU race: caller wraps creation in try/catch on P2002
  // and re-runs this function.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.event.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
    i++;
    if (i > 1000) throw new Error("Slug allocation exhausted");
  }
}
```

- [ ] **Step 10.3: Run slugify tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/slugify-event.test.ts
```

Expected: 7 passed.

- [ ] **Step 10.4: Append failing event-create test in `src/lib/__tests__/api-org.test.ts`**

```typescript
describe("POST /api/admin/[orgId]/events", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates event with unique slug and registrationOpen=false", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "Conférence Paris 2026", location: "Paris", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const event = await prisma.event.findFirst({ where: { orgId: org.id } });
    expect(event?.slug).toBe("conference-paris-2026");
    expect(event?.registrationOpen).toBe(false);
  });

  it("appends -2 if global slug collision", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "a-o" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "b-o" } });
    await prisma.event.create({
      data: { orgId: orgA.id, title: "X", slug: "x", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: orgB.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${orgB.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: orgB.id }) });
    const event = await prisma.event.findFirst({ where: { orgId: orgB.id } });
    expect(event?.slug).toBe("x-2");
  });

  it("refuses creation when quotaMaxEvents is reached (409 QUOTA_EXCEEDED)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "q-o", quotaMaxEvents: 1 } });
    await prisma.event.create({
      data: { orgId: org.id, title: "Existing", slug: "existing", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "Second", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("QUOTA_EXCEEDED");
  });

  it("copies CategoryTemplate to Category when templateIds provided", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-ev-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Conf Tpl",
        location: "Paris",
        date: "2026-12-15",
        templateIds: [tpl.id],
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: org.id }) });

    const cats = await prisma.category.findMany();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("Délégué");
    expect(cats[0].color).toBe("#ff0000");
  });
});
```

- [ ] **Step 10.5: Add POST handler in `src/app/api/admin/[orgId]/events/route.ts`**

```typescript
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { uniqueEventSlug } from "@/lib/slugify-event";

const createSchema = z.object({
  title: z.string().min(1).max(180),
  location: z.string().max(180).default(""),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date" }),
  logo: z.string().nullable().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(80).optional(),
  templateIds: z.array(z.string()).optional(),
  manualCategories: z
    .array(
      z.object({
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        number: z.number().int().min(0),
        neutralBadge: z.boolean().optional(),
        anonymous: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  // Quota check
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { quotaMaxEvents: true },
  });
  if (org?.quotaMaxEvents != null) {
    const count = await prisma.event.count({ where: { orgId, archived: false } });
    if (count >= org.quotaMaxEvents) {
      return NextResponse.json(
        { error: "Quota d'événements atteint", code: "QUOTA_EXCEEDED" },
        { status: 409 },
      );
    }
  }

  // Slug allocation
  const slug = data.slug ?? (await uniqueEventSlug(data.title));

  // Categories aggregation
  type CatInput = { name: string; color: string; number: number; neutralBadge?: boolean; anonymous?: boolean };
  let categoryInputs: CatInput[] = [];
  if (data.templateIds && data.templateIds.length > 0) {
    const templates = await prisma.categoryTemplate.findMany({
      where: { id: { in: data.templateIds }, orgId },
    });
    categoryInputs = templates.map((t) => ({
      name: t.name,
      color: t.color,
      number: t.number,
      neutralBadge: t.neutralBadge,
      anonymous: t.anonymous,
    }));
  }
  if (data.manualCategories && data.manualCategories.length > 0) {
    categoryInputs.push(...data.manualCategories);
  }

  // Renumber to guarantee unique numbers within event (1..N)
  const seenNumbers = new Set<number>();
  let nextFreeNumber = 1;
  categoryInputs = categoryInputs.map((c) => {
    if (seenNumbers.has(c.number)) {
      while (seenNumbers.has(nextFreeNumber)) nextFreeNumber++;
      c = { ...c, number: nextFreeNumber };
    }
    seenNumbers.add(c.number);
    return c;
  });

  // Create event + categories in a transaction
  try {
    const event = await prisma.event.create({
      data: {
        orgId,
        title: data.title,
        slug,
        location: data.location,
        date: new Date(data.date),
        logo: data.logo ?? null,
        registrationOpen: false,
        categories: {
          create: categoryInputs.map((c) => ({
            name: c.name,
            color: c.color,
            number: c.number,
            neutralBadge: c.neutralBadge ?? false,
            anonymous: c.anonymous ?? false,
          })),
        },
      },
    });

    await logActivity({
      type: "EVENT_CREATED",
      userId: session.user.id,
      orgId,
      eventId: event.id,
      details: {
        title: data.title,
        slug,
        categoriesCount: categoryInputs.length,
        templatesUsed: data.templateIds ?? [],
      },
      req,
    });

    return NextResponse.json({ event: { id: event.id, slug: event.slug } }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002" && err.meta?.target?.includes?.("slug")) {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 10.6: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts src/lib/__tests__/slugify-event.test.ts
```

Expected: tous passent.

- [ ] **Step 10.7: Commit**

```bash
git add src/lib/slugify-event.ts src/lib/__tests__/slugify-event.test.ts src/app/api/admin/[orgId]/events/route.ts src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): POST /api/admin/[orgId]/events (quota, slug unique, templates)"
```

---

## Task 11: Wizard `EventCreationWizard` + page `/events/new`

**Files:**
- Create: `src/components/admin/EventCreationWizard.tsx`
- Create: `src/app/admin/[orgId]/events/new/page.tsx`

> Le wizard maintient un state local sur les 3 étapes et n'appelle l'API qu'au submit final. Validation Zod côté client miroir du backend (rapide feedback).

- [ ] **Step 11.1: Create `src/components/admin/EventCreationWizard.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Template = { id: string; name: string; color: string; number: number };
type ManualCategory = { name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };

export function EventCreationWizard({
  orgId,
  templates,
}: {
  orgId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Step 2
  const [mode, setMode] = useState<"template" | "manual">("template");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [manualCats, setManualCats] = useState<ManualCategory[]>([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function suggestedSlug(t: string): string {
    return t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(suggestedSlug(v));
  }

  function step1Valid() {
    return title.trim() && date && location.trim();
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    const body: any = { title, date, location };
    if (slug && slugTouched) body.slug = slug;
    if (mode === "template") body.templateIds = selectedTemplates;
    if (mode === "manual") body.manualCategories = manualCats;

    const res = await fetch(`/api/admin/${orgId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.code === "QUOTA_EXCEEDED") {
        setErr("Limite atteinte. Contactez le support pour augmenter votre quota.");
      } else if (json.code === "SLUG_TAKEN") {
        setErr("Ce slug est déjà utilisé. Modifiez-le et réessayez.");
      } else {
        setErr("Erreur lors de la création.");
      }
      return;
    }
    const json = await res.json();
    router.push(`/admin/${orgId}/events/${json.event.id}/settings`);
  }

  function addManualCategory() {
    setManualCats([
      ...manualCats,
      { name: "", color: "#0066cc", number: manualCats.length + 1, neutralBadge: false, anonymous: false },
    ]);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Nouvel événement</h1>

      <ol className="flex gap-4 text-sm">
        <li className={step === 1 ? "font-bold" : "text-gray-500"}>1. Informations</li>
        <li className={step === 2 ? "font-bold" : "text-gray-500"}>2. Catégories</li>
        <li className={step === 3 ? "font-bold" : "text-gray-500"}>3. Récap</li>
      </ol>

      {err && <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{err}</div>}

      {step === 1 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <Input
            placeholder="Titre"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input
            placeholder="Lieu"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <div>
            <label className="text-sm text-gray-600">Slug (URL publique)</label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Suggéré automatiquement à partir du titre. Si le slug existe déjà globalement, un
              suffixe -2, -3… sera ajouté à la création.
            </p>
          </div>
          <div className="flex justify-end">
            <Button disabled={!step1Valid()} onClick={() => setStep(2)}>
              Suivant
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              variant={mode === "template" ? "primary" : "secondary"}
              onClick={() => setMode("template")}
            >
              Partir d'un modèle
            </Button>
            <Button
              variant={mode === "manual" ? "primary" : "secondary"}
              onClick={() => setMode("manual")}
            >
              Définir manuellement
            </Button>
          </div>

          {mode === "template" && (
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-gray-500">
                  Aucun modèle disponible. Créez-en un dans Modèles catégories ou passez en manuel.
                </p>
              )}
              {templates.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTemplates([...selectedTemplates, t.id]);
                      else setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                    }}
                  />
                  <span
                    className="inline-block w-3 h-3 rounded"
                    style={{ background: t.color }}
                  />
                  {t.name} (#{t.number})
                </label>
              ))}
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-2">
              {manualCats.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nom"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...manualCats];
                      next[i].name = e.target.value;
                      setManualCats(next);
                    }}
                  />
                  <Input
                    type="color"
                    value={c.color}
                    onChange={(e) => {
                      const next = [...manualCats];
                      next[i].color = e.target.value;
                      setManualCats(next);
                    }}
                  />
                  <Input
                    type="number"
                    value={c.number}
                    onChange={(e) => {
                      const next = [...manualCats];
                      next[i].number = Number(e.target.value);
                      setManualCats(next);
                    }}
                    className="w-20"
                  />
                </div>
              ))}
              <Button variant="secondary" onClick={addManualCategory}>
                Ajouter une catégorie
              </Button>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button onClick={() => setStep(3)}>Suivant</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="font-semibold">Récap</h2>
          <dl className="text-sm space-y-1">
            <div><dt className="inline font-medium">Titre : </dt><dd className="inline">{title}</dd></div>
            <div><dt className="inline font-medium">Date : </dt><dd className="inline">{date}</dd></div>
            <div><dt className="inline font-medium">Lieu : </dt><dd className="inline">{location}</dd></div>
            <div><dt className="inline font-medium">Slug : </dt><dd className="inline">{slug || "(auto)"}</dd></div>
            <div>
              <dt className="inline font-medium">Catégories : </dt>
              <dd className="inline">
                {mode === "template"
                  ? `${selectedTemplates.length} modèle(s) sélectionné(s)`
                  : `${manualCats.length} manuelle(s)`}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-500">
            L'événement sera créé avec les inscriptions fermées par défaut. Vous pourrez les ouvrir
            depuis la page de configuration.
          </p>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Création..." : "Créer l'événement"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: Create `src/app/admin/[orgId]/events/new/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { EventCreationWizard } from "@/components/admin/EventCreationWizard";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }],
    select: { id: true, name: true, color: true, number: true },
  });
  return <EventCreationWizard orgId={orgId} templates={templates} />;
}
```

- [ ] **Step 11.3: Manual smoke test**

Ouvrir `/admin/[orgId]/events/new`, naviguer les 3 étapes, créer un event. Vérifier la redirection vers `/admin/[orgId]/events/[eventId]/settings` (cette page sera créée au Plan 4 ; pour l'instant on accepte un 404 — l'event est bien créé).

- [ ] **Step 11.4: Commit**

```bash
git add src/components/admin/EventCreationWizard.tsx src/app/admin/[orgId]/events/new
git commit -m "feat(v2): wizard EventCreationWizard 3 etapes"
```

---

## Task 12: Archive / Restore events

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/archive/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/restore/route.ts`
- Add tests in `src/lib/__tests__/api-org.test.ts`

> Règle : vérifier que l'event appartient bien à l'org (sinon 404). Audit `EVENT_ARCHIVED` / `EVENT_RESTORED`.

- [ ] **Step 12.1: Append failing tests**

```typescript
describe("Archive/Restore events", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.event.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("archives an event of the org", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ar-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const e = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "ar-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${e.id}/archive`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: e.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: e.id } });
    expect(updated?.archived).toBe(true);
  });

  it("refuses to archive event of another org (404)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "x-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "x-b" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: orgA.id, role: "OWNER" } });
    const e = await prisma.event.create({
      data: { orgId: orgB.id, title: "T", slug: "x-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(`http://localhost/api/admin/${orgA.id}/events/${e.id}/archive`, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ orgId: orgA.id, eventId: e.id }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 12.2: Create `src/app/api/admin/[orgId]/events/[eventId]/archive/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    throw err;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { archived: true, archivedAt: new Date(), registrationOpen: false },
  });

  await logActivity({
    type: "EVENT_ARCHIVED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { title: event.title },
    req,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 12.3: Create `src/app/api/admin/[orgId]/events/[eventId]/restore/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    throw err;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { archived: false, archivedAt: null },
  });

  await logActivity({
    type: "EVENT_RESTORED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { title: event.title },
    req,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 12.4: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-org.test.ts
```

Expected: archive/restore tests passent.

- [ ] **Step 12.5: Commit**

```bash
git add src/app/api/admin/[orgId]/events/[eventId]/archive src/app/api/admin/[orgId]/events/[eventId]/restore src/lib/__tests__/api-org.test.ts
git commit -m "feat(v2): archive/restore events scope org"
```

---

## Task 13: Activity log scope org

**Files:**
- Create: `src/app/api/admin/[orgId]/activity/route.ts`
- Create: `src/app/admin/[orgId]/activity/page.tsx`

> Filtres en query : `type` (ActivityType), `from` / `to` (ISO date), `eventId`, `userId`. Pagination simple `cursor` + `take=50`.

- [ ] **Step 13.1: Create `src/app/api/admin/[orgId]/activity/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

export const GET = withOrgAuth("OWNER", async (req, { orgId }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const eventId = url.searchParams.get("eventId");
  const userId = url.searchParams.get("userId");
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);

  const where: any = { orgId };
  if (type) where.type = type;
  if (eventId) where.eventId = eventId;
  if (userId) where.userId = userId;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const hasMore = logs.length > take;
  const items = logs.slice(0, take).map((l) => ({
    id: l.id,
    type: l.type,
    eventId: l.eventId,
    targetId: l.targetId,
    details: l.details,
    staffActor: l.staffActor,
    createdAt: l.createdAt,
    user: l.user ? { id: l.user.id, email: l.user.email, name: l.user.name } : null,
  }));

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});
```

- [ ] **Step 13.2: Create `src/app/admin/[orgId]/activity/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const logs = await prisma.activityLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Journal d'activité</h1>
      <p className="text-sm text-gray-500">
        Les actions marquées <span className="px-1 rounded bg-amber-100 text-amber-800">staff</span>{" "}
        sont effectuées par le staff applicatif.
      </p>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Acteur</th>
            <th className="px-3 py-2">Détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                Aucune activité.
              </td>
            </tr>
          )}
          {logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(l.createdAt).toLocaleString("fr-FR")}
              </td>
              <td className="px-3 py-2">
                {l.type}
                {l.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{l.user?.email ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-600">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(l.details, null, 0)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 13.3: Commit**

```bash
git add src/app/api/admin/[orgId]/activity src/app/admin/[orgId]/activity
git commit -m "feat(v2): GET /api/admin/[orgId]/activity + page journal"
```

---

## Task 14: Page `/select` (sélecteur post-login multi-org)

**Files:**
- Create: `src/app/select/page.tsx`

> Affiche la liste des orgs où le user a une OrgMembership. Si staff, propose en plus "Espace staff" → `/staff`. Si une seule org et pas staff → redirection auto (gérée par Plan 1 middleware + Task 15 dispatcher).

- [ ] **Step 14.1: Create `src/app/select/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";

export default async function SelectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const orgs = await prisma.organization.findMany({
    where: { memberships: { some: { userId: ctx.user.id, role: "OWNER" } } },
    select: { id: true, name: true, slug: true, archived: true },
    orderBy: { name: "asc" },
  });

  // Cas dégénérés : redirige directement
  if (!ctx.isStaff && orgs.length === 1) {
    redirect(`/admin/${orgs[0].id}`);
  }
  if (!ctx.isStaff && orgs.length === 0) {
    redirect("/profile?message=no-org");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold">Choisissez une organisation</h1>
        {ctx.isStaff && (
          <Link
            href="/staff"
            className="block w-full rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
          >
            Espace staff applicatif
          </Link>
        )}
        <ul className="space-y-1">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/${o.id}`}
                className="block w-full rounded border px-4 py-3 text-sm hover:bg-gray-50"
              >
                {o.name}
                {o.archived && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-gray-200 text-xs">Archivée</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.2: Commit**

```bash
git add src/app/select/page.tsx
git commit -m "feat(v2): page /select (selecteur post-login multi-org)"
```

---

## Task 15: Dispatcher post-login (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/lib/org-redirect.ts`
- Create: `src/lib/__tests__/org-redirect.test.ts`

> Logique pure (testable) qui retourne le chemin de redirection selon le profil. La page `/` (server component) appelle ensuite `redirect()`.

- [ ] **Step 15.1: Write failing tests**

Create `src/lib/__tests__/org-redirect.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { resolveHomeRedirect } from "@/lib/org-redirect";

describe("resolveHomeRedirect", () => {
  it("returns /login if no userContext", () => {
    expect(resolveHomeRedirect(null, null)).toBe("/login");
  });

  it("returns /staff if user is staff with no lastOrg", () => {
    expect(
      resolveHomeRedirect(
        { isStaff: true, orgMemberships: [] } as any,
        null,
      ),
    ).toBe("/staff");
  });

  it("returns /admin/[orgId] if single org and not staff", () => {
    expect(
      resolveHomeRedirect(
        { isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }] } as any,
        null,
      ),
    ).toBe("/admin/o1");
  });

  it("returns /select if multi-org and not staff", () => {
    expect(
      resolveHomeRedirect(
        {
          isStaff: false,
          orgMemberships: [
            { orgId: "o1", role: "OWNER" },
            { orgId: "o2", role: "OWNER" },
          ],
        } as any,
        null,
      ),
    ).toBe("/select");
  });

  it("uses lastOrgId hint if still valid", () => {
    expect(
      resolveHomeRedirect(
        {
          isStaff: false,
          orgMemberships: [
            { orgId: "o1", role: "OWNER" },
            { orgId: "o2", role: "OWNER" },
          ],
        } as any,
        "o2",
      ),
    ).toBe("/admin/o2");
  });

  it("ignores lastOrgId if user lost membership", () => {
    expect(
      resolveHomeRedirect(
        { isStaff: false, orgMemberships: [{ orgId: "o1", role: "OWNER" }] } as any,
        "o-gone",
      ),
    ).toBe("/admin/o1");
  });

  it("staff with lastOrgId hint goes there", () => {
    expect(
      resolveHomeRedirect(
        { isStaff: true, orgMemberships: [] } as any,
        "o-any",
      ),
    ).toBe("/admin/o-any");
  });

  it("returns /profile if not staff and no org", () => {
    expect(
      resolveHomeRedirect(
        { isStaff: false, orgMemberships: [] } as any,
        null,
      ),
    ).toBe("/profile?message=no-org");
  });
});
```

- [ ] **Step 15.2: Implement `src/lib/org-redirect.ts`**

```typescript
import type { UserContext } from "@/types/auth";

export function resolveHomeRedirect(
  ctx: UserContext | null,
  lastOrgIdHint: string | null,
): string {
  if (!ctx) return "/login";

  const memberOrgIds = new Set(ctx.orgMemberships.map((m) => m.orgId));

  // Staff path : honor lastOrgIdHint if any, else go to /staff
  if (ctx.isStaff) {
    if (lastOrgIdHint) return `/admin/${lastOrgIdHint}`;
    return "/staff";
  }

  if (memberOrgIds.size === 0) return "/profile?message=no-org";

  if (lastOrgIdHint && memberOrgIds.has(lastOrgIdHint)) {
    return `/admin/${lastOrgIdHint}`;
  }

  if (memberOrgIds.size === 1) {
    const onlyOrgId = ctx.orgMemberships[0].orgId;
    return `/admin/${onlyOrgId}`;
  }

  return "/select";
}
```

- [ ] **Step 15.3: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/org-redirect.test.ts
```

Expected: 8 passed.

- [ ] **Step 15.4: Rewrite `src/app/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { resolveHomeRedirect } from "@/lib/org-redirect";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  // lastOrgId persists côté client en localStorage — non lisible côté serveur.
  // On retombe sur la logique sans hint ; le client peut rediriger via OrgSelector si besoin.
  const target = resolveHomeRedirect(ctx, null);
  redirect(target);
}
```

> Note : le `lastOrgId` du LocalStorage est volontairement ignoré côté serveur (cookies HTTP-Only seraient nécessaires pour le lire). Le client `OrgSelector` redirige déjà sur changement. La logique `resolveHomeRedirect` accepte ce hint pour les usages futurs (cookie set lors de la sélection).

- [ ] **Step 15.5: Commit**

```bash
git add src/lib/org-redirect.ts src/lib/__tests__/org-redirect.test.ts src/app/page.tsx
git commit -m "feat(v2): dispatcher post-login (page d'accueil -> /staff | /admin/[orgId] | /select)"
```

---

## Task 16: Test e2e du parcours OWNER (smoke)

**Files:**
- Create: `src/lib/__tests__/owner-journey.test.ts` (intégration via Prisma + fetch, sans Playwright)

> Vitest "integration" qui exécute le scénario OWNER de bout en bout (création org via Prisma direct comme seed, puis API calls). Vérifie le golden path : connexion → création event → invitation OWNER → vérif mailpit (via stub `sendUserInvitation`).

- [ ] **Step 16.1: Create test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Spy on sendUserInvitation
vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<any>("@/lib/mail");
  return {
    ...actual,
    sendUserInvitation: vi.fn(async () => undefined),
    sendSmtpTest: vi.fn(async () => ({ messageId: "test-1" })),
  };
});

import { sendUserInvitation } from "@/lib/mail";

describe("OWNER journey (smoke)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendUserInvitation).mockClear();
  });

  it("OWNER creates event, invites OWNER, archives event", async () => {
    // Seed: org + OWNER
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme", quotaMaxEvents: 10 },
    });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: owner.id, email: owner.email, name: owner.name, isStaff: false } } as any);

    // 1. Create event
    const { POST: createEvent } = await import("@/app/api/admin/[orgId]/events/route");
    const r1 = await createEvent(
      new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
        method: "POST",
        body: JSON.stringify({ title: "Conf 2026", location: "Paris", date: "2026-12-15" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(r1.status).toBe(201);
    const eventCreated = await r1.json();
    expect(eventCreated.event.slug).toBe("conf-2026");

    // 2. Invite a co-OWNER
    const { POST: inviteOwner } = await import("@/app/api/admin/[orgId]/members/route");
    const r2 = await inviteOwner(
      new NextRequest(`http://localhost/api/admin/${org.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: "bob@acme.com", name: "Bob" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(r2.status).toBe(201);
    expect(vi.mocked(sendUserInvitation)).toHaveBeenCalledTimes(1);

    // 3. Archive the event
    const { POST: archive } = await import("@/app/api/admin/[orgId]/events/[eventId]/archive/route");
    const r3 = await archive(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${eventCreated.event.id}/archive`, { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: eventCreated.event.id }) },
    );
    expect(r3.status).toBe(200);
    const archived = await prisma.event.findUnique({ where: { id: eventCreated.event.id } });
    expect(archived?.archived).toBe(true);

    // Activity log shape
    const logs = await prisma.activityLog.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.type)).toEqual(
      expect.arrayContaining(["EVENT_CREATED", "MEMBERSHIP_ADDED", "USER_CREATED", "EVENT_ARCHIVED"]),
    );
    // Non-staff actions must not be flagged staffActor
    expect(logs.every((l) => !l.staffActor)).toBe(true);
  });

  it("staff acting on org produces staffActor=true logs", async () => {
    const staff = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-s" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: staff.id, email: staff.email, name: staff.name, isStaff: true } } as any);

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    await PATCH(
      new NextRequest(`http://localhost/api/admin/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Acme-2" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(true);
  });
});
```

- [ ] **Step 16.2: Run e2e test**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/owner-journey.test.ts
```

Expected: 2 passed.

- [ ] **Step 16.3: Manual smoke test (browser)**

Avec mailpit en cours (`make dev`), depuis le navigateur :

1. Se connecter en STAFF_ADMIN (créé par seed Plan 1)
2. Aller sur `/staff` (Plan 2) ou créer manuellement une org en SQL si Plan 2 pas encore mergé
3. Ajouter une OrgMembership pour son user en SQL → visiter `/admin/[orgId]`
4. Créer un event via le wizard
5. Inviter un OWNER → vérifier mailpit `http://localhost:8025`
6. Archiver l'event
7. Vérifier que le journal d'activité scope org affiche les 3 actions

Expected : tous les pas réussissent sans erreur visible. L'audit log montre les badges `staff` si l'action est faite par le STAFF_ADMIN.

- [ ] **Step 16.4: Commit**

```bash
git add src/lib/__tests__/owner-journey.test.ts
git commit -m "test(v2): e2e parcours OWNER (create event, invite OWNER, archive)"
```

---

## Task 17: Final verification

- [ ] **Step 17.1: Run full test suite**

```bash
make test
```

Expected: tous les tests passent (Plan 1 + Plan 3).

- [ ] **Step 17.2: Lint and typecheck**

```bash
make lint && make typecheck
```

Expected: pas de warning, pas d'erreur TypeScript dans les nouveaux fichiers de Plan 3. Les fichiers `src/app/api/**` ou `src/app/admin/**` hérités de v1 peuvent encore avoir des erreurs : elles sont à éliminer dans les Plans 2/4/5 et ne doivent pas être "réparées" ici.

- [ ] **Step 17.3: Verify no secret leaks in API**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'grep -rn "smtpPassword\|recaptchaSecretKey\|recaptchaSiteKey" src/app/api/admin/' || true
```

Expected : aucune apparition. Depuis 2026-05-31, SMTP et reCAPTCHA sont geres uniquement au niveau `PlatformSettings` : aucun champ `smtpPassword`, `recaptchaSecretKey` ou `recaptchaSiteKey` n'existe dans `Organization` (le modele `OrgSettings` a egalement ete supprime le meme jour), donc aucune route `/api/admin/[orgId]/*` ne doit y faire reference.

- [ ] **Step 17.3-bis: Verify no residual OrgSettings reference**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'grep -rn "OrgSettings\|orgSettings\|ORG_SETTINGS_UPDATED" src/app/api/admin/ src/app/admin/ src/lib/ src/components/' || true
```

Expected : aucune apparition. Depuis 2026-05-31, le modele `OrgSettings` est supprime ; toute reference doit avoir ete remplacee par `Organization` (et `ORG_SETTINGS_UPDATED` par `ORG_UPDATED`).

- [ ] **Step 17.4: Manual exploratory test**

Parcourir, connecté en OWNER :
- `/admin/[orgId]` — dashboard
- `/admin/[orgId]/events` — liste
- `/admin/[orgId]/events/new` — wizard 3 étapes
- `/admin/[orgId]/members` — invite + retrait
- `/admin/[orgId]/templates` — CRUD
- `/admin/[orgId]/settings` — formulaire complet (sections Identite, Adresse, Administratif, Contact public) qui POST sur `PATCH /api/admin/[orgId]` ; aucun SMTP ni reCAPTCHA cote org depuis 2026-05-31
- `/admin/[orgId]/activity` — journal

Connecté en STAFF_ADMIN, ouvrir la même org : vérifier le bandeau "Mode staff" en haut, et qu'au moins une action génère un `staffActor=true` visible dans le journal.

- [ ] **Step 17.5: Verify routes index for next plan**

Lister les routes créées pour validation visuelle :

```bash
find src/app/api/admin -type f -name "route.ts" | sort
find src/app/admin -type f -name "page.tsx" | sort
```

Expected : toutes les routes documentées dans la spec sont présentes, sauf celles préfixées `/events/[eventId]/*` (Plan 4).

- [ ] **Step 17.6: Update `docs/v2/architecture.md`**

Ajouter en fin de fichier :

```markdown
## État au lot C (post-Plan 3)

Plan 3 (espace organisation) terminé. Disponible :

- Layout `OrgShell` + sélecteur d'org + bandeau staff
- Routes `/admin/[orgId]/{dashboard, settings, members, templates, events, events/new, activity}`
- API REST scope-org : organisation (`PATCH /api/admin/[orgId]` accepte toutes les infos administratives — identite, adresse, taxId, website, logo, contact public ; slug et quotas restent staff-only ; SMTP et reCAPTCHA non geres ici depuis 2026-05-31), members (LAST_OWNER 409), templates, events (quota + slug unique), archive/restore, activity
- Wizard `EventCreationWizard` 3 étapes
- Dispatcher post-login (`/`, `/select`)

Reste à venir :

- Plan 4 (espace événement `/admin/[orgId]/events/[eventId]/*`)
- Plan 5 (inscription publique `/e/[slug]`)
- Plan 6 (templates email — actuellement stubs)
- Plan 7 (déploiement initial v2)
```

- [ ] **Step 17.7: Commit doc**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): note d'avancement post-Plan 3 (espace organisation)"
```

- [ ] **Step 17.8: Final git log review**

```bash
git log --oneline | head -25
```

Expected : succession de `feat(v2)` et `test(v2)` cohérents, scopés Plan 3.

---

### Task 18 : Vérification finale — aucun stub Plan 6 résiduel

**Files:**
- Verify: `src/lib/mail.ts` ou `src/lib/mail-stubs.ts`

- [ ] **Step 1 : Detection des stubs**

Run:
```bash
grep -rn "TODO: wired up by Plan 6\|STUB_PLAN_6" src/lib/ src/app/api/ || echo "OK aucun stub residuel"
```

Expected: `OK aucun stub residuel` (aucun match).

- [ ] **Step 2 : Verifier que sendUserInvitation et sendSmtpTest sont importes depuis le vrai module**

Run:
```bash
grep -rn "from \"@/lib/mail\"" src/app/api/admin/ src/app/admin/ | grep -E "sendUserInvitation|sendSmtpTest"
```

Expected : au moins 1 import par fonction depuis `@/lib/mail` (pas `@/lib/mail-stubs`).

- [ ] **Step 3 : Run tests + typecheck**

Run:
```bash
make typecheck && make test
```

Expected : tout passe.

- [ ] **Step 4 : Commit (si modifications)**

```bash
git commit -m "chore(org): supprime les stubs Plan 6 residuels"
```

---

## Done

Plan 3 (espace organisation OWNER) est complet. Toutes les routes `/admin/[orgId]/*` (hors `events/[eventId]/*`) et leurs API correspondantes sont en place, testées (intégration + e2e), avec :

- Wrapper `withOrgAuth` réutilisable pour toutes les API scope-org
- Cascade contact correctement appliquée via `Organization` (`OrgSettings` supprime 2026-05-31)
- Quotas appliqués à la création d'event
- Slug d'event globalement unique avec suffixage automatique
- Audit log `staffActor` automatique pour les actions staff
- LAST_OWNER (409) bloque la suppression du dernier OWNER
- Dispatcher post-login multi-org (`/` → `/staff`, `/admin/[orgId]`, `/select`, ou `/profile?message=no-org`)

Plan 4 (espace événement) peut maintenant s'appuyer sur le layout `/admin/[orgId]` déjà chargé et le helper `requireEventRole` du Plan 1.
