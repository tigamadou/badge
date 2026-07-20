# Reorganisation des tests E2E par page (tous espaces) — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Reorganiser toute la suite Playwright pour qu'il y ait **un fichier de specs par page**, chaque fichier couvrant **exhaustivement toutes les actions de sa page** (rendu, actions UI, gardes de role positives ET negatives, etats limites), a travers les quatre espaces `org`, `event`, `platform`, `public`. Creer les tests manquants, supprimer les tests obsoletes/redondants, et dissoudre les fichiers transversaux (`pages-render`, `rbac`, `interactions`) en repartissant leur contenu par page.

**Architecture:** L'unite d'organisation devient **la page** (un segment de route = un fichier `<page>.spec.ts`). Chaque fichier est **auto-suffisant** : il contient tout ce qui concerne sa page. Les fragments actuellement eparpilles (`pages-render.spec.ts` pour le rendu, `rbac.spec.ts` pour la matrice de roles, `interactions.spec.ts` pour les clics UI) sont **dissous** et redistribues dans les fichiers par page. Le residu strictement transverse (gates de layout : non-connecte -> login, mauvais espace -> redirection, ressource introuvable -> 404) va dans un `access.spec.ts` par espace. Les flux reellement transverses (deconnexion) restent dans `e2e/transverse/`.

**Tech Stack:** Playwright (chromium systeme en conteneur / mode UI hote), Prisma 6 + MySQL 8 (seed direct via `e2e/helpers/db.ts`), Mailpit (assertions email), helpers `e2e/helpers/{auth,db,audit,mailpit,pdf}.ts` + `e2e/fixtures/`.

## Global Constraints

- **Version cible : v4.** Doc dans `docs/v4/`.
- **Les tests ne modifient JAMAIS le code applicatif `src/`.** Si un test echoue a cause d'un bug applicatif reel (cf. bugs connus ci-dessous), on le marque `test.fixme(...)` avec un commentaire referencant le bug et **on s'arrete pour signaler a l'utilisateur** — on ne touche pas `src/` pour faire passer un test, et on ne masque pas le bug.
- **Langue** : intitules de tests et commentaires en francais (style ASCII des fichiers existants) ; identifiants en anglais. Les selecteurs `getByRole`/`getByLabel` dependent des libelles FR (locale `fr-FR`).
- **Pas de mock de Prisma ni des regles metier.** Seed via `db.ts` (vraie MySQL de dev), stack complete via `make dev`.
- **Reutiliser les helpers existants** avant d'en creer. En particulier `auth.ts` expose `loginAsOrgMember`, `loginAsEventMember`, `loginAsStaff` (sous-utilises aujourd'hui) — les preferer a `createTest* + loginAs` manuels.
- **Regle UI-first, API pour l'inatteignable** : toute action disposant d'une UI se teste **via l'interaction reelle** (clic/formulaire). Les codes d'erreur et gardes non declenchables par l'UI (403 par role, 409 garde-fou, 400 validation, 413/415 upload) et les endpoints **sans surface UI** se testent via `page.request.*` **dans le meme fichier de page**, section « Gardes & API » du `describe`.
- **Endpoints sans page** (blocklist plateforme, `duplicates`, PATCH org plateforme sans formulaire) : deja couverts par les tests d'integration Vitest — **ne pas** creer de spec e2e pour eux ; le noter explicitement (pas de couverture silencieusement supposee).
- **workers = 1** (config actuelle) : execution sequentielle, cleanup partage par suffixe email `@v2-11-e2e.test` + slug `e2e-`. Chaque fichier garde un `test.afterAll(cleanupE2ETestData + disconnectDb)`.
- **Nommage** : `e2e/<espace>/<page>.spec.ts` ; `describe` = nom lisible de la page ; un seul `describe` par fichier.
- **Baseline E2E** : la suite a des echecs pre-existants (env mail + races) — comparer a la baseline stashee pour distinguer une vraie regression d'un flake connu. `make test` (Vitest) **efface les donnees dev** ; re-seed (`make db-seed`) au besoin.
- **Avant tout commit** : `make lint && make typecheck && make test-e2e` (ou run cible). Commits FR ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur** — les etapes « Commit » ne s'executent que sur demande.
- **Conservation des plans** : ce plan est conserve (marquer la Progression, ne pas supprimer sans demande).

## Bug applicatif OUVERT (decouvert le 2026-07-20, a corriger cote src/)

> **Liste des inscriptions : colonnes Nom et E-mail vides.**
> `GET /api/org/[orgId]/events/[eventId]/registrations` renvoie `snapshotFirstName`,
> `snapshotLastName`, `snapshotEmail` (route.ts, select), mais
> `src/components/event/RegistrationTable.tsx` lit `r.firstName`, `r.lastName`,
> `r.email` -> `undefined`. L'utilisateur voit donc une liste sans identite.
> Le test `e2e/event/registrations.spec.ts` « La liste affiche le nom et l'e-mail »
> est en `test.fixme` en attendant le correctif (mapper le DTO cote route ou lire
> les champs `snapshot*` cote composant).

## Bugs applicatifs connus — CORRIGES (plan pre-requis termine le 2026-07-20)

> Le plan [`2026-07-20-01-v4-fixes-bugs-pre-e2e.md`](2026-07-20-01-v4-fixes-bugs-pre-e2e.md) a corrige les trois bugs ci-dessous. **Aucun `test.fixme`/`test.skip` de contournement ne subsiste** sur ces zones (18/18 e2e verts). Les tasks concernees de ce plan doivent en tenir compte :

1. **`/badge/[id]`** — page orpheline **supprimee** (sa route data `/api/verify/[id]` avait disparu au nettoyage v2 et aucun lien n'y menait ; le QR pointe vers `/verify/[badgeId]`). Le composant exclusif `BadgeDownload.tsx` a suivi. **-> Task 4.11 : ne couvrir que `/verify/[badgeId]`, il n'y a plus de flux public de telechargement.**
2. **Verify-email golden path** — le self-fetch SSR est remplace par le helper `consumeEmailVerifyToken()` appele directement (pattern `setup-password`). Les deux `test.fixme` de `e2e/public/auth-register.spec.ts` sont **actifs**. **-> Task 4.3 : plus de `fixme` a prevoir.**
3. **PRINTER sur `/badges`** — le parcours badges est garde par la permission `badge.print` (et non `minRole`), avec un **endpoint dedie `GET .../badges`** a DTO minimal. Un PRINTER pur obtient **200**. **-> Task 2.6 : la « discrepance » est levee ; tester la liste via le nouvel endpoint, et noter que le 403 renvoie desormais `EVENT_FORBIDDEN`.**

## Definition of coverage (DoD d'un fichier `<page>.spec.ts`)

Une page-spec est « complete » quand elle contient, pour sa page :
1. **Acces** : 1 test rendu golden (role autorise voit la page) + redirections d'acces (non-connecte -> login ; role/espace invalide -> redirection ou 403 ; ressource introuvable -> 404).
2. **Chaque action UI** listee dans la cartographie : 1 test par action (creation, edition, suppression, invitation, changement de role, filtre, recherche, tri, pagination, upload, toggle, modale de confirmation, impression/telechargement, scan…).
3. **Chaque garde de role** pertinente : au moins 1 negatif (role insuffisant -> 403/redirect) + le positif deja couvert par l'action.
4. **Chaque garde-fou metier** de la page (codes : `LAST_OWNER`, `SLUG_TAKEN`, `NUMBER_TAKEN`, `CATEGORY_HAS_REGISTRATIONS`, `EVENT_LIMIT`/`SUBSCRIPTION_INACTIVE`, `BAD_TYPE`/`TOO_LARGE`, `UNKNOWN_TEMPLATE`, `LAST_SUPER_ADMIN`, `EMAIL_TAKEN`, `NAME_TAKEN`, etc.).
5. **Etats** : vide, et le cas echeant erreurs reseau affichees.
6. `afterAll` de cleanup. Aucun `test.skip` non justifie par un bug connu reference.

---

## Progression

> Statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned. Dater + noter apres chaque task validee (run e2e vert de la page + DoD OK).

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 0 | Convention, helpers, `access.spec` gabarit + page de reference codee | [x] | 2026-07-20 | `e2e/README.md` (convention) ; 4 helpers de login confirmes ; `org/members.spec.ts` recode en gabarit (11/11 verts). |
| 1.1 | org/dashboard | [x] | 2026-07-20 | `e2e/org/dashboard.spec.ts` (lacune totale comblee) : KPI, acces AUDITOR, etat vide, banniere quota >80% vs sous seuil vs illimite, lien Tout voir. 7/7 verts. |
| 1.2 | org/events (liste + wizard) | [x] | 2026-07-20 | `e2e/org/events.spec.ts` : rendu liste + etat vide + tag archive (lacunes), wizard 3 etapes, lien creation, EVENT_LIMIT / abonnement inactif / SLUG_TAKEN / 400, AUDITOR page OK mais POST 403, archive+restore. 12/12 verts. |
| 1.3 | org/members | [x] | 2026-07-20 | Fait avec la Task 0 (page de reference). Fusionne rendu + 3 actions UI + etat protege + 6 gardes API. |
| 1.4 | org/templates | [x] | 2026-07-20 | `e2e/org/templates.spec.ts` : rendu, CRUD UI (modales + confirm), etat vide, MANAGER 201 / AUDITOR 403 / lecture 200, scoping 404. Commentaire contradictoire corrige. 9/9 verts. |
| 1.5 | org/subscription | [x] | 2026-07-20 | `e2e/org/subscription.spec.ts` : rendu (plan/statut/periode/limites), MANAGER OK, AUDITOR redirige, illimite, sans abonnement, echu. 6/6 verts. |
| 1.6 | org/settings (+ badge) | [x] | 2026-07-20 | `e2e/org/settings.spec.ts` : rendu (slug disabled), edition UI, upload logo UI (lacune comblee), selection template UI, reset heritage, UNKNOWN_TEMPLATE, SMTP 400, MANAGER voit la page mais PATCH 403, AUDITOR redirige. 12/12 verts. |
| 1.7 | org/activity (+ detail) | [x] | 2026-07-20 | `e2e/org/activity.spec.ts` : rendu, AUDITOR page+API, etat vide, tag staff, navigation detail, scoping 404 cross-org (lacunes comblees). 7/7 verts. |
| 1.8 | org/access + suppression transverses org | [x] | 2026-07-20 | `e2e/org/access.spec.ts` (gates layout, staff->platform, nav par role). Tests hors-perimetre relogues : /select -> `e2e/public/select.spec.ts`, profile/complete -> `account-profile.spec.ts`. pages-render/rbac/interactions org SUPPRIMES (30 tests -> 71 repartis sur 8 pages). 81 passed / 0 echec. |
| 2.1 | event/dashboard | [x] | 2026-07-20 | `e2e/event/dashboard.spec.ts` enrichi : 4 roles (shells distincts) + etat vide, banniere quota >80% vs sous seuil, lien Tout voir (lacunes comblees). 8/8 verts. |
| 2.2 | event/registrations (liste) | [x] | 2026-07-20 | `e2e/event/registrations.spec.ts` : rendu, etat vide, filtre statut, RECHERCHE et PAGINATION (lacunes comblees), navigation detail/creation, export CSV. **1 test.fixme** : BUG APPLICATIF decouvert — l'API renvoie snapshot* mais RegistrationTable lit firstName/lastName/email -> colonnes Nom et E-mail VIDES. 8/8 verts + 1 fixme. |
| 2.3 | event/registrations-new | [x] | 2026-07-20 | `e2e/event/registrations-new.spec.ts` : rendu, creation via formulaire, uploads photo et document UI (lacunes comblees), e-mail inconnu 404, OPERATOR 403. 6/6 verts. |
| 2.4 | event/registration-detail | [x] | 2026-07-20 | `e2e/event/registration-detail.spec.ts` : approuver, rejeter (modale+motif), ALL ACCESS, bloquer e-mail, bloquer document, supprimer, voir le badge — TOUTES via l'UI (all-access/suppression/blocages etaient API-only). + VIEWER 403 et rejet sans motif 400. 10/10 verts. |
| 2.5 | event/registrations-overview | [x] | 2026-07-20 | `e2e/event/registrations-overview.spec.ts` : acces VIEWER effectif, comptes agreges exacts (total = PENDING+APPROVED, rejets exclus), repartition par categorie, non-exposition PII, etat vide. Lacunes comblees. 6/6 verts. |
| 2.6 | event/badges (+ detail + print) | [x] | 2026-07-20 | `badges-print.spec.ts` renomme `badges.spec.ts` : PDF individuel, PRINTER pur 200 (endpoint dedie), marquage lot API + UI, cascade template, detail badge, apercu par lot, etat vide. 10/10 verts. |
| 2.7 | event/categories | [x] | 2026-07-20 | `e2e/event/categories.spec.ts` : CRUD API + garde-fous (NUMBER_TAKEN, CATEGORY_HAS_REGISTRATIONS) + creation/edition/suppression/import via UI (lacunes comblees) + etat vide. 11/11 verts. |
| 2.8 | event/members | [x] | 2026-07-20 | `e2e/event/members.spec.ts` : invitation (nouveau + existant), retrait, table, + changement de role via select inline (lacune comblee) et garde OPERATOR 403. 6/6 verts. |
| 2.9 | event/scan | [x] | 2026-07-20 | `scan-checkin.spec.ts` renomme `scan.spec.ts` : API verify/checkin + saisie manuelle UI (migree d'interactions) + gardes VIEWER/PRINTER 403 + acces ADMIN. Scan camera non automatisable (documente). 12/12 verts. |
| 2.10 | event/settings (+ badge) | [ ] | | |
| 2.11 | event/activity (+ detail) | [x] | 2026-07-20 | `e2e/event/activity.spec.ts` : feed ADMIN, filtre OPERATOR serveur, non-fuite PII, + rendus page/detail migres de pages-render et etat vide. 8/8 verts. |
| 2.12 | event/blocklist | [x] | 2026-07-20 | `e2e/event/blocklist.spec.ts` : deux onglets, redirection /blocked-documents, ajout+retrait e-mail et document via UI avec audit, garde OPERATOR 403. 5/5 verts. |
| 2.13 | event/access + suppression transverses event | [ ] | | |
| 3.1 | platform/dashboard | [ ] | | |
| 3.2 | platform/organizations-list | [ ] | | |
| 3.3 | platform/organization-new | [ ] | | |
| 3.4 | platform/organization-detail (danger UI) | [ ] | | |
| 3.5 | platform/organization-subscription | [ ] | | |
| 3.6 | platform/organization-members | [ ] | | |
| 3.7 | platform/organization-events + activity (supervision) | [ ] | | |
| 3.8 | platform/plans | [ ] | | |
| 3.9 | platform/users-list | [ ] | | |
| 3.10 | platform/user-new | [ ] | | |
| 3.11 | platform/user-detail | [ ] | | |
| 3.12 | platform/settings (+ badge) | [ ] | | |
| 3.13 | platform/activity (+ detail) | [ ] | | |
| 3.14 | platform/access + suppression transverses platform | [ ] | | |
| 4.1 | public/marketing (+ contact) | [ ] | | |
| 4.2 | public/login | [ ] | | |
| 4.3 | public/register (+ success + verify-email) | [ ] | | |
| 4.4 | public/forgot-password + reset-password | [ ] | | |
| 4.5 | public/setup-password | [ ] | | |
| 4.6 | public/select | [ ] | | |
| 4.7 | account/dashboard | [ ] | | |
| 4.8 | account/profile (+ complete) | [ ] | | |
| 4.9 | account/registration-detail (resubmit) | [ ] | | |
| 4.10 | public/event-register (+ success) | [ ] | | |
| 4.11 | public/badge-verify (+ download fixme) | [ ] | | |
| 4.12 | public/misc (styleguide) + security transverse | [ ] | | |
| 5 | Nettoyage final, verification globale, doc | [ ] | | |

---

## Task 0 : Convention, helpers, gabarit

**Files:**
- Create: `e2e/README.md` (convention de structure des specs)
- Modify: `e2e/helpers/auth.ts` si un helper de login manque (verifier d'abord)
- Reference: `e2e/org/members.spec.ts` (page de reference entierement recodee ci-dessous)

- [x] **Step 1 : Ecrire `e2e/README.md`** documentant la convention (repris de la section « Definition of coverage » + regle UI-first + nommage `<espace>/<page>.spec.ts` + dissolution `pages-render`/`rbac`/`interactions` + `access.spec.ts` par espace).

- [x] **Step 2 : Verifier les helpers de login.** Confirmer que `loginAsOrgMember({orgId, role, scope})`, `loginAsEventMember({orgId, eventId, role, scope})`, `loginAsStaff({role, scope})` existent (`e2e/helpers/auth.ts`). Si un helper de login par role manque pour un espace, l'ajouter en suivant le pattern existant. (Aucun code applicatif `src/` ne doit changer.)

- [x] **Step 3 : Recoder `e2e/org/members.spec.ts` comme PAGE DE REFERENCE.** Ce fichier sert de gabarit a toutes les autres pages. Il fusionne : l'invitation UI (`interactions.spec.ts:29`), le retrait UI (`interactions.spec.ts:72`), la garde dernier OWNER UI (`interactions.spec.ts:107`), les gardes API (`members.spec.ts` L19/66/102/135/154), le RBAC (`rbac.spec.ts` L25/93/153/168), le rendu (`pages-render.spec.ts:55`).

```ts
import { test, expect } from "@playwright/test";
import {
  createTestOrgWithOwner,
  createTestOrgMember,
  createTestUser,
  getDb,
  cleanupE2ETestData,
  disconnectDb,
} from "../helpers/db";
import { loginAs } from "../helpers/auth";
import { expectLastActivity } from "../helpers/audit";
import { mailpit } from "../helpers/mailpit";

// Page Membres — /org/[orgId]/members
// Nav : MANAGER+. Mutations : OWNER-only (POST/PATCH/DELETE members).
test.describe("Org — Membres", () => {
  test.afterAll(async () => {
    await cleanupE2ETestData();
    await disconnectDb();
  });

  // --- Acces & rendu ---
  test("OWNER voit la liste des membres (rendu)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-render" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByRole("heading", { name: /Membres/ })).toBeVisible();
    await expect(page.getByText(owner.email)).toBeVisible();
  });

  // --- Actions UI ---
  test("OWNER invite un nouveau membre (MANAGER) via le formulaire", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-invite" });
    await mailpit.clear();
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/members`);
    const email = `invitee-${Date.now()}@v2-11-e2e.test`;
    await page.getByLabel("Nom").fill("Invite Test");
    await page.getByLabel(/e-mail|email/i).fill(email);
    await page.getByLabel(/Role/i).selectOption("MANAGER");
    await page.getByRole("button", { name: /Inviter/ }).click();
    await expect(page.getByText(email)).toBeVisible();
    await expectLastActivity({ type: "MEMBERSHIP_ADDED", orgId });
    await mailpit.expectMail({ to: email, subjectPattern: /invitation|Badge/i });
  });

  test("OWNER retire un membre via le bouton Retirer", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-remove" });
    const member = await createTestOrgMember({ scope: "mem-removee", orgId, role: "MANAGER" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/members`);
    page.on("dialog", (d) => d.accept()); // confirm("Retirer ce membre ?")
    await page
      .getByRole("row", { name: new RegExp(member.email) })
      .getByRole("button", { name: /Retirer/ })
      .click();
    await expect(page.getByText(member.email)).toHaveCount(0);
    await expectLastActivity({ type: "MEMBERSHIP_REMOVED", orgId });
  });

  // --- Etats & garde-fous ---
  test("Dernier OWNER : pas de bouton Retirer (etat protege UI)", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-lastowner" });
    await loginAs(page, owner);
    await page.goto(`/org/${orgId}/members`);
    await expect(page.getByText(/Dernier OWNER/)).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(owner.email) }).getByRole("button", { name: /Retirer/ }),
    ).toHaveCount(0);
  });

  // --- Gardes & API (inatteignable par l'UI) ---
  test("DELETE dernier OWNER -> 409 LAST_OWNER", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-api-lastowner" });
    await loginAs(page, owner);
    const res = await page.request.delete(`/api/org/${orgId}/members/${owner.id}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("LAST_OWNER");
  });

  test("PATCH retrograde dernier OWNER -> 409 LAST_OWNER", async ({ page }) => {
    const { orgId, owner } = await createTestOrgWithOwner({ scope: "mem-api-demote" });
    await loginAs(page, owner);
    const res = await page.request.patch(`/api/org/${orgId}/members/${owner.id}`, {
      data: { role: "MANAGER" },
    });
    expect(res.status()).toBe(409);
  });

  test("MANAGER POST /members -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-rbac" });
    const manager = await createTestOrgMember({ scope: "mem-rbac-mgr", orgId, role: "MANAGER" });
    await loginAs(page, manager);
    const res = await page.request.post(`/api/org/${orgId}/members`, {
      data: { name: "X", email: `x-${Date.now()}@v2-11-e2e.test`, role: "AUDITOR" },
    });
    expect(res.status()).toBe(403);
  });

  test("AUDITOR POST /members -> 403", async ({ page }) => {
    const { orgId } = await createTestOrgWithOwner({ scope: "mem-rbac2" });
    const auditor = await createTestOrgMember({ scope: "mem-rbac-aud", orgId, role: "AUDITOR" });
    await loginAs(page, auditor);
    const res = await page.request.post(`/api/org/${orgId}/members`, {
      data: { name: "X", email: `y-${Date.now()}@v2-11-e2e.test`, role: "AUDITOR" },
    });
    expect(res.status()).toBe(403);
  });
});
```

- [x] **Step 4 : Lancer la page de reference.**
Run (conteneur) : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/org/members.spec.ts`
Expected : tous verts. Ajuster les libelles FR reels (`getByLabel`, boutons) si un selecteur ne matche pas — SANS toucher `src/`.

- [x] **Step 5 : Commit** (si demande) : `test(v4): page de reference org/members + convention e2e par page`.

> **Toutes les tasks suivantes appliquent EXACTEMENT ce gabarit** : un `describe` par page, sections Acces / Actions UI / Etats / Gardes & API, cleanup `afterAll`, helpers de login par role, assertions d'audit et mail quand pertinent. Pour chaque page : (a) creer/renommer le fichier cible, (b) migrer les tests existants cites, (c) creer les tests des lacunes citees, (d) supprimer les doublons cites, (e) run vert, (f) commit si demande.

---

## Phase 1 — Espace ORG (`e2e/org/`)

Etat actuel : `events.spec.ts`, `members.spec.ts`, `settings.spec.ts`, `templates.spec.ts`, `pages-render.spec.ts`, `rbac.spec.ts`, `interactions.spec.ts` (7 fichiers, 50 tests). Cible : 8 fichiers par page + `access.spec.ts`.

### Task 1.1 — `e2e/org/dashboard.spec.ts` (NOUVEAU)
Page `/org/[orgId]` (AUDITOR+, lecture seule).
- **Couvrir** : rendu golden (StatCards evenements/archives/inscriptions/quota) ; banniere quota `Alert` **affichee si eventsPct > 80** vs **absente sinon** (seeder assez d'events via `createTestOrgWithOwner({maxEvents})` + creation d'events) ; etat vide events (`EmptyState`) + etat vide activite ; lien « Tout voir » -> `/org/[orgId]/events` ; ligne event -> `/event/[id]`.
- **Migrer** : rien (aucun test dashboard aujourd'hui).
- **Creer** : 4-5 tests ci-dessus (lacune totale).
- **Supprimer** : rien.

### Task 1.2 — `e2e/org/events.spec.ts` (COMPLETER)
Pages `/org/[orgId]/events` (liste) + `/events/new` (wizard). AUDITOR voit ; POST = MANAGER.
- **Couvrir** : rendu liste + etat vide + badges statut (archive/ouvert/ferme) ; lien « Creer un evenement » ; lien « Configurer » -> `/event/[id]/settings` ; **wizard 3 etapes UI** (titre/date/lieu/slug auto ; mode template vs manuel ; recap ; submit -> `/event/[id]/settings`) ; garde-fous : `EVENT_LIMIT` (409), `SLUG_TAKEN` (409), `SUBSCRIPTION_INACTIVE`, validation 400 ; bypass staff (`QUOTA_BYPASS` loggue) ; **AUDITOR atteint `/events/new` mais POST -> 403**.
- **Migrer** : `events.spec.ts` L18 (wizard UI), L173 (`EVENT_LIMIT`), L213 (`SLUG_TAKEN`). L98/L136 (archive/restore) **NE concernent PAS cette page** : ce sont des actions de la fiche org plateforme -> deplacer vers Task 3.4 (ou les garder en API ici si elles s'executent depuis la liste org — verifier ; sinon deplacer).
- **Creer** : rendu liste + etat vide ; lien Configurer ; validation 400 ; AUDITOR POST 403 (depuis `rbac.spec.ts:59`).
- **Supprimer** : doublons de rendu de `pages-render` le cas echeant.

### Task 1.3 — `e2e/org/members.spec.ts` (REFERENCE, Task 0)
Deja traitee en Task 0. Verifier DoD complet.

### Task 1.4 — `e2e/org/templates.spec.ts` (COMPLETER)
Page `/org/[orgId]/templates` (MANAGER+).
- **Couvrir** : rendu tableau + etat vide (`EmptyState`) ; **creation via modale UI** (nom/couleur/numero/switch neutre/anonyme) ; **edition via modale UI** ; **suppression via bouton + confirm** ; MANAGER autorise (201) ; **AUDITOR POST -> 403**.
- **Migrer** : `interactions.spec.ts` L193 (creation UI), L232 (edition UI), L270 (suppression UI), L305 (etat vide) ; `templates.spec.ts` L115 (rendu tableau) ; `rbac.spec.ts` L78 (AUDITOR POST 403).
- **Creer** : rien de neuf (bonne couverture existante) — consolider.
- **Supprimer** : `templates.spec.ts` L19/L42/L59/L88 (CRUD **API pur**) : garder uniquement 1 test API par garde utile (le 403 AUDITOR) ; le CRUD nominal est deja couvert par l'UI -> retirer les doublons API. **Corriger le commentaire contradictoire** `templates.spec.ts:38-42` (dit OWNER-only alors que MANAGER=201).

### Task 1.5 — `e2e/org/subscription.spec.ts` (NOUVEAU)
Page `/org/[orgId]/subscription` (MANAGER+, **lecture seule**, garde dans la page).
- **Couvrir** : rendu (plan, statut, dates, actif oui/non, limites effectives « Illimite » si null) ; `Alert` warn si `!active` ; « Aucun abonnement » si absent ; **AUDITOR -> redirect `/org/[orgId]`** (garde MANAGER dans la page) ; MANAGER et OWNER voient.
- **Migrer** : `pages-render.spec.ts:84` (rendu).
- **Creer** : cas inactif (Alert), cas sans abonnement, AUDITOR redirige.
- **Supprimer** : rien.

### Task 1.6 — `e2e/org/settings.spec.ts` (COMPLETER, inclut settings/badge)
Pages `/org/[orgId]/settings` (formulaire ; **page sans garde**, PATCH OWNER-only) + `/settings/badge` (MANAGER, garde dans la page).
- **Couvrir (settings)** : **edition infos org UI** (PATCH OWNER) ; **upload logo UI** (`Dropzone`) + bouton Retirer ; slug disabled (staff-only) ; Annuler = reset local ; garde-fous : `SLUG_TAKEN` (409), `NOTHING_TO_UPDATE` (400), **payload SMTP rejete (400)**, upload `BAD_TYPE` (415) / `TOO_LARGE` (413) / `NO_FILE` (400) ; **MANAGER PATCH -> 403** (page visible mais mutation refusee) ; **AUDITOR atteint la page mais PATCH 403**.
- **Couvrir (settings/badge)** : **selection template UI** (PATCH) ; **« Utiliser le defaut herite »** (null) ; `UNKNOWN_TEMPLATE` (400) ; MANAGER autorise (200) ; **AUDITOR -> redirect** (garde MANAGER).
- **Migrer** : `settings.spec.ts` L18 (edit infos), L53/L81 (badge select/reset), L102 (SMTP 400), L116 (MANAGER 403) ; `interactions.spec.ts` L123 (edit UI), L157 (badge UI) ; `rbac.spec.ts` L44/L112/L136 (PATCH org 403, MANAGER badge 200, AUDITOR badge 403) ; `pages-render.spec.ts` L64/L75 (rendus).
- **Creer** : upload logo UI + erreurs upload (413/415/400) ; AUDITOR sur `/settings` (page visible, PATCH 403).
- **Supprimer** : doublons de rendu.

### Task 1.7 — `e2e/org/activity.spec.ts` (NOUVEAU, inclut detail)
Pages `/org/[orgId]/activity` (AUDITOR+) + `/activity/[logId]`.
- **Couvrir** : rendu liste + etat vide ; tag « staff » si `staffActor` ; lien « Voir le detail » -> detail ; rendu detail ; **scoping cross-org -> 404** (log d'une autre org). API `GET /api/org/[orgId]/activity` accessible AUDITOR (200).
- **Migrer** : `pages-render.spec.ts` L22/L33 (rendus liste+detail) ; `rbac.spec.ts` L223 (AUDITOR GET activity 200). **Corriger le commentaire perime** `rbac.spec.ts:215-222`.
- **Creer** : etat vide, scoping 404 cross-org.
- **Supprimer** : rien.

### Task 1.8 — `e2e/org/access.spec.ts` (NOUVEAU) + suppression des transverses org
- **Couvrir (access)** : non-connecte sur `/org/[orgId]` -> `/login?callbackUrl=…` ; org introuvable -> `notFound` (404) ; **staff non-membre -> redirect `/platform/organizations/[orgId]`** ; membre d'une autre org -> `/select`. Elements de shell : `OrgSelector`, `LogoutButton` presents.
- **Migrer** : `rbac.spec.ts:239` (staff sans membership -> banniere + `staffActor=true`) — corriger le commentaire perime L14 (parle de `/select`, le corps redirige `/platform`).
- **Deplacer hors org** : `pages-render.spec.ts` L93 (`/select` multi-orgs) -> Task 4.6 ; L116 (`/account/profile/complete`) -> Task 4.8. **Ne pas les supprimer**, les reloger.
- **Supprimer les fichiers dissous** : `e2e/org/pages-render.spec.ts`, `e2e/org/rbac.spec.ts`, `e2e/org/interactions.spec.ts` (leur contenu a ete redistribue en 1.1-1.8). Verifier via `git grep` qu'aucun intitule unique n'a ete perdu avant suppression.

---

## Phase 2 — Espace EVENT (`e2e/event/`)

Etat actuel : 14 fichiers, 96 tests, dont `interactions.spec.ts` (fourre-tout 12 tests multi-pages), `pages-render.spec.ts` (11 rendus), `rbac.spec.ts` (18, API). Nav par role via shells distincts (ADMIN complet, OPERATOR=scan, PRINTER=badges, VIEWER=overview).

### Task 2.1 — `e2e/event/dashboard.spec.ts` (COMPLETER)
`/event/[eventId]` (tous roles ; branche OPERATOR « Mes scans »).
- **Couvrir** : KPI ADMIN ; branche OPERATOR (lien scanner) ; `Alert` quota > 80% ; etat vide ; liens (scanner, tout voir, ligne inscription).
- **Migrer** : `dashboard.spec.ts` (4 tests par role) ; parts de `pages-render`.
- **Creer** : banniere quota, etat vide si absents.

### Task 2.2 — `e2e/event/registrations.spec.ts` (liste)
`/event/[eventId]/registrations` (ADMIN).
- **Couvrir** : rendu + etat vide ; **recherche** (nom/email/document) ; **filtre statut** ; **Actualiser** ; **Export CSV** ; **pagination** (25/page) ; lien ligne -> detail ; « Nouvelle inscription ».
- **Migrer** : fragments de `interactions.spec.ts` (reg-list) + `registrations-admin.spec.ts` (export en API).
- **Creer** : **recherche UI**, **pagination UI** (lacunes).

### Task 2.3 — `e2e/event/registrations-new.spec.ts`
`/event/[eventId]/registrations/new` (ADMIN).
- **Couvrir** : formulaire creation (APPROVED par defaut) ; **upload photo/document UI** (`POST …/upload`) + erreurs `BAD_TYPE`/`TOO_LARGE` ; submit -> detail.
- **Migrer** : `interactions.spec.ts` (new-reg) ; `registrations-admin.spec.ts` (create API).
- **Creer** : **upload UI** (lacune).

### Task 2.4 — `e2e/event/registration-detail.spec.ts`
`/event/[eventId]/registrations/[regId]` (ADMIN ; PRINTER/VIEWER 403).
- **Couvrir** : **Approuver**, **Rejeter/Bloquer (modale motif)**, **Imprimer**, **All-access toggle**, **Bloquer email**, **Bloquer document**, **Supprimer (danger)** — tous **via UI** ; liens fichiers ; bandeau motif rejet ; tag ALL ACCESS ; mail + audit sur approve/reject.
- **Migrer** : `interactions.spec.ts` (approve/reject UI) ; `registrations-lifecycle.spec.ts` (approve/reject API + mail + audit + PDF) ; `registrations-admin.spec.ts` (block/all-access/delete API).
- **Creer** : **all-access via bouton UI**, **supprimer via bouton UI**, block email/document **via UI** (lacunes — actuellement API-only).
- **Note API-only** : `duplicates` reste couvert par Vitest (pas de spec e2e). `checkin` par regId est teste via la page scan (2.9).

### Task 2.5 — `e2e/event/registrations-overview.spec.ts`
`/event/[eventId]/registrations/overview` (VIEWER+).
- **Couvrir** : comptes agreges par statut (PENDING+APPROVED) + repartition par categorie ; etat vide ; **acces VIEWER effectif** (nav Viewer -> overview) ; ADMIN voit aussi.
- **Migrer** : rendu de `pages-render`.
- **Creer** : assertions de comptes agreges + acces VIEWER (lacunes).

### Task 2.6 — `e2e/event/badges.spec.ts` (liste + detail + print)
`/badges`, `/badges/[badgeId]`, `/badges/print` (PRINTER/ADMIN).
- **Couvrir** : rendu liste + filtre imprimes/non ; **selection + « Marquer imprimes » UI** ; **impression par lot** (ouverture `/badges/print?ids=`) ; **telechargement PDF** du detail (`BadgeDownloadV2`, QR serveur) ; apercu lot (pas de bouton, cf. note) ; cas categorie anonyme/neutre/all-access.
- **Migrer** : `badges-print.spec.ts` (6, API + cascade PDF) ; `interactions.spec.ts` (mark-printed UI) ; rendus de `pages-render`.
- **Creer** : **telechargement PDF detail** (via `expectPdfResponse`), lacune.
- **PRINTER (discrepance levee)** : la liste passe par l'**endpoint dedie** `GET .../badges` (DTO minimal : id, prenom, nom, `badgePrinted`, `allAccessGranted`, categorie — **pas d'email ni de structure**), garde par la permission `badge.print`. Un **PRINTER pur obtient 200** sur la liste et sur le PDF. Couvrir le negatif avec un **VIEWER -> 403 `EVENT_FORBIDDEN`** (code standard `withEventAuth`).

### Task 2.7 — `e2e/event/categories.spec.ts`
`/event/[eventId]/categories` (ADMIN).
- **Couvrir** : **Ajouter (modale)**, **Modifier (modale)**, **Supprimer + confirm** ; **Importer un modele (modale)** depuis les templates org ; **Reaffecter (`CategoryReassignModal`)** quand la categorie a des inscriptions ; garde-fous `NUMBER_TAKEN` (409), `CATEGORY_HAS_REGISTRATIONS` (409).
- **Migrer** : `categories.spec.ts` (6, API CRUD + import + collisions) ; fragments `interactions.spec.ts`.
- **Creer** : **edition UI**, **import modele UI**, **reassignation UI** (lacunes).

### Task 2.8 — `e2e/event/members.spec.ts`
`/event/[eventId]/members` (ADMIN).
- **Couvrir** : **Inviter** (roles ADMIN/OPERATOR/PRINTER/VIEWER) UI ; **Changer role (select) UI** ; **Retirer** UI ; table.
- **Migrer** : `members.spec.ts` (4, invite/remove/table).
- **Creer** : **changement de role via select UI** (lacune).

### Task 2.9 — `e2e/event/scan.spec.ts`
`/event/[eventId]/scan` (OPERATOR + ADMIN ; PRINTER/VIEWER 403).
- **Couvrir** : **saisie manuelle** -> `POST …/scan/verify` (« Acces autorise » / « Acces refuse ») ; check-in par regId ; RBAC (VIEWER/PRINTER 403). Scan camera (Html5Qrcode) : **non automatisable** -> le noter (pas de test camera).
- **Migrer** : `scan-checkin.spec.ts` (7, API) ; `interactions.spec.ts` (scan manuel UI).
- **Creer** : consolider ; documenter la limite camera.

### Task 2.10 — `e2e/event/settings.spec.ts` (+ badge)
`/settings` + `/settings/badge` (ADMIN ; badge garde permission).
- **Couvrir (settings)** : **upload logo UI** ; **enregistrer infos** (titre/lieu/date/slug/registrationOpen) ; **enregistrer contact** (override cascade) ; rejet payload SMTP (400).
- **Couvrir (badge)** : selection template / retour heritage (cascade Event>Org>Platform).
- **Migrer** : `settings.spec.ts` (5, API) ; `badge-template-selection.spec.ts` (1, UI).
- **Creer** : **upload logo UI** (lacune).

### Task 2.11 — `e2e/event/activity.spec.ts` (+ detail)
`/activity` (STAFF/ADMIN/OPERATOR ; OPERATOR filtre a ses `BADGE_SCANNED`) + `/activity/[logId]`.
- **Couvrir** : feed ADMIN ; **acces OPERATOR filtre** (via nav Operator) ; non-fuite PII ; rendu detail + scoping.
- **Migrer** : `activity.spec.ts` (5, API).
- **Creer** : acces OPERATOR via UI ; detail scoping.

### Task 2.12 — `e2e/event/blocklist.spec.ts`
`/blocked-emails` (onglets email+document ; `/blocked-documents` redirige). ADMIN.
- **Couvrir** : **Ajouter/Retirer email** UI ; **Ajouter/Retirer document** UI ; redirection `/blocked-documents` -> `/blocked-emails`.
- **Migrer** : blocklist parts de `interactions.spec.ts` / `registrations-admin.spec.ts`.
- **Creer** : actions UI ajout/retrait (si API-only actuellement).

### Task 2.13 — `e2e/event/access.spec.ts` + suppression transverses event
- **Couvrir** : non-connecte -> login ; event introuvable -> 404 ; role event insuffisant -> shell reduit (OPERATOR ne voit que scanner, PRINTER que badges, VIEWER que overview) ; heritage org->event (org OWNER = event ADMIN effectif).
- **Migrer** : `rbac.spec.ts` (18) — repartir les negatifs par page (dans 2.2-2.12) et garder ici les gates de layout + heritage. `archive.spec.ts` (5) concerne l'action archive/restore **depuis l'org** -> deplacer vers Task 1.2 ou 3.4 (fiche org).
- **Supprimer** : `e2e/event/pages-render.spec.ts`, `e2e/event/rbac.spec.ts`, `e2e/event/interactions.spec.ts` apres redistribution. **Corriger** le `test.skip` `registrations-lifecycle.spec.ts:209` (comportement volontairement absent -> retirer le test mort plutot que le laisser skip).

---

## Phase 3 — Espace PLATFORM (`e2e/platform/`)

Etat actuel : 7 fichiers, 48 tests (`activity`, `interactions`, `orgs`, `pages-render`, `rbac`, `settings`, `users`). Roles `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`.

### Task 3.1 — `e2e/platform/dashboard.spec.ts` (NOUVEAU)
`/platform` (OBSERVER+, read-only). **Lacune totale.**
- **Couvrir** : StatCards ; etats vides (topOrgs, recentActivity) ; liens « Tout voir » -> organizations/activity.

### Task 3.2 — `e2e/platform/organizations-list.spec.ts` (NOUVEAU)
`/platform/organizations` (OBSERVER+). **Lacune.**
- **Couvrir** : **recherche `q`**, **checkbox archivees**, **bouton Filtrer** ; table + etat vide ; lien « Creer une organisation ».

### Task 3.3 — `e2e/platform/organization-new.spec.ts`
`/platform/organizations/new` (STAFF_ADMIN).
- **Couvrir** : creation UI (name/slug auto/ownerEmail/ownerName) -> redirect fiche ; auto-increment slug sur collision ; **OBSERVER : bouton present mais POST 403**.
- **Migrer** : `orgs.spec.ts` L1 (creation UI), L5 (slug collision) ; `rbac.spec.ts` (OBSERVER `/organizations/new` bouton + POST 403).

### Task 3.4 — `e2e/platform/organization-detail.spec.ts` (NOUVEAU, danger UI)
`/platform/organizations/[orgId]` (OBSERVER+ ; delete SUPER_ADMIN). **Lacune UI critique.**
- **Couvrir** : rendu fiche (StatCards, OWNERs, events, tag archivee, 404) ; **Archiver UI** (bouton) ; **Restaurer UI** ; **Supprimer definitivement UI** (modale, saisie slug exact + header `x-confirm`) reservee SUPER_ADMIN ; gardes : STAFF_ADMIN archive/restore (200), **ADMIN DELETE hard -> 403**, `SLUG_TAKEN` (PATCH, si expose). Recevoir ici l'archive/restore migre depuis `event/archive.spec.ts` et `org/events` si applicable.
- **Migrer** : `orgs.spec.ts` L3 (archive/restore, actuellement `page.request`) -> **refaire en UI** ; L4 (hard delete, `page.request` + header) -> **refaire via la modale UI** ; `rbac.spec.ts` (ADMIN DELETE 403).
- **Creer** : parcours UI archiver/restaurer/supprimer (lacunes majeures — aujourd'hui l'UI n'est jamais exercee).
- **Note** : PATCH org (name/contact/slug) n'a **pas** de formulaire UI -> reste couvert par Vitest (noter, pas de spec e2e).

### Task 3.5 — `e2e/platform/organization-subscription.spec.ts`
`/platform/organizations/[orgId]/subscription` (STAFF_ADMIN).
- **Couvrir** : assignation plan via `SubscriptionForm` UI ; feedback ; 404 org absente. **(Voir aussi le plan abonnements 2026-07-20 : si la periodicite est livree, le champ periode remplace startDate/endDate — aligner les selecteurs.)**
- **Migrer** : `interactions.spec.ts` #9 (reassign UI) ; rendu de `pages-render` #5.

### Task 3.6 — `e2e/platform/organization-members.spec.ts` (NOUVEAU)
`/platform/organizations/[orgId]/members` (STAFF_ADMIN). **Lacune : invitation jamais exercee.**
- **Couvrir** : **Inviter** (OWNER/MANAGER/AUDITOR) via `PlatformOrgMemberInviteForm` UI -> POST `/owners` ; table read-only. Gardes API : DELETE `/owners/[userId]` (**NOT_OWNER** 409, **LAST_OWNER** 409) — pas d'UI, tester en API dans ce fichier.
- **Migrer** : rendu `pages-render` (« Membres (1) »).
- **Creer** : invitation UI + gardes retrait API (lacunes).

### Task 3.7 — `e2e/platform/organization-supervision.spec.ts`
Onglets **read-only** `/[orgId]/events` + `/[orgId]/activity`.
- **Couvrir** : rendu events supervision + etat vide ; rendu journal org (50 dernieres, `orgId`) + etat vide. Aucune action.
- **Migrer** : `pages-render` (events, activity org).

### Task 3.8 — `e2e/platform/plans.spec.ts`
`/platform/plans` (STAFF_ADMIN).
- **Couvrir** : **Creer un plan** UI (name/maxEvents/maxParticipants) ; **Archiver/Restaurer** toggle UI ; `NAME_TAKEN` (409) ; etat vide.
- **Migrer** : `interactions.spec.ts` #6 (create + archive/restore) ; rendu `pages-render`.
- **Creer** : `NAME_TAKEN` si absent.

### Task 3.9 — `e2e/platform/users-list.spec.ts` (NOUVEAU)
`/platform/users` (OBSERVER+ pour voir ; filtres). **Lacune partielle.**
- **Couvrir** : **recherche `q`**, **select type staff/client**, **checkbox archives**, **Filtrer** ; table + etat vide ; lien « Creer un utilisateur ».
- **Migrer** : `interactions.spec.ts` #5 (filtre q + etat vide).
- **Creer** : filtres type + archives (lacunes).

### Task 3.10 — `e2e/platform/user-new.spec.ts`
`/platform/users/new`.
- **Couvrir** : creation client (AUDITOR) UI ; creation staff STAFF_SUPPORT (radio + select) UI ; options top-role conditionnelles ; gardes : `EMAIL_TAKEN` (409), **SUPPORT cree staff -> 403 STAFF_ADMIN_REQUIRED**, **ADMIN cree top staff -> 403 SUPER_ADMIN_REQUIRED**.
- **Migrer** : `interactions.spec.ts` #1/#2 (create client/staff UI) ; `users.spec.ts` (create client/staff API) ; `rbac.spec.ts` (STAFF_ADMIN_REQUIRED, SUPER_ADMIN_REQUIRED).
- **Supprimer** : doublons API de `users.spec.ts` deja couverts en UI (garder les gardes 403/409 en API).

### Task 3.11 — `e2e/platform/user-detail.spec.ts`
`/platform/users/[userId]`.
- **Couvrir** : **Renvoyer lien mot de passe** UI (STAFF_SUPPORT) ; **Changer le role (select + bouton) UI** (options top-role conditionnelles) ; **Archiver** UI ; masquage si `isSelf` ; gardes : **dernier SUPER_ADMIN non archivable/non retrogradable** (409), **changer son propre role -> 403**, 404.
- **Migrer** : `interactions.spec.ts` #3/#4 (reset/archive UI) ; `users.spec.ts` (last super admin, self-role, promote API) ; rendu `pages-render`.
- **Creer** : **changement de role via UI** (lacune : seul l'API est couvert).

### Task 3.12 — `e2e/platform/settings.spec.ts` (+ badge)
`/platform/settings` (STAFF_ADMIN ; secrets SUPER_ADMIN) + `/settings/badge` (STAFF_ADMIN).
- **Couvrir (settings)** : modif SMTP non-secret (audit `changedFields`, jamais les secrets) ; SUPER_ADMIN modifie `smtpPassword` (audit `smtpPasswordChanged`, valeur non auditee) ; **ADMIN modifie secret -> 403 FORBIDDEN_SECRET_CHANGE** ; **Test SMTP** (`test-smtp`) ; secrets jamais renvoyes par GET ; **champs reCAPTCHA** (enabled/siteKey/secret), **toggle smtpSecure**, **toggle showSecrets**.
- **Couvrir (badge)** : selection template (`UNKNOWN_TEMPLATE` 400, `INVALID_BODY` 400) ; `< STAFF_ADMIN -> redirect`.
- **Migrer** : `settings.spec.ts` (5) ; `interactions.spec.ts` #7/#8 (smtpUser UI, badge UI).
- **Creer** : reCAPTCHA, toggles smtpSecure/showSecrets (lacunes).
- **Supprimer** : doublon badge entre `settings.spec.ts` #5 et `interactions.spec.ts` #8 (garder 1 UI + 1 garde API).

### Task 3.13 — `e2e/platform/activity.spec.ts` (+ detail)
`/platform/activity` (global) + `/activity/[logId]`.
- **Couvrir** : rendu + **filtres** (type, staffActor, from, to, orgId, userId) ; **pagination** (50/page) ; `INVALID_TYPE` (400) ; rendu detail (ip/ua/details) + 404.
- **Migrer** : `activity.spec.ts` (5) ; rendu detail de `pages-render`.
- **Creer** : filtres avances from/to/orgId/userId (lacunes ; seuls type + staffActor couverts).

### Task 3.14 — `e2e/platform/access.spec.ts` + suppression transverses platform
- **Couvrir** : non-staff sur `/platform` -> `/` (page) / 403 (API) ; non-connecte -> login ; `PlatformOrgShell` supervision (STAFF_OBSERVER) rendu. Matrice RBAC residuelle non rattachee a une page.
- **Migrer** : `rbac.spec.ts` (9) reparti ; garder ici les gates de layout + « tout staff GET activity 200 ».
- **Supprimer** : `e2e/platform/pages-render.spec.ts`, `e2e/platform/rbac.spec.ts`, `e2e/platform/interactions.spec.ts`, et `orgs.spec.ts`/`users.spec.ts` une fois leur contenu migre (garder uniquement ce qui devient des gardes API dans les fichiers par page). **Blocklist plateforme** : aucune page UI -> **pas de spec e2e**, reste couverte par Vitest (le noter).

---

## Phase 4 — Espace PUBLIC / COMPTE / TRANSVERSE (`e2e/public/`, `e2e/transverse/`)

Etat actuel : 10 fichiers public (54 tests) + 1 transverse (2 tests). Decoupage mixte (par page et par action) a normaliser en 1 fichier/page.

### Task 4.1 — `e2e/public/marketing.spec.ts` (COMPLETER, + contact)
Pages `(marketing)` : `/`, `/a-propos`, `/fonctionnalites`, `/tarifs`, `/contact`, `/cgu`, `/confidentialite`, `/mentions-legales`.
- **Couvrir** : test parametre rendu (titre + lien « Se connecter ») ; **soumission `ContactForm`** -> POST `/api/contact` (succes + validation).
- **Migrer** : `marketing.spec.ts` (parametré 8 chemins).
- **Creer** : **submit ContactForm** (lacune).

### Task 4.2 — `e2e/public/login.spec.ts` (NOUVEAU)
`/login`. **Lacune : formulaire jamais teste directement.**
- **Couvrir** : login succes -> redirect `/select` ; identifiants invalides -> erreur FR ; compte non verifie refuse ; compte bloque refuse.

### Task 4.3 — `e2e/public/register.spec.ts` (COMPLETER, + success + verify-email)
`/register`, `/register/success`, `/verify-email/[token]`.
- **Couvrir** : register -> message « verifiez votre email » ; email deja pris -> erreur FR ; rate-limit 429 ; rendu `/register/success` ; verify-email token expire -> vue invalide ; **golden path verify-email actif** (le self-fetch SSR a ete corrige — plus aucun `fixme`) ; **token consomme deux fois -> reste un succes** (idempotence `already-verified`).
- **Migrer** : `auth-register.spec.ts` (7 + 2 fixme) ; `misc-render.spec.ts` (register/success).
- **Supprimer** : doublon rate-limit register (garder 1, retirer celui de `security.spec.ts:111`).

### Task 4.4 — `e2e/public/password-reset.spec.ts` (renomme)
`/forgot-password` + `/reset-password/[token]`.
- **Couvrir** : golden path forgot->mail->reset->login ; anti-enumeration (unknown 200, unverified 200) ; token expire (FR) ; **token invalide/absent** ; rate-limit 429.
- **Migrer** : `auth-password-reset.spec.ts` (5).
- **Creer** : token invalide/absent (lacune ; seul « expired » couvert).

### Task 4.5 — `e2e/public/setup-password.spec.ts` (garder)
`/setup-password?token=`.
- **Couvrir** : golden path token valide ; token invalide ; token expire ; utilisateur archive refuse.
- **Migrer** : `auth-setup-password.spec.ts` (4). Deja complet — nettoyer les mentions « v2 » perimees.

### Task 4.6 — `e2e/public/select.spec.ts` (NOUVEAU)
`/select`. **Lacune.**
- **Couvrir** : membre de 2 orgs voit la liste ; redirection auto si une seule cible ; liste `/platform` si staff.
- **Migrer** : `org/pages-render.spec.ts:93` (multi-orgs) deplace ici.

### Task 4.7 — `e2e/public/account.spec.ts` (NOUVEAU)
`/account` (dashboard compte). **Lacune : liste inscriptions non testee.**
- **Couvrir** : rendu liste des inscriptions (liens detail) ; lien profil complete ; etat vide ; XSS `user.name` echappe.
- **Migrer** : `security.spec.ts` (XSS `/account`).
- **Creer** : rendu liste + etat vide.

### Task 4.8 — `e2e/public/account-profile.spec.ts` (garder, + complete)
`/account/profile` + `/account/profile/complete`.
- **Couvrir** : edition champs persistee ; **upload photo** (persist + service `/api/files`) ; **upload document PDF** ; **> 5 Mo refuse** ; **mauvais mime refuse** ; `participantProfileCompletedAt` positionne ; parcours `/complete`.
- **Migrer** : `account-profile.spec.ts` (8, dont 1 skip a retirer : L150 `BlockedDocument out of scope`, test vide).
- **Deplacer ici** : `org/pages-render.spec.ts:116` (`/account/profile/complete`).

### Task 4.9 — `e2e/public/account-registration.spec.ts` (renomme)
`/account/registrations/[id]`.
- **Couvrir** : resubmit d'une inscription rejetee ; mail « Inscription resoumise » ; edition profil met a jour le snapshot ; resubmit sur PENDING -> 409 INVALID_STATE ; audit REGISTRATION_RESUBMITTED ; 403 autre user ; 404.
- **Migrer** : `registration-resubmit.spec.ts` (5).
- **Creer** : 403 autre user, 404 (lacunes).

### Task 4.10 — `e2e/public/event-register.spec.ts` (garder, + success)
`/e/[slug]`, `/e/[slug]/register`, `/e/[slug]/success`.
- **Couvrir** : CTA login/register si non loggue ; inscription profil complet ; profil incomplet -> redirect complete ; deja inscrit -> notice+lien ; event archive ferme + refuse API ; `EMAIL_BLOCKED` ; `DOCUMENT_BLOCKED` ; `PARTICIPANT_LIMIT` (429) ; **rendu `/e/[slug]/success`**.
- **Migrer** : `event-register.spec.ts` (7).
- **Creer** : DOCUMENT_BLOCKED distinct, rendu success (lacunes).

### Task 4.11 — `e2e/public/badge-verify.spec.ts` (renomme)
`/verify/[badgeId]` uniquement (la page `/badge/[id]` a ete **supprimee** : ilot orphelin, cf. section Bugs).
- **Couvrir** : APPROVED non-anonyme (nom+structure) ; APPROVED anonyme (masque) ; PENDING -> invalide ; id inconnu -> 404 ; audit BADGE_SCANNED a chaque appel API.
- **Migrer** : `badge-public.spec.ts` (5 tests, plus aucun skip). **Ne pas** prevoir de flux public de telechargement de badge : il n'en existe plus (le PDF se genere cote espace evenement, permission `badge.print`).

### Task 4.12 — `e2e/public/misc.spec.ts` + `e2e/transverse/`
- **Couvrir (misc)** : `/styleguide` smoke.
- **Transverse** : `logout.spec.ts` reste (modal deconnexion Annuler/Confirmer) — bouton present sur tous layouts authentifies. `security.spec.ts` : garder les tests reellement transverses (cookie vide/falsifie rejette API) dans un `e2e/transverse/security.spec.ts` ; migrer XSS -> 4.7, rate-limit -> 4.3 ; retirer le `test.skip` L26 (limitation v2 assumee) ou le convertir en note.
- **Nettoyer** : toutes les mentions « v2 » perimees dans les commentaires (`security`, `badge-public`, etc.). Le suffixe email `@v2-11-e2e.test` reste (convention de cleanup, ne pas changer).
- **Supprimer** : `misc-render.spec.ts` (reparti : register/success -> 4.3, styleguide -> misc).

---

## Task 5 : Nettoyage final, verification globale, documentation

- [ ] **Step 1 : Verifier qu'aucun test n'a ete perdu.** Comparer l'inventaire des intitules avant/apres :
Run : `git stash` (ou diff contre la base) puis pour chaque espace `grep -rhoE 'test\((fixme|skip)?\s*"[^"]+"' e2e/<espace>` avant/apres et diff. Tout intitule disparu doit avoir un equivalent dans un fichier par page (ou une suppression justifiee : doublon/obsolete).

- [ ] **Step 2 : Supprimer les fichiers dissous** confirmes vides de contenu unique : `e2e/{org,event,platform}/pages-render.spec.ts`, `.../rbac.spec.ts`, `.../interactions.spec.ts`, et les fichiers par-entite fusionnes (`org/settings.spec.ts` ancien contenu migre, `platform/orgs.spec.ts`, `platform/users.spec.ts`, `public/misc-render.spec.ts`). Utiliser `git rm`.

- [ ] **Step 3 : Lint + typecheck.** Run : `make lint && make typecheck`. Expected : succes.

- [ ] **Step 4 : Suite E2E complete.**
Run (hote) : `make test-e2e-ui` sur toute la suite, ou (conteneur) `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test`.
Expected : 0 echec hors `test.fixme` documentes (badge download, verify-email conteneur). Comparer a la baseline pour ne pas confondre un flake connu avec une regression.

- [ ] **Step 5 : Documenter.** Mettre a jour `docs/v4/features/politique-tests.md` (nouvelle convention « 1 fichier par page », section E2E) et `e2e/README.md`. Consigner dans `docs/v4/README.md` l'etat E2E.

- [ ] **Step 6 : Signaler les bugs applicatifs** decouverts (badge `/api/verify/[id]` inexistant ; discrepance PRINTER pur sur `/badges` ; verify-email self-fetch conteneur) a l'utilisateur pour des fix separes — **sans les corriger dans ce plan**.

- [ ] **Step 7 : Mettre a jour le tracker `## Progression`** (statuts `[x]`, dates). Conserver ce plan.

- [ ] **Step 8 : Commit** (si demande) : `test(v4): reorganisation e2e par page (org, event, platform, public)`.

---

## Auto-revue (couverture de la demande)

- **« Un fichier par page »** : Phases 1-4 creent/renomment un `<page>.spec.ts` par page de chaque espace ; les fichiers transversaux (`pages-render`/`rbac`/`interactions`) sont dissous (Tasks 1.8, 2.13, 3.14, 5). ✅
- **« Toutes les actions testees, sans exception »** : chaque task liste la checklist exhaustive d'actions issue de la cartographie + DoD par page ; les lacunes identifiees (recherche, pagination, uploads UI, edition/reassignation categories, changement de role membre/user, archive/delete org UI, invitation org plateforme, filtres, reCAPTCHA, ContactForm, login, select, account…) sont explicitement a creer. ✅
- **« Creer les manquants »** : sections « Creer » de chaque task. ✅
- **« Supprimer les inutilises »** : sections « Supprimer » + Task 5 (fichiers dissous, doublons API/UI, tests morts `test.skip` non justifies, commentaires « v2 » perimes). ✅
- **« Tous les espaces »** (precision utilisateur) : org (Phase 1), event (Phase 2), platform (Phase 3), public+compte+transverse (Phase 4). ✅
- **Contrainte tests≠src** : bugs applicatifs signales, jamais corriges ici ; `test.fixme` reference. ✅
- **Coherence** : gabarit unique (Task 0, `org/members`), helpers de login par role, sections Acces/Actions/Etats/Gardes&API homogenes. ✅
