# Couverture de tests complete v4 — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Atteindre une couverture de tests complete sur Badge v4 : 100% des modules `src/lib/` couverts en unitaire (Vitest), 100% des routes API couvertes en integration (Vitest + vraie MySQL), 100% des pages et de leurs interactions couvertes en E2E (Playwright), commandes `make` pour tous les modes d'execution (CLI, UI, coverage), et un workflow GitHub Actions bloquant (lint ESLint + typecheck + tests) sur chaque push et pull request.

**Definition de "100%" (perimetre precis) :**

- **Unitaire** : seuils coverage V8 a 100% (lines/branches/functions/statements) sur `src/lib/**`, avec liste d'exclusions justifiees (ex. `prisma.ts` singleton trivial). Les composants React ne sont PAS vises par l'unitaire : ils sont couverts par l'E2E.
- **Integration API** : chaque route de `src/app/api/**` a au minimum : 1 golden path (200/201/204), 1 cas 401 (non authentifie), 1 cas 403 par frontiere de role (matrice RBAC), 1 cas 400 (validation), 1 cas 404 le cas echeant, et l'assertion `logActivity` pour toute action sensible.
- **E2E** : chaque page de `src/app/**/page.tsx` a au moins 1 spec de rendu + 1 spec par interaction utilisateur (formulaire, bouton d'action, filtre, navigation), y compris etats vides et erreurs 403/404 en navigation.

**Architecture :** Next.js 16 App Router + Prisma 6 + MySQL 8, espaces v4 separes (`/platform`, `/org/[orgId]`, `/org/[orgId]/events/[eventId]`), HTTPS local Caddy (`https://badge.local`), stockage MinIO/S3, abonnements (Plan/Subscription). Tests dans le conteneur Docker dev (`make dev` prealable).

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

- [ ] **Step 1 : Renommer** `e2e/staff/` -> `e2e/platform/` (`git mv`), aligner les imports et le `playwright.config.ts` (projects/testDir si references).
- [ ] **Step 2 : Verifier les helpers** `e2e/helpers/auth.ts` et `db.ts` : URLs `/platform`, `/org/[orgId]`, `/api/platform`, `/api/org`, baseURL HTTPS (`https://badge.local` ou variable existante), `ignoreHTTPSErrors: true` si CA locale non fiable dans le conteneur.
- [ ] **Step 3 : Verify** : `rg -n "/staff|/admin|/api/staff|/api/admin" e2e/` retourne 0 occurrence (hors commentaires historiques).

### Task 0.3 — Resorption des echecs : 0 rouge

- [ ] **Step 1 : Corriger** les echecs categorie (a), (b), (c) spec par spec (selecteurs, chemins, flux logout modal v4, uploads MinIO).
- [ ] **Step 2 : Pour la categorie (d)** (regressions app reelles) : documenter chacune dans la note, corriger l'app si trivial, sinon creer une entree dediee en fin de plan et l'implementer avant de fermer la phase.
- [ ] **Step 3 : Verify** : `make test-e2e` -> 0 echec, 0 skip non justifie. Reporter le compte exact dans la note.

---

## Phase 1 — Couverture unitaire 100% `src/lib/`

### Task 1.1 — Outillage coverage

- [ ] **Step 1 : Installer** `@vitest/coverage-v8` en devDependency (`docker compose -f docker-compose.dev.yml exec app yarn add -D @vitest/coverage-v8`).
- [ ] **Step 2 : Configurer** `vitest.config.ts` : `coverage.provider = "v8"`, `include: ["src/lib/**"]`, exclusions justifiees en commentaire (au minimum `src/lib/prisma.ts`), `thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 }`.
- [ ] **Step 3 : Verify** : `docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage` produit un rapport (echec attendu sur les seuils a ce stade : c'est la mesure de depart, noter les % par module dans la note).

### Task 1.2 — Combler les trous unitaires

- [ ] **Step 1 : Lister** les modules `src/lib/` sous 100% depuis le rapport (attendus : branches non couvertes de `auth-guards`, `subscription`, `storage`, `settings`, `mail`, `activity-log`, `format-*`, `generate-id`, `qrcode`, `image-to-dataurl`).
- [ ] **Step 2 : Ecrire les tests manquants** module par module dans `src/lib/__tests__/`, en couvrant les branches d'erreur (entrees invalides, cascades null, garde-fous `assertNotLastOwner`/`assertNotLastSuperAdmin`, expiration d'abonnement, limites null).
- [ ] **Step 3 : Verify** : `yarn vitest run --coverage` passe les seuils 100% sur `src/lib/**` sans exclusion ajoutee sans justification ecrite.

---

## Phase 2 — Couverture integration 100% des routes API

Inventaire de reference (78 routes `src/app/api/**/route.ts`) : namespaces `auth` (6), `account` (5), public (`events/[slug]/register`, `public/events/[slug]`, `public/verify/[badgeId]`, `files/[...path]`, `upload`), `org/[orgId]/**` (37 dont events/registrations/categories/members/blocklists/settings/templates/upload/subscription), `platform/**` (21 dont organizations/owners/subscription, users, plans, settings, blocklists, activity).

### Task 2.1 — Matrice de couverture

- [ ] **Step 1 : Generer l'inventaire** : `find src/app/api -name route.ts` croise avec `rg -l "api/<ns>" src/**/__tests__` ; produire dans la note un tableau route x methode x {golden, 401, 403 par role, 400, 404, audit} avec l'etat actuel (couvert / partiel / absent).
- [ ] **Step 2 : Verify** : le tableau couvre les 78 routes ; les manques sont chiffres par namespace.

### Task 2.2 — Namespace auth + account + public

- [ ] **Step 1 : Completer** les tests d'integration des routes `auth/*` (register, verify-email, forgot/reset/setup-password : idempotence token, expiration, rate-limit), `account/*` (profile, registrations, resubmit, upload : mimes, 5 Mo, proprietaire vs autre user), publiques (`events/[slug]/register` : BlockedEmail, BlockedDocument, event archive, limites d'abonnement ; `files/[...path]` : ACL photo publique vs document prive ; `public/verify` : anonyme vs nominatif).
- [ ] **Step 2 : Verify** : matrice Task 2.1 verte sur ces namespaces ; `make test` vert.

### Task 2.3 — Namespace org (org, events, registrations, categories, members, blocklists, settings, templates, subscription, upload)

- [ ] **Step 1 : Completer** la matrice RBAC OWNER/MANAGER/AUDITOR + roles event ADMIN/OPERATOR/PRINTER/VIEWER + staff (staffActor=true) sur chaque route ; cycle de vie complet registration (create/approve/reject/checkin/print/all-access/duplicates/export/block-*) ; garde-fous (LAST_OWNER, SLUG_TAKEN, NUMBER_TAKEN, CATEGORY_HAS_REGISTRATIONS, limites d'abonnement EVENT_LIMIT/PARTICIPANT_LIMIT).
- [ ] **Step 2 : Verify** : matrice verte sur `org/**` ; `make test` vert ; toute action sensible a son assertion d'audit.

### Task 2.4 — Namespace platform (organizations, owners, subscription, users, plans, settings, blocklists, activity)

- [ ] **Step 1 : Completer** : hierarchie SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER sur chaque route ; owners (POST/DELETE, garde-fou dernier owner) ; plans/subscription (CRUD, assignation, expiration) ; blocklists globales (CRUD + effet sur une inscription) ; settings (secrets jamais retournes, test-smtp) ; garde-fou dernier SUPER_ADMIN.
- [ ] **Step 2 : Verify** : matrice verte sur `platform/**` ; `make test` vert ; aucun secret (hash, smtpPassword, recaptchaSecretKey, tokens non hashes) dans aucune reponse testee.

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

### Task 3.4 — Espace evenement `/org/[orgId]/events/[eventId]`

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

- [ ] **Step 1 : Verifier l'existant** : `test` (vitest), `test-e2e` (CLI conteneur), `test-e2e-ui` (UI hote) existent deja — ne pas les dupliquer.
- [ ] **Step 2 : Ajouter au Makefile** : `test-unit` (vitest `src/lib`), `test-coverage` (vitest run --coverage), `test-all` (lint + typecheck + test + test-e2e, s'arrete au premier echec). Declarer dans `.PHONY`.
- [ ] **Step 3 : Verify** : `make test-unit`, `make test-coverage`, `make test-all` fonctionnent depuis l'hote (conteneurs demarres) ; `make help` (si present) ou l'en-tete du Makefile documente les cibles.

---

## Phase 5 — Workflow GitHub Actions

Interpretation actee : "sur chaque migration" = sur chaque push et chaque pull request vers `development` (a ajuster si l'utilisateur visait autre chose). S'appuyer sur la spec v3-03 (politique tests + CI) migree dans l'historique du repo.

### Task 5.1 — Workflow CI

- [ ] **Step 1 : Creer** `.github/workflows/ci.yml` : declencheurs `pull_request` + `push` sur `development` ; 4 jobs paralleles bloquants :
  1. `lint` — `yarn lint` (ESLint, 0 erreur ; warnings toleres au niveau baseline).
  2. `typecheck` — `yarn tsc --noEmit`.
  3. `unit-integration` — service MySQL 8 (+ variables d'env de test), `prisma db push`, seed minimal, `yarn vitest run --coverage` (seuils = gate).
  4. `e2e` — services MySQL + Mailpit + MinIO, build Next standalone ou serveur dev, `yarn playwright test` (chromium), upload de `playwright-report/` en artefact en cas d'echec.
- [ ] **Step 2 : Cache** : yarn (`actions/setup-node` cache), navigateurs Playwright.
- [ ] **Step 3 : Verify** : workflow syntaxiquement valide (`actionlint` si disponible, sinon relecture) ; pousser sur une branche de test UNIQUEMENT si l'utilisateur le demande ; sinon verification locale des memes commandes (`make test-all`).

### Task 5.2 — Protection de branche (manuel utilisateur)

- [ ] **Step 1 : Documenter** dans `docs/v4/installation.md` la configuration GitHub a faire a la main : `development` protegee, les 4 checks requis, interdiction du push direct.
- [ ] **Step 2 : Verify** : la doc decrit checks et chemin de configuration ; signaler a l'utilisateur que l'activation est une action manuelle de sa part.

---

## Phase 6 — Documentation et verification finale

### Task 6.1 — Doc v4

- [ ] **Step 1 : Mettre a jour** `docs/v4/README.md` (reference de ce plan + statut), `docs/v4/installation.md` (cibles make, workflow CI, pre-requis Playwright/MinIO), et creer `docs/v4/features/politique-tests.md` (3 couches, seuils, conventions specs E2E, matrice RBAC).
- [ ] **Step 2 : Verify** : liens relatifs valides ; conventions de langue respectees.

### Task 6.2 — Verification finale

- [ ] **Step 1 :** `make test-all` -> lint 0 erreur, typecheck 0 erreur, vitest 100% vert avec seuils coverage, Playwright 100% vert.
- [ ] **Step 2 :** Croisement final : 78 routes API toutes presentes dans la matrice Task 2.1 verte ; 62 pages toutes mappees a une spec (tableau Task 3.6) ; aucun `test.skip`/`test.fixme` sans justification ecrite dans la note.
- [ ] **Step 3 :** Mettre a jour la section "Notes d'execution" ci-dessous avec les comptes finaux (nb tests par couche, % coverage, duree des suites).

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

### Mesure coverage initiale (Task 1.x)

(A alimenter.)

### Matrice API (Task 2.1)

(A alimenter.)

### Tableau page -> spec (Task 3.6)

(A alimenter.)

### Comptes finaux (Task 6.2)

(A alimenter.)
