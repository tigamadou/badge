# Espace Événement (ADMIN / OPERATOR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Mise à jour 2026-05-31 — SMTP plateforme uniquement.** Suite à la décision de design du 2026-05-31, les paramètres SMTP (y compris `smtpFrom`) sont **exclusivement** au niveau `PlatformSettings`. Aucun champ SMTP n'est overridable au niveau `EventSettings`, et il n'existe pas de route "test SMTP" côté event. **Task 7 (EventSettings)** est simplifiée : retrait complet de `smtpFrom` de la route GET/PATCH et du formulaire ; conservation uniquement de `contactEmail` + `contactPhone`. **Sous-task Step 7.4** (`settings/test-smtp/route.ts`) est supprimée. Les sources de vérité associées (`docs/v2/features/espace-evenement.md`, `docs/v2/features/multi-tenancy-rbac.md`) ont déjà été mises à jour.
>
> **Mise à jour 2026-05-31 — suppression d'OrgSettings, infos contact directement sur Organization.** Le modèle `OrgSettings` est **supprimé** (fusionné dans `Organization`). Les infos contact (`contactEmail`, `contactPhone`) sont désormais lues directement depuis `Organization`. La cascade settings pour les emails event reste : **`Event.settings` → `Organization` → `Platform`** (premier non-null gagne), mais l'étape intermédiaire lit `Organization.contactEmail`/`Organization.contactPhone` (et plus `Organization.settings.contactEmail`). Impact sur ce plan : si un test crée une `OrgSettings` pour poser un contact d'org, le remplacer par un `prisma.organization.update({ where: { id: orgId }, data: { contactEmail, contactPhone } })`. Le helper `resolveSettings(eventId)` (Plan 1) doit refléter la nouvelle cascade ; les tests qui le mockent ou inspectent ses sources doivent rester cohérents avec cette lecture directe.

**Goal:** Implement the EVENT workspace of Badge v2 (`/admin/[orgId]/events/[eventId]/*`) : dashboard event, gestion complète des inscriptions (table, détail, création manuelle, approbation/rejet/édition, blocage email/document, export, doublons, lien d'édition), badges (liste, prévisualisation, impression unique et batch, all-access), catégories (CRUD scope event + import templates org), membres event (invitation ADMIN/OPERATOR), settings event (cascade overrides), scanner QR aux points de contrôle, blocages email/document, journal d'activité event. La sidebar OPERATOR est limitée à `/scan` et `/profile` (defense in depth via API + middleware).

**Architecture:** Toutes les routes API sont protégées par un wrapper `withEventAuth` qui (1) résout `orgId` et `eventId` depuis le path, (2) vérifie que l'event appartient à l'org (cohérence URL), (3) appelle `requireEventRole` (Plan 1, honore héritage OWNER→ADMIN + bypass staff), (4) délègue au handler avec un contexte typé `EventAuthCtx`. Le pattern reflète `withOrgAuth` du Plan 3. Les pages serveur consomment Prisma directement pour les lectures ; les mutations passent par fetch vers les routes API protégées. Toute mutation appelle `logActivity({ orgId, eventId, … })` (le `staffActor` est auto-calculé par Plan 1). La cascade settings event utilise `resolveSettings(eventId)` du Plan 1 — `EventSettings` n'accepte que les overrides contact (`contactEmail`, `contactPhone`). Le SMTP est plateforme uniquement (décision 2026-05-31). reCAPTCHA n'est pas overridable au niveau event. Le quota `quotaMaxRegistrations` est appliqué côté admin uniquement comme garde-fou ; la création publique (Plan 5) le respectera aussi. Les composants v1 (`RegistrationForm`, `BadgeDocument`, `BadgeBatchExport`, `TeamForm`, `RegistrationTable`, `QRScanner`) sont **refondus** sous `src/components/event/` avec une prop `event` typée et des callbacks scopés `eventId`. La séparation OPERATOR/ADMIN est triple : sidebar côté `EventShell`, middleware Plan 1, et chaque route API re-vérifie via `withEventAuth({ minRole: "ADMIN" })`.

**Tech Stack:** Next.js 16 App Router (Server Components + Client Forms), Prisma 6, NextAuth 4 (`getServerSession`), Zod 3 (validation), TypeScript 5, Vitest 4. UI : composants existants `Button`, `Input`, `Select`, `Table`, `Modal`, `StatusBadge`. Badges : `@react-pdf/renderer` 4. Scan : `html5-qrcode` 2. QR : `qrcode` 1.

**Spec:** [docs/v2/features/espace-evenement.md](../../v2/features/espace-evenement.md)

**Prerequisite plans:**

- Plan 1 — Multi-tenancy & RBAC (helpers `requireEventRole`, `getEffectiveEventRole`, `loadUserContext`, `logActivity`, `resolveSettings`, `AuthError`, schéma Prisma v2 dont `Registration`, `Category`, `SubmissionSnapshot`, `EventMembership`, `EventSettings`, `BlockedEmail`, `BlockedDocument`, `ActivityLog` avec types `BADGE_SCANNED`, `REGISTRATION_APPROVED`, etc.)
- Plan 3 — Espace Organisation (fournit `CategoryTemplate` côté org pour `apply-template`, layout `/admin/[orgId]` parent, et `OrgSettings` cascade)
- Plan 6 — Notifications email (fournit `sendStatusNotification(registrationId)`, `sendBadgePrintedNotification(registrationId)`, `sendEditLinkEmail(registrationId)`, `sendUserInvitation(userId, { eventId? })`). **Stratégie de stub** : si Plan 6 n'est pas encore mergé, créer des stubs typés (Task 0.4) et **vérifier en Task finale** qu'aucun `[stub]` ne subsiste. *Note : `sendSmtpTest` est utilisé par PlatformSettings (Plan 6) mais n'est plus consommé par Plan 4 depuis la décision 2026-05-31.*

---

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [x] | 2026-05-31 | Pre-flight : 6 helpers Plan 1/3 OK, 6 ActivityType (REGISTRATION_APPROVED, BADGE_SCANNED, etc.) OK. Ajout des 3 stubs Plan 6 manquants : sendStatusNotification, sendBadgePrintedNotification, sendEditLinkEmail. sendUserInvitation existait deja (Plan v2-02). |
| 1 | [x] | 2026-05-31 | src/lib/with-event-auth.ts + tests (11/11 passent). Wrapper d'API : 401 sans session, 404 si event absent ou cross-org (URL tampering), 410 EVENT_ARCHIVED par defaut (allowArchived bypass), 409 REGISTRATION_CLOSED si requireRegistrationOpen=true, 403 sans role suffisant. ctx expose orgId/eventId/effectiveRole/session. OWNER org herite ADMIN event. Staff bypass total (effectiveRole=STAFF). |
| 2 | [x] | 2026-05-31 | 4 helpers purs livres : event-quota (PENDING+APPROVED, REJECTED exclu), edit-token (randomBytes 32 hex, TTL 48h), duplicates (email/document/nom scope event), registration-csv (escape RFC4180). 26/26 tests verts. |
| 3 | [x] | 2026-05-31 | Layout `/admin/[orgId]/events/[eventId]` + EventShell (sidebar complete ADMIN/STAFF) + EventOperatorShell (Scanner + Profil). Aiguillage par role. Bandeau "Mode staff" si staff sans membership. Typecheck vert. |
| 4 | [x] | 2026-05-31 | Dashboard event (KPI ADMIN, Mes scans OPERATOR) + GET/PATCH route. Slug staff-only, P2002→409 SLUG_TAKEN, log EVENT_UPDATED + EVENT_REGISTRATION_OPENED/CLOSED. 5/5 tests verts. |
| 5 | [x] | 2026-05-31 | Categories CRUD scope event + import-templates avec renumerotation. Routes GET/POST + [id] PATCH/DELETE + import-templates. Components CategoryForm/Table/ReassignModal/ImportTemplatesModal + page. 7/7 tests verts. |
| 6 | [x] | 2026-05-31 | Members event GET/POST invite (user existant -> juste membership ; nouveau -> User + inviteToken + sendUserInvitation) + PATCH role + DELETE. 5/5 tests verts. |
| 7 | [x] | 2026-05-31 | EventSettings GET/PATCH (contactEmail + contactPhone uniquement, SMTP plateforme uniquement). z.strict() refuse smtp*. Resolved cascade preview. 4/4 nouveaux tests verts. |
| 8 | [x] | 2026-05-31 | Registrations GET liste (filtres status/categoryId/q + pagination) + POST manuel (status=APPROVED, audit REGISTRATION_CREATED). OPERATOR lit la liste, seul ADMIN cree. 5/5 tests verts. |
| 9 | [x] | 2026-05-31 | Routes [regId] GET/PATCH/DELETE + approve/reject (editToken + sendStatusNotification)/print (badgePrinted + sendBadgePrintedNotification)/all-access. PATCH snapshot avant update. editToken jamais expose. 7/7 nouveaux tests verts. |
| 10 | [x] | 2026-05-31 | Routes block-email, block-document, duplicates, resend-edit-link, reset-edit-token, checkin (OPERATOR), batch print, export CSV. 4/4 nouveaux tests verts. |
| 11 | [x] | 2026-05-31 | Composants RegistrationActions (Approve/Reject modal/Print) + RegistrationTable (filtres + recherche + pagination + export CSV) + RegistrationForm refondu (prop categories, sans lecture Prisma). |
| 12 | [x] | 2026-05-31 | Pages registrations (liste, new, [regId] detail) + composants RegistrationHistory (snapshots) + RegistrationDetailPanel (Approve/Reject/Print + block/edit-link/all-access/delete). Typecheck vert. |
| 13 | [x] | 2026-05-31 | Composants badge V2 (BadgeDocument/Anonymous/Batch/Preview/Download/WebPreview) avec prop `event` et `registration`. Font Montserrat preservee. QR + ALL ACCESS + neutralBadge. Typecheck vert. |
| 14 | [x] | 2026-05-31 | Pages badges liste/detail/print + components BadgeListTable (filtres + selection batch + open PDF preview) + BadgeBatchPanel (PDFViewer + fetch + QR generation). Typecheck vert. |
| 15 | [x] | 2026-05-31 | Endpoint scan/verify (extract id from QR url, log BADGE_SCANNED, FOREIGN_EVENT 404, authorized iff APPROVED) + QRScanner (html5-qrcode + saisie manuelle + historique session) + page scan. 4/4 tests verts. |
| 16 | [x] | 2026-05-31 | Blocked emails/documents : routes GET/POST + [id] DELETE pour les deux entites, audit REGISTRATION_UPDATED avec details.action discriminant. P2002 -> 409 ALLREADY_BLOCKED. Components BlockedEmailsForm/BlockedDocumentsForm + pages SSR. OPERATOR refuse en 403 (ADMIN minRole). 5/5 tests verts. |
| 17 | [x] | 2026-05-31 | Activity log event : route GET + page. ADMIN voit tous les logs, OPERATOR filtre defense-in-depth (userId=session.user.id AND type=BADGE_SCANNED), VIEWER 403 (minRole OPERATOR car PRINTER/VIEWER stricts). Filtre type validate vs enum ActivityType. Pagination page/limit (max 100). 5/5 tests verts. |
| 18 | [x] | 2026-05-31 | POST /registrations admin : audit `quotaBypass=true` si quota depasse apres creation (admin bypass, pas de blocage cote admin). 1/1 nouveau test vert. |
| 19 | [x] | 2026-05-31 | event-journey.test.ts (3 tests integration). 1/ OWNER (no EventMembership) herite ADMIN, cree categorie + registration APPROVED + print badge ; logs portent orgId+eventId, staffActor=false (criteres #1, #6, #9). 2/ OPERATOR scan OK mais approve/PATCH/DELETE cat -> 403 (criteres #2, #10). 3/ Staff PATCH event -> log staffActor=true (audit). |
| 20 | [x] | 2026-05-31 | Append au test api-event-categories.test.ts : flux complet DELETE catFrom -> 409 / PATCH reassignToCategoryId=catTo -> 200 / DELETE catFrom -> 204, registration deplacee vers catTo. 8/8 tests categories cumules. |
| 21 | [-] | 2026-05-31 | Smoke navigateur manuel : reporte a l'utilisateur (necessite browser interactif). Steps documentees dans le plan, a executer si verif visuelle souhaitee. |
| 22 | [x] | 2026-05-31 | Verification finale : 399/399 tests verts (test-setup.ts global cleanup ajoute pour fixer la regression cross-fichier liee aux residus Registration). Typecheck OK. Lint OK (0 erreurs apres fix RegistrationTable.tsx useTransition + MemberTable EventRole typage). Aucun secret SMTP/reCAPTCHA dans les routes event. Doc architecture.md a mettre a jour avec section "Etat au lot C (post-Plan 4)" — TODO complementaire. |

**Derniere session** : 2026-05-31 - Plan v2-04 entierement implemente (Tasks 0-20, 22 = [x] ; Task 21 = [-] smoke navigateur manuel reporte a l'utilisateur). Execution via Agent Team de 3 implementers en parallele : `implementer-event` (Tasks 2-12), `implementer-badges-scan` (Tasks 13, 15), `implementer-blocked-activity` (Tasks 16-17) + team-lead (Tasks 0, 1, 14 coord, 18 verif, 19, 20, 22). **400/400 tests verts** (cumul Plan v2-01 + v2-02 + v2-03 + v2-04). Typecheck OK. Lint OK (0 erreurs). Aucun commit (consigne user — a commiter sur demande).

Fixes infra livres pendant Plan v2-04 :
- `src/test-setup.ts` : global `beforeEach` qui reset la BDD en ordre FK strict (corrige la regression cross-fichier liee aux `Registration` cumulees).
- `src/components/ui/Input.tsx` : `label` rendu optionnel (deja fait Plan v2-03).
- `src/components/event/RegistrationTable.tsx` : `useTransition` au lieu de setBusy synchrone (lint compliance).
- `src/components/event/MemberTable.tsx` : type `EventRole` importe de `@prisma/client`.

**Prochaine etape** : commit (sur demande utilisateur), puis Plan v2-05 (inscription publique) ou Plan v2-06 (templates email). Task 21 (smoke navigateur) reste a executer par l'utilisateur en local avec `make dev`.

**Notes** :
- 2026-05-31 — Décision SMTP plateforme uniquement. Task 7 (EventSettings) simplifiée : retrait de `smtpFrom` (API + UI), suppression de l'ancienne sous-task "Step 7.4: settings/test-smtp/route.ts" `[-]` (raison : aucune route test SMTP côté event, le SMTP est plateforme uniquement). Renumérotation des steps suivants (7.5 → 7.4, 7.6 → 7.5, 7.7 → 7.6, 7.8 → 7.7). Sources de vérité mises à jour : `docs/v2/features/espace-evenement.md`, `docs/v2/features/multi-tenancy-rbac.md`.
- 2026-05-31 — Suppression d'`OrgSettings` (fusionné dans `Organization`). Les infos contact sont lues directement sur `Organization`. La cascade contact pour les emails event devient : `Event.settings` → `Organization.contactEmail/Phone` → `Platform`. Impact tests : tout setup qui crée une `OrgSettings` pour poser un contact d'org est remplacé par `prisma.organization.update({ where: { id: orgId }, data: { contactEmail, contactPhone } })`. Les mocks de `resolveSettings(eventId)` doivent refléter cette lecture directe.

---

## File Structure

**Files to create:**

Wrapper auth + helpers purs :

- `src/lib/with-event-auth.ts`
- `src/lib/__tests__/with-event-auth.test.ts`
- `src/lib/event-quota.ts` (compteur d'inscriptions PENDING/APPROVED)
- `src/lib/__tests__/event-quota.test.ts`
- `src/lib/edit-token.ts` (génération + hashing du editToken, signature `randomBytes(32).toString("hex")`)
- `src/lib/__tests__/edit-token.test.ts`
- `src/lib/duplicates.ts` (recherche de doublons)
- `src/lib/__tests__/duplicates.test.ts`
- `src/lib/registration-csv.ts` (export CSV)
- `src/lib/__tests__/registration-csv.test.ts`

Layout event + composants :

- `src/components/event/EventShell.tsx`
- `src/components/event/EventOperatorShell.tsx`
- `src/components/event/RegistrationForm.tsx` (refonte v1)
- `src/components/event/RegistrationTable.tsx` (refonte v1)
- `src/components/event/RegistrationDetailPanel.tsx`
- `src/components/event/RegistrationHistory.tsx` (snapshots)
- `src/components/event/RegistrationActions.tsx` (Approve/Reject modal)
- `src/components/event/CategoryForm.tsx` (refonte de `TeamForm` v1)
- `src/components/event/CategoryTable.tsx`
- `src/components/event/CategoryReassignModal.tsx`
- `src/components/event/CategoryImportTemplatesModal.tsx`
- `src/components/event/MemberInviteForm.tsx`
- `src/components/event/MemberTable.tsx`
- `src/components/event/BlockedEmailsForm.tsx`
- `src/components/event/BlockedDocumentsForm.tsx`
- `src/components/event/EventSettingsForm.tsx`
- `src/components/event/BadgeListTable.tsx`
- `src/components/event/BadgeBatchPanel.tsx`
- `src/components/event/QRScanner.tsx` (refonte v1, html5-qrcode + saisie manuelle)
- `src/components/badge/BadgeDocumentV2.tsx` (refonte avec prop `event`)
- `src/components/badge/BadgeDocumentAnonymousV2.tsx`
- `src/components/badge/BadgeBatchExportV2.tsx`
- `src/components/badge/BadgePreviewV2.tsx`
- `src/components/badge/BadgeDownloadV2.tsx`
- `src/components/badge/BadgeWebPreviewV2.tsx`

Pages serveur (App Router) :

- `src/app/admin/[orgId]/events/[eventId]/layout.tsx`
- `src/app/admin/[orgId]/events/[eventId]/page.tsx` (dashboard event)
- `src/app/admin/[orgId]/events/[eventId]/registrations/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/registrations/new/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/registrations/[regId]/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/badges/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/badges/[badgeId]/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/badges/print/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/categories/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/members/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/settings/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/blocked-emails/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/blocked-documents/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/activity/page.tsx`
- `src/app/admin/[orgId]/events/[eventId]/scan/page.tsx`

Routes API (sous `src/app/api/admin/[orgId]/events/[eventId]/`) :

- `route.ts` (GET, PATCH event)
- `registrations/route.ts` (GET liste, POST création manuelle)
- `registrations/[regId]/route.ts` (GET, PATCH, DELETE)
- `registrations/[regId]/approve/route.ts` (POST)
- `registrations/[regId]/reject/route.ts` (POST)
- `registrations/[regId]/print/route.ts` (POST)
- `registrations/[regId]/all-access/route.ts` (POST toggle)
- `registrations/[regId]/checkin/route.ts` (POST)
- `registrations/[regId]/reset-edit-token/route.ts` (POST)
- `registrations/[regId]/resend-edit-link/route.ts` (POST)
- `registrations/[regId]/duplicates/route.ts` (GET)
- `registrations/[regId]/block-email/route.ts` (POST)
- `registrations/[regId]/block-document/route.ts` (POST)
- `registrations/print/route.ts` (POST batch print)
- `registrations/export/route.ts` (GET CSV)
- `categories/route.ts` (GET, POST)
- `categories/[id]/route.ts` (PATCH, DELETE, PATCH reassign)
- `categories/import-templates/route.ts` (POST)
- `members/route.ts` (GET, POST invite)
- `members/[membershipId]/route.ts` (PATCH role, DELETE)
- `settings/route.ts` (GET, PATCH)
- `blocked-emails/route.ts` (GET, POST)
- `blocked-emails/[id]/route.ts` (DELETE)
- `blocked-documents/route.ts` (GET, POST)
- `blocked-documents/[id]/route.ts` (DELETE)
- `scan/verify/route.ts` (POST)
- `activity/route.ts` (GET)

Tests d'intégration :

- `src/lib/__tests__/api-event-registrations.test.ts`
- `src/lib/__tests__/api-event-categories.test.ts`
- `src/lib/__tests__/api-event-members.test.ts`
- `src/lib/__tests__/api-event-settings.test.ts`
- `src/lib/__tests__/api-event-scan.test.ts`
- `src/lib/__tests__/api-event-blocked.test.ts`
- `src/lib/__tests__/event-journey.test.ts` (smoke e2e ADMIN + OPERATOR)

**Files to modify:**

- aucune route v1 n'est modifiée — les anciennes `src/app/api/registrations/*` restent en place ; elles seront supprimées dans le plan 7 (déploiement initial) car incompatibles avec le schéma v2.
- `docs/v2/architecture.md` (Task 22 — note d'avancement post-Plan 4)

**Tests vivent dans `src/lib/__tests__/` (convention v1/Plan 1/Plan 3).**

---

## Pre-flight

### Task 0: Vérifier prérequis Plan 1, Plan 3, et stratégie de stub Plan 6

- [ ] **Step 0.1: Confirmer branche et arbre propre**

```bash
git status && git branch --show-current
```

Expected: branche `feat/v2-sass` (ou dérivée), arbre propre (ou seuls les fichiers de ce plan).

- [ ] **Step 0.2: Vérifier que Plan 1 + Plan 3 sont en place**

```bash
ls src/lib/auth-guards.ts src/lib/user-context.ts src/lib/settings.ts src/lib/activity-log.ts src/lib/with-org-auth.ts src/lib/slugify-event.ts
```

Expected: les 6 fichiers existent. Si l'un manque → **STOP** : exécuter Plan 1 et/ou Plan 3 avant.

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/auth-guards.test.ts src/lib/__tests__/with-org-auth.test.ts
```

Expected: tous passent.

- [ ] **Step 0.3: Vérifier que les types `ActivityType` Plan 1 incluent les events**

```bash
grep -E "REGISTRATION_APPROVED|BADGE_SCANNED|MEMBERSHIP_ADDED|CATEGORY_CREATED|EVENT_SETTINGS_UPDATED|EDIT_LINK_SENT" prisma/schema.prisma
```

Expected: les 6 types sont présents (ajoutés par Plan 1). Si l'un manque → ajouter au schéma Prisma + migration avant d'avancer.

- [ ] **Step 0.4: Vérifier Plan 6 (mail) ou créer stubs typés**

```bash
grep -E "export (async )?function (sendStatusNotification|sendBadgePrintedNotification|sendUserInvitation|sendEditLinkEmail)" src/lib/mail.ts 2>/dev/null
```

Si **les 4 exports** sont présents → Plan 6 mergé, passer à Step 0.6.

Sinon, créer/compléter `src/lib/mail.ts` avec les stubs minimaux (à supprimer une fois Plan 6 mergé) :

```typescript
// [stub Plan 6] À remplacer par l'implémentation Plan 6.
export async function sendStatusNotification(_registrationId: string): Promise<void> {
  console.warn("[stub] sendStatusNotification — Plan 6 not implemented yet");
}

export async function sendBadgePrintedNotification(_registrationId: string): Promise<void> {
  console.warn("[stub] sendBadgePrintedNotification — Plan 6 not implemented yet");
}

export async function sendEditLinkEmail(_registrationId: string): Promise<void> {
  console.warn("[stub] sendEditLinkEmail — Plan 6 not implemented yet");
}

export async function sendUserInvitation(
  _userId: string,
  _opts?: { eventId?: string; orgId?: string; role?: string },
): Promise<void> {
  console.warn("[stub] sendUserInvitation — Plan 6 not implemented yet");
}
```

> Tous les stubs émettent `console.warn("[stub] …")` pour faciliter le repérage. La Task 22 finale vérifie l'absence de `[stub]` dans le code livré (sauf si Plan 6 reste à venir).

- [ ] **Step 0.5: Documenter la stratégie de stub dans le commit**

Si stubs ajoutés :

```bash
git add src/lib/mail.ts
git commit -m "chore(v2): stubs typés mail pour debloquer Plan 4 en attendant Plan 6"
```

- [ ] **Step 0.6: Lancer la suite de tests Plan 1 + Plan 3**

```bash
make test
```

Expected: tous les tests Plan 1 et Plan 3 passent (les nouveaux fichiers de Plan 4 ne sont pas encore créés, pas de régression attendue).

---

## Task 1: `withEventAuth` — wrapper d'API scope-event

**Files:**
- Create: `src/lib/with-event-auth.ts`
- Create: `src/lib/__tests__/with-event-auth.test.ts`

> Objectif : un wrapper qui (1) extrait `orgId` et `eventId` du path, (2) vérifie l'existence de l'event et la cohérence `event.orgId === orgId`, (3) appelle `requireEventRole(userId, eventId, minRole)` (honore héritage OWNER → ADMIN + bypass staff via Plan 1), (4) refuse les events archivés sauf si `allowArchived: true`, (5) refuse les events fermés si `requireRegistrationOpen: true`, (6) délègue au handler avec un contexte typé. Centralise la défense en profondeur côté API event.

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/__tests__/with-event-auth.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function setup() {
  const org = await prisma.organization.create({ data: { name: "Org", slug: `org-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Evt", slug: `evt-${Date.now()}`, location: "L", date: new Date() },
  });
  return { org, event };
}

describe("withEventAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    const { org, event } = await setup();
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const { org } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/missing`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to a different org (URL tampering)", async () => {
    const { event } = await setup();
    const otherOrg = await prisma.organization.create({ data: { name: "Other", slug: "other" } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${otherOrg.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: otherOrg.id, eventId: event.id }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 for user with no membership and not staff", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });

  it("passes for OPERATOR membership when OPERATOR required", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    let captured: { eventId: string; orgId: string; effectiveRole: string | null } | null = null;
    const handler = withEventAuth({ minRole: "OPERATOR" }, async (_req, ctx) => {
      captured = { eventId: ctx.eventId, orgId: ctx.orgId, effectiveRole: ctx.effectiveRole };
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });

    expect(res.status).toBe(200);
    expect(captured).toEqual({ eventId: event.id, orgId: org.id, effectiveRole: "OPERATOR" });
  });

  it("rejects OPERATOR for ADMIN-required route (defense in depth)", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "ADMIN" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });

  it("OWNER of parent org inherits ADMIN on event", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "owner@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    expect(captured).toBe("ADMIN");
  });

  it("staff bypass", async () => {
    const { org, event } = await setup();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.id, email: s.email, name: s.name, isStaff: true } } as any);

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    expect(captured).toBe("STAFF");
  });

  it("refuses archived event by default", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.code).toBe("EVENT_ARCHIVED");
  });

  it("allowArchived=true lets archived events through", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
  });

  it("requireRegistrationOpen=true blocks closed events", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, email: u.email, name: u.name, isStaff: false } } as any);

    const handler = withEventAuth(
      { minRole: "ADMIN", requireRegistrationOpen: true },
      async () => new Response("ok"),
    );
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("REGISTRATION_CLOSED");
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-event-auth.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/with-event-auth'`.

- [ ] **Step 1.3: Implement `src/lib/with-event-auth.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { EventRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireEventRole,
  getEffectiveEventRole,
} from "@/lib/auth-guards";
import type { EffectiveEventRole } from "@/types/auth";

export type EventAuthCtx = {
  orgId: string;
  eventId: string;
  effectiveRole: EffectiveEventRole;
  session: Session;
};

type RouteParams = { params: Promise<{ orgId: string; eventId: string }> };

export type WithEventAuthOptions = {
  minRole: EventRole;
  allowArchived?: boolean;
  requireRegistrationOpen?: boolean;
};

export function withEventAuth(
  options: WithEventAuthOptions,
  handler: (req: NextRequest, ctx: EventAuthCtx, extra: RouteParams) => Promise<Response>,
) {
  return async (req: NextRequest, params: RouteParams): Promise<Response> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, eventId } = await params.params;
    if (!orgId || !eventId) {
      return NextResponse.json({ error: "Missing orgId or eventId" }, { status: 400 });
    }

    // Charge l'event pour verifier la coherence URL (orgId du path doit matcher l'orgId reel)
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, orgId: true, archived: true, registrationOpen: true },
    });
    if (!event || event.orgId !== orgId) {
      // 404 plutot que 403 pour ne pas leaker l'existence d'un event sur une autre org
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (event.archived && !options.allowArchived) {
      return NextResponse.json({ error: "EVENT_ARCHIVED", code: "EVENT_ARCHIVED" }, { status: 410 });
    }

    if (options.requireRegistrationOpen && !event.registrationOpen) {
      return NextResponse.json(
        { error: "REGISTRATION_CLOSED", code: "REGISTRATION_CLOSED" },
        { status: 409 },
      );
    }

    try {
      await requireEventRole(session.user.id, eventId, options.minRole);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }

    const effectiveRole = await getEffectiveEventRole(session.user.id, eventId);

    return handler(req, { orgId, eventId, effectiveRole, session }, params);
  };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/with-event-auth.test.ts
```

Expected: 10 passed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/with-event-auth.ts src/lib/__tests__/with-event-auth.test.ts
git commit -m "feat(v2): wrapper withEventAuth (scope-event pour les routes API)"
```

---

## Task 2: Helpers purs — quota inscriptions, doublons, edit-token, export CSV

**Files:**
- Create: `src/lib/event-quota.ts`
- Create: `src/lib/__tests__/event-quota.test.ts`
- Create: `src/lib/edit-token.ts`
- Create: `src/lib/__tests__/edit-token.test.ts`
- Create: `src/lib/duplicates.ts`
- Create: `src/lib/__tests__/duplicates.test.ts`
- Create: `src/lib/registration-csv.ts`
- Create: `src/lib/__tests__/registration-csv.test.ts`

> 4 helpers indépendants, testables sans Prisma sur la logique pure, avec une fonction Prisma-aware par helper. Regle quota : seules les inscriptions `status IN (PENDING, APPROVED)` comptent dans `quotaMaxRegistrations` (REJECTED exclus). Edit token : `randomBytes(32).toString("hex")` aligné Plan 6, TTL 48h.

### 2.A — `event-quota.ts`

- [ ] **Step 2.1: Write failing tests**

Create `src/lib/__tests__/event-quota.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { countCountableRegistrations, assertQuotaAvailable, QuotaError } from "@/lib/event-quota";

async function setup(quotaMax: number | null = null) {
  const org = await prisma.organization.create({
    data: {
      name: "Q",
      slug: `q-${Date.now()}`,
      quotaMaxRegistrations: quotaMax ?? undefined,
    },
  });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `q-evt-${Date.now()}`, location: "", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  return { org, event, cat };
}

async function mkReg(eventId: string, categoryId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      email: `${Math.random()}@x`,
      lastName: "L",
      firstName: "F",
      structure: "S",
      idDocumentType: "CNI",
      idDocumentNumber: `D-${Math.random()}`,
      status,
    },
  });
}

describe("countCountableRegistrations", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("counts PENDING + APPROVED, ignores REJECTED", async () => {
    const { event, cat } = await setup();
    await mkReg(event.id, cat.id, "PENDING");
    await mkReg(event.id, cat.id, "APPROVED");
    await mkReg(event.id, cat.id, "APPROVED");
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");

    const n = await countCountableRegistrations(event.id);
    expect(n).toBe(3);
  });

  it("returns 0 when no registration", async () => {
    const { event } = await setup();
    expect(await countCountableRegistrations(event.id)).toBe(0);
  });
});

describe("assertQuotaAvailable", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("passes when no quota set", async () => {
    const { event } = await setup(null);
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });

  it("passes when below quota", async () => {
    const { event, cat } = await setup(5);
    await mkReg(event.id, cat.id, "PENDING");
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });

  it("throws QuotaError when at quota", async () => {
    const { event, cat } = await setup(1);
    await mkReg(event.id, cat.id, "APPROVED");
    await expect(assertQuotaAvailable(event.id)).rejects.toBeInstanceOf(QuotaError);
  });

  it("rejected registrations do not consume quota", async () => {
    const { event, cat } = await setup(2);
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");
    await mkReg(event.id, cat.id, "REJECTED");
    await expect(assertQuotaAvailable(event.id)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/event-quota.test.ts
```

Expected: FAIL (`Cannot find module '@/lib/event-quota'`).

- [ ] **Step 2.3: Implement `src/lib/event-quota.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export class QuotaError extends Error {
  constructor(public readonly limit: number, public readonly current: number) {
    super(`QUOTA_EXCEEDED (current=${current}, limit=${limit})`);
  }
}

// Seules les inscriptions PENDING + APPROVED comptent dans le quota.
// Les REJECTED sont exclues (decision spec ll. 244-245).
export async function countCountableRegistrations(eventId: string): Promise<number> {
  return prisma.registration.count({
    where: { eventId, status: { in: ["PENDING", "APPROVED"] } },
  });
}

export async function assertQuotaAvailable(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true, organization: { select: { quotaMaxRegistrations: true } } },
  });
  if (!event) return;
  const limit = event.organization.quotaMaxRegistrations;
  if (limit == null) return;
  const current = await countCountableRegistrations(eventId);
  if (current >= limit) {
    throw new QuotaError(limit, current);
  }
}
```

- [ ] **Step 2.4: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/event-quota.test.ts
```

Expected: 6 passed.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/event-quota.ts src/lib/__tests__/event-quota.test.ts
git commit -m "feat(v2): helper event-quota (compte PENDING+APPROVED, exclut REJECTED)"
```

### 2.B — `edit-token.ts`

- [ ] **Step 2.6: Write failing tests**

Create `src/lib/__tests__/edit-token.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { generateEditToken, isEditTokenExpired, EDIT_TOKEN_TTL_MS } from "@/lib/edit-token";

describe("generateEditToken", () => {
  it("returns 64 hex chars (32 bytes)", () => {
    const t = generateEditToken();
    expect(t.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns expiresAt 48h in the future", () => {
    const now = Date.now();
    const t = generateEditToken();
    const diff = t.expiresAt.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(EDIT_TOKEN_TTL_MS - 1000);
    expect(diff).toBeLessThanOrEqual(EDIT_TOKEN_TTL_MS + 1000);
  });

  it("generates a fresh token each call", () => {
    const a = generateEditToken();
    const b = generateEditToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe("isEditTokenExpired", () => {
  it("returns true when expiresAt is null", () => {
    expect(isEditTokenExpired(null)).toBe(true);
  });

  it("returns true when expiresAt is in the past", () => {
    expect(isEditTokenExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("returns false when expiresAt is in the future", () => {
    expect(isEditTokenExpired(new Date(Date.now() + 1000))).toBe(false);
  });
});
```

- [ ] **Step 2.7: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/edit-token.test.ts
```

Expected: FAIL.

- [ ] **Step 2.8: Implement `src/lib/edit-token.ts`**

```typescript
import { randomBytes } from "crypto";

export const EDIT_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export function generateEditToken(): { token: string; expiresAt: Date } {
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_MS),
  };
}

export function isEditTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}
```

- [ ] **Step 2.9: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/edit-token.test.ts
```

Expected: 6 passed.

- [ ] **Step 2.10: Commit**

```bash
git add src/lib/edit-token.ts src/lib/__tests__/edit-token.test.ts
git commit -m "feat(v2): helper edit-token (randomBytes 32 hex, TTL 48h)"
```

### 2.C — `duplicates.ts`

- [ ] **Step 2.11: Write failing tests**

Create `src/lib/__tests__/duplicates.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { findDuplicatesForRegistration } from "@/lib/duplicates";

async function mkOrgEvt() {
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  return { org, event, cat };
}

async function mkReg(eventId: string, categoryId: string, data: Partial<{ email: string; firstName: string; lastName: string; idDocumentNumber: string }>) {
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      email: data.email ?? `${Math.random()}@x`,
      lastName: data.lastName ?? "L",
      firstName: data.firstName ?? "F",
      structure: "S",
      idDocumentType: "CNI",
      idDocumentNumber: data.idDocumentNumber ?? `D-${Math.random()}`,
    },
  });
}

describe("findDuplicatesForRegistration", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it("matches by same email (same event, different id)", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { email: "x@y.com", firstName: "A" });
    const b = await mkReg(event.id, cat.id, { email: "x@y.com", firstName: "B" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("matches by same idDocumentNumber", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { idDocumentNumber: "DOC-1" });
    const b = await mkReg(event.id, cat.id, { idDocumentNumber: "DOC-1" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("matches by same firstName+lastName combination", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    const b = await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).toEqual([b.id]);
  });

  it("does not return the registration itself", async () => {
    const { event, cat } = await mkOrgEvt();
    const a = await mkReg(event.id, cat.id, { email: "u@u.com" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups.map((d) => d.id)).not.toContain(a.id);
  });

  it("scopes to the same event only", async () => {
    const { event, cat } = await mkOrgEvt();
    const otherOrg = await prisma.organization.create({ data: { name: "B", slug: "b-o" } });
    const otherEvt = await prisma.event.create({
      data: { orgId: otherOrg.id, title: "E2", slug: "e2", location: "", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvt.id, name: "V", color: "#000", number: 1 },
    });
    const a = await mkReg(event.id, cat.id, { email: "same@x" });
    await mkReg(otherEvt.id, otherCat.id, { email: "same@x" });
    const dups = await findDuplicatesForRegistration(a.id);
    expect(dups).toHaveLength(0);
  });

  it("returns empty array when registration unknown", async () => {
    const dups = await findDuplicatesForRegistration("missing");
    expect(dups).toEqual([]);
  });
});
```

- [ ] **Step 2.12: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/duplicates.test.ts
```

Expected: FAIL.

- [ ] **Step 2.13: Implement `src/lib/duplicates.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export type DuplicateMatch = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  idDocumentNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  matchedOn: ("email" | "name" | "document")[];
};

export async function findDuplicatesForRegistration(registrationId: string): Promise<DuplicateMatch[]> {
  const ref = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventId: true,
      email: true,
      firstName: true,
      lastName: true,
      idDocumentNumber: true,
    },
  });
  if (!ref) return [];

  const candidates = await prisma.registration.findMany({
    where: {
      eventId: ref.eventId,
      id: { not: ref.id },
      OR: [
        { email: ref.email },
        { idDocumentNumber: ref.idDocumentNumber },
        { AND: [{ firstName: ref.firstName }, { lastName: ref.lastName }] },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      idDocumentNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.map((c) => {
    const matchedOn: ("email" | "name" | "document")[] = [];
    if (c.email === ref.email) matchedOn.push("email");
    if (c.firstName === ref.firstName && c.lastName === ref.lastName) matchedOn.push("name");
    if (c.idDocumentNumber === ref.idDocumentNumber) matchedOn.push("document");
    return { ...c, matchedOn };
  });
}
```

- [ ] **Step 2.14: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/duplicates.test.ts
```

Expected: 6 passed.

- [ ] **Step 2.15: Commit**

```bash
git add src/lib/duplicates.ts src/lib/__tests__/duplicates.test.ts
git commit -m "feat(v2): helper duplicates (recherche email/document/nom scope event)"
```

### 2.D — `registration-csv.ts`

- [ ] **Step 2.16: Write failing tests**

Create `src/lib/__tests__/registration-csv.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { toRegistrationCsv, escapeCsvField } from "@/lib/registration-csv";

describe("escapeCsvField", () => {
  it("returns plain values unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField("amadou@example.com")).toBe("amadou@example.com");
  });

  it("quotes fields with commas", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
  });

  it("quotes fields with newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes inner double quotes by doubling", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("renders null/undefined as empty string", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("toRegistrationCsv", () => {
  it("returns header + rows in canonical order", () => {
    const csv = toRegistrationCsv([
      {
        id: "R1",
        firstName: "Amadou",
        lastName: "Diallo",
        email: "a@x",
        structure: "ENSEA",
        categoryName: "VIP",
        status: "APPROVED",
        idDocumentType: "CNI",
        idDocumentNumber: "ABC",
        badgePrinted: true,
        allAccessGranted: false,
        createdAt: new Date("2026-05-01T10:00:00Z"),
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "id,firstName,lastName,email,structure,category,status,idDocumentType,idDocumentNumber,badgePrinted,allAccess,createdAt",
    );
    expect(lines[1]).toContain("R1");
    expect(lines[1]).toContain("Amadou");
    expect(lines[1]).toContain("APPROVED");
    expect(lines[1]).toContain("true");
  });

  it("returns header only on empty input", () => {
    const csv = toRegistrationCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("escapes commas in names", () => {
    const csv = toRegistrationCsv([
      {
        id: "R1",
        firstName: "Jean, Paul",
        lastName: "Doe",
        email: "x@x",
        structure: "S",
        categoryName: "Cat",
        status: "PENDING",
        idDocumentType: "CNI",
        idDocumentNumber: "X",
        badgePrinted: false,
        allAccessGranted: false,
        createdAt: new Date(),
      },
    ]);
    expect(csv).toContain('"Jean, Paul"');
  });
});
```

- [ ] **Step 2.17: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-csv.test.ts
```

Expected: FAIL.

- [ ] **Step 2.18: Implement `src/lib/registration-csv.ts`**

```typescript
export type RegistrationCsvRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  categoryName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  idDocumentType: string;
  idDocumentNumber: string;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
};

const HEADER = [
  "id",
  "firstName",
  "lastName",
  "email",
  "structure",
  "category",
  "status",
  "idDocumentType",
  "idDocumentNumber",
  "badgePrinted",
  "allAccess",
  "createdAt",
];

export function escapeCsvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toRegistrationCsv(rows: RegistrationCsvRow[]): string {
  const out: string[] = [HEADER.join(",")];
  for (const r of rows) {
    out.push(
      [
        escapeCsvField(r.id),
        escapeCsvField(r.firstName),
        escapeCsvField(r.lastName),
        escapeCsvField(r.email),
        escapeCsvField(r.structure),
        escapeCsvField(r.categoryName),
        escapeCsvField(r.status),
        escapeCsvField(r.idDocumentType),
        escapeCsvField(r.idDocumentNumber),
        escapeCsvField(r.badgePrinted),
        escapeCsvField(r.allAccessGranted),
        escapeCsvField(r.createdAt.toISOString()),
      ].join(","),
    );
  }
  return out.join("\n");
}
```

- [ ] **Step 2.19: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/registration-csv.test.ts
```

Expected: 8 passed.

- [ ] **Step 2.20: Commit**

```bash
git add src/lib/registration-csv.ts src/lib/__tests__/registration-csv.test.ts
git commit -m "feat(v2): helper registration-csv (export inscriptions au format CSV)"
```

---

## Task 3: `EventShell` + `EventOperatorShell` + layout `/admin/[orgId]/events/[eventId]`

**Files:**
- Create: `src/components/event/EventShell.tsx`
- Create: `src/components/event/EventOperatorShell.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/layout.tsx`

> Le layout charge l'event + le role effectif, et choisit le shell : `EventShell` (sidebar complete) pour ADMIN/STAFF, `EventOperatorShell` (sidebar Scanner + Profil uniquement) pour OPERATOR. Refus si pas de droits. La spec impose : "Un OPERATOR ne voit que `/scan` et `/profile` dans la sidebar" (critere d'acceptation #1).

- [ ] **Step 3.1: Create `src/components/event/EventShell.tsx`**

```typescript
import Link from "next/link";

type Event = { id: string; title: string; slug: string; date: Date; archived: boolean; registrationOpen: boolean };
type Org = { id: string; name: string };

export function EventShell({
  org,
  event,
  effectiveRole,
  isStaffMode,
  user,
  children,
}: {
  org: Org;
  event: Event;
  effectiveRole: "ADMIN" | "OPERATOR" | "STAFF";
  isStaffMode: boolean;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const base = `/admin/${org.id}/events/${event.id}`;
  const nav = [
    { href: base, label: "Tableau de bord" },
    { href: `${base}/registrations`, label: "Inscriptions" },
    { href: `${base}/badges`, label: "Badges" },
    { href: `${base}/categories`, label: "Catégories" },
    { href: `${base}/members`, label: "Membres" },
    { href: `${base}/settings`, label: "Paramètres" },
    { href: `${base}/activity`, label: "Journal" },
    { href: `${base}/scan`, label: "Scanner" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <Link href={`/admin/${org.id}/events`} className="text-xs text-gray-400 hover:underline">
          ← {org.name}
        </Link>
        <div className="text-lg font-bold mb-1 mt-2">{event.title}</div>
        <div className="text-xs text-gray-400 mb-6">
          {new Date(event.date).toLocaleDateString("fr-FR")}
          {event.archived && <span className="ml-2 px-2 py-0.5 rounded bg-gray-700 text-xs">Archivé</span>}
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">{user.name}</div>
      </aside>
      <div className="flex-1 flex flex-col">
        {isStaffMode && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
            <strong>Mode staff</strong> — vos actions sont auditées et visibles par le OWNER.
          </div>
        )}
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {org.name} <span className="px-1 text-gray-300">/</span> Événement
            <span className="ml-3 px-2 py-0.5 rounded bg-gray-100 text-xs">{effectiveRole}</span>
          </div>
          <Link href="/profile" className="text-sm text-gray-700 hover:underline">
            {user.email}
          </Link>
        </header>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Create `src/components/event/EventOperatorShell.tsx`**

```typescript
import Link from "next/link";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

export function EventOperatorShell({
  org,
  event,
  user,
  children,
}: {
  org: Org;
  event: Event;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const base = `/admin/${org.id}/events/${event.id}`;
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <div className="text-xs text-gray-400">{org.name}</div>
        <div className="text-lg font-bold mb-6 mt-2">{event.title}</div>
        <nav className="flex-1 space-y-1">
          <Link href={`${base}/scan`} className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
            Scanner
          </Link>
          <Link href="/profile" className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
            Profil
          </Link>
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">{user.name}</div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Opérateur — {event.title}
          </div>
          <Link href="/profile" className="text-sm text-gray-700 hover:underline">
            {user.email}
          </Link>
        </header>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3: Create `src/app/admin/[orgId]/events/[eventId]/layout.tsx`**

```typescript
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole, hasOrgRole } from "@/lib/auth-helpers";
import { EventShell } from "@/components/event/EventShell";
import { EventOperatorShell } from "@/components/event/EventOperatorShell";

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  children: React.ReactNode;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/${orgId}/events/${eventId}`);
  }

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      archived: true,
      registrationOpen: true,
      orgId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, event.id, event.orgId);
  if (!role) {
    // Pas de droits sur cet event
    redirect("/select");
  }

  const isStaffMode = ctx.isStaff && !hasOrgRole(ctx, event.orgId, "OWNER") && !ctx.eventMemberships.some((m) => m.eventId === event.id);

  if (role === "OPERATOR") {
    return (
      <EventOperatorShell
        org={{ id: event.organization.id, name: event.organization.name }}
        event={{ id: event.id, title: event.title }}
        user={{ name: ctx.user.name, email: ctx.user.email }}
      >
        {children}
      </EventOperatorShell>
    );
  }

  return (
    <EventShell
      org={{ id: event.organization.id, name: event.organization.name }}
      event={event}
      effectiveRole={role}
      isStaffMode={isStaffMode}
      user={{ name: ctx.user.name, email: ctx.user.email }}
    >
      {children}
    </EventShell>
  );
}
```

- [ ] **Step 3.4: Typecheck**

```bash
docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit 2>&1 | grep -E "components/event/Event(Shell|OperatorShell)|app/admin/\[orgId\]/events/\[eventId\]/layout" || true
```

Expected: aucune erreur sur ces fichiers.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/event/EventShell.tsx src/components/event/EventOperatorShell.tsx "src/app/admin/[orgId]/events/[eventId]/layout.tsx"
git commit -m "feat(v2): layout event + shells ADMIN/OPERATOR (sidebar restreinte OPERATOR)"
```

---

## Task 4: Dashboard event (`page.tsx`) + GET/PATCH `/api/admin/[orgId]/events/[eventId]`

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/route.ts`
- Create: `src/app/admin/[orgId]/events/[eventId]/page.tsx`
- Create test entries in `src/lib/__tests__/api-event-settings.test.ts`

> Le dashboard ADMIN affiche les KPI (status counts, badges imprimés, quota, dernières inscriptions, mini-chart 30j). Le dashboard OPERATOR affiche "Mes scans" + CTA `/scan`.

- [ ] **Step 4.1: Write failing tests for PATCH (title, location, date, logo, registrationOpen)**

Create `src/lib/__tests__/api-event-settings.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedAdmin() {
  const u = await prisma.user.create({ data: { email: `a-${Date.now()}@x`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Old", slug: `evt-${Date.now()}`, location: "L", date: new Date("2026-12-01") },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("PATCH /api/admin/[orgId]/events/[eventId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("ADMIN updates title, location, date, registrationOpen", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "New",
        location: "Paris",
        date: "2026-12-15",
        registrationOpen: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.title).toBe("New");
    expect(updated?.location).toBe("Paris");
    expect(updated?.registrationOpen).toBe(true);
    expect(updated?.date.toISOString().slice(0, 10)).toBe("2026-12-15");
  });

  it("slug is immutable for non-staff (ignored silently)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).not.toBe("new-slug");
  });

  it("staff can update slug", async () => {
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-staff" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "old-slug", location: "L", date: new Date() },
    });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).toBe("new-slug");
  });

  it("toggle registrationOpen=true emits EVENT_REGISTRATION_OPENED log", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ registrationOpen: true }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_REGISTRATION_OPENED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot PATCH event (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "evt-op", location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-settings.test.ts
```

Expected: FAIL.

- [ ] **Step 4.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (_req, { eventId }) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      location: true,
      date: true,
      logo: true,
      registrationOpen: true,
      archived: true,
      createdAt: true,
      orgId: true,
      organization: { select: { id: true, name: true, slug: true, quotaMaxRegistrations: true } },
      _count: { select: { registrations: true, categories: true, memberships: true } },
    },
  });
  if (!event) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ event });
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  logo: z.string().nullable().optional(),
  registrationOpen: z.boolean().optional(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN", allowArchived: false }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const before = await prisma.event.findUnique({
    where: { id: eventId },
    select: { registrationOpen: true },
  });

  const data: any = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);
  if (parsed.data.logo !== undefined) data.logo = parsed.data.logo;
  if (parsed.data.registrationOpen !== undefined) data.registrationOpen = parsed.data.registrationOpen;
  if (parsed.data.slug !== undefined && session.user.isStaff) data.slug = parsed.data.slug;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const event = await prisma.event.update({ where: { id: eventId }, data });

    await logActivity({
      type: "EVENT_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { changedFields: Object.keys(data) },
      req,
    });

    if (parsed.data.registrationOpen !== undefined && before?.registrationOpen !== parsed.data.registrationOpen) {
      await logActivity({
        type: parsed.data.registrationOpen ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED",
        userId: session.user.id,
        orgId,
        eventId,
        req,
      });
    }

    return NextResponse.json({ event });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 4.4: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-settings.test.ts
```

Expected: 5 passed.

- [ ] **Step 4.5: Implement dashboard page**

Create `src/app/admin/[orgId]/events/[eventId]/page.tsx` :

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";
import { countCountableRegistrations } from "@/lib/event-quota";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, title: true, organization: { select: { quotaMaxRegistrations: true } } },
  });
  if (!event || event.orgId !== orgId) redirect("/select");

  const role = effectiveEventRole(ctx, event.id, event.orgId);

  if (role === "OPERATOR") {
    const myScans = await prisma.activityLog.count({
      where: { type: "BADGE_SCANNED", userId: ctx.user.id, eventId },
    });
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="text-2xl font-bold">Tableau de bord opérateur</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Kpi label="Mes scans" value={myScans} />
          <Link
            href={`/admin/${orgId}/events/${eventId}/scan`}
            className="rounded border bg-white p-4 hover:bg-gray-50 flex items-center justify-center text-lg font-semibold"
          >
            Ouvrir le scanner
          </Link>
        </div>
      </div>
    );
  }

  const [pending, approved, rejected, badgesPrinted, scansToday, scansTotal, latest, quota30d] =
    await Promise.all([
      prisma.registration.count({ where: { eventId, status: "PENDING" } }),
      prisma.registration.count({ where: { eventId, status: "APPROVED" } }),
      prisma.registration.count({ where: { eventId, status: "REJECTED" } }),
      prisma.registration.count({ where: { eventId, badgePrinted: true } }),
      prisma.activityLog.count({
        where: {
          type: "BADGE_SCANNED",
          eventId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.activityLog.count({ where: { type: "BADGE_SCANNED", eventId } }),
      prisma.registration.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true },
      }),
      countCountableRegistrations(eventId),
    ]);

  const quotaMax = event.organization.quotaMaxRegistrations;
  const quotaPct = quotaMax != null ? Math.round((quota30d / quotaMax) * 100) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{event.title} — Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="En attente" value={pending} />
        <Kpi label="Approuvées" value={approved} />
        <Kpi label="Rejetées" value={rejected} />
        <Kpi label="Badges imprimés" value={badgesPrinted} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Scans aujourd'hui" value={scansToday} />
        <Kpi label="Scans total" value={scansTotal} />
        <Kpi
          label="Quota inscriptions"
          value={quotaMax != null ? `${quota30d}/${quotaMax}` : "—"}
          warn={quotaPct != null && quotaPct > 80}
        />
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Dernières inscriptions</h2>
          <Link href={`/admin/${orgId}/events/${eventId}/registrations`} className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {latest.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucune inscription pour le moment.</li>
          )}
          {latest.map((r) => (
            <li key={r.id} className="px-4 py-3 flex justify-between text-sm">
              <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="hover:underline">
                {r.firstName} {r.lastName} <span className="text-gray-400">— {r.email}</span>
              </Link>
              <span className="text-xs text-gray-500">
                {r.status} — {new Date(r.createdAt).toLocaleDateString("fr-FR")}
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
      className={`rounded border p-4 bg-white ${warn ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 4.6: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/route.ts" "src/app/admin/[orgId]/events/[eventId]/page.tsx" src/lib/__tests__/api-event-settings.test.ts
git commit -m "feat(v2): dashboard event + GET/PATCH route event (variante OPERATOR)"
```

---

## Task 5: Categories — CRUD scope event + import templates

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/categories/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/categories/import-templates/route.ts`
- Create: `src/components/event/CategoryForm.tsx`
- Create: `src/components/event/CategoryTable.tsx`
- Create: `src/components/event/CategoryReassignModal.tsx`
- Create: `src/components/event/CategoryImportTemplatesModal.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/categories/page.tsx`
- Create: `src/lib/__tests__/api-event-categories.test.ts`

> Regles : (1) `number` unique au sein de l'event (DB-level) ; collision = 409. (2) Suppression refusee si registrations liees (409 + code `CATEGORY_HAS_REGISTRATIONS`). (3) Import templates : copie name/color/number/neutralBadge/anonymous depuis `CategoryTemplate` ; renumerote les collisions au sein du batch.

- [ ] **Step 5.1: Write failing tests**

Create `src/lib/__tests__/api-event-categories.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedAdmin() {
  const u = await prisma.user.create({ data: { email: `a-${Date.now()}@x`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("POST /api/admin/[orgId]/events/[eventId]/categories", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates a category and writes audit", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "VIP", color: "#ff0000", number: 1, neutralBadge: false, anonymous: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const cat = await prisma.category.findFirst({ where: { eventId: event.id } });
    expect(cat?.name).toBe("VIP");
    expect(cat?.number).toBe(1);

    const log = await prisma.activityLog.findFirst({ where: { type: "CATEGORY_CREATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("refuses duplicate number within event (409)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.category.create({ data: { eventId: event.id, name: "A", color: "#fff", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "B", color: "#000", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NUMBER_TAKEN");
  });

  it("OPERATOR cannot POST categories (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evt-op", location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: "X", color: "#fff", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/[orgId]/events/[eventId]/categories/[id]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("refuses deletion when registrations linked (409 CATEGORY_HAS_REGISTRATIONS)", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000", number: 1 } });
    await prisma.registration.create({
      data: {
        id: "REG1",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories/${cat.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CATEGORY_HAS_REGISTRATIONS");
    expect(json.count).toBe(1);
  });

  it("deletes empty category", async () => {
    const { u, org, event } = await seedAdmin();
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "VIP", color: "#000", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories/${cat.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id }),
    });
    expect(res.status).toBe(204);
    const after = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(after).toBeNull();
  });
});

describe("POST /api/admin/[orgId]/events/[eventId]/categories/import-templates", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("copies templates to categories, renumbering on collision", async () => {
    const { u, org, event } = await seedAdmin();
    const t1 = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    const t2 = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Invité", color: "#00ff00", number: 2 },
    });
    await prisma.category.create({ data: { eventId: event.id, name: "Existing", color: "#000", number: 1 } });

    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t1.id, t2.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const cats = await prisma.category.findMany({ where: { eventId: event.id }, orderBy: { number: "asc" } });
    expect(cats).toHaveLength(3);
    const numbers = cats.map((c) => c.number);
    expect(new Set(numbers).size).toBe(3); // tous distincts
  });

  it("refuses templates from another org", async () => {
    const { u, org, event } = await seedAdmin();
    const otherOrg = await prisma.organization.create({ data: { name: "Z", slug: "z-o" } });
    const t = await prisma.categoryTemplate.create({
      data: { orgId: otherOrg.id, name: "X", color: "#000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/import-templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories/import-templates`, {
      method: "POST",
      body: JSON.stringify({ templateIds: [t.id] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-categories.test.ts
```

Expected: FAIL.

- [ ] **Step 5.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/categories/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (_req, { eventId }) => {
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      number: true,
      neutralBadge: true,
      anonymous: true,
      _count: { select: { registrations: true } },
    },
  });
  return NextResponse.json({ categories });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  number: z.number().int().min(0).max(999),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({
      data: { eventId, ...parsed.data },
    });
    await logActivity({
      type: "CATEGORY_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: category.id,
      details: { name: parsed.data.name, number: parsed.data.number },
      req,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
      const code = target.includes("number") ? "NUMBER_TAKEN" : target.includes("name") ? "NAME_TAKEN" : "CONFLICT";
      return NextResponse.json({ error: code, code }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 5.4: Implement `src/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  number: z.number().int().min(0).max(999).optional(),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
  reassignToCategoryId: z.string().optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = await extra.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { reassignToCategoryId, ...updates } = parsed.data;

  if (reassignToCategoryId) {
    const target = await prisma.category.findUnique({ where: { id: reassignToCategoryId } });
    if (!target || target.eventId !== eventId || target.id === id) {
      return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
    }
    await prisma.registration.updateMany({
      where: { categoryId: id },
      data: { categoryId: reassignToCategoryId },
    });
  }

  if (Object.keys(updates).length === 0 && !reassignToCategoryId) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const category = Object.keys(updates).length
      ? await prisma.category.update({ where: { id }, data: updates })
      : await prisma.category.findUnique({ where: { id } });

    await logActivity({
      type: "CATEGORY_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: id,
      details: { changedFields: Object.keys(parsed.data) },
      req,
    });
    return NextResponse.json({ category });
  } catch (err: any) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
      const code = target.includes("number") ? "NUMBER_TAKEN" : "CONFLICT";
      return NextResponse.json({ error: code, code }, { status: 409 });
    }
    throw err;
  }
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = await extra.params;
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, eventId: true, name: true, _count: { select: { registrations: true } } },
  });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (existing._count.registrations > 0) {
    return NextResponse.json(
      {
        error: "CATEGORY_HAS_REGISTRATIONS",
        code: "CATEGORY_HAS_REGISTRATIONS",
        count: existing._count.registrations,
        message: "Réaffectez les inscriptions à une autre catégorie avant de supprimer.",
      },
      { status: 409 },
    );
  }

  await prisma.category.delete({ where: { id } });
  await logActivity({
    type: "CATEGORY_DELETED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: id,
    details: { name: existing.name },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 5.5: Implement `src/app/api/admin/[orgId]/events/[eventId]/categories/import-templates/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({
  templateIds: z.array(z.string().min(1)).min(1).max(50),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const templates = await prisma.categoryTemplate.findMany({
    where: { id: { in: parsed.data.templateIds }, orgId },
  });
  if (templates.length !== parsed.data.templateIds.length) {
    return NextResponse.json({ error: "TEMPLATES_NOT_FOUND_IN_ORG" }, { status: 400 });
  }

  const existing = await prisma.category.findMany({
    where: { eventId },
    select: { number: true, name: true },
  });
  const usedNumbers = new Set(existing.map((c) => c.number));
  const usedNames = new Set(existing.map((c) => c.name));
  let nextFree = 1;
  function allocateNumber(preferred: number): number {
    if (!usedNumbers.has(preferred)) {
      usedNumbers.add(preferred);
      return preferred;
    }
    while (usedNumbers.has(nextFree)) nextFree++;
    usedNumbers.add(nextFree);
    return nextFree++;
  }
  function allocateName(preferred: string): string {
    if (!usedNames.has(preferred)) {
      usedNames.add(preferred);
      return preferred;
    }
    let i = 2;
    while (usedNames.has(`${preferred} (${i})`)) i++;
    const name = `${preferred} (${i})`;
    usedNames.add(name);
    return name;
  }

  const created = await prisma.$transaction(
    templates.map((t) =>
      prisma.category.create({
        data: {
          eventId,
          name: allocateName(t.name),
          color: t.color,
          number: allocateNumber(t.number),
          neutralBadge: t.neutralBadge,
          anonymous: t.anonymous,
        },
      }),
    ),
  );

  for (const c of created) {
    await logActivity({
      type: "CATEGORY_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: c.id,
      details: { name: c.name, number: c.number, source: "template" },
      req,
    });
  }

  return NextResponse.json({ categories: created }, { status: 201 });
});
```

- [ ] **Step 5.6: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-categories.test.ts
```

Expected: 7 passed.

- [ ] **Step 5.7: Create UI components**

Create `src/components/event/CategoryForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Initial = { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };

export function CategoryForm({
  orgId,
  eventId,
  initial,
  onSaved,
}: {
  orgId: string;
  eventId: string;
  initial?: Initial;
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
      ? `/api/admin/${orgId}/events/${eventId}/categories/${initial.id}`
      : `/api/admin/${orgId}/events/${eventId}/categories`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, number, neutralBadge, anonymous }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.code === "NUMBER_TAKEN") setErr(`Le numéro ${number} est déjà utilisé dans cet événement.`);
      else if (json.code === "NAME_TAKEN") setErr(`Le nom « ${name} » est déjà utilisé dans cet événement.`);
      else setErr("Échec de l'enregistrement.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">{initial ? "Modifier" : "Nouvelle"} catégorie</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex items-center gap-2">
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <Input
          type="number"
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
          min={0}
          max={999}
          className="w-24"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={neutralBadge} onChange={(e) => setNeutralBadge(e.target.checked)} />
        Badge neutre (couleur grise sur le PDF)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Anonyme (pas de nom ni de photo sur le badge)
      </label>
      <Button type="submit">{initial ? "Mettre à jour" : "Créer"}</Button>
    </form>
  );
}
```

- [ ] **Step 5.8: Create `src/components/event/CategoryReassignModal.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Cat = { id: string; name: string; number: number };

export function CategoryReassignModal({
  orgId,
  eventId,
  fromCategory,
  candidates,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  fromCategory: Cat;
  candidates: Cat[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState<string>(candidates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${fromCategory.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reassignToCategoryId: target }),
    });
    if (!res.ok) {
      setErr("Échec de la réaffectation.");
      setBusy(false);
      return;
    }
    const del = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${fromCategory.id}`, {
      method: "DELETE",
    });
    if (!del.ok) {
      setErr("Réaffectation OK mais suppression refusée.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
      <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
        <h3 className="font-semibold">Réaffecter les inscriptions de « {fromCategory.name} »</h3>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune autre catégorie disponible. Créez-en une d'abord.</p>
        ) : (
          <>
            <label className="text-sm block">Vers :</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.number} — {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy || candidates.length === 0}>
            {busy ? "..." : "Réaffecter et supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.9: Create `src/components/event/CategoryImportTemplatesModal.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Tpl = { id: string; name: string; color: string; number: number };

export function CategoryImportTemplatesModal({
  orgId,
  eventId,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/${orgId}/templates`)
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []))
      .catch(() => setErr("Impossible de charger les modèles."));
  }, [orgId]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    if (selected.length === 0) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/import-templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateIds: selected }),
    });
    if (!res.ok) {
      setErr("Échec de l'import.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3">
        <h3 className="font-semibold">Importer des modèles de catégories</h3>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun modèle disponible pour cette organisation.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y border rounded">
            {templates.map((t) => (
              <li key={t.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                <span className="inline-block w-4 h-4 rounded" style={{ background: t.color }} />
                <span>#{t.number}</span>
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy || selected.length === 0}>
            {busy ? "..." : `Importer (${selected.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.10: Create `src/components/event/CategoryTable.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryForm } from "./CategoryForm";
import { CategoryReassignModal } from "./CategoryReassignModal";
import { CategoryImportTemplatesModal } from "./CategoryImportTemplatesModal";

type Cat = { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean; _count: { registrations: number } };

export function CategoryTable({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Cat[];
}) {
  const [cats, setCats] = useState(initial);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reassign, setReassign] = useState<Cat | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories`);
    const json = await res.json();
    setCats(json.categories);
    setEditing(null);
    setAdding(false);
    setImporting(false);
    setReassign(null);
  }

  async function remove(c: Cat) {
    if (c._count.registrations > 0) {
      setReassign(c);
      return;
    }
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.code === "CATEGORY_HAS_REGISTRATIONS") {
        setReassign(c);
        return;
      }
      alert("Échec de la suppression.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <div className="space-x-2">
          {!adding && !editing && (
            <>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Importer un modèle
              </Button>
              <Button onClick={() => setAdding(true)}>Nouvelle catégorie</Button>
            </>
          )}
        </div>
      </div>

      {adding && <CategoryForm orgId={orgId} eventId={eventId} onSaved={refresh} />}
      {editing && <CategoryForm orgId={orgId} eventId={eventId} initial={editing} onSaved={refresh} />}
      {importing && (
        <CategoryImportTemplatesModal orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setImporting(false)} />
      )}
      {reassign && (
        <CategoryReassignModal
          orgId={orgId}
          eventId={eventId}
          fromCategory={reassign}
          candidates={cats.filter((c) => c.id !== reassign.id)}
          onDone={refresh}
          onCancel={() => setReassign(null)}
        />
      )}

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Couleur</th>
            <th className="px-3 py-2">Neutre</th>
            <th className="px-3 py-2">Anonyme</th>
            <th className="px-3 py-2">Inscriptions</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {cats.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                Aucune catégorie. Créez la première.
              </td>
            </tr>
          )}
          {cats.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-3 py-2">{c.number}</td>
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2">
                <span className="inline-block w-4 h-4 rounded mr-1 align-middle" style={{ background: c.color }} />
                {c.color}
              </td>
              <td className="px-3 py-2">{c.neutralBadge ? "oui" : "non"}</td>
              <td className="px-3 py-2">{c.anonymous ? "oui" : "non"}</td>
              <td className="px-3 py-2">{c._count.registrations}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <Button variant="secondary" onClick={() => setEditing(c)}>
                  Éditer
                </Button>
                <Button variant="secondary" onClick={() => remove(c)}>
                  Supprimer
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

- [ ] **Step 5.11: Create `src/app/admin/[orgId]/events/[eventId]/categories/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { CategoryTable } from "@/components/event/CategoryTable";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      number: true,
      neutralBadge: true,
      anonymous: true,
      _count: { select: { registrations: true } },
    },
  });
  return <CategoryTable orgId={orgId} eventId={eventId} initial={categories} />;
}
```

- [ ] **Step 5.12: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/categories" "src/app/admin/[orgId]/events/[eventId]/categories" src/components/event/Category*.tsx src/lib/__tests__/api-event-categories.test.ts
git commit -m "feat(v2): CRUD categories event + import templates + reassign avant suppression"
```

---

## Task 6: Members event — GET + POST invite + PATCH/DELETE

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/members/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/members/[membershipId]/route.ts`
- Create: `src/components/event/MemberInviteForm.tsx`
- Create: `src/components/event/MemberTable.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/members/page.tsx`
- Create: `src/lib/__tests__/api-event-members.test.ts`

> Invitation : si user existe (par email), crée juste l'EventMembership. Sinon, crée le User avec un `inviteToken` (`randomBytes(32).toString("hex")`) + envoie `sendUserInvitation(userId, { eventId, role })` (Plan 6 stub si absent). Email contextualisé "Vous avez été invité à [Event] en tant que [Rôle]".

- [ ] **Step 6.1: Write failing tests**

Create `src/lib/__tests__/api-event-members.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<any>("@/lib/mail");
  return {
    ...actual,
    sendUserInvitation: vi.fn(async () => undefined),
  };
});
import { sendUserInvitation } from "@/lib/mail";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedAdmin() {
  const u = await prisma.user.create({ data: { email: `a-${Date.now()}@x`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("POST /api/admin/[orgId]/events/[eventId]/members (invite)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendUserInvitation).mockClear();
  });

  it("adds membership when user exists by email", async () => {
    const { u, org, event } = await seedAdmin();
    const existing = await prisma.user.create({ data: { email: "op@x.com", password: "x", name: "Op" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "op@x.com", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const m = await prisma.eventMembership.findFirst({ where: { eventId: event.id, userId: existing.id } });
    expect(m?.role).toBe("OPERATOR");
    // user existe deja -> pas d'email d'invitation
    expect(vi.mocked(sendUserInvitation)).not.toHaveBeenCalled();
  });

  it("creates user + invite when email is new", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "newuser@x.com", name: "New User", role: "ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "newuser@x.com" } });
    expect(created).not.toBeNull();
    expect(created?.inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(vi.mocked(sendUserInvitation)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserInvitation).mock.calls[0][1]).toMatchObject({ eventId: event.id, role: "ADMIN" });
  });

  it("rejects duplicate membership (409)", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "dup@x", password: "x", name: "D" } });
    await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "dup@x", role: "ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
  });

  it("OPERATOR cannot invite (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op", location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "x@x", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/[orgId]/events/[eventId]/members/[membershipId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("removes membership and logs MEMBERSHIP_REMOVED", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "y@x", password: "x", name: "Y" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/members/${m.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id }),
    });
    expect(res.status).toBe(204);
    const log = await prisma.activityLog.findFirst({ where: { type: "MEMBERSHIP_REMOVED" } });
    expect(log?.eventId).toBe(event.id);
  });
});
```

- [ ] **Step 6.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-members.test.ts
```

Expected: FAIL.

- [ ] **Step 6.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/members/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, { eventId }) => {
  const members = await prisma.eventMembership.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, isStaff: true } },
    },
  });
  return NextResponse.json({ members });
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["ADMIN", "OPERATOR"]),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  let user = await prisma.user.findUnique({ where: { email } });
  const wasNew = !user;

  if (!user) {
    const inviteToken = randomBytes(32).toString("hex");
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name ?? email.split("@")[0],
        password: randomBytes(16).toString("hex"), // placeholder, will be replaced via setup-password
        inviteToken,
        inviteTokenExpiry,
      },
    });
    await logActivity({
      type: "USER_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: user.id,
      details: { email, via: "event-invite" },
      req,
    });
  }

  try {
    const membership = await prisma.eventMembership.create({
      data: { eventId, userId: user.id, role: parsed.data.role },
    });
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: user.id,
      details: { membershipId: membership.id, role: parsed.data.role, scope: "event" },
      req,
    });

    if (wasNew) {
      try {
        await sendUserInvitation(user.id, { eventId, orgId, role: parsed.data.role });
      } catch (e) {
        console.error("[mail] sendUserInvitation failed", e);
      }
    }

    return NextResponse.json({ membership: { id: membership.id, role: membership.role } }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "ALREADY_MEMBER", code: "ALREADY_MEMBER" }, { status: 409 });
    }
    throw err;
  }
});
```

- [ ] **Step 6.4: Implement `src/app/api/admin/[orgId]/events/[eventId]/members/[membershipId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const patchSchema = z.object({ role: z.enum(["ADMIN", "OPERATOR"]) });

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { membershipId } = await extra.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.eventMembership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await prisma.eventMembership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
  });
  await logActivity({
    type: "MEMBERSHIP_ROLE_CHANGED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: updated.userId,
    details: { from: existing.role, to: parsed.data.role, scope: "event" },
    req,
  });
  return NextResponse.json({ membership: updated });
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { membershipId } = await extra.params;
  const existing = await prisma.eventMembership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.eventMembership.delete({ where: { id: membershipId } });
  await logActivity({
    type: "MEMBERSHIP_REMOVED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: existing.userId,
    details: { role: existing.role, scope: "event" },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 6.5: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-members.test.ts
```

Expected: 5 passed.

- [ ] **Step 6.6: Create UI**

Create `src/components/event/MemberInviteForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function MemberInviteForm({
  orgId,
  eventId,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR">("OPERATOR");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, role }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.code === "ALREADY_MEMBER") setErr("Cet utilisateur est déjà membre de l'événement.");
      else setErr("Échec de l'invitation.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">Inviter un membre</h3>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input placeholder="Nom (optionnel si l'utilisateur existe)" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "OPERATOR")} className="border rounded px-2 py-1 text-sm">
        <option value="OPERATOR">Opérateur (scan uniquement)</option>
        <option value="ADMIN">Administrateur</option>
      </select>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "..." : "Inviter"}
        </Button>
      </div>
    </form>
  );
}
```

Create `src/components/event/MemberTable.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MemberInviteForm } from "./MemberInviteForm";

type Member = {
  id: string;
  role: "ADMIN" | "OPERATOR";
  createdAt: string;
  user: { id: string; email: string; name: string; isStaff: boolean };
};

export function MemberTable({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Member[];
}) {
  const [members, setMembers] = useState(initial);
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/members`);
    const json = await res.json();
    setMembers(json.members);
    setInviting(false);
  }

  async function setRole(m: Member, role: "ADMIN" | "OPERATOR") {
    await fetch(`/api/admin/${orgId}/events/${eventId}/members/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  async function remove(m: Member) {
    if (!confirm(`Retirer ${m.user.email} ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/members/${m.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Membres</h1>
        {!inviting && <Button onClick={() => setInviting(true)}>Inviter</Button>}
      </div>
      {inviting && <MemberInviteForm orgId={orgId} eventId={eventId} onDone={refresh} onCancel={() => setInviting(false)} />}
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Rôle</th>
            <th className="px-3 py-2">Depuis</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                Aucun membre. Invitez le premier opérateur.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="px-3 py-2 font-medium">{m.user.name}</td>
              <td className="px-3 py-2">{m.user.email}</td>
              <td className="px-3 py-2">
                <select
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as "ADMIN" | "OPERATOR")}
                  className="border rounded px-2 py-1 text-xs"
                >
                  <option value="OPERATOR">Opérateur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(m.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(m)}>
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

- [ ] **Step 6.7: Create page**

Create `src/app/admin/[orgId]/events/[eventId]/members/page.tsx` :

```typescript
import { prisma } from "@/lib/prisma";
import { MemberTable } from "@/components/event/MemberTable";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const members = await prisma.eventMembership.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, isStaff: true } },
    },
  });
  const serialised = members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  return <MemberTable orgId={orgId} eventId={eventId} initial={serialised} />;
}
```

- [ ] **Step 6.8: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/members" "src/app/admin/[orgId]/events/[eventId]/members" src/components/event/Member*.tsx src/lib/__tests__/api-event-members.test.ts
git commit -m "feat(v2): membres event (GET liste, POST invite ADMIN/OPERATOR, PATCH role, DELETE)"
```

---

## Task 7: EventSettings — GET / PATCH

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/settings/route.ts`
- Create: `src/components/event/EventSettingsForm.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/settings/page.tsx`
- Add tests in `src/lib/__tests__/api-event-settings.test.ts`

> EventSettings cles overridables UNIQUEMENT : `contactEmail`, `contactPhone`. Le SMTP est plateforme uniquement (décision 2026-05-31) — aucune override SMTP au niveau event, aucune route test SMTP côté event. `null` = herite. GET ne retourne jamais de secret (cf. Plan 3 pattern).

- [ ] **Step 7.1: Add failing tests**

Append to `src/lib/__tests__/api-event-settings.test.ts` :

```typescript
describe("GET /api/admin/[orgId]/events/[eventId]/settings", () => {
  beforeEach(async () => {
    await prisma.eventSettings.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns event settings + resolved cascade preview", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "c@evt", contactPhone: "+225 0101" },
    });
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", smtpHost: "p", smtpPort: 587, smtpFrom: "p@x", smtpUser: "", smtpPassword: "", smtpSecure: false, recaptchaEnabled: false, recaptchaSiteKey: "", recaptchaSecretKey: "" },
      update: {},
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/settings`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.contactEmail).toBe("c@evt");
    expect(json.settings.contactPhone).toBe("+225 0101");
    expect("smtpFrom" in json.settings).toBe(false);
    expect("smtpPassword" in json.resolved).toBe(false);
    expect("recaptchaSecretKey" in json.resolved).toBe(false);
  });
});

describe("PATCH /api/admin/[orgId]/events/[eventId]/settings", () => {
  beforeEach(async () => {
    await prisma.eventSettings.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("upserts EventSettings and audits EVENT_SETTINGS_UPDATED", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: "ce@x", contactPhone: "+225 0101" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBe("ce@x");
    expect(s?.contactPhone).toBe("+225 0101");
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_SETTINGS_UPDATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("null resets the override (cascade fallback)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({ data: { eventId: event.id, contactEmail: "old@x" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: null }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBeNull();
  });

  it("refuses fields not allowed at event level (smtpFrom, smtpHost, smtpPassword)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ smtpFrom: "leak@x", smtpHost: "evil.smtp", smtpPassword: "leak" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-settings.test.ts
```

Expected: les nouveaux tests echouent.

- [ ] **Step 7.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/settings/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { resolvePublicSettings } from "@/lib/settings";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, { eventId }) => {
  const settings = await prisma.eventSettings.findUnique({ where: { eventId } });
  const resolved = await resolvePublicSettings(eventId);
  return NextResponse.json({
    settings: settings
      ? { contactEmail: settings.contactEmail, contactPhone: settings.contactPhone }
      : {},
    resolved,
  });
});

const patchSchema = z
  .object({
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().max(40).nullable().optional(),
  })
  .strict();

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  await prisma.eventSettings.upsert({
    where: { eventId },
    create: { eventId, ...data },
    update: data,
  });

  await logActivity({
    type: "EVENT_SETTINGS_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { changedFields: Object.keys(data) },
    req,
  });

  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 7.4: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-settings.test.ts
```

Expected: 3 nouveaux tests verts.

> Note 2026-05-31 : la sous-task "Step 7.4: Implement settings/test-smtp/route.ts" a été **supprimée** suite à la décision SMTP plateforme uniquement. Aucune route test SMTP n'existe côté event.

- [ ] **Step 7.5: Create `src/components/event/EventSettingsForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Initial = {
  event: { id: string; title: string; location: string; date: string; slug: string; logo: string | null; registrationOpen: boolean };
  settings: { contactEmail: string | null; contactPhone: string | null };
  resolved: { contactEmail: string; contactPhone: string };
};

export function EventSettingsForm({ orgId, eventId, initial }: { orgId: string; eventId: string; initial: Initial }) {
  const [title, setTitle] = useState(initial.event.title);
  const [location, setLocation] = useState(initial.event.location);
  const [date, setDate] = useState(initial.event.date.slice(0, 10));
  const [logo, setLogo] = useState<string | null>(initial.event.logo);
  const [registrationOpen, setRegistrationOpen] = useState(initial.event.registrationOpen);
  const [contactEmail, setContactEmail] = useState(initial.settings.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial.settings.contactPhone ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, location, date, logo, registrationOpen }),
    });
    setMsg(res.ok ? "Événement mis à jour." : "Échec de la mise à jour.");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      }),
    });
    setMsg(res.ok ? "Paramètres enregistrés." : "Échec.");
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres de l'événement</h1>
      {msg && <div className="rounded bg-blue-50 border border-blue-200 px-4 py-2 text-sm">{msg}</div>}

      <form onSubmit={saveEvent} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Informations</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input
          value={logo ?? ""}
          onChange={(e) => setLogo(e.target.value || null)}
          placeholder="Chemin du logo (uploads/.../logo.png)"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} />
          Inscriptions ouvertes
        </label>
        <div className="text-xs text-gray-500">Slug : <code>{initial.event.slug}</code> (modifiable par le staff uniquement)</div>
        <Button type="submit">Enregistrer</Button>
      </form>

      <form onSubmit={saveSettings} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Contact (overrides)</h2>
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={`Email de contact (cascade : ${initial.resolved.contactEmail || "—"})`}
        />
        <Input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder={`Téléphone de contact (cascade : ${initial.resolved.contactPhone || "—"})`}
        />
        <p className="text-xs text-gray-500">
          Laisser vide pour hériter du niveau organisation. Les paramètres SMTP sont gérés au niveau plateforme uniquement (décision 2026-05-31).
        </p>
        <Button type="submit">Enregistrer</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7.6: Create `src/app/admin/[orgId]/events/[eventId]/settings/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings } from "@/lib/settings";
import { EventSettingsForm } from "@/components/event/EventSettingsForm";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, location: true, date: true, slug: true, logo: true, registrationOpen: true },
  });
  if (!event) throw new Error("Event not found");
  const settings = await prisma.eventSettings.findUnique({ where: { eventId } });
  const resolved = await resolvePublicSettings(eventId);
  return (
    <EventSettingsForm
      orgId={orgId}
      eventId={eventId}
      initial={{
        event: { ...event, date: event.date.toISOString() },
        settings: {
          contactEmail: settings?.contactEmail ?? null,
          contactPhone: settings?.contactPhone ?? null,
        },
        resolved: {
          contactEmail: resolved.contactEmail,
          contactPhone: resolved.contactPhone,
        },
      }}
    />
  );
}
```

- [ ] **Step 7.7: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/settings" "src/app/admin/[orgId]/events/[eventId]/settings" src/components/event/EventSettingsForm.tsx src/lib/__tests__/api-event-settings.test.ts
git commit -m "feat(v2): EventSettings (GET/PATCH overrides contact) sans override SMTP"
```

---

## Task 8: Registrations API — GET liste + POST creation manuelle

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts`
- Create: `src/lib/__tests__/api-event-registrations.test.ts`

> GET supporte les filtres `status`, `categoryId`, `q` (recherche email/firstName/lastName/idDocumentNumber), `blocked` (true/false), pagination `page` & `limit` (max 100). POST cree manuellement avec `status=APPROVED` par defaut (admin sait ce qu'il fait, pas de moderation). Bypass quota cote admin avec audit explicite.

- [ ] **Step 8.1: Write failing tests**

Create `src/lib/__tests__/api-event-registrations.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<any>("@/lib/mail");
  return {
    ...actual,
    sendStatusNotification: vi.fn(async () => undefined),
    sendBadgePrintedNotification: vi.fn(async () => undefined),
    sendEditLinkEmail: vi.fn(async () => undefined),
  };
});

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedAdmin() {
  const u = await prisma.user.create({ data: { email: `a-${Date.now()}@x`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event, cat };
}

async function mkReg(eventId: string, categoryId: string, over: Partial<{ email: string; firstName: string; lastName: string; status: "PENDING" | "APPROVED" | "REJECTED"; idDocumentNumber: string }> = {}) {
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      email: over.email ?? `${Math.random()}@x`,
      lastName: over.lastName ?? "L",
      firstName: over.firstName ?? "F",
      structure: "S",
      idDocumentType: "CNI",
      idDocumentNumber: over.idDocumentNumber ?? `D-${Math.random()}`,
      status: over.status ?? "PENDING",
    },
  });
}

describe("GET /registrations", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("filters by status", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { status: "PENDING" });
    await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations?status=PENDING`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].status).toBe("PENDING");
  });

  it("searches by q on email/firstName/lastName/document", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { email: "amadou@x", firstName: "Amadou" });
    await mkReg(event.id, cat.id, { email: "fatim@x", firstName: "Fatim" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations?q=Amadou`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].firstName).toBe("Amadou");
  });

  it("OPERATOR can read list (defense in depth: scan needs participant infos)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
  });
});

describe("POST /registrations (manual creation)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates a registration with status=APPROVED by default", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: "x@y",
        firstName: "A",
        lastName: "D",
        structure: "ENSEA",
        idDocumentType: "CNI",
        idDocumentNumber: "DOC-1",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const r = await prisma.registration.findFirst();
    expect(r?.status).toBe("APPROVED");

    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_CREATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot create (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op-c" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op-c", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: "x@y",
        firstName: "A",
        lastName: "D",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "DOC-1",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 8.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: FAIL.

- [ ] **Step 8.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateId } from "@/lib/generate-id";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (req, { eventId }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("categoryId");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25")));

  const where: Prisma.RegistrationWhereInput = { eventId };
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status as any;
  }
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { idDocumentNumber: { contains: q } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        structure: true,
        status: true,
        badgePrinted: true,
        allAccessGranted: true,
        createdAt: true,
        category: { select: { id: true, name: true, color: true, number: true } },
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return NextResponse.json({ registrations, total, page, limit });
});

const createSchema = z.object({
  categoryId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  structure: z.string().min(1).max(200),
  idDocumentType: z.string().min(1).max(40),
  idDocumentNumber: z.string().min(1).max(80),
  photo: z.string().nullable().optional(),
  idDocument: z.string().nullable().optional(),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || category.eventId !== eventId) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const id = generateId(12);
  const registration = await prisma.registration.create({
    data: {
      id,
      eventId,
      categoryId: parsed.data.categoryId,
      email: parsed.data.email.toLowerCase().trim(),
      lastName: parsed.data.lastName,
      firstName: parsed.data.firstName,
      structure: parsed.data.structure,
      idDocumentType: parsed.data.idDocumentType,
      idDocumentNumber: parsed.data.idDocumentNumber,
      photo: parsed.data.photo ?? null,
      idDocument: parsed.data.idDocument ?? null,
      status: "APPROVED",
    },
  });

  await logActivity({
    type: "REGISTRATION_CREATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: registration.id,
    details: { manual: true, status: "APPROVED" },
    req,
  });

  return NextResponse.json({ registration }, { status: 201 });
});
```

- [ ] **Step 8.4: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: 5 passed.

- [ ] **Step 8.5: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts" src/lib/__tests__/api-event-registrations.test.ts
git commit -m "feat(v2): GET/POST registrations event (filtres, pagination, creation manuelle ADMIN)"
```

---

## Task 9: Registrations API — GET/PATCH/DELETE single + approve/reject/print

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reject/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/all-access/route.ts`
- Add tests in `src/lib/__tests__/api-event-registrations.test.ts`

> Regles : (1) approve/reject = ADMIN only. (2) reject genere `editToken` (Plan 6 helper Plan 4 = `generateEditToken`), envoie `sendStatusNotification` (Plan 6). (3) print marque `badgePrinted=true`, envoie `sendBadgePrintedNotification`. (4) PATCH archive l'ancien etat dans `SubmissionSnapshot` avant modification. (5) DELETE = hard delete + audit (ADMIN seul).

- [ ] **Step 9.1: Add failing tests**

Append to `src/lib/__tests__/api-event-registrations.test.ts` :

```typescript
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";

describe("POST /registrations/[regId]/approve", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendStatusNotification).mockClear();
  });

  it("approves a pending registration, logs, and sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/.../approve`, { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("APPROVED");
    expect(vi.mocked(sendStatusNotification)).toHaveBeenCalledWith(r.id);
    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_APPROVED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot approve (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op-a" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op-a", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /registrations/[regId]/reject", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendStatusNotification).mockClear();
  });

  it("rejects with reason, generates editToken (64 hex), sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "Photo illisible", details: "Veuillez fournir une photo nette" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("REJECTED");
    expect(after?.rejectionReason).toBe("Photo illisible");
    expect(after?.editToken).toMatch(/^[0-9a-f]{64}$/);
    expect(after?.editTokenExpiresAt).not.toBeNull();
    expect(vi.mocked(sendStatusNotification)).toHaveBeenCalledWith(r.id);
  });

  it("requires a reason", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /registrations/[regId]/print", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendBadgePrintedNotification).mockClear();
  });

  it("marks badge printed and sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.badgePrinted).toBe(true);
    expect(after?.badgePrintedAt).not.toBeNull();
    expect(vi.mocked(sendBadgePrintedNotification)).toHaveBeenCalledWith(r.id);
  });

  it("refuses to print a non-approved registration", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(409);
  });
});

describe("PATCH /registrations/[regId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("snapshots before update and audits", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { firstName: "Old" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "New" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.firstName).toBe("New");
    const snaps = await prisma.submissionSnapshot.findMany({ where: { registrationId: r.id } });
    expect(snaps).toHaveLength(1);
    expect(snaps[0].firstName).toBe("Old");
  });
});
```

- [ ] **Step 9.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: les nouveaux tests echouent.

- [ ] **Step 9.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (_req, { eventId }, extra) => {
  const { regId } = await extra.params;
  const registration = await prisma.registration.findUnique({
    where: { id: regId },
    include: {
      category: true,
      snapshots: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration || registration.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  // never expose editToken
  const { editToken, ...safe } = registration;
  return NextResponse.json({ registration: safe });
});

const patchSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  structure: z.string().min(1).max(200).optional(),
  categoryId: z.string().optional(),
  idDocumentType: z.string().min(1).max(40).optional(),
  idDocumentNumber: z.string().min(1).max(80).optional(),
  photo: z.string().nullable().optional(),
  idDocument: z.string().nullable().optional(),
  allAccessGranted: z.boolean().optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (parsed.data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!cat || cat.eventId !== eventId) {
      return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
    }
  }

  // snapshot l'etat avant modification
  await prisma.submissionSnapshot.create({
    data: {
      registrationId: existing.id,
      lastName: existing.lastName,
      firstName: existing.firstName,
      email: existing.email,
      structure: existing.structure,
      categoryId: existing.categoryId,
      idDocumentType: existing.idDocumentType,
      idDocumentNumber: existing.idDocumentNumber,
      photo: existing.photo,
      idDocument: existing.idDocument,
    },
  });

  const updated = await prisma.registration.update({
    where: { id: regId },
    data: parsed.data,
  });

  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { changedFields: Object.keys(parsed.data) },
    req,
  });

  const { editToken, ...safe } = updated;
  return NextResponse.json({ registration: safe });
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.registration.delete({ where: { id: regId } });
  await logActivity({
    type: "REGISTRATION_DELETED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { email: existing.email },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 9.4: Implement approve/reject/print routes**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status === "APPROVED") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }

  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      rejectionDetails: null,
      editToken: null,
      editTokenExpiresAt: null,
    },
  });

  await logActivity({
    type: "REGISTRATION_APPROVED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reject/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";
import { generateEditToken } from "@/lib/edit-token";

const schema = z.object({
  reason: z.string().min(1).max(200),
  details: z.string().max(2000).optional(),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { token, expiresAt } = generateEditToken();
  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "REJECTED",
      rejectionReason: parsed.data.reason,
      rejectionDetails: parsed.data.details ?? null,
      editToken: token,
      editTokenExpiresAt: expiresAt,
    },
  });

  await logActivity({
    type: "REGISTRATION_REJECTED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { reason: parsed.data.reason, hasDetails: !!parsed.data.details },
    req,
  });

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendBadgePrintedNotification } from "@/lib/mail";

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status !== "APPROVED") {
    return NextResponse.json(
      { error: "NOT_APPROVED", code: "NOT_APPROVED", message: "Seules les inscriptions approuvées peuvent être imprimées." },
      { status: 409 },
    );
  }

  await prisma.registration.update({
    where: { id: regId },
    data: { badgePrinted: true, badgePrintedAt: new Date() },
  });

  await logActivity({
    type: "BADGE_PRINTED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  try {
    await sendBadgePrintedNotification(regId);
  } catch (e) {
    console.error("[mail] sendBadgePrintedNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/all-access/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({ allAccessGranted: z.boolean() });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.registration.update({
    where: { id: regId },
    data: { allAccessGranted: parsed.data.allAccessGranted },
  });
  await logActivity({
    type: "BADGE_ALL_ACCESS_TOGGLED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { value: parsed.data.allAccessGranted },
    req,
  });
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 9.5: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: tous les tests verts.

- [ ] **Step 9.6: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]"
git commit -m "feat(v2): registration single-actions (GET/PATCH/DELETE + approve/reject/print/all-access)"
```

---

## Task 10: Registrations API — block-email, block-document, duplicates, resend edit link, reset edit token, checkin, batch print, export CSV

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-email/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-document/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/duplicates/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/resend-edit-link/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reset-edit-token/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/checkin/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/print/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/registrations/export/route.ts`

- [ ] **Step 10.1: Add failing tests**

Append to `src/lib/__tests__/api-event-registrations.test.ts` :

```typescript
describe("POST /registrations/[regId]/block-email", () => {
  beforeEach(async () => {
    await prisma.blockedEmail.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("adds the registration email to BlockedEmail", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "block@x" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ reason: "spam" }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedEmail.findFirst({ where: { eventId: event.id, email: "block@x" } });
    expect(blocked).not.toBeNull();
  });
});

describe("GET /registrations/[regId]/duplicates", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns duplicates matched on email/name/document within event", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r1 = await mkReg(event.id, cat.id, { email: "dup@x" });
    const r2 = await mkReg(event.id, cat.id, { email: "dup@x" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/duplicates/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r1.id }) },
    );
    const json = await res.json();
    expect(json.duplicates).toHaveLength(1);
    expect(json.duplicates[0].id).toBe(r2.id);
  });
});

describe("GET /registrations/export (CSV)", () => {
  beforeEach(async () => {
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns text/csv with header + rows", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/export/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations/export`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Amadou");
    expect(body.split("\n")[0]).toContain("firstName");
  });
});

describe("POST /registrations/[regId]/checkin", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OPERATOR can checkin (writes BADGE_SCANNED log)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-ci" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-ci", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/checkin/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_SCANNED" } });
    expect(log?.userId).toBe(u.id);
    expect(log?.eventId).toBe(event.id);
  });
});
```

- [ ] **Step 10.2: Implement block-email + block-document**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-email/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({ reason: z.string().max(500).optional() });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  const reason = parsed.success ? parsed.data.reason ?? null : null;

  const reg = await prisma.registration.findUnique({ where: { id: regId } });
  if (!reg || reg.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await prisma.blockedEmail.create({
      data: { eventId, email: reg.email, reason },
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err;
  }
  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { action: "block-email", email: reg.email, reason },
    req,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/block-document/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({ reason: z.string().max(500).optional() });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  const reason = parsed.success ? parsed.data.reason ?? null : null;

  const reg = await prisma.registration.findUnique({ where: { id: regId } });
  if (!reg || reg.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await prisma.blockedDocument.create({
      data: { eventId, documentNumber: reg.idDocumentNumber, reason },
    });
  } catch (err: any) {
    if (err.code !== "P2002") throw err;
  }
  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { action: "block-document", documentNumber: reg.idDocumentNumber, reason },
    req,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
```

- [ ] **Step 10.3: Implement duplicates**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/duplicates/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { withEventAuth } from "@/lib/with-event-auth";
import { findDuplicatesForRegistration } from "@/lib/duplicates";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, _, extra) => {
  const { regId } = await extra.params;
  const duplicates = await findDuplicatesForRegistration(regId);
  return NextResponse.json({ duplicates });
});
```

- [ ] **Step 10.4: Implement resend-edit-link + reset-edit-token**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/resend-edit-link/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateEditToken } from "@/lib/edit-token";
import { sendEditLinkEmail } from "@/lib/mail";

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { token, expiresAt } = generateEditToken();
  await prisma.registration.update({
    where: { id: regId },
    data: { editToken: token, editTokenExpiresAt: expiresAt },
  });
  await logActivity({
    type: "EDIT_LINK_SENT",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });
  try {
    await sendEditLinkEmail(regId);
  } catch (e) {
    console.error("[mail] sendEditLinkEmail failed", e);
  }
  return NextResponse.json({ ok: true });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/reset-edit-token/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateEditToken } from "@/lib/edit-token";

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { token, expiresAt } = generateEditToken();
  await prisma.registration.update({
    where: { id: regId },
    data: { editToken: token, editTokenExpiresAt: expiresAt },
  });
  await logActivity({
    type: "EDIT_LINK_SENT",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { resetOnly: true },
    req,
  });
  return NextResponse.json({ ok: true, token });
});
```

- [ ] **Step 10.5: Implement checkin (OPERATOR allowed)**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/checkin/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const POST = withEventAuth({ minRole: "OPERATOR" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = await extra.params;
  const reg = await prisma.registration.findUnique({
    where: { id: regId },
    select: { id: true, eventId: true, status: true, firstName: true, lastName: true, badgePrinted: true },
  });
  if (!reg || reg.eventId !== eventId) {
    return NextResponse.json(
      { error: "NOT_FOUND", code: "FOREIGN_EVENT", message: "Badge appartient à un autre événement" },
      { status: 404 },
    );
  }

  await logActivity({
    type: "BADGE_SCANNED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  const authorized = reg.status === "APPROVED";
  return NextResponse.json({
    ok: true,
    registration: {
      id: reg.id,
      firstName: reg.firstName,
      lastName: reg.lastName,
      status: reg.status,
      badgePrinted: reg.badgePrinted,
    },
    authorized,
  });
});
```

- [ ] **Step 10.6: Implement batch print + export CSV**

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/print/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendBadgePrintedNotification } from "@/lib/mail";

const schema = z.object({ ids: z.array(z.string()).min(1).max(500) });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const regs = await prisma.registration.findMany({
    where: { id: { in: parsed.data.ids }, eventId, status: "APPROVED" },
    select: { id: true },
  });
  const ids = regs.map((r) => r.id);
  await prisma.registration.updateMany({
    where: { id: { in: ids } },
    data: { badgePrinted: true, badgePrintedAt: new Date() },
  });
  await logActivity({
    type: "BADGE_BATCH_PRINTED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { count: ids.length },
    req,
  });
  for (const id of ids) {
    try {
      await sendBadgePrintedNotification(id);
    } catch (e) {
      console.error("[mail] sendBadgePrintedNotification failed", e);
    }
  }
  return NextResponse.json({ ok: true, printed: ids.length });
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/registrations/export/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { toRegistrationCsv } from "@/lib/registration-csv";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (req, { orgId, eventId, session }) => {
  const regs = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  const csv = toRegistrationCsv(
    regs.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      structure: r.structure,
      categoryName: r.category.name,
      status: r.status,
      idDocumentType: r.idDocumentType,
      idDocumentNumber: r.idDocumentNumber,
      badgePrinted: r.badgePrinted,
      allAccessGranted: r.allAccessGranted,
      createdAt: r.createdAt,
    })),
  );

  await logActivity({
    type: "BADGE_BATCH_EXPORTED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { format: "csv", count: regs.length },
    req,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registrations-${eventId}.csv"`,
    },
  });
});
```

- [ ] **Step 10.7: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: tous verts.

- [ ] **Step 10.8: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/registrations"
git commit -m "feat(v2): registrations block/duplicates/edit-link/checkin/batch print/export CSV"
```

---

## Task 11: Composants — RegistrationTable + RegistrationForm refondu

**Files:**
- Create: `src/components/event/RegistrationTable.tsx`
- Create: `src/components/event/RegistrationForm.tsx`
- Create: `src/components/event/RegistrationActions.tsx`

> `RegistrationForm` refondu : prop `event`, prop `categories[]`, plus de lecture globale Prisma. Validation cote client laissee minimale ; le serveur valide via Zod (Task 8).

- [ ] **Step 11.1: Create `src/components/event/RegistrationActions.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RegistrationActions({
  orgId,
  eventId,
  registrationId,
  status,
  onChanged,
}: {
  orgId: string;
  eventId: string;
  registrationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  onChanged: () => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/approve`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, details: details || undefined }),
    });
    setBusy(false);
    setShowReject(false);
    onChanged();
  }

  async function print() {
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/print`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <>
          <Button onClick={approve} disabled={busy}>Approuver</Button>
          <Button variant="secondary" onClick={() => setShowReject(true)} disabled={busy}>
            Rejeter
          </Button>
        </>
      )}
      {status === "APPROVED" && (
        <Button onClick={print} disabled={busy}>Marquer imprimé</Button>
      )}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
          <form onSubmit={reject} className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
            <h3 className="font-semibold">Rejeter cette inscription</h3>
            <input
              type="text"
              required
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif (obligatoire)"
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <textarea
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Détails complémentaires (optionnel)"
              className="w-full border rounded px-2 py-1 text-sm h-24"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowReject(false)} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy || !reason}>
                Rejeter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: Create `src/components/event/RegistrationTable.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: string;
  category: { id: string; name: string; color: string; number: number };
};

export function RegistrationTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("page", String(page));
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations?${params}`);
    const json = await res.json();
    setRows(json.registrations);
    setTotal(json.total);
    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  function exportCsv() {
    window.location.href = `/api/admin/${orgId}/events/${eventId}/registrations/export`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Rechercher (nom, email, document)"
          className="border rounded px-2 py-1 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Tous statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuvé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <Button variant="secondary" onClick={load} disabled={busy}>Rafraîchir</Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>Exporter CSV</Button>
          <Link href={`/admin/${orgId}/events/${eventId}/registrations/new`}>
            <Button>Nouvelle inscription</Button>
          </Link>
        </div>
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Badge</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                Aucune inscription.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 font-medium">
                <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="hover:underline">
                  {r.firstName} {r.lastName}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-600">{r.email}</td>
              <td className="px-3 py-2">
                <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: r.category.color }} />
                {r.category.name}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2">{r.badgePrinted ? "Imprimé" : "—"}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="text-sm text-blue-600 hover:underline">
                  Détail
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">{total} inscription{total > 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Précédent
          </Button>
          <span className="px-2 py-1">Page {page}</span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 25}>
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const c =
    status === "APPROVED"
      ? "bg-green-100 text-green-800"
      : status === "REJECTED"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800";
  const l = status === "APPROVED" ? "Approuvé" : status === "REJECTED" ? "Rejeté" : "En attente";
  return <span className={`px-2 py-0.5 rounded text-xs ${c}`}>{l}</span>;
}
```

- [ ] **Step 11.3: Create `src/components/event/RegistrationForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Category = { id: string; name: string; number: number };

export function RegistrationForm({
  orgId,
  eventId,
  categories,
  initial,
}: {
  orgId: string;
  eventId: string;
  categories: Category[];
  initial?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    structure: string;
    categoryId: string;
    idDocumentType: string;
    idDocumentNumber: string;
    photo: string | null;
    idDocument: string | null;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [structure, setStructure] = useState(initial?.structure ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [idDocumentType, setIdDocumentType] = useState(initial?.idDocumentType ?? "CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState(initial?.idDocumentNumber ?? "");
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const [idDocument, setIdDocument] = useState<string | null>(initial?.idDocument ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const url = initial
      ? `/api/admin/${orgId}/events/${eventId}/registrations/${initial.id}`
      : `/api/admin/${orgId}/events/${eventId}/registrations`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        structure,
        categoryId,
        idDocumentType,
        idDocumentNumber,
        photo,
        idDocument,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Échec de l'enregistrement.");
      setBusy(false);
      return;
    }
    const json = await res.json();
    router.push(`/admin/${orgId}/events/${eventId}/registrations/${initial?.id ?? json.registration.id}`);
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded p-4 space-y-3 max-w-xl">
      <h2 className="text-xl font-semibold">{initial ? "Modifier l'inscription" : "Nouvelle inscription"}</h2>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" required />
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" required />
      </div>
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <Input value={structure} onChange={(e) => setStructure(e.target.value)} placeholder="Structure / organisation" required />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.number} — {c.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="CNI">CNI</option>
          <option value="PASSPORT">Passeport</option>
          <option value="DRIVER_LICENSE">Permis de conduire</option>
          <option value="OTHER">Autre</option>
        </select>
        <Input value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} placeholder="N° de pièce" required />
      </div>
      <Input value={photo ?? ""} onChange={(e) => setPhoto(e.target.value || null)} placeholder="Chemin photo (uploads/...)" />
      <Input value={idDocument ?? ""} onChange={(e) => setIdDocument(e.target.value || null)} placeholder="Chemin pièce d'identité" />
      <Button type="submit" disabled={busy}>
        {busy ? "..." : initial ? "Mettre à jour" : "Créer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 11.4: Commit**

```bash
git add src/components/event/RegistrationTable.tsx src/components/event/RegistrationForm.tsx src/components/event/RegistrationActions.tsx
git commit -m "feat(v2): composants RegistrationTable + RegistrationForm + RegistrationActions (refonte v1)"
```

---

## Task 12: Pages registrations (liste, detail, new) + composant historique snapshots

**Files:**
- Create: `src/components/event/RegistrationHistory.tsx`
- Create: `src/components/event/RegistrationDetailPanel.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/registrations/page.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/registrations/new/page.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/registrations/[regId]/page.tsx`

- [ ] **Step 12.1: Create `src/components/event/RegistrationHistory.tsx`**

```typescript
type Snapshot = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  idDocumentNumber: string;
  createdAt: string;
};

export function RegistrationHistory({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-gray-500">Aucune modification antérieure.</p>;
  }
  return (
    <ul className="bg-white border rounded divide-y text-sm">
      {snapshots.map((s) => (
        <li key={s.id} className="px-4 py-3">
          <div className="flex justify-between">
            <span className="font-medium">
              {s.firstName} {s.lastName}
            </span>
            <span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString("fr-FR")}</span>
          </div>
          <div className="text-xs text-gray-600">
            {s.email} — {s.structure} — Doc {s.idDocumentNumber}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 12.2: Create `src/components/event/RegistrationDetailPanel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { RegistrationActions } from "./RegistrationActions";

type Reg = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  allAccessGranted: boolean;
  rejectionReason: string | null;
  rejectionDetails: string | null;
  photo: string | null;
  idDocument: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  createdAt: string;
  category: { id: string; name: string; color: string; number: number };
};

export function RegistrationDetailPanel({
  orgId,
  eventId,
  registration,
}: {
  orgId: string;
  eventId: string;
  registration: Reg;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const r = registration;

  async function blockEmail() {
    if (!confirm(`Bloquer l'email ${r.email} sur cet événement ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/block-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Email bloqué.");
  }

  async function blockDocument() {
    if (!confirm(`Bloquer le document ${r.idDocumentNumber} ?`)) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/block-document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Bloqué via le détail inscription" }),
    });
    alert("Document bloqué.");
  }

  async function resendEditLink() {
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/resend-edit-link`, { method: "POST" });
    setBusy(false);
    alert("Lien d'édition régénéré et envoyé.");
  }

  async function toggleAllAccess() {
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}/all-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !r.allAccessGranted }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement l'inscription de ${r.firstName} ${r.lastName} ?`)) return;
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${r.id}`, { method: "DELETE" });
    router.push(`/admin/${orgId}/events/${eventId}/registrations`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-4 space-y-2">
        <h2 className="text-xl font-semibold">
          {r.firstName} {r.lastName}
        </h2>
        <div className="text-sm text-gray-600">{r.email} — {r.structure}</div>
        <div className="text-sm">
          Catégorie :
          <span className="inline-block w-3 h-3 rounded mx-1 align-middle" style={{ background: r.category.color }} />
          {r.category.name} (#{r.category.number})
        </div>
        <div className="text-sm">Pièce : {r.idDocumentType} {r.idDocumentNumber}</div>
        <div className="text-sm">
          Statut : {r.status}
          {r.badgePrinted && <span className="ml-2 text-xs text-gray-500">— badge imprimé le {new Date(r.badgePrintedAt!).toLocaleString("fr-FR")}</span>}
        </div>
        {r.rejectionReason && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <strong>Motif de rejet :</strong> {r.rejectionReason}
            {r.rejectionDetails && <div className="mt-1 text-xs">{r.rejectionDetails}</div>}
          </div>
        )}
        <RegistrationActions
          orgId={orgId}
          eventId={eventId}
          registrationId={r.id}
          status={r.status}
          onChanged={() => router.refresh()}
        />
      </div>

      <div className="bg-white border rounded p-4 space-y-2">
        <h3 className="font-semibold">Pièces jointes</h3>
        <div className="flex gap-4 flex-wrap">
          {r.photo ? (
            <a href={`/api/files/${r.photo}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Voir la photo
            </a>
          ) : (
            <span className="text-sm text-gray-500">Pas de photo</span>
          )}
          {r.idDocument ? (
            <a href={`/api/files/${r.idDocument}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Voir la pièce d'identité
            </a>
          ) : (
            <span className="text-sm text-gray-500">Pas de pièce d'identité</span>
          )}
        </div>
      </div>

      <div className="bg-white border rounded p-4 space-y-3">
        <h3 className="font-semibold">Actions avancées</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={toggleAllAccess} disabled={busy}>
            {r.allAccessGranted ? "Retirer ALL ACCESS" : "Activer ALL ACCESS"}
          </Button>
          <Link href={`/admin/${orgId}/events/${eventId}/badges/${r.id}`}>
            <Button variant="secondary">Voir le badge</Button>
          </Link>
          <Button variant="secondary" onClick={blockEmail} disabled={busy}>
            Bloquer cet email
          </Button>
          <Button variant="secondary" onClick={blockDocument} disabled={busy}>
            Bloquer ce document
          </Button>
          <Button variant="secondary" onClick={resendEditLink} disabled={busy}>
            Renvoyer le lien d'édition
          </Button>
          <Button variant="secondary" onClick={remove} disabled={busy}>
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.3: Create page `registrations/page.tsx`**

```typescript
import { RegistrationTable } from "@/components/event/RegistrationTable";

export default async function RegistrationsListPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inscriptions</h1>
      <RegistrationTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
```

- [ ] **Step 12.4: Create page `registrations/new/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { RegistrationForm } from "@/components/event/RegistrationForm";

export default async function NewRegistrationPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
    select: { id: true, name: true, number: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle inscription</h1>
      <RegistrationForm orgId={orgId} eventId={eventId} categories={categories} />
    </div>
  );
}
```

- [ ] **Step 12.5: Create page `registrations/[regId]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RegistrationDetailPanel } from "@/components/event/RegistrationDetailPanel";
import { RegistrationHistory } from "@/components/event/RegistrationHistory";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string; regId: string }>;
}) {
  const { orgId, eventId, regId } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id: regId },
    include: {
      category: true,
      snapshots: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration || registration.eventId !== eventId) notFound();

  const r = {
    id: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email: registration.email,
    structure: registration.structure,
    status: registration.status,
    badgePrinted: registration.badgePrinted,
    badgePrintedAt: registration.badgePrintedAt?.toISOString() ?? null,
    allAccessGranted: registration.allAccessGranted,
    rejectionReason: registration.rejectionReason,
    rejectionDetails: registration.rejectionDetails,
    photo: registration.photo,
    idDocument: registration.idDocument,
    idDocumentType: registration.idDocumentType,
    idDocumentNumber: registration.idDocumentNumber,
    createdAt: registration.createdAt.toISOString(),
    category: registration.category,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <RegistrationDetailPanel orgId={orgId} eventId={eventId} registration={r} />
      <section>
        <h3 className="text-lg font-semibold mb-3">Historique des modifications</h3>
        <RegistrationHistory
          snapshots={registration.snapshots.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
            structure: s.structure,
            idDocumentNumber: s.idDocumentNumber,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 12.6: Commit**

```bash
git add "src/app/admin/[orgId]/events/[eventId]/registrations" src/components/event/RegistrationHistory.tsx src/components/event/RegistrationDetailPanel.tsx
git commit -m "feat(v2): pages registrations (liste, detail, new) + historique snapshots"
```

---

## Task 13: Composants badge — refonte BadgeDocument/Anonymous/Batch avec prop `event`

**Files:**
- Create: `src/components/badge/BadgeDocumentV2.tsx`
- Create: `src/components/badge/BadgeDocumentAnonymousV2.tsx`
- Create: `src/components/badge/BadgeBatchExportV2.tsx`
- Create: `src/components/badge/BadgePreviewV2.tsx`
- Create: `src/components/badge/BadgeWebPreviewV2.tsx`
- Create: `src/components/badge/BadgeDownloadV2.tsx`

> Refonte v1 -> v2 : la prop `event` remplace la lecture globale (le v1 lisait `prisma.event.findFirst()` partout). On garde l'identique pour le layout PDF (Montserrat, dimensions, logo en haut, QR en bas). Le QR encode `${baseUrl}/verify/${badgeId}` (critere d'acceptation #8).

- [ ] **Step 13.1: Create `src/components/badge/BadgeDocumentV2.tsx`**

```typescript
"use client";

import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { formatBadgeName, formatBadgeStructure } from "@/lib/format-badge-name";

Font.register({
  family: "Montserrat",
  fonts: [
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf", fontWeight: 700 },
  ],
});

const BADGE_WIDTH = 100 * 2.835;
const BADGE_HEIGHT = 140 * 2.835;

const styles = StyleSheet.create({
  page: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Montserrat",
    position: "relative",
  },
  header: { flexDirection: "row", alignItems: "center", padding: 14 },
  logo: { width: 60, height: 60, objectFit: "contain", marginRight: 16 },
  title: { fontSize: 12, fontWeight: 700, color: "#111" },
  date: { fontSize: 9, color: "#666", marginTop: 2 },
  photo: { width: 130, height: 160, objectFit: "cover", alignSelf: "center", marginTop: 6, borderRadius: 4 },
  name: { fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 12, paddingHorizontal: 16 },
  structure: { fontSize: 10, color: "#555", textAlign: "center", marginTop: 4, paddingHorizontal: 16 },
  categoryBar: { padding: 8, marginTop: 12, alignItems: "center" },
  categoryText: { color: "#fff", fontSize: 12, fontWeight: 600 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, marginTop: "auto" },
  qr: { width: 70, height: 70 },
  badgeId: { fontSize: 8, color: "#888" },
});

export type BadgeRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  structure: string;
  photo?: string | null;
  allAccessGranted?: boolean;
  category: { name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };
};

export type BadgeEvent = {
  title: string;
  date: Date;
  logo?: string | null;
};

export function BadgeDocumentV2({
  registration,
  event,
  qrDataUrl,
  photoDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  photoDataUrl?: string | null;
  logoDataUrl?: string | null;
}) {
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <Document>
      <Page size={[BADGE_WIDTH, BADGE_HEIGHT]} style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.date}>{new Date(event.date).toLocaleDateString("fr-FR")}</Text>
          </View>
        </View>
        {photoDataUrl && <Image src={photoDataUrl} style={styles.photo} />}
        <Text style={styles.name}>
          {formatBadgeName(registration.firstName, registration.lastName)}
        </Text>
        <Text style={styles.structure}>{formatBadgeStructure(registration.structure)}</Text>
        <View style={[styles.categoryBar, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>
            #{registration.category.number} — {registration.category.name}
            {registration.allAccessGranted ? "  •  ALL ACCESS" : ""}
          </Text>
        </View>
        <View style={styles.footer}>
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.badgeId}>{registration.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 13.2: Create `src/components/badge/BadgeDocumentAnonymousV2.tsx`**

```typescript
"use client";

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { BadgeRegistration, BadgeEvent } from "./BadgeDocumentV2";

const BADGE_WIDTH = 100 * 2.835;
const BADGE_HEIGHT = 140 * 2.835;

const styles = StyleSheet.create({
  page: { width: BADGE_WIDTH, height: BADGE_HEIGHT, backgroundColor: "#FFFFFF", fontFamily: "Montserrat" },
  header: { padding: 14, alignItems: "center" },
  logo: { width: 60, height: 60, objectFit: "contain" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8 },
  categoryBar: { padding: 16, marginTop: 24, alignItems: "center" },
  categoryText: { color: "#fff", fontSize: 18, fontWeight: 700 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 8, marginTop: "auto" },
  qr: { width: 70, height: 70 },
  badgeId: { fontSize: 8, color: "#888" },
});

export function BadgeDocumentAnonymousV2({
  registration,
  event,
  qrDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  logoDataUrl?: string | null;
}) {
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <Document>
      <Page size={[BADGE_WIDTH, BADGE_HEIGHT]} style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <Text style={styles.title}>{event.title}</Text>
        </View>
        <View style={[styles.categoryBar, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>{registration.category.name}</Text>
        </View>
        <View style={styles.footer}>
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.badgeId}>{registration.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 13.3: Create `src/components/badge/BadgeBatchExportV2.tsx`**

```typescript
"use client";

import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeEvent, type BadgeRegistration } from "./BadgeDocumentV2";

// Impression batch : une page par badge, A4 paysage avec 2 badges cote a cote (impression industrielle).
const A4_W = 842;
const A4_H = 595;

const styles = StyleSheet.create({
  page: { flexDirection: "row", padding: 20, gap: 20 },
  slot: { width: (A4_W - 60) / 2, border: "1pt solid #ccc" },
});

export function BadgeBatchExportV2({
  items,
  event,
}: {
  items: { registration: BadgeRegistration; qrDataUrl: string; photoDataUrl?: string | null; logoDataUrl?: string | null }[];
  event: BadgeEvent;
}) {
  const pages: typeof items[] = [];
  for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
  return (
    <Document>
      {pages.map((pair, i) => (
        <Page key={i} size={[A4_W, A4_H]} style={styles.page}>
          {pair.map((it) => (
            <View key={it.registration.id} style={styles.slot}>
              <BadgeDocumentV2
                registration={it.registration}
                event={event}
                qrDataUrl={it.qrDataUrl}
                photoDataUrl={it.photoDataUrl}
                logoDataUrl={it.logoDataUrl}
              />
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
```

- [ ] **Step 13.4: Create `src/components/badge/BadgePreviewV2.tsx`**

```typescript
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeRegistration, type BadgeEvent } from "./BadgeDocumentV2";
import { BadgeDocumentAnonymousV2 } from "./BadgeDocumentAnonymousV2";

export function BadgePreviewV2({
  registration,
  event,
  qrDataUrl,
  photoDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  photoDataUrl?: string | null;
  logoDataUrl?: string | null;
}) {
  const Doc = registration.category.anonymous ? BadgeDocumentAnonymousV2 : BadgeDocumentV2;
  return (
    <PDFViewer style={{ width: "100%", height: 600 }}>
      <Doc registration={registration} event={event} qrDataUrl={qrDataUrl} photoDataUrl={photoDataUrl} logoDataUrl={logoDataUrl} />
    </PDFViewer>
  );
}
```

- [ ] **Step 13.5: Create `src/components/badge/BadgeDownloadV2.tsx`**

```typescript
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocumentV2, type BadgeRegistration, type BadgeEvent } from "./BadgeDocumentV2";
import { BadgeDocumentAnonymousV2 } from "./BadgeDocumentAnonymousV2";

export function BadgeDownloadV2({
  registration,
  event,
  qrDataUrl,
  photoDataUrl,
  logoDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  qrDataUrl: string;
  photoDataUrl?: string | null;
  logoDataUrl?: string | null;
}) {
  const Doc = registration.category.anonymous ? BadgeDocumentAnonymousV2 : BadgeDocumentV2;
  const fileName = `badge-${registration.id}.pdf`;
  return (
    <PDFDownloadLink
      document={
        <Doc registration={registration} event={event} qrDataUrl={qrDataUrl} photoDataUrl={photoDataUrl} logoDataUrl={logoDataUrl} />
      }
      fileName={fileName}
      className="inline-block rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
    >
      {({ loading }) => (loading ? "Préparation..." : "Télécharger le badge PDF")}
    </PDFDownloadLink>
  );
}
```

- [ ] **Step 13.6: Create `src/components/badge/BadgeWebPreviewV2.tsx`**

```typescript
"use client";

import type { BadgeRegistration, BadgeEvent } from "./BadgeDocumentV2";

export function BadgeWebPreviewV2({
  registration,
  event,
  photoUrl,
  logoUrl,
  qrDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  photoUrl?: string | null;
  logoUrl?: string | null;
  qrDataUrl?: string;
}) {
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <div className="bg-white border rounded-lg overflow-hidden w-[220px] shadow">
      <div className="flex items-center gap-3 p-3 border-b">
        {logoUrl && <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />}
        <div className="text-xs">
          <div className="font-bold">{event.title}</div>
          <div className="text-gray-500">{new Date(event.date).toLocaleDateString("fr-FR")}</div>
        </div>
      </div>
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-100" />
      )}
      <div className="p-2 text-center">
        <div className="font-semibold text-sm">
          {registration.firstName} {registration.lastName}
        </div>
        <div className="text-xs text-gray-600">{registration.structure}</div>
      </div>
      <div className="p-2 text-white text-center text-sm font-semibold" style={{ background: catColor }}>
        #{registration.category.number} — {registration.category.name}
        {registration.allAccessGranted ? " — ALL ACCESS" : ""}
      </div>
      <div className="flex justify-between items-center p-2 border-t">
        {qrDataUrl ? <img src={qrDataUrl} alt="" className="w-12 h-12" /> : <span className="text-xs text-gray-400">QR</span>}
        <span className="text-[10px] text-gray-500">{registration.id}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 13.7: Commit**

```bash
git add src/components/badge/BadgeDocumentV2.tsx src/components/badge/BadgeDocumentAnonymousV2.tsx src/components/badge/BadgeBatchExportV2.tsx src/components/badge/BadgePreviewV2.tsx src/components/badge/BadgeDownloadV2.tsx src/components/badge/BadgeWebPreviewV2.tsx
git commit -m "feat(v2): refonte composants badge (BadgeDocumentV2 + Anonymous + Batch + Preview + Download avec prop event)"
```

---

## Task 14: Pages badges (liste, detail, batch print)

**Files:**
- Create: `src/components/event/BadgeListTable.tsx`
- Create: `src/components/event/BadgeBatchPanel.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/badges/page.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/badges/[badgeId]/page.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/badges/print/page.tsx`

> Liste badges = inscriptions APPROVED. Filtres : imprime / non imprime / all-access. Batch : selection multiple + `POST /registrations/print` ou `/badges/print` (vue PDF batch).

- [ ] **Step 14.1: Create `src/components/event/BadgeListTable.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  category: { name: string; color: string; number: number };
};

export function BadgeListTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "printed" | "unprinted" | "allaccess">("unprinted");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations?status=APPROVED&limit=100`);
    const json = await res.json();
    let r: Row[] = json.registrations;
    if (filter === "printed") r = r.filter((x) => x.badgePrinted);
    else if (filter === "unprinted") r = r.filter((x) => !x.badgePrinted);
    else if (filter === "allaccess") r = r.filter((x) => x.allAccessGranted);
    setRows(r);
    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function batchPrint() {
    if (selected.size === 0) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/print`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    load();
  }

  function openBatchPdf() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    window.open(`/admin/${orgId}/events/${eventId}/badges/print?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
          <option value="unprinted">Non imprimés</option>
          <option value="printed">Imprimés</option>
          <option value="allaccess">All-access</option>
          <option value="all">Tous</option>
        </select>
        <div className="space-x-2">
          <Button variant="secondary" onClick={openBatchPdf} disabled={selected.size === 0}>
            Aperçu PDF batch
          </Button>
          <Button onClick={batchPrint} disabled={selected.size === 0 || busy}>
            Marquer comme imprimés ({selected.size})
          </Button>
        </div>
      </div>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2">Nom</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Imprimé</th>
            <th className="px-3 py-2">All access</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              </td>
              <td className="px-3 py-2 font-medium">
                {r.firstName} {r.lastName}
              </td>
              <td className="px-3 py-2">
                <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: r.category.color }} />
                #{r.category.number} {r.category.name}
              </td>
              <td className="px-3 py-2">{r.badgePrinted ? "oui" : "non"}</td>
              <td className="px-3 py-2">{r.allAccessGranted ? "oui" : "—"}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/admin/${orgId}/events/${eventId}/badges/${r.id}`} className="text-sm text-blue-600 hover:underline">
                  Voir
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

- [ ] **Step 14.2: Create `src/components/event/BadgeBatchPanel.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { BadgeBatchExportV2 } from "@/components/badge/BadgeBatchExportV2";
import type { BadgeEvent, BadgeRegistration } from "@/components/badge/BadgeDocumentV2";
import { PDFViewer } from "@react-pdf/renderer";
import { generateQrDataUrl } from "@/lib/qrcode";

export function BadgeBatchPanel({
  orgId,
  eventId,
  ids,
  baseUrl,
}: {
  orgId: string;
  eventId: string;
  ids: string[];
  baseUrl: string;
}) {
  const [items, setItems] = useState<{ registration: BadgeRegistration; qrDataUrl: string }[]>([]);
  const [event, setEvent] = useState<BadgeEvent | null>(null);

  useEffect(() => {
    (async () => {
      const evtRes = await fetch(`/api/admin/${orgId}/events/${eventId}`);
      const evtJson = await evtRes.json();
      setEvent({ title: evtJson.event.title, date: new Date(evtJson.event.date), logo: evtJson.event.logo });
      const fetched: { registration: BadgeRegistration; qrDataUrl: string }[] = [];
      for (const id of ids) {
        const r = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${id}`);
        if (!r.ok) continue;
        const j = await r.json();
        const qr = await generateQrDataUrl(`${baseUrl}/verify/${j.registration.id}`);
        fetched.push({ registration: j.registration, qrDataUrl: qr });
      }
      setItems(fetched);
    })();
  }, [orgId, eventId, ids, baseUrl]);

  if (!event || items.length === 0) return <div className="text-sm text-gray-500">Chargement...</div>;

  return (
    <PDFViewer style={{ width: "100%", height: 800 }}>
      <BadgeBatchExportV2 items={items} event={event} />
    </PDFViewer>
  );
}
```

- [ ] **Step 14.3: Create page `badges/page.tsx`**

```typescript
import { BadgeListTable } from "@/components/event/BadgeListTable";

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Badges</h1>
      <BadgeListTable orgId={orgId} eventId={eventId} />
    </div>
  );
}
```

- [ ] **Step 14.4: Create page `badges/[badgeId]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { BadgeDownloadV2 } from "@/components/badge/BadgeDownloadV2";

export default async function BadgeDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string; badgeId: string }>;
}) {
  const { orgId, eventId, badgeId } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: { category: true, event: { select: { title: true, date: true, logo: true, orgId: true } } },
  });
  if (!registration || registration.eventId !== eventId || registration.event.orgId !== orgId) notFound();

  const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const qrDataUrl = await generateQrDataUrl(`${baseUrl}/verify/${registration.id}`);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">
        Badge — {registration.firstName} {registration.lastName}
      </h1>
      <BadgeDownloadV2
        registration={{
          id: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          structure: registration.structure,
          photo: registration.photo,
          allAccessGranted: registration.allAccessGranted,
          category: {
            name: registration.category.name,
            color: registration.category.color,
            number: registration.category.number,
            neutralBadge: registration.category.neutralBadge,
            anonymous: registration.category.anonymous,
          },
        }}
        event={{
          title: registration.event.title,
          date: registration.event.date,
          logo: registration.event.logo,
        }}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
```

- [ ] **Step 14.5: Create page `badges/print/page.tsx`**

```typescript
import { BadgeBatchPanel } from "@/components/event/BadgeBatchPanel";

export default async function BatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { orgId, eventId } = await params;
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").filter(Boolean);
  const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Impression batch ({ids.length} badges)</h1>
      <BadgeBatchPanel orgId={orgId} eventId={eventId} ids={ids} baseUrl={baseUrl} />
    </div>
  );
}
```

- [ ] **Step 14.6: Commit**

```bash
git add "src/app/admin/[orgId]/events/[eventId]/badges" src/components/event/BadgeListTable.tsx src/components/event/BadgeBatchPanel.tsx
git commit -m "feat(v2): pages badges (liste filtree + detail + batch print PDF)"
```

---

## Task 15: Scanner QR + endpoint `/scan/verify`

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/scan/verify/route.ts`
- Create: `src/components/event/QRScanner.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/scan/page.tsx`
- Create: `src/lib/__tests__/api-event-scan.test.ts`

> Endpoint `scan/verify` accepte un payload (badgeId direct ou QR `https://host/verify/[id]`), extrait l'id, verifie qu'il appartient bien a cet event (critere d'acceptation #3 : "Une inscription scannee d'un autre event affiche 'Badge appartient a un autre evenement'"). Log `BADGE_SCANNED` quel que soit le resultat.

- [ ] **Step 15.1: Write failing tests**

Create `src/lib/__tests__/api-event-scan.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedOperator() {
  const u = await prisma.user.create({ data: { email: `op-${Date.now()}@x`, password: "x", name: "Op" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
  return { u, org, event, cat };
}

describe("POST /scan/verify", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("APPROVED badge -> authorized=true + BADGE_SCANNED log", async () => {
    const { u, org, event, cat } = await seedOperator();
    const r = await prisma.registration.create({
      data: {
        id: "REG-OK",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: r.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(true);
    expect(json.registration.firstName).toBe("F");
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_SCANNED" } });
    expect(log?.userId).toBe(u.id);
  });

  it("extracts badgeId from QR URL payload", async () => {
    const { u, org, event, cat } = await seedOperator();
    const r = await prisma.registration.create({
      data: {
        id: "REG-QR",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "https://example.com/verify/REG-QR" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registration.id).toBe(r.id);
  });

  it("badge from another event -> code=FOREIGN_EVENT", async () => {
    const { u, org, event } = await seedOperator();
    const otherOrg = await prisma.organization.create({ data: { name: "B", slug: "b-o" } });
    const otherEvt = await prisma.event.create({
      data: { orgId: otherOrg.id, title: "X", slug: "x-o", location: "", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: otherEvt.id, name: "V", color: "#000", number: 1 } });
    await prisma.registration.create({
      data: {
        id: "REG-FOREIGN",
        eventId: otherEvt.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "REG-FOREIGN" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("FOREIGN_EVENT");
    expect(json.message).toContain("autre événement");
  });

  it("REJECTED badge -> authorized=false", async () => {
    const { u, org, event, cat } = await seedOperator();
    await prisma.registration.create({
      data: {
        id: "REG-REJ",
        eventId: event.id,
        categoryId: cat.id,
        email: "x@x",
        lastName: "L",
        firstName: "F",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D",
        status: "REJECTED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "REG-REJ" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(false);
    expect(json.registration.status).toBe("REJECTED");
  });
});
```

- [ ] **Step 15.2: Run tests (fail)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-scan.test.ts
```

Expected: FAIL.

- [ ] **Step 15.3: Implement `src/app/api/admin/[orgId]/events/[eventId]/scan/verify/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({ payload: z.string().min(1).max(2000) });

function extractBadgeId(payload: string): string {
  const trimmed = payload.trim();
  // Forme URL : https://host/verify/[id] -> extrait l'id
  const match = trimmed.match(/\/verify\/([A-Za-z0-9-]+)/);
  if (match) return match[1];
  return trimmed;
}

export const POST = withEventAuth({ minRole: "OPERATOR" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const badgeId = extractBadgeId(parsed.data.payload);
  const reg = await prisma.registration.findUnique({
    where: { id: badgeId },
    select: {
      id: true,
      eventId: true,
      status: true,
      firstName: true,
      lastName: true,
      allAccessGranted: true,
      badgePrinted: true,
      category: { select: { name: true, color: true, number: true } },
    },
  });

  if (!reg) {
    await logActivity({
      type: "BADGE_SCANNED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { result: "not-found", payload: parsed.data.payload },
      req,
    });
    return NextResponse.json(
      { error: "NOT_FOUND", code: "NOT_FOUND", message: "Badge inconnu." },
      { status: 404 },
    );
  }

  if (reg.eventId !== eventId) {
    await logActivity({
      type: "BADGE_SCANNED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: reg.id,
      details: { result: "foreign-event" },
      req,
    });
    return NextResponse.json(
      {
        error: "FOREIGN_EVENT",
        code: "FOREIGN_EVENT",
        message: "Badge appartient à un autre événement.",
      },
      { status: 404 },
    );
  }

  await logActivity({
    type: "BADGE_SCANNED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: reg.id,
    details: { result: reg.status === "APPROVED" ? "ok" : `denied-${reg.status}` },
    req,
  });

  return NextResponse.json({
    ok: true,
    authorized: reg.status === "APPROVED",
    registration: {
      id: reg.id,
      firstName: reg.firstName,
      lastName: reg.lastName,
      status: reg.status,
      allAccessGranted: reg.allAccessGranted,
      badgePrinted: reg.badgePrinted,
      category: reg.category,
    },
  });
});
```

- [ ] **Step 15.4: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-scan.test.ts
```

Expected: 4 verts.

- [ ] **Step 15.5: Create `src/components/event/QRScanner.tsx`**

> Refonte v1 : `html5-qrcode`. Affiche resultat (vert/rouge), historique session (10 dernieres lectures), bouton saisie manuelle.

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ScanResult = {
  authorized: boolean;
  registration?: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    category: { name: string; color: string; number: number };
  };
  error?: string;
  message?: string;
  scannedAt: Date;
};

export function QRScanner({ orgId, eventId }: { orgId: string; eventId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<any>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [busy, setBusy] = useState(false);

  async function verifyPayload(payload: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/scan/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const json = await res.json();
    const result: ScanResult = {
      authorized: json.authorized ?? false,
      registration: json.registration,
      error: json.error,
      message: json.message,
      scannedAt: new Date(),
    };
    setLast(result);
    setHistory((h) => [result, ...h].slice(0, 10));
    setBusy(false);
  }

  useEffect(() => {
    if (manualMode) return;
    let cancelled = false;
    (async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (cancelled || !containerRef.current) return;
      const scanner = new Html5QrcodeScanner(containerRef.current.id, { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (decoded: string) => {
          verifyPayload(decoded);
        },
        () => {
          // ignore errors per frame
        },
      );
      scannerRef.current = scanner;
    })();
    return () => {
      cancelled = true;
      try {
        scannerRef.current?.clear();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode, orgId, eventId]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPayload) return;
    await verifyPayload(manualPayload);
    setManualPayload("");
  }

  const resultClass = last
    ? last.authorized
      ? "border-green-400 bg-green-50"
      : "border-red-400 bg-red-50"
    : "border-gray-200 bg-white";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Scanner</h2>
        <Button variant="secondary" onClick={() => setManualMode((m) => !m)}>
          {manualMode ? "Activer la caméra" : "Saisie manuelle"}
        </Button>
      </div>

      {manualMode ? (
        <form onSubmit={submitManual} className="bg-white border rounded p-3 flex gap-2">
          <Input
            value={manualPayload}
            onChange={(e) => setManualPayload(e.target.value)}
            placeholder="ID de badge ou contenu QR"
          />
          <Button type="submit" disabled={busy || !manualPayload}>
            Vérifier
          </Button>
        </form>
      ) : (
        <div id="qr-scanner-container" ref={containerRef} className="bg-white border rounded p-2" />
      )}

      <div className={`rounded border p-4 ${resultClass}`}>
        {last ? (
          <>
            <div className="text-lg font-bold">
              {last.authorized ? "Entrée autorisée" : last.error === "FOREIGN_EVENT" ? "Badge d'un autre événement" : "Refusé"}
            </div>
            {last.message && <div className="text-sm">{last.message}</div>}
            {last.registration && (
              <div className="mt-2">
                <div className="font-semibold">
                  {last.registration.firstName} {last.registration.lastName}
                </div>
                <div className="text-sm text-gray-600">
                  Catégorie : #{last.registration.category.number} {last.registration.category.name}
                </div>
                <div className="text-sm">Statut : {last.registration.status}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">Aucun scan pour le moment.</div>
        )}
      </div>

      <section>
        <h3 className="font-semibold mb-2">Historique session</h3>
        <ul className="bg-white border rounded divide-y text-sm">
          {history.length === 0 && <li className="px-3 py-2 text-gray-500">—</li>}
          {history.map((h, i) => (
            <li key={i} className="px-3 py-2 flex justify-between">
              <span>
                {h.registration ? `${h.registration.firstName} ${h.registration.lastName}` : h.error ?? "?"}
              </span>
              <span className={h.authorized ? "text-green-700" : "text-red-700"}>
                {h.authorized ? "OK" : "Refusé"} — {h.scannedAt.toLocaleTimeString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 15.6: Create page `scan/page.tsx`**

```typescript
import { QRScanner } from "@/components/event/QRScanner";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scanner les badges</h1>
      <QRScanner orgId={orgId} eventId={eventId} />
    </div>
  );
}
```

- [ ] **Step 15.7: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/scan" "src/app/admin/[orgId]/events/[eventId]/scan" src/components/event/QRScanner.tsx src/lib/__tests__/api-event-scan.test.ts
git commit -m "feat(v2): scanner QR + endpoint scan/verify (foreign event detection, log BADGE_SCANNED)"
```

---

## Task 16: Blocked emails / documents — routes + composants + pages

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/blocked-emails/[id]/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/blocked-documents/route.ts`
- Create: `src/app/api/admin/[orgId]/events/[eventId]/blocked-documents/[id]/route.ts`
- Create: `src/components/event/BlockedEmailsForm.tsx`
- Create: `src/components/event/BlockedDocumentsForm.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/blocked-emails/page.tsx`
- Create: `src/app/admin/[orgId]/events/[eventId]/blocked-documents/page.tsx`
- Create: `src/lib/__tests__/api-event-blocked.test.ts`

- [ ] **Step 16.1: Write failing tests**

Create `src/lib/__tests__/api-event-blocked.test.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

async function seedAdmin() {
  const u = await prisma.user.create({ data: { email: `a-${Date.now()}@x`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${Date.now()}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("/blocked-emails", () => {
  beforeEach(async () => {
    await prisma.blockedEmail.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("POST adds an entry; DELETE removes it", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ email: "spam@x", reason: "spam" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(201);
    const json = await res.json();

    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/[id]/route");
    const r2 = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: json.blocked.id }) },
    );
    expect(r2.status).toBe(204);
    expect(await prisma.blockedEmail.count()).toBe(0);
  });

  it("OPERATOR cannot add (403)", async () => {
    const u = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op", location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ email: "x@x" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("/blocked-documents", () => {
  beforeEach(async () => {
    await prisma.blockedDocument.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("POST adds and audit logged", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-documents/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ documentNumber: "DOC-XX", reason: "faux" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(201);
    expect(await prisma.blockedDocument.count()).toBe(1);
  });
});
```

- [ ] **Step 16.2: Implement `blocked-emails/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, { eventId }) => {
  const blocked = await prisma.blockedEmail.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ blocked });
});

const schema = z.object({ email: z.string().email(), reason: z.string().max(500).optional() });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  try {
    const blocked = await prisma.blockedEmail.create({
      data: { eventId, email: parsed.data.email.toLowerCase().trim(), reason: parsed.data.reason ?? null },
    });
    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { action: "blocked-email-added", email: parsed.data.email },
      req,
    });
    return NextResponse.json({ blocked }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") return NextResponse.json({ error: "ALREADY_BLOCKED" }, { status: 409 });
    throw err;
  }
});
```

- [ ] **Step 16.3: Implement `blocked-emails/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = await extra.params;
  const existing = await prisma.blockedEmail.findUnique({ where: { id } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.blockedEmail.delete({ where: { id } });
  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { action: "blocked-email-removed", email: existing.email },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 16.4: Implement `blocked-documents/route.ts` + `blocked-documents/[id]/route.ts`** (calque sur emails)

Create `src/app/api/admin/[orgId]/events/[eventId]/blocked-documents/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, { eventId }) => {
  const blocked = await prisma.blockedDocument.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ blocked });
});

const schema = z.object({ documentNumber: z.string().min(1).max(80), reason: z.string().max(500).optional() });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  try {
    const blocked = await prisma.blockedDocument.create({
      data: { eventId, documentNumber: parsed.data.documentNumber, reason: parsed.data.reason ?? null },
    });
    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { action: "blocked-document-added", documentNumber: parsed.data.documentNumber },
      req,
    });
    return NextResponse.json({ blocked }, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") return NextResponse.json({ error: "ALREADY_BLOCKED" }, { status: 409 });
    throw err;
  }
});
```

Create `src/app/api/admin/[orgId]/events/[eventId]/blocked-documents/[id]/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = await extra.params;
  const existing = await prisma.blockedDocument.findUnique({ where: { id } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.blockedDocument.delete({ where: { id } });
  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { action: "blocked-document-removed", documentNumber: existing.documentNumber },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 16.5: Create UI components + pages**

Create `src/components/event/BlockedEmailsForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = { id: string; email: string; reason: string | null; createdAt: string };

export function BlockedEmailsForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState(initial);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-emails`);
    const j = await res.json();
    setRows(
      j.blocked.map((b: any) => ({ ...b, createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date(b.createdAt).toISOString() })),
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, reason: reason || undefined }),
    });
    if (res.ok) {
      setEmail("");
      setReason("");
      refresh();
    } else {
      alert("Échec de l'ajout.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ?")) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-emails/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold">Bloquer un email</h2>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison (optionnelle)" />
        <Button type="submit">Bloquer</Button>
      </form>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Raison</th>
            <th className="px-3 py-2">Depuis</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                Aucun email bloqué.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.email}</td>
              <td className="px-3 py-2 text-gray-600">{r.reason ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(r.id)}>
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

Create `src/components/event/BlockedDocumentsForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = { id: string; documentNumber: string; reason: string | null; createdAt: string };

export function BlockedDocumentsForm({
  orgId,
  eventId,
  initial,
}: {
  orgId: string;
  eventId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState(initial);
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");

  async function refresh() {
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents`);
    const j = await res.json();
    setRows(j.blocked);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentNumber: doc, reason: reason || undefined }),
    });
    if (res.ok) {
      setDoc("");
      setReason("");
      refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ?")) return;
    await fetch(`/api/admin/${orgId}/events/${eventId}/blocked-documents/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-semibold">Bloquer un document</h2>
        <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Numéro de pièce d'identité" required />
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison (optionnelle)" />
        <Button type="submit">Bloquer</Button>
      </form>
      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Raison</th>
            <th className="px-3 py-2">Depuis</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                Aucun document bloqué.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.documentNumber}</td>
              <td className="px-3 py-2 text-gray-600">{r.reason ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="secondary" onClick={() => remove(r.id)}>
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

Create `src/app/admin/[orgId]/events/[eventId]/blocked-emails/page.tsx` :

```typescript
import { prisma } from "@/lib/prisma";
import { BlockedEmailsForm } from "@/components/event/BlockedEmailsForm";

export default async function BlockedEmailsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const rows = await prisma.blockedEmail.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Emails bloqués</h1>
      <BlockedEmailsForm
        orgId={orgId}
        eventId={eventId}
        initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
```

Create `src/app/admin/[orgId]/events/[eventId]/blocked-documents/page.tsx` :

```typescript
import { prisma } from "@/lib/prisma";
import { BlockedDocumentsForm } from "@/components/event/BlockedDocumentsForm";

export default async function BlockedDocumentsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const rows = await prisma.blockedDocument.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Documents bloqués</h1>
      <BlockedDocumentsForm
        orgId={orgId}
        eventId={eventId}
        initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
```

- [ ] **Step 16.6: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-blocked.test.ts
```

Expected: 3 verts.

- [ ] **Step 16.7: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/blocked-emails" "src/app/api/admin/[orgId]/events/[eventId]/blocked-documents" "src/app/admin/[orgId]/events/[eventId]/blocked-emails" "src/app/admin/[orgId]/events/[eventId]/blocked-documents" src/components/event/BlockedEmailsForm.tsx src/components/event/BlockedDocumentsForm.tsx src/lib/__tests__/api-event-blocked.test.ts
git commit -m "feat(v2): blocked emails/documents scope event (CRUD)"
```

---

## Task 17: Activity log event — route + page (OPERATOR voit seulement ses scans)

**Files:**
- Create: `src/app/api/admin/[orgId]/events/[eventId]/activity/route.ts`
- Create: `src/app/admin/[orgId]/events/[eventId]/activity/page.tsx`

> OPERATOR : filtre `userId = session.user.id` cote serveur (defense in depth — un OPERATOR ne doit jamais voir l'historique d'un autre user, meme par URL crafted).

- [ ] **Step 17.1: Create `src/app/api/admin/[orgId]/events/[eventId]/activity/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (req, { eventId, session, effectiveRole }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "30"));

  const where: any = { eventId };
  if (type) where.type = type;
  // OPERATOR : restreint a ses propres actions (critere spec ll. 135)
  if (effectiveRole === "OPERATOR") {
    where.userId = session.user.id;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        details: true,
        staffActor: true,
        createdAt: true,
        targetId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
});
```

- [ ] **Step 17.2: Create page `activity/page.tsx`**

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, eventId, orgId);
  const where: any = { eventId };
  if (role === "OPERATOR") where.userId = ctx.user.id;

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      staffActor: true,
      details: true,
      targetId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Journal d'activité</h1>
      <ul className="bg-white border rounded divide-y text-sm">
        {logs.length === 0 && <li className="px-3 py-3 text-gray-500">Aucune activité.</li>}
        {logs.map((l) => (
          <li key={l.id} className="px-3 py-3 flex justify-between items-start">
            <div>
              <div className="font-medium">
                {l.type}
                {l.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">staff</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {l.user ? `${l.user.name} (${l.user.email})` : "Système"}
                {l.targetId ? ` — cible ${l.targetId}` : ""}
              </div>
            </div>
            <div className="text-xs text-gray-500 whitespace-nowrap">
              {new Date(l.createdAt).toLocaleString("fr-FR")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 17.3: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/activity" "src/app/admin/[orgId]/events/[eventId]/activity"
git commit -m "feat(v2): activity log event (OPERATOR voit uniquement ses propres actions)"
```

---

## Task 18: Quota — appliquer `quotaMaxRegistrations` cote admin POST registrations

**Files:**
- Modify: `src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts`
- Add tests in `src/lib/__tests__/api-event-registrations.test.ts`

> Decision spec : "Les admins peuvent toujours creer des inscriptions manuellement (bypass quota cote admin avec audit)". On NE bloque PAS cote admin, mais on AUDIT explicitement le depassement de quota. Le 429 QUOTA_EXCEEDED est applique cote public (Plan 5).

- [ ] **Step 18.1: Add failing tests**

Append to `src/lib/__tests__/api-event-registrations.test.ts` :

```typescript
describe("Quota — admin bypass with audit", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("admin can create even if quota exceeded — log includes quotaBypass=true", async () => {
    const u = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "qq-o", quotaMaxRegistrations: 1 } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "qq-e", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await prisma.registration.create({
      data: { id: "R1", eventId: event.id, categoryId: cat.id, email: "a@x", lastName: "L", firstName: "F", structure: "S", idDocumentType: "CNI", idDocumentNumber: "D1", status: "APPROVED" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: "second@x",
        firstName: "B",
        lastName: "B",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "D2",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_CREATED", targetId: { not: "R1" } } });
    expect((log?.details as any)?.quotaBypass).toBe(true);
  });
});
```

- [ ] **Step 18.2: Update `registrations/route.ts` POST handler**

Modify the existing `src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts` (Task 8) — replace the audit `details` block in `POST`:

```typescript
import { countCountableRegistrations } from "@/lib/event-quota";

// ... inside POST, AFTER prisma.registration.create({...}) :

const orgRow = await prisma.organization.findUnique({
  where: { id: orgId },
  select: { quotaMaxRegistrations: true },
});
const after = await countCountableRegistrations(eventId);
const quotaBypass = orgRow?.quotaMaxRegistrations != null && after > orgRow.quotaMaxRegistrations;

await logActivity({
  type: "REGISTRATION_CREATED",
  userId: session.user.id,
  orgId,
  eventId,
  targetId: registration.id,
  details: { manual: true, status: "APPROVED", quotaBypass },
  req,
});
```

- [ ] **Step 18.3: Run tests (pass)**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-registrations.test.ts
```

Expected: tous verts (le nouveau test inclus).

- [ ] **Step 18.4: Commit**

```bash
git add "src/app/api/admin/[orgId]/events/[eventId]/registrations/route.ts" src/lib/__tests__/api-event-registrations.test.ts
git commit -m "feat(v2): admin POST registration audit quotaBypass=true si quota depasse"
```

---

## Task 19: Smoke e2e — parcours ADMIN complet + parcours OPERATOR

**Files:**
- Create: `src/lib/__tests__/event-journey.test.ts`

> Test integration via Prisma + appels API : ADMIN cree inscription, approuve, imprime, scan ; OPERATOR scan uniquement (les autres routes renvoient 403). Couvre les criteres d'acceptation #1, #2, #3, #6, #7, #9, #10 de la spec.

- [ ] **Step 19.1: Create `src/lib/__tests__/event-journey.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<any>("@/lib/mail");
  return {
    ...actual,
    sendStatusNotification: vi.fn(async () => undefined),
    sendBadgePrintedNotification: vi.fn(async () => undefined),
    sendEditLinkEmail: vi.fn(async () => undefined),
    sendUserInvitation: vi.fn(async () => undefined),
  };
});
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as any);
}

describe("ADMIN journey (smoke)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.submissionSnapshot.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendStatusNotification).mockClear();
    vi.mocked(sendBadgePrintedNotification).mockClear();
  });

  it("ADMIN creates category, creates registration, approves, prints, OWNER inherits ADMIN", async () => {
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Salon 2026", slug: "salon-2026", location: "Abidjan", date: new Date("2026-10-01") },
    });
    await withSession({ id: owner.id, email: owner.email, name: owner.name, isStaff: false });

    // 1. OWNER (no EventMembership) cree une categorie -> ADMIN inherite (critere #1 verif)
    const { POST: createCat } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/route");
    const r1 = await createCat(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ name: "VIP", color: "#ff0000", number: 1 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(r1.status).toBe(201);
    const cat = await prisma.category.findFirst({ where: { eventId: event.id } });

    // 2. ADMIN cree une inscription manuelle (APPROVED par defaut)
    const { POST: createReg } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const r2 = await createReg(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          categoryId: cat!.id,
          email: "p@x",
          firstName: "Amadou",
          lastName: "Diallo",
          structure: "ENSEA",
          idDocumentType: "CNI",
          idDocumentNumber: "CNI-1",
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(r2.status).toBe(201);
    const created = await r2.json();
    const regId = created.registration.id;

    // 3. Print badge
    const { POST: print } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const r3 = await print(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId }) },
    );
    expect(r3.status).toBe(200);
    expect(vi.mocked(sendBadgePrintedNotification)).toHaveBeenCalledWith(regId);

    // 4. Verifie que tous les logs portent orgId + eventId (critere #9)
    const logs = await prisma.activityLog.findMany({ where: { eventId: event.id } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.orgId === org.id && l.eventId === event.id)).toBe(true);
  });
});

describe("OPERATOR restrictions (smoke)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OPERATOR can scan but cannot approve/create/delete/PATCH (critere #2, #10)", async () => {
    const op = await prisma.user.create({ data: { email: "op@x", password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e-op", location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: op.id, eventId: event.id, role: "OPERATOR" } });
    const r = await prisma.registration.create({
      data: { id: "R-OP", eventId: event.id, categoryId: cat.id, email: "x@x", lastName: "L", firstName: "F", structure: "S", idDocumentType: "CNI", idDocumentNumber: "D", status: "PENDING" },
    });
    await withSession({ id: op.id, email: op.email, name: op.name, isStaff: false });

    // scan : autorise
    const { POST: scan } = await import("@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route");
    const rscan = await scan(
      new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ payload: r.id }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(rscan.status).toBe(200);

    // approve : 403
    const { POST: approve } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const rapp = await approve(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(rapp.status).toBe(403);

    // PATCH : 403
    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/route");
    const rpatch = await PATCH(
      new NextRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ firstName: "X" }), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id }) },
    );
    expect(rpatch.status).toBe(403);

    // DELETE category : 403
    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route");
    const rdel = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id }) },
    );
    expect(rdel.status).toBe(403);
  });
});
```

- [ ] **Step 19.2: Run tests**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/event-journey.test.ts
```

Expected: 2 passed (1 ADMIN journey + 1 OPERATOR restrictions).

- [ ] **Step 19.3: Commit**

```bash
git add src/lib/__tests__/event-journey.test.ts
git commit -m "test(v2): e2e parcours event (ADMIN approve+print, OPERATOR restrictions, OWNER hericheADMIN)"
```

---

## Task 20: Verifier critere #5 (suppression categorie avec inscriptions -> modale de reaffectation)

**Files:**
- Modify (verification only): `src/lib/__tests__/api-event-categories.test.ts`

> La modale `CategoryReassignModal` (Task 5) a deja ete cree. On ajoute un test integration qui simule le flux complet : tentative DELETE -> 409 CATEGORY_HAS_REGISTRATIONS -> PATCH reassignToCategoryId -> DELETE OK.

- [ ] **Step 20.1: Add failing test**

Append to `src/lib/__tests__/api-event-categories.test.ts` :

```typescript
describe("Category reassignment flow (critere #5)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("PATCH reassignToCategoryId moves registrations then DELETE succeeds", async () => {
    const u = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ra-o" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "ra-e", location: "L", date: new Date() },
    });
    const catFrom = await prisma.category.create({ data: { eventId: event.id, name: "From", color: "#000", number: 1 } });
    const catTo = await prisma.category.create({ data: { eventId: event.id, name: "To", color: "#fff", number: 2 } });
    await prisma.registration.create({
      data: { id: "R1", eventId: event.id, categoryId: catFrom.id, email: "x@x", firstName: "F", lastName: "L", structure: "S", idDocumentType: "CNI", idDocumentNumber: "D" },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    // 1. DELETE initial -> 409
    const { DELETE } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route");
    const r1 = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }) },
    );
    expect(r1.status).toBe(409);

    // 2. PATCH reassignToCategoryId
    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route");
    const r2 = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ reassignToCategoryId: catTo.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }) },
    );
    expect(r2.status).toBe(200);

    // 3. DELETE -> 204
    const r3 = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, id: catFrom.id }) },
    );
    expect(r3.status).toBe(204);

    const remaining = await prisma.registration.findMany();
    expect(remaining[0].categoryId).toBe(catTo.id);
  });
});
```

- [ ] **Step 20.2: Run**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/api-event-categories.test.ts
```

Expected: tous verts (le nouveau test inclus).

- [ ] **Step 20.3: Commit**

```bash
git add src/lib/__tests__/api-event-categories.test.ts
git commit -m "test(v2): flux complet reaffectation categorie avant suppression (critere d acceptation 5)"
```

---

## Task 21: Manual smoke tests (navigateur) — golden path + cas limites

> Cette tache est manuelle et obligatoire. Le but : verifier visuellement chaque parcours dans le navigateur.

- [ ] **Step 21.1: Demarrer l'environnement**

```bash
make dev
```

Attendre que `app`, `mysql`, `mailpit` soient prets. Mailpit : `http://localhost:8025`. App : `http://localhost:3000`.

- [ ] **Step 21.2: Seed manuel**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db seed
```

Connect en STAFF_ADMIN (`admin@badge.local`/`admin123`).

- [ ] **Step 21.3: Creer une org + un event + un OWNER en SQL si Plan 2/3 pas mergees**

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge' <<SQL
INSERT INTO Organization (id, name, slug, createdAt) VALUES ('org-test', 'Test Org', 'test-org', NOW());
INSERT INTO User (id, email, password, name, createdAt) VALUES ('user-owner', 'owner@test', '\$2a\$12\$YWxz...', 'Owner', NOW());
INSERT INTO OrgMembership (id, userId, orgId, role, createdAt) VALUES ('m1', 'user-owner', 'org-test', 'OWNER', NOW());
INSERT INTO Event (id, orgId, title, slug, location, date, registrationOpen, createdAt) VALUES ('evt-test', 'org-test', 'Salon 2026', 'salon-2026', 'Abidjan', '2026-12-15', false, NOW());
SQL
```

- [ ] **Step 21.4: Parcours OWNER**

Ouvrir `http://localhost:3000/admin/org-test/events/evt-test`.

Verifier :
- Sidebar EventShell (Tableau de bord, Inscriptions, Badges, Categories, Membres, Parametres, Journal, Scanner)
- KPI affiches a 0
- Bandeau "Mode staff" si connecte en STAFF_ADMIN

Parcourir :
- `/categories` -> creer "VIP" (#1) + "Invite" (#2)
- `/registrations/new` -> creer une inscription manuelle -> status APPROVED automatique
- `/registrations` -> filtres + recherche fonctionnent
- `/registrations/[id]` -> detail + actions (block email, all-access, voir badge)
- `/badges` -> liste, selection multiple, batch print -> Mailpit recoit N emails
- `/badges/[id]` -> Telecharger PDF, verifier logo + QR + categorie
- `/scan` -> ouvrir la camera, scanner un QR -> autorise (vert)
- `/members` -> inviter un OPERATOR -> Mailpit recoit invitation
- `/settings` -> changer les overrides contactEmail / contactPhone -> verifier persistance (le SMTP est plateforme uniquement, aucune override SMTP cote event)
- `/blocked-emails`, `/blocked-documents` -> ajouter + retirer
- `/activity` -> verifier que toutes les actions apparaissent avec `staffActor` si pertinent

- [ ] **Step 21.5: Parcours OPERATOR**

Se deconnecter, se reconnecter en OPERATOR (cree a l'etape precedente).

Verifier :
- Sidebar reduite : Scanner + Profil uniquement
- Visite `/admin/org-test/events/evt-test` -> dashboard OPERATOR (mes scans + CTA scanner)
- Visite `/admin/org-test/events/evt-test/registrations` -> redirige vers `/select` ou 403 (selon middleware)
- Visite `/admin/org-test/events/evt-test/scan` -> scanner fonctionnel
- Scanner un badge -> log `BADGE_SCANNED` cree, visible sur `/activity` (filtrage userId)

- [ ] **Step 21.6: Cas limites**

- Categorie avec inscriptions : tenter Supprimer -> modale "Reaffecter" s'ouvre
- Quota atteint : forcer `quotaMaxRegistrations=1` en SQL puis creer une 2e inscription -> log `quotaBypass=true`
- Event archive : passer `archived=true` en SQL puis tenter `/categories` POST -> 410 EVENT_ARCHIVED
- Scanner badge d'un autre event : creer 2 events, scanner un id du wrong event -> message "Badge appartient a un autre evenement"

- [ ] **Step 21.7: Confirmer manuellement chaque checkbox**

Cocher chacun des criteres d'acceptation de la spec (l. 230-241) :

1. OPERATOR sidebar restreinte
2. OPERATOR `/registrations` -> 403/redirect
3. Scan event etranger -> message "autre evenement"
4. Categorie avec `number` deja utilise -> refus 409
5. Suppression categorie avec inscriptions -> 409 + modale reaffectation
6. Email approbation contient titre event correct (Mailpit)
7. PDF badge inclut le logo event (telecharger + verifier)
8. QR code encode `https://[host]/verify/[badgeId]` (scanner et lire le contenu)
9. Mutations -> ActivityLog `orgId + eventId`
10. OperatorMembership ne donne pas acces a `/registrations` (defense in depth)

---

## Task 22: Finalisation — lint, typecheck, tests complets, doc, verif no-stub

**Files:**
- Modify: `docs/v2/architecture.md`

- [ ] **Step 22.1: Run full test suite**

```bash
make test
```

Expected : tous les tests Plan 1 + Plan 3 + Plan 4 passent.

- [ ] **Step 22.2: Lint + typecheck**

```bash
make lint && make typecheck
```

Expected : pas de warning, pas d'erreur dans les nouveaux fichiers Plan 4. Les fichiers v1 hors-scope (`src/app/api/registrations/*` ancien, `src/app/admin/registrations/*`) peuvent encore generer des erreurs (a supprimer dans Plan 7).

- [ ] **Step 22.3: Verifier l'absence de stubs Plan 6 residuels**

```bash
grep -rn "\[stub\]" src/lib/mail.ts src/app/api/admin || true
```

Expected :
- Si Plan 6 est mergee : **aucune sortie**. Si une ligne `[stub]` apparait → STOP, executer Plan 6.
- Si Plan 6 n'est pas encore mergee : les stubs Task 0.4 apparaissent dans `src/lib/mail.ts` (acceptable temporairement). Plan 6 les remplacera.

- [ ] **Step 22.4: Verifier qu'aucune route Plan 4 n'expose un secret**

```bash
grep -rn "smtpPassword\|recaptchaSecretKey\|editToken" "src/app/api/admin/[orgId]/events/[eventId]" || true
```

Expected : seules les references autorisees :
- `editToken` mis a jour DB dans approve/reject/resend/reset (jamais retourne en reponse sauf `reset-edit-token` ou c'est intentionnel + ADMIN-only)
- aucune occurrence de `smtpPassword` ou `recaptchaSecretKey` dans une `NextResponse.json(...)`

- [ ] **Step 22.5: Lister les routes/pages crees**

```bash
find "src/app/api/admin/[orgId]/events/[eventId]" -type f -name "route.ts" | sort
find "src/app/admin/[orgId]/events/[eventId]" -type f -name "page.tsx" | sort
```

Expected : 27 routes API + 14 pages (cf. File Structure en tete de plan ; la route `settings/test-smtp` a été retirée le 2026-05-31). Si un fichier manque → revenir a la tache concernee.

- [ ] **Step 22.6: Update `docs/v2/architecture.md`**

Append en fin de fichier :

```markdown
## État au lot C (post-Plan 4)

Plan 4 (espace événement) terminé. Disponible :

- Wrapper `withEventAuth` (scope-event, honore héritage OWNER → ADMIN, refuse archived/closed selon options)
- Layouts `EventShell` (sidebar complète ADMIN) + `EventOperatorShell` (Scanner + Profil)
- Dashboard event (KPI + dashboard OPERATOR restreint)
- API REST scope-event : 27 endpoints (registrations CRUD + approve/reject/print/all-access/checkin/duplicates/block, categories + import-templates, members invite, settings overrides contact uniquement, scan/verify, blocked-emails, blocked-documents, activity, export CSV)
- Pages refondues : 14 (dashboard, registrations list/detail/new, badges list/detail/print, categories, members, settings, blocked-*, activity, scan)
- Composants refondus v1 → v2 : RegistrationForm, RegistrationTable, RegistrationDetailPanel, CategoryForm, CategoryTable, QRScanner, BadgeDocumentV2, BadgeDocumentAnonymousV2, BadgeBatchExportV2, BadgePreviewV2, BadgeDownloadV2, BadgeWebPreviewV2
- Helpers : event-quota (PENDING+APPROVED), edit-token (32 bytes hex, TTL 48h), duplicates (email/document/name), registration-csv

Defense en profondeur :

- Middleware Plan 1 + `withEventAuth` route-level
- OPERATOR sidebar restreinte + chaque route ADMIN re-vérifie via `withEventAuth({ minRole: "ADMIN" })`
- Quota admin = bypass avec audit `quotaBypass=true` ; quota public = 429 (Plan 5)
- Tous `editToken` générés via `randomBytes(32).toString("hex")` + TTL 48h
- Aucun secret (`smtpPassword`, `recaptchaSecretKey`, `editToken`) dans les réponses API (sauf `reset-edit-token` ADMIN-only)

Reste à venir :

- Plan 5 (inscription publique `/e/[slug]`, `/verify/[id]`, `/edit-registration/[token]`)
- Plan 6 (templates email réels — actuellement stubs si non mergé)
- Plan 7 (déploiement initial v2 + suppression des routes v1 obsolètes)
```

- [ ] **Step 22.7: Commit doc**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): note d avancement post-Plan 4 (espace evenement)"
```

- [ ] **Step 22.8: Final git log review**

```bash
git log --oneline | head -40
```

Expected : succession de `feat(v2)` et `test(v2)` cohérents scopés Plan 4 (~22 commits depuis le debut du plan).

---

## Done

Plan 4 (espace événement ADMIN/OPERATOR) est complet. Toutes les routes `/admin/[orgId]/events/[eventId]/*` et leurs API sont en place, testées (helpers purs + intégration + smoke e2e ADMIN/OPERATOR), avec :

- Wrapper `withEventAuth` réutilisable (defense en profondeur, héritage OWNER → ADMIN)
- 27 endpoints API scope-event (registrations, badges, categories, members, settings overrides contact, blocked, scan, activity, export CSV ; SMTP plateforme uniquement)
- 14 pages refondues + composants v1 → v2 (BadgeDocument, RegistrationForm, QRScanner, CategoryForm, …)
- Cascade settings event (overrides cosmétiques uniquement)
- Quota inscriptions PENDING+APPROVED (REJECTED exclus) + bypass admin avec audit
- Catégories : suppression bloquée 409 + flow réaffectation, import templates org
- Scanner QR : extraction badgeId depuis URL ou texte brut, refus cross-event explicite
- Tous les `editToken` : `randomBytes(32).toString("hex")`, TTL 48h
- Tous les `logActivity` portent `{ orgId, eventId }` avec `staffActor` auto-calculé Plan 1

Plan 5 (inscription publique) peut maintenant s'appuyer sur les helpers `event-quota`, `edit-token`, `duplicates`, et la base d'inscriptions/categories scope-event.

