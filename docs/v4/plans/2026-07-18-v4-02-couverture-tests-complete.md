# Couverture de tests complete v4 — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Atteindre une couverture de tests complete sur Badge v4 : 100% des modules `src/lib/` couverts en unitaire (Vitest), 100% des routes API couvertes en integration (Vitest + vraie MySQL), 100% des pages et de leurs interactions couvertes en E2E (Playwright), commandes `make` pour tous les modes d'execution (CLI, UI, coverage), et un workflow GitHub Actions bloquant (lint ESLint + typecheck + tests) sur chaque push et pull request.

**Definition de "100%" (perimetre precis) :**

- **Unitaire** : seuils coverage V8 a 100% (lines/branches/functions/statements) sur `src/lib/**`, avec liste d'exclusions justifiees (ex. `prisma.ts` singleton trivial). Les composants React ne sont PAS vises par l'unitaire : ils sont couverts par l'E2E.
- **Integration API** : chaque route de `src/app/api/**` a au minimum : 1 golden path (200/201/204), 1 cas 401 (non authentifie), 1 cas 403 par frontiere de role (matrice RBAC), 1 cas 400 (validation), 1 cas 404 le cas echeant, et l'assertion `logActivity` pour toute action sensible.
- **E2E** : chaque page de `src/app/**/page.tsx` a au moins 1 spec de rendu + 1 spec par interaction utilisateur (formulaire, bouton d'action, filtre, navigation), y compris etats vides et erreurs 403/404 en navigation.

**Architecture :** Next.js 16 App Router + Prisma 6 + MySQL 8, **trois workspaces v4 top-level non imbriques** (`/platform`, `/org/[orgId]`, `/event/[eventId]` — cf. refonte Bloc D), selecteur de workspace post-login (`/select`), HTTPS local Caddy (`https://badge.local`), stockage MinIO/S3, abonnements (Plan/Subscription). Les URL **API** restent sous `/api/org/[orgId]/events/[eventId]`. Tests dans le conteneur Docker dev (`make dev` prealable).

**Tech Stack tests :** Vitest 4 (+ `@vitest/coverage-v8` a installer), Playwright (chromium systeme dans le conteneur, mode UI depuis l'hote), Mailpit (assertions email), MinIO (assertions storage), GitHub Actions.

## Global Constraints

- **Version cible : v4.** Doc de ces changements dans `docs/v4/`.
- **Langue :** specs de test et commentaires en francais (style ASCII des fichiers existants) ; identifiants en anglais.
- **Reutiliser les helpers existants** `e2e/helpers/` (auth, db, mailpit, pdf, audit) et `e2e/fixtures/` avant d'en creer de nouveaux.
- **Pas de mock de Prisma ni des regles metier** : integration = vraie MySQL de dev ; E2E = stack complete (`make dev`).
- **Avant tout commit :** `make lint && make typecheck && make test`. Commits en francais ASCII, conventional commits. **Ne jamais commit sans demande explicite de l'utilisateur** — les etapes "Commit" ne s'executent que si l'utilisateur l'a demande dans la session.
- **Actions a risque (demander avant) :** `make db-reset`, modification de `.env*`, `docker-compose*.yml`, `Caddyfile*`, `Dockerfile*`.
- **Baseline au 2026-07-18 :** 660 tests Vitest verts ; ~53 echecs E2E pre-existants (a requalifier en Phase 0) ; 39 specs E2E ; dossier `e2e/staff/` non renomme ; pas de coverage configure ; pas de `.github/workflows/` ; cibles `test`, `test-e2e`, `test-e2e-ui`, `lint`, `typecheck` deja dans le Makefile.

---

## Vue d'ensemble des phases

| Phase | Chantier | Nature | Risque |
|---|---|---|---|
| 0 | Stabilisation de la baseline E2E (0 echec) | Fiabilisation | Moyen |
| 1 | Couverture unitaire 100% `src/lib/` + coverage | Tests | Faible |
| 2 | Couverture integration 100% routes API | Tests | Moyen |
| 3 | Couverture E2E 100% pages et interactions | Tests | Eleve (volume) |
| 4 | Commandes Make (CLI, UI, coverage, all) | Outillage | Faible |
| 5 | Workflow GitHub Actions (lint + typecheck + tests) | CI | Moyen |
| 6 | Documentation v4 + verification finale | Doc | Faible |

Ordre justifie : impossible de viser 100% E2E (Phase 3) sur une suite qui a deja ~53 echecs (Phase 0 d'abord). Le coverage (Phase 1) revele les trous unitaires avant d'ecrire l'integration (Phase 2) qui reutilise les memes fixtures. La CI (Phase 5) n'est activee qu'une fois les suites vertes, sinon elle bloque tout.

---

## Phase 0 — Stabilisation de la baseline E2E

### Task 0.1 — Etat des lieux des echecs E2E

- [x] **Step 1 : Executer** `make test-e2e 2>&1 | tee /tmp/e2e-baseline.log` (stack `make dev` demarree). Compter passes/echecs/skips. → 183 tests : 15 passes / 164 echecs / 4 skips (1.4h). Log : `.plan-logs/e2e-baseline.raw.log`.
- [x] **Step 2 : Classifier chaque echec** dans une note en fin de ce plan (section "Notes d'execution") : (a) chemin obsolete `/staff`-`/admin` non renomme, (b) HTTPS/redirection 308, (c) selecteur UI perime (refonte design, logout modal), (d) regression reelle de l'app, (e) flake (re-run vert). → cf. "Notes d'execution > Baseline E2E".
- [x] **Step 3 : Verify** : la note liste 100% des echecs avec leur categorie. → 159 (c) login helper + 5 (c)/(d) pages verify + (a)/(b) masques + 0 flake ; 100% des 164 categorises.

### Task 0.2 — Alignement structurel v4 de la suite

- [x] **Step 1 : Renommer** `e2e/staff/` -> `e2e/platform/` (`git mv`), aligner les imports et le `playwright.config.ts` (projects/testDir si references). → `git mv` fait ; imports relatifs (`../helpers`) inchanges (meme profondeur) ; `playwright.config.ts` `testDir:"./e2e"` sans reference par dossier (aucun changement).
- [x] **Step 2 : Verifier les helpers** `e2e/helpers/auth.ts` et `db.ts` : URLs `/platform`, `/org/[orgId]`, `/api/platform`, `/api/org`, baseURL HTTPS (`https://badge.local` ou variable existante), `ignoreHTTPSErrors: true` si CA locale non fiable dans le conteneur. → helpers propres (0 vieux chemin) ; `auth.ts` navigue via `/login`, `db.ts` seed via Prisma (pas d'API HTTP). baseURL in-conteneur = `http://localhost:3000` (fonctionne, GET /login=200) ; HTTPS `badge.local` reserve au mode UI hote — pas de changement requis.
- [x] **Step 3 : Verify** : `rg -n "/staff|/admin|/api/staff|/api/admin" e2e/` retourne 0 occurrence (hors commentaires historiques). → 0 occurrence. Bug corrige au passage : `platform/orgs.spec.ts` `waitForURL` pointait encore `/staff/organizations`.

### Task 0.3 — Resorption des echecs : 0 rouge

> ✅ **BLOCAGE ARCHITECTURE RESOLU (decision 2026-07-18).** La categorie (d) bloquante (membre
> event-only redirige hors de son evenement par le layout org parent) est tranchee : **de-nesting
> complet de l'espace evenement en workspace top-level `/event/[eventId]`** + selecteur de workspace.
> **ORDRE IMPOSE :** implementer d'abord le **Bloc D du plan refonte**
> (`docs/v4/plans/2026-07-17-v4-refonte-globale.md`, Phase 2 Bloc D — Tasks 2.9 a 2.13) qui de-neste
> l'event et supprime la cascade de redirect, PUIS reprendre cette Task 0.3 sur une base saine
> (les chemins e2e event deviennent `/event/[eventId]`, cf. Phase 3 Task 3.4). Ne pas tenter de
> fermer 0.3 avant que le Bloc D soit livre : la suite E2E ne peut pas passer au vert sinon.

- [x] **Step 1 : Corriger** les echecs categorie (a), (b), (c) spec par spec (selecteurs, chemins `/event/[eventId]`, flux logout modal v4, uploads MinIO). → 2026-07-18. Cause racine majeure : fixture `request` (contexte isole) au lieu de `page.request` (partage la session) -> 401 au lieu de 403/200 sur ~40 tests RBAC. Puis realignement DOM v4 (titres text vs heading, labels "Adresse e-mail", role=radio/checkbox, boutons renommes, accents) + isolation SMTP (PlatformSettings restaure). Cf. section Notes.
- [x] **Step 2 : Pour la categorie (d)** (regressions app reelles) : documenter chacune. → Les "bugs app" documentes dans les tests etaient en fait des **attentes de test perimees** vs comportement v4 corrige (AUDITOR lit activity, MANAGER cree template, smtpPassword SUPER_ADMIN-only, staff redirige vers /platform). Aligne. Un vrai defaut dev-env : `verify-email` fait un self-fetch SSR vers `NEXTAUTH_URL` injoignable en conteneur (2 tests en `test.fixme` documente ; OK en prod).
- [x] **Step 3 : Verify** : `make test-e2e` -> 0 echec. → **177 passed / 0 failed / 6 skipped** (4 tests skip pre-existants + 2 `test.fixme` verify-email justifies). Baseline 164 echecs -> 0.

---

## Phase 1 — Couverture unitaire 100% `src/lib/`

### Task 1.1 — Outillage coverage

- [x] **Step 1 : Installer** `@vitest/coverage-v8` en devDependency (`docker compose -f docker-compose.dev.yml exec app yarn add -D @vitest/coverage-v8`).
- [x] **Step 2 : Configurer** `vitest.config.ts` : `coverage.provider = "v8"`, `include: ["src/lib/**"]`, exclusions justifiees en commentaire (au minimum `src/lib/prisma.ts`), `thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 }`.
- [x] **Step 3 : Verify** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage` produit un rapport (echec attendu sur les seuils a ce stade : c'est la mesure de depart, noter les % par module dans la note).

### Task 1.2 — Combler les trous unitaires

- [x] **Step 1 : Lister** les modules `src/lib/` sous 100% depuis le rapport (attendus : branches non couvertes de `auth-guards`, `subscription`, `storage`, `settings`, `mail`, `activity-log`, `format-*`, `generate-id`, `qrcode`, `image-to-dataurl`).
- [x] **Step 2 : Ecrire les tests manquants** module par module dans `src/lib/__tests__/`, en couvrant les branches d'erreur (entrees invalides, cascades null, garde-fous `assertNotLastOwner`/`assertNotLastSuperAdmin`, expiration d'abonnement, limites null).
- [x] **Step 3 : Verify** : `yarn vitest run --coverage` passe les seuils 100% sur `src/lib/**` sans exclusion ajoutee sans justification ecrite.

---

## Phase 2 — Couverture integration 100% des routes API

Inventaire de reference (78 routes `src/app/api/**/route.ts`) : namespaces `auth` (6), `account` (5), public (`events/[slug]/register`, `public/events/[slug]`, `public/verify/[badgeId]`, `files/[...path]`, `upload`), `org/[orgId]/**` (37 dont events/registrations/categories/members/blocklists/settings/templates/upload/subscription), `platform/**` (21 dont organizations/owners/subscription, users, plans, settings, blocklists, activity).

### Task 2.1 — Matrice de couverture

- [ ] **Step 1 : Generer l'inventaire** : `find src/app/api -name route.ts` croise avec `rg -l "api/<ns>" src/**/__tests__` ; produire dans la note un tableau route x methode x {golden, 401, 403 par role, 400, 404, audit} avec l'etat actuel (couvert / partiel / absent).
- [ ] **Step 2 : Verify** : le tableau couvre les 78 routes ; les manques sont chiffres par namespace.

### Task 2.2 — Namespace auth + account + public

- [x] **Step 1 : Completer** les tests d'integration des routes `auth/*` (register, verify-email, forgot/reset/setup-password : idempotence token, expiration, rate-limit), `account/*` (profile, registrations, resubmit, upload : mimes, 5 Mo, proprietaire vs autre user), publiques (`events/[slug]/register` : BlockedEmail, BlockedDocument, event archive, limites d'abonnement ; `files/[...path]` : ACL photo publique vs document prive ; `public/verify` : anonyme vs nominatif). → 2026-07-18. 17 routes du namespace a 100/100/100 (hors `[...nextauth]` exclu). 3 agents write-only paralleles + verif. Detail : `.plan-logs/report-2.2-*.md`.
- [x] **Step 2 : Verify** : matrice Task 2.1 verte sur ces namespaces ; `make test` vert. → 881 tests verts, typecheck OK. 4 branches mortes defensives **simplifiees en prod avec accord utilisateur** (choix "simplifier/retirer") : `account/upload`+`upload` (`instanceof Blob`→`instanceof File`, retrait ternaire `? file.name : "upload"`), `account/profile` (boucle-avec-garde `typeof v==="string"` → `const data = parsed.data`, zod omet deja les optionnels absents), `files/[...path]` (`FileClass` en union discriminee, elimine le `return false` final inatteignable). `auth/[...nextauth]` exclu du coverage (wrapper NextAuth trivial, justifie dans `vitest.config.ts`).

### Task 2.3 — Namespace org (org, events, registrations, categories, members, blocklists, settings, templates, subscription, upload)

- [x] **Step 1 : Completer** la matrice RBAC OWNER/MANAGER/AUDITOR + roles event ADMIN/OPERATOR/PRINTER/VIEWER + staff (staffActor=true) sur chaque route ; cycle de vie complet registration (create/approve/reject/checkin/print/all-access/duplicates/export/block-*) ; garde-fous (LAST_OWNER, SLUG_TAKEN, NUMBER_TAKEN, CATEGORY_HAS_REGISTRATIONS, limites d'abonnement EVENT_LIMIT/PARTICIPANT_LIMIT). → 2026-07-18. TOUTES les routes `org/**` a 100/100/100. 2 vagues d'agents write-only (4 batches + 4 closers + 1 micro-closer). Rethrows couverts via spy mono-appel ; corps malformes ; conflits P2002 array/string. Rapports : `.plan-logs/report-2.3-*.md`, `.plan-logs/report-2.3-closers.md`.
- [x] **Step 2 : Verify** : matrice verte sur `org/**` ; `make test` vert ; toute action sensible a son assertion d'audit. → 1099 tests verts, typecheck OK. **BUG REEL corrige (accord utilisateur)** : POST `/org/[orgId]/events` renvoyait 500 au lieu de 409 `SLUG_TAKEN` sur MySQL (`meta.target` = chaine nom d'index, pas tableau de champs) → handler P2002 rendu compatible MySQL+Postgres. **8 branches mortes simplifiees (accord utilisateur, comme 2.2)** : gardes `if(!event)`/`if(!ctx)` redondantes post-auth → `findUniqueOrThrow`/assertion ; `NO_TEMPLATE` 500 impossible retire ; `EXT[mime] ?? …` mort retire ; `catById.get() ?? null` (FK garantie). Fixes de test : fixture badges VIEWER (etait OWNER org), test pagination activity flaky (`createdAt` distincts).

### Task 2.4 — Namespace platform (organizations, owners, subscription, users, plans, settings, blocklists, activity)

- [x] **Step 1 : Completer** : hierarchie SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER sur chaque route ; owners (POST/DELETE, garde-fou dernier owner) ; plans/subscription (CRUD, assignation, expiration) ; blocklists globales (CRUD + effet sur une inscription) ; settings (secrets jamais retournes, test-smtp) ; garde-fou dernier SUPER_ADMIN. → 2026-07-18. 4 agents write-only + 1 micro-closer. Routes a 0% desormais couvertes : blocklists globales (4 nouveaux fichiers), owners/owners[userId], plans/[planId]. Rapports : `.plan-logs/report-2.4-platform.md`.
- [x] **Step 2 : Verify** : matrice verte sur `platform/**` ; `make test` vert ; aucun secret (hash, smtpPassword, recaptchaSecretKey, tokens non hashes) dans aucune reponse testee. → **Gate coverage EXIT=0**. 1224 tests verts, typecheck OK. Couverture globale (lib+api) **100/100/100/100**. Seule modif prod : `/* v8 ignore */` sur `organizations/route.ts:85` (garde-fou anti-boucle `n>999` d'allocation de slug : vrai garde-fou de securite, conserve plutot que retire — a valider si retrait souhaite).

---

## Phase 3 — Couverture E2E 100% des pages et interactions

Convention : 1 fichier spec par page ou groupe coherent, dans `e2e/{public,account,org,event,platform,transverse}/`. Chaque interaction listee = au moins 1 test. Reutiliser helpers/fixtures ; viewport desktop par defaut.

### Task 3.1 — Public & auth

- [ ] **Step 1 :** `/` (rendu, liens login/register), `/login` (succes, mauvais mot de passe FR, compte archive, callbackUrl, redirection par profil staff/org/participant), `/register` + `/register/success`, `/forgot-password`, `/reset-password/[token]`, `/setup-password`, `/verify-email/[token]` (deja couverts : completer les trous releves en Phase 0), `/select` (multi-org, sans membership, staff), `/styleguide` (smoke).
- [ ] **Step 2 :** `/e/[slug]` (rendu branding, slug inconnu 404, event archive, CTA connecte/non connecte), `/e/[slug]/register`, `/e/[slug]/success`, `/verify/[badgeId]` (APPROVED nominatif/anonyme, PENDING, inconnu), `/badge/[id]` (telechargement).
- [ ] **Step 3 : Verify** : chaque page listee a >= 1 spec verte ; `make test-e2e` vert.

### Task 3.2 — Espace participant `/account`

- [ ] **Step 1 :** `/account` (liste par statut, etat vide), `/account/profile` (edition, uploads photo/document via MinIO, refus > 5 Mo et mime invalide), `/account/profile/complete` (parcours complet), `/account/registrations/[id]` (detail par statut, resubmit apres rejet, badge telechargeable si APPROVED).
- [ ] **Step 2 : Verify** : specs vertes ; les fichiers uploades sont servis via `/api/files` (assertion contenu).

### Task 3.3 — Espace organisation `/org/[orgId]`

- [ ] **Step 1 :** dashboard (KPI, etat vide), `/events` + `/events/new` (wizard, quota/limite d'abonnement, slug collision), `/members` (invitation avec choix de role v4 OWNER/MANAGER/AUDITOR, changement de role, suppression, garde-fou dernier OWNER en UI), `/settings` + `/settings/badge` (formulaires, cascade heritage), `/templates` (CRUD UI complet), `/subscription` (v4 : plan affiche, limites, barres de progression, alerte > 80%), `/activity` + `/activity/[logId]`.
- [ ] **Step 2 : Verify** : specs vertes pour OWNER, MANAGER, AUDITOR (nav filtree par role).

### Task 3.4 — Espace evenement `/event/[eventId]` (workspace top-level, cf. refonte Bloc D)

- [ ] **Step 1 :** dashboard par role (ADMIN/OPERATOR/PRINTER/VIEWER), `/registrations` (recherche, filtres statut/categorie, pagination, tri — via l'UI), `/registrations/new` (formulaire, validation), `/registrations/[regId]` (approve/reject avec motif, block email/document, all-access, doublons, checkin — boutons UI), `/registrations/overview`.
- [ ] **Step 2 :** `/badges` + `/badges/[badgeId]` + `/badges/print` (galerie, previsualisation, impression batch UI, cascade template), `/categories` (CRUD via modales, import templates org), `/blocked-emails` + `/blocked-documents` (liste + deblocage UI), `/members` (invitation, retrait), `/scan` (saisie manuelle : success / invalid / already-scanned), `/settings` + `/settings/badge`, `/activity` + `/activity/[logId]`, archivage/restauration d'event (OWNER).
- [ ] **Step 3 : Verify** : specs vertes ; chaque action listee a son test ; etats vides couverts.

### Task 3.5 — Espace plateforme `/platform`

- [ ] **Step 1 :** dashboard, `/organizations` + `/organizations/new` + `/organizations/[orgId]` (detail, owners add/remove, subscription assignation/override, events, members, activity, archive/restore, hard delete SUPER_ADMIN), `/users` + `/users/new` + `/users/[userId]` (creation client/staff, reset password, archivage, garde-fou dernier SUPER_ADMIN, promotion), `/plans` (v4 : CRUD catalogue), `/settings` + `/settings/badge` (SMTP + test-smtp, secrets masques), `/activity` + `/activity/[logId]`, blocklists globales (CRUD + effet sur inscription).
- [ ] **Step 2 : Verify** : specs vertes pour les 4 roles staff (nav et actions filtrees).

### Task 3.6 — Transverse

- [ ] **Step 1 : Navigation** : sidebar par role dans chaque espace (liens visibles/masques), OrgSelector, banniere staff, back-link event, **logout modal v4** dans chaque espace (ouvrir, annuler, confirmer -> `/`).
- [ ] **Step 2 : Erreurs en navigation** : URL directes sans droits -> 403/redirect login, ids inconnus -> 404, event/org archives.
- [ ] **Step 3 : Responsive** : golden paths cles (login, inscription publique, liste registrations, scan) en viewport mobile (390px).
- [ ] **Step 4 : Emails** : rendu branding cascade Event -> Org dans Mailpit (fromLabel, logo) sur approve/reject/invitation.
- [ ] **Step 5 : Verify** : `make test-e2e` -> 100% vert ; croiser la liste des 62 pages (`find src/app -name page.tsx`) avec les specs : chaque page apparait dans au moins un fichier spec (`rg` du chemin dans `e2e/`). Reporter le tableau page -> spec dans la note.

---

## Phase 4 — Commandes Make

### Task 4.1 — Cibles de test completes

- [x] **Step 1 : Verifier l'existant** : `test` (vitest), `test-e2e` (CLI conteneur), `test-e2e-ui` (UI hote) existent deja — ne pas les dupliquer. → verifie.
- [x] **Step 2 : Ajouter au Makefile** : `test-unit` (vitest `src/lib`), `test-coverage` (vitest run --coverage), `test-all` (lint + typecheck + test + test-e2e, s'arrete au premier echec). Declarer dans `.PHONY`. → ajoutes + `.PHONY` mis a jour. Commentaires sur le vidage DB par `test` et le self-seed e2e.
- [x] **Step 3 : Verify** : `make test-unit`, `make test-coverage`, `make test-all` fonctionnent depuis l'hote (conteneurs demarres). → `make test-unit` = 865 tests verts ; `make -n test-all` = ordre correct lint→typecheck→vitest→e2e ; `test-coverage` deja eprouvee en Phase 2 (gate EXIT=0).

---

## Phase 5 — Workflow GitHub Actions

Interpretation actee : "sur chaque migration" = sur chaque push et chaque pull request vers `development` (a ajuster si l'utilisateur visait autre chose). S'appuyer sur la spec v3-03 (politique tests + CI) migree dans l'historique du repo.

### Task 5.1 — Workflow CI

- [x] **Step 1 : Creer** `.github/workflows/ci.yml` : declencheurs `pull_request` + `push` sur `development` ; 4 jobs paralleles bloquants (lint / typecheck / unit-integration MySQL+coverage-gate / e2e MySQL+Mailpit+MinIO+build+playwright, artefact `playwright-report` si echec). → cree.
- [x] **Step 2 : Cache** : yarn (`actions/setup-node` cache: yarn) ; navigateurs Playwright installes via `playwright install --with-deps chromium`. → fait. `concurrency` ajoute (annule les runs obsoletes).
- [x] **Step 3 : Verify** : workflow syntaxiquement valide (parse YAML dans le conteneur : 4 jobs, triggers OK, services OK). **Non pousse** (pas de demande utilisateur). NB : le job `e2e` restera rouge tant que la Phase 3 n'est pas verte — documente dans le workflow et `installation.md`.

### Task 5.2 — Protection de branche (manuel utilisateur)

- [x] **Step 1 : Documenter** dans `docs/v4/installation.md` la configuration GitHub a faire a la main : `development` protegee, les checks requis, interdiction du push direct. → section "Integration continue > Protection de branche" ajoutee.
- [x] **Step 2 : Verify** : la doc decrit checks et chemin de configuration ; activation = action manuelle de l'admin du depot (signale dans la doc et au fil de session).

---

## Phase 6 — Documentation et verification finale

### Task 6.1 — Doc v4

- [x] **Step 1 : Mettre a jour** `docs/v4/README.md` (reference de ce plan + statut), `docs/v4/installation.md` (cibles make, workflow CI, pre-requis Playwright/MinIO), et creer `docs/v4/features/politique-tests.md` (3 couches, seuils, conventions specs E2E, matrice RBAC). → fait.
- [x] **Step 2 : Verify** : liens relatifs valides ; conventions de langue respectees. → tous les liens resolvent (verifie) ; francais ASCII conforme au style des fichiers.

### Task 6.2 — Verification finale

- [~] **Step 1 :** `make test-all` -> lint 0 erreur, typecheck 0 erreur, vitest 100% vert avec seuils coverage, Playwright 100% vert. → **Partiel** : lint 0 erreur, typecheck 0 erreur, **vitest gate coverage EXIT=0 (1224 tests, 100/100/100/100)**. Playwright (E2E) **en attente de la Phase 3** — non encore vert.
- [ ] **Step 2 :** Croisement final : 76 routes API toutes presentes dans la matrice Task 2.1 verte (FAIT pour l'API) ; 62 pages toutes mappees a une spec (tableau Task 3.6, **en attente Phase 3**) ; aucun `test.skip`/`test.fixme` sans justification ecrite.
- [ ] **Step 3 :** Mettre a jour la section "Notes d'execution" avec les comptes finaux (nb tests par couche, % coverage, duree des suites). → **partiel** : voir "Mesure coverage" ci-dessus (Phase 1+2). Comptes E2E a completer apres Phase 3.

---

## Notes d'execution

### Baseline E2E (Task 0.1) — run du 2026-07-18

Commande : `docker compose exec -d ... yarn playwright test --reporter=list` (1 worker,
serialise, conteneur seul apres nettoyage de 368 processus orphelins + `restart app`).
Log brut : `.plan-logs/e2e-baseline.raw.log`.

**Comptes exacts :** 183 tests — **15 passes / 164 echecs / 4 skips** — duree 1.4h — exit 1.

**Classification des 164 echecs (100% couverts) :**

- **(c) Selecteur UI perime — 159 echecs (signature timeout 30.1s).** Cause racine UNIQUE :
  `e2e/helpers/auth.ts` `loginAs()` fait `page.getByLabel("Email")`, mais le formulaire
  `/login` (reskine) libelle le champ **"Adresse e-mail"** (verifie : GET /login = 200,
  labels `["Adresse e-mail","Mot de passe"]`). `getByLabel("Email")` ne matche pas =>
  `.fill()` attend le timeout de test (30s). Tout spec dont le `beforeEach` appelle
  `loginAs` echoue. Repartition par fichier (login-dependants) :
  event/rbac(18), org/rbac(13), staff/rbac(9), staff/users(7), event/scan-checkin(7),
  event/registrations-admin(7), public/event-register(6), public/account-profile(6),
  event/categories(6), event/badges-print(6), staff/settings(5), staff/orgs(5),
  staff/activity(5), public/registration-resubmit(5), org/templates(5), org/settings(5),
  org/members(5), org/events(5), event/settings(5), event/archive(5), event/activity(5),
  event/registrations-lifecycle(4), event/members(4), event/dashboard(4),
  public/security(3), public/auth-register(1), public/auth-setup-password(1),
  public/auth-password-reset(1), event/badge-template-selection(1).
- **(c)/(d) Pages reskinees register/verify — 5 echecs (signature 5-7s, PAS login).**
  `public/auth-register.spec.ts` (2 : verify-email active le compte / double consommation)
  et `public/badge-public.spec.ts` (3 : `/verify/[badgeId]` nominatif / anonyme / PENDING).
  Echouent vite => contenu/selecteur des pages verify-email et verification-badge reskinees ;
  a root-cause individuellement en Task 0.3.
- **(a) chemins `/staff`-`/admin` obsoletes & (b) HTTPS/308 : MASQUES.** La suite n'atteint
  jamais la navigation (bloquee au login). Ces categories ne seront observables qu'apres le
  fix du helper (Task 0.3 Step 1). Note structurelle : les specs staff vivent dans
  `e2e/staff/` (a renommer `e2e/platform/`, Task 0.2) et melangent d'anciens (`/staff...`)
  et nouveaux (`/api/platform`) chemins.
- **(e) flake : aucun.** Signatures uniformes et deterministes.

**15 passes (login-independants, tous `e2e/public/`)** : auth-password-reset(4),
auth-register(4), auth-setup-password(3), badge-public(2), event-register(1), security(1).

**Conclusion Task 0.1 :** le fix prioritaire (Task 0.3) est une correction du selecteur du
helper partage `loginAs` ("Email" -> "Adresse e-mail"), qui devrait debloquer ~159 echecs
d'un coup et reveler les categories (a)/(b) sous-jacentes pour traitement.

### Task 0.3 — progression et blocages (working tree, non committe : Verify globale non atteinte)

Fixes appliques et VERIFIES (dans l'arbre de travail, pas encore committes car la
Verify de 0.3 = suite complete a 0 rouge n'est pas atteinte) :
- `e2e/helpers/auth.ts` : `getByLabel("Email")` -> `getByLabel(/e-?mail/i)`. Debloque le
  login partage => les ~159 echecs a 30s passent l'etape login (verifie).
- `e2e/event/dashboard.spec.ts` (ADMIN) : `getByRole("heading", {name:/tableau de bord/i})`
  -> `getByText(/tableau de bord de l'evenement/i).first()`. La page reskinee met le titre
  d'evenement en `<h1>` et "Tableau de bord de l'evenement" en `<p>` (sous-titre). ADMIN
  passe (verifie, KPI toujours asserts, non affaibli).

Blocage ouvert (arbitrage c vs d — decision humaine requise) :
- `e2e/event/dashboard.spec.ts` OPERATOR/PRINTER/VIEWER : `page.goto(.../events/[eventId])`
  renvoie `net::ERR_ABORTED` UNIQUEMENT pour les roles non-admin (ADMIN OK). Le layout
  event (`src/app/org/[orgId]/events/[eventId]/layout.tsx`) ne redirige pas ces roles : il
  rend des shells dedies `EventOperatorShell`/`EventPrinterShell`/`EventViewerShell` (Server
  Components, sans redirect ni router client). L'abort de navigation cible-role est donc un
  **candidat regression (categorie d)** a investiguer (rendu de la vue operateur/printer/
  viewer), pas une simple derive de selecteur. A trancher avant de fermer 0.3.

Diagnostic approfondi de l'ERR_ABORTED non-admin (causes ecartees) : PAS un 500 (aucune
erreur serveur dans les logs app au rendu operateur) ; PAS du timing de compilation Next dev
(re-run apres compilation = meme abort deterministe) ; PAS un redirect (ni le layout, ni la
page `page.tsx`, ni `EventOperatorShell` — Server Component pur, Links only — ne redirigent ;
`waitUntil:"commit"` n'aide pas => abort au niveau reponse). Piste a instruire via la trace
Playwright (`test-results/.../trace.zip`) + intention design : interaction fixture possible —
`createTestEventMember({role:"OPERATOR"})` cree aussi une OrgMembership AUDITOR, or
`effectiveEventRole` donne priorite a l'org (AUDITOR -> "VIEWER") sur l'EventMembership
(OPERATOR). A verifier : role effectif reellement resolu + cause exacte de l'abort. Releve
d'une decision humaine (fixture a corriger vs comportement app a ajuster vs test a adapter).

Finding complementaire (2e passe) : les 3 tests non-admin qui abortent (OPERATOR/PRINTER/
VIEWER de `dashboard.spec.ts`) partagent tous une OrgMembership AUDITOR posee par la fixture
`createTestEventMember` ; or `effectiveEventRole` donne priorite a l'org (AUDITOR -> "VIEWER")
sur l'EventMembership. Consequence : les 3 resolvent en VIEWER et rendent tous
`EventViewerShell` (Server Component pur, sans redirect) — les tests "OPERATOR"/"PRINTER"
**n'exercent donc jamais** leur role event (bug de conception de la fixture, arbitrage RBAC
a trancher). Cause exacte de l'`ERR_ABORTED` (au-dela de la resolution de role) : trace reseau inspectee
(`trace.zip` -> `0-trace.network`) => la requete de navigation event est **avortee sans
reponse serveur** (`time:-1`, aucune entree response), la ou ADMIN obtient un rendu complet.
Ecarte une redirection/500 serveur normale ; pointe vers un abort client / soft-nav RSC dont
la cause exige un debogage runtime (PWDEBUG ou logs serveur cibles). Decision humaine requise :
corriger la fixture (ne pas coupler org AUDITOR) vs. adapter les attentes des tests au
routage/role effectif reel, puis re-diagnostiquer l'abort sur la base saine.

*** CORRECTION / ROOT CAUSE CONFIRMEE (supersede les 2 hypotheses ci-dessus) ***
La theorie "fixture couple org AUDITOR" est FAUSSE : `createTestEventMember` a un flag
`attachOrgAuditor` OPT-IN (defaut falsy) et `dashboard.spec.ts` ne le passe pas => les users
OPERATOR/PRINTER/VIEWER sont de PURS event-members (EventMembership seule, aucune
OrgMembership). Egalement faux : "pas de redirect". Cause reelle CONFIRMEE (categorie d,
REGRESSION APP) : `src/app/org/[orgId]/layout.tsx` (v4 Bloc B) calcule
`isMember = hasOrgRole(ctx, orgId, "AUDITOR")` puis `redirect("/select")` si non-membre.
Or l'espace evenement est physiquement imbrique sous `/org/[orgId]/events/[eventId]`, donc ce
layout parent s'applique AUSSI aux pages event. Un membre event-only (OPERATOR/PRINTER/VIEWER
sans OrgMembership) n'a pas de role org => `isMember=false` => redirect SSR => `page.goto`
renvoie `ERR_ABORTED` (redirect gere en soft-nav, d'ou l'absence de reponse dans la trace).
ADMIN passe car `makeEventAdminUser` cree un membre avec role org (OWNER) => `isMember=true`.

Impact reel (pas seulement tests) : TOUT operateur/imprimeur/lecteur d'evenement qui n'est
pas aussi membre de l'organisation est REDIRIGE hors de son propre evenement -> les roles
event dedies (et leurs shells Operator/Printer/Viewer) sont inaccessibles en v4. Bug de prod.

Correctif NON trivial (arbitrage architecture, decision humaine) : le org layout doit laisser
passer les membres d'un evenement de l'org vers les routes `/events/[eventId]/**` sans exposer
les pages org-level aux non-membres org. Options : (a) elargir le gate `isMember` pour inclure
"membre d'un event de cette org" ET re-gater les pages org-level (dashboard/members/settings)
individuellement ; (b) sortir l'espace event de sous `/org/[orgId]` (revenir sur l'imbrication
URL de la refonte) ; (c) deplacer tout le controle d'acces event dans le event layout et
neutraliser le gate org pour le sous-arbre event. Chaque option a des consequences RBAC a
trancher avec l'intention design de la refonte v4 (Bloc B "fin des vues imbriquees").

Nature du reste de 0.3 : ~40 specs a adapter a la DOM reskinee v4, chacune avec un arbitrage
(c : selecteur a mettre a jour / d : regression app a corriger et documenter ici). Chaque
iteration de verification = run complet ~1.4h. Travail iteratif a supervision humaine ;
non drainable mecaniquement.

### Mesure coverage initiale (Task 1.x)

Baseline 2026-07-18 : `src/lib` ~80% lignes / 71% branches. Final Phase 1 :
**100% / 100% / 100% / 100%** (lignes/branches/fonctions/statements), gate
`vitest run --coverage` vert (exit 0). 98 fichiers de test verts.

---

## HANDOFF — reprise en nouvelle session (etat au 2026-07-18)

**Branche :** `feat/design_implementation`. Tout est committe (voir `git log`). Non
committes (a laisser) : `scripts/run-plans.sh`, `.plan-logs/`, `Todo.md` (outillage boucle).

### Ce qui est FAIT dans cette session
- **Refonte v4 Bloc D (de-nesting event)** : espace evenement passe en top-level
  `/event/[eventId]`, selecteur de workspace `/select`, regression "membre event-only
  redirige hors de son event" corrigee (prouvee E2E : `e2e/event/dashboard.spec.ts` 4/4).
  Commits `7f2863f`, `f632cea`. Plan refonte 100% (133/133).
- **Site public / marketing** : landing + fonctionnalites, tarifs, a-propos, contact
  (+ `/api/contact`), 3 pages legales, chrome partage. Route group `src/app/(marketing)/`.
  Plan `2026-07-18-v4-site-public-marketing.md` 100% (85/85). Commits `0c3f998`, `e0692b6`.
- **SMTP dev** : `PlatformSettings` en base dev repointe sur `mailpit:1025` (le seed a
  deja la bonne valeur ; c'etait un artefact runtime). Le formulaire contact delivre.
- **Phase 1 (couverture unitaire lib) : TERMINEE a 100%.** Tasks 1.1-1.2 cochees.
  Config coverage dans `vitest.config.ts` (provider v8, include `src/lib/**`, seuils 100%,
  exclusions justifiees). Du code mort defensif a ete retire de la PROD **avec l'accord
  explicite de l'utilisateur** (format-badge-name if redondant, mail/mail-helpers `?? ch`,
  `v8 ignore` sur branches S3 defensives). Commits `86ce77e`, `d27ce91`, `09dea4a`,
  `5fbf69c`, `88d963c`, `aac6848`, `91ce109`.

### CONTRAINTES A HONORER (imperatif utilisateur)
1. **Les tests ne modifient JAMAIS le code de production.** Si couvrir une ligne exige
   de toucher `src/` (hors `__tests__`) ou revele un bug -> **s'arreter et demander**,
   ne pas modifier la prod. (L'exception dead-code de cette session a ete validee au cas
   par cas ; toute nouvelle modif prod requiert un accord frais.)
2. **Ne jamais committer sans demande explicite** de l'utilisateur dans la session.

### PIEGES TECHNIQUES appris (a reutiliser)
- **Base MySQL unique partagee entre tests et DEV** (`vitest.config` `fileParallelism:false`,
  reset global `src/test-setup.ts` en `beforeEach` qui `deleteMany` ~14 modeles) :
  (1) **ne jamais lancer deux runs vitest en parallele** ; les agents delegues **ecrivent
  les tests sans les executer**, l'agent principal fait UNE passe `yarn vitest run --coverage`
  de verif a la fin. (2) **Chaque `make test` VIDE les donnees de dev** -> relancer
  `make db-seed` ensuite (comptes seed, password `123456`). Symptome typique : `badge.local`
  redirige vers `/login` (session valide mais user supprime -> `loadUserContext` null ->
  `resolveHomeRedirect(null)` = `/login`). Une base de test separee serait souhaitable (v3).
- **next-auth v4** : le vrai `authorize` est dans `authOptions.providers[0].options.authorize`
  (le `.authorize` de premier niveau est un stub `() => null`).
- Modeles a mocker si on mocke `@/lib/prisma` : le reset global appelle `deleteMany` sur
  ~14 modeles -> preferer la **vraie DB** (pattern des tests lib existants) plutot qu'un
  mock partiel de prisma.
- `Registration.id` n'a pas de `@default` -> fournir un `id` explicite a `registration.create`.

### PROCHAINE ETAPE : Phase 2 — Integration API 100% (76 routes)
1. **Task 2.1 (mesure)** : ajouter `src/app/api/**` a `coverage.include` de
   `vitest.config.ts`, lancer `yarn vitest run --coverage`, lister les routes/lignes sous
   100%. Beaucoup de routes ont deja des tests (`src/lib/__tests__/api-*.test.ts`).
2. **Tasks 2.2-2.4 (combler)** par namespace : `auth`/`account`/public, `org/**`,
   `platform/**`. Pour chaque route : golden path (2xx), 401, 403 par frontiere de role,
   400 (validation), 404 le cas echeant, assertion `logActivity`. Reutiliser les helpers
   et le style des `api-*.test.ts` existants. Deleguer l'ECRITURE a des agents paralleles
   (write-only, no run), puis UNE passe de verif.
3. Puis Phases 3 (E2E, gros/lent — Bloc D deja livre donc Task 0.3 debloquee), 4-5 (Make +
   CI), 6 (doc).

### Etat Phase 0 Task 0.3 (E2E)
Le blocage architecture est leve (Bloc D). `e2e/helpers/auth.ts` (fix login) et
`e2e/event/dashboard.spec.ts` sont committes et verts. Il reste ~40 specs E2E a realigner
sur le DOM v4 reskine + chemins `/event/[eventId]` (categorie (c)). Chaque run E2E complet
~1.4h -> travail iteratif supervise.

### Matrice API (Task 2.1)

Mesure baseline 2026-07-18 (post-Phase 1), coverage V8 avec `src/app/api/**` ajoute au
perimetre (`vitest.config.ts` `coverage.include`). **77 fichiers route** (76 `route.ts` +
1 `route.tsx` badges). Global API+lib : **73.5% lignes / 71.6% branches / 69.5% fonctions**
(la lib reste a 100%). **4 routes deja a 100/100/100**, **73 a completer**. Numeros de lignes
non couvertes par route : `.plan-logs/api-uncovered-lines.json`. Log : `.plan-logs/api-coverage-baseline.log`.

Colonnes = % lignes / branches / fonctions. `✅` = deja a 100/100/100.

| Route | L% | B% | F% |
|---|---|---|---|
| `account/profile` | 82.85 | 56.25 | 75 |
| `account/registrations` | 85.71 | 50 | 100 |
| `account/registrations/[id]` | 66.66 | 50 | 100 |
| `account/registrations/[id]/resubmit` | 82.6 | 70 | 100 |
| `account/upload` | 0 | 0 | 0 |
| `auth/[...nextauth]` | 0 | 100 | 0 |
| `auth/forgot-password` | 86.95 | 78.57 | 50 |
| `auth/register` | 89.65 | 75 | 50 |
| `auth/reset-password` | 94.44 | 90 | 50 |
| `auth/setup-password` | 100 | 100 | 50 |
| `auth/verify-email` | 90 | 81.81 | 50 |
| `contact` | 0 | 0 | 0 |
| `events/[slug]/register` | 72.88 | 42.3 | 33.33 |
| `files/[...path]` | 76 | 63.63 | 100 |
| `org/[orgId]` | 78.57 | 71.42 | 33.33 |
| `org/[orgId]/activity` | 0 | 0 | 0 |
| `org/[orgId]/events` | 62.5 | 51.42 | 71.42 |
| `org/[orgId]/events/[eventId]` | 75.86 | 75 | 33.33 |
| `org/[orgId]/events/[eventId]/activity` ✅ | 100 | 100 | 100 |
| `org/[orgId]/events/[eventId]/archive` | 78.57 | 62.5 | 100 |
| `org/[orgId]/events/[eventId]/badges/[badgeId]` | 85.29 | 68.75 | 83.33 |
| `org/[orgId]/events/[eventId]/blocked-documents` | 61.11 | 33.33 | 33.33 |
| `org/[orgId]/events/[eventId]/blocked-documents/[id]` | 87.5 | 75 | 100 |
| `org/[orgId]/events/[eventId]/blocked-emails` | 77.77 | 66.66 | 33.33 |
| `org/[orgId]/events/[eventId]/blocked-emails/[id]` | 87.5 | 75 | 100 |
| `org/[orgId]/events/[eventId]/categories` | 80 | 41.66 | 33.33 |
| `org/[orgId]/events/[eventId]/categories/[id]` | 69.23 | 54.54 | 66.66 |
| `org/[orgId]/events/[eventId]/categories/import-templates` | 75 | 62.5 | 85.71 |
| `org/[orgId]/events/[eventId]/members` | 82.14 | 70 | 33.33 |
| `org/[orgId]/events/[eventId]/members/[membershipId]` | 42.85 | 30 | 33.33 |
| `org/[orgId]/events/[eventId]/registrations` | 86.66 | 76.66 | 75 |
| `org/[orgId]/events/[eventId]/registrations/[regId]` | 45.16 | 25 | 25 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/all-access` | 0 | 0 | 0 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/approve` | 84.61 | 83.33 | 100 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/block-document` | 0 | 0 | 0 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/block-email` | 85.71 | 50 | 50 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/checkin` | 87.5 | 75 | 100 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/duplicates` ✅ | 100 | 100 | 100 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/print` | 84.61 | 83.33 | 100 |
| `org/[orgId]/events/[eventId]/registrations/[regId]/reject` | 87.5 | 75 | 50 |
| `org/[orgId]/events/[eventId]/registrations/export` ✅ | 100 | 100 | 100 |
| `org/[orgId]/events/[eventId]/registrations/overview` | 0 | 0 | 0 |
| `org/[orgId]/events/[eventId]/registrations/print` | 86.66 | 50 | 66.66 |
| `org/[orgId]/events/[eventId]/restore` | 0 | 0 | 0 |
| `org/[orgId]/events/[eventId]/scan/verify` | 85 | 80 | 66.66 |
| `org/[orgId]/events/[eventId]/settings` | 100 | 75 | 66.66 |
| `org/[orgId]/events/[eventId]/settings/badge` | 94.44 | 80 | 50 |
| `org/[orgId]/events/[eventId]/upload` | 0 | 0 | 0 |
| `org/[orgId]/members` | 80 | 60 | 40 |
| `org/[orgId]/members/[userId]` | 32.55 | 23.07 | 33.33 |
| `org/[orgId]/settings/badge` | 90 | 80 | 50 |
| `org/[orgId]/templates` | 83.33 | 100 | 33.33 |
| `org/[orgId]/templates/[id]` | 0 | 0 | 0 |
| `org/[orgId]/upload` | 0 | 0 | 0 |
| `platform/activity` | 96.96 | 79.16 | 100 |
| `platform/blocked-documents` | 0 | 0 | 0 |
| `platform/blocked-documents/[id]` | 0 | 0 | 0 |
| `platform/blocked-emails` | 0 | 0 | 0 |
| `platform/blocked-emails/[id]` | 0 | 0 | 0 |
| `platform/organizations` | 100 | 90 | 83.33 |
| `platform/organizations/[orgId]` | 95.12 | 87.5 | 75 |
| `platform/organizations/[orgId]/archive` | 60 | 0 | 100 |
| `platform/organizations/[orgId]/owners` | 0 | 0 | 0 |
| `platform/organizations/[orgId]/owners/[userId]` | 0 | 0 | 0 |
| `platform/organizations/[orgId]/restore` | 60 | 0 | 100 |
| `platform/organizations/[orgId]/subscription` | 80.95 | 75 | 50 |
| `platform/plans` | 55 | 37.5 | 33.33 |
| `platform/plans/[planId]` | 0 | 0 | 0 |
| `platform/settings` | 100 | 100 | 80 |
| `platform/settings/badge` | 94.73 | 87.5 | 50 |
| `platform/settings/test-smtp` | 66.66 | 50 | 50 |
| `platform/users` | 96.22 | 88.52 | 80 |
| `platform/users/[userId]` | 78.37 | 77.77 | 75 |
| `platform/users/[userId]/reset-password` ✅ | 100 | 100 | 100 |
| `public/events/[slug]` | 85.71 | 66.66 | 100 |
| `public/verify/[badgeId]` | 100 | 90 | 100 |
| `upload` | 91.89 | 75 | 100 |

### Tableau page -> spec (Task 3.6)

Croisement 2026-07-19 : **69 pages** `page.tsx`. Apres realignement de la suite existante
(164 -> 0 echec) et ajout de **5 fichiers de rendu** dediés, **68/69 pages** ont au moins un
spec de navigation/rendu (le `/` restant est un faux-negatif de la detection regex : il est
teste dans `e2e/public/marketing.spec.ts` via `page.goto(path)` indirect). Couverture de
**rendu** des pages : complete.

Nouveaux fichiers de rendu :
- `e2e/public/marketing.spec.ts` — 8 pages statiques marketing/legales (/, a-propos, fonctionnalites, tarifs, contact, cgu, confidentialite, mentions-legales).
- `e2e/public/misc-render.spec.ts` — /register/success, /styleguide.
- `e2e/event/pages-render.spec.ts` — 11 pages event (activity[/logId], badges[/badgeId,/print], blocked-*, categories, registrations[/regId,/new,/overview], scan).
- `e2e/org/pages-render.spec.ts` — 8 pages org + /select + /account/profile/complete.
- `e2e/platform/pages-render.spec.ts` — 11 pages platform (organizations/[orgId]/*, plans, settings[/badge], users[/[userId],/new], activity/[logId]).

**Reserve** : ce croisement garantit **>=1 spec de rendu par page** (Tasks 3.x Step "render").
La couverture exhaustive des **interactions** par page (chaque bouton/filtre/formulaire) n'est
pas integralement mesuree — a completer si l'objectif "1 spec par interaction" est vise.

**BUG PROD corrige au passage** (accord utilisateur) : `platform/organizations/[orgId]/subscription`
renvoyait 500 pour toute org avec abonnement (Server Component appelant `isoDay` du module client
`SubscriptionForm`). `isoDay` deplace vers `src/lib/format-date.ts` (module partage), +3 tests unitaires.

### Comptes finaux (Task 6.2)

(A alimenter.)
