# Spec — Couverture E2E complète Badge v2 (2026-06-01)

> **Statut** : en conception
> **Décide** : organisation, stratégie et périmètre des tests E2E Playwright couvrant l'ensemble de l'application Badge v2.
> **Plan d'implémentation associé** : `../plans/2026-06-01-v2-13-e2e-coverage.md`
> **Checklist visuelle associée** : `2026-06-01-e2e-visual-review-checklist.md`

## 1. Contexte

À date, l'app Badge v2 comporte :

- **35 pages** réparties sur 4 espaces : staff applicatif, organisation, événement, public/participant.
- **53 routes API** couvrant authentification, RBAC, registrations, badges, scan, settings, audit.
- **5 specs Playwright** existantes (`e2e/account-register`, `account-profile`, `account-resubmit`, `event-register-flow`, `badge-template-selection`) qui couvrent partiellement le parcours participant.
- **0 spec** pour les espaces staff, organisation, événement (côté admin) ; aucune assertion automatisée sur emails Mailpit, PDF de badge, scan API, audit.

L'utilisateur a demandé une couverture E2E complète : « toutes les vues, toutes les actions ». Cette spec définit comment y arriver sans dériver vers ~60 specs ingérables.

## 2. Objectifs

1. **Couvrir tous les parcours métier critiques** des 4 espaces (staff / org / event / public) avec un test Playwright reproductible.
2. **Vérifier les effets de bord** : emails (Mailpit), génération PDF de badge, audit `ActivityLog`, snapshots Registration.
3. **Garantir le RBAC** : pour chaque espace, prouver qu'un rôle inférieur ne peut pas exécuter les actions réservées.
4. **Rester maintenable** : chaque spec doit être autonome (setup + cleanup), lisible (un parcours = un `test()`), et insensible à l'ordre d'exécution.
5. **Produire des artefacts utilisables hors CI** : checklist de revue visuelle manuelle pour les aspects esthétiques (mise en page, dark/light, responsive) que Playwright ne couvre pas.

## 3. Hors scope

- **v1** (production actuelle). Cette couverture cible exclusivement v2.
- **Tests cross-browser** : Playwright est configuré uniquement avec Chromium (`/usr/bin/chromium-browser` dans le container `app`). Pas de Firefox / WebKit.
- **Tests de performance / charge** : pas de `k6`, pas de mesures de latence.
- **Scan QR via UI caméra** : `html5-qrcode` exige une caméra, non testable en CI. On teste la logique de check-in via l'API `/api/admin/.../scan/verify` et `/checkin` directement.
- **Vérification visuelle du PDF** : on assert le `Content-Type: application/pdf` et la taille > seuil. Pas de parsing OCR du contenu — la revue visuelle se fait manuellement (voir checklist).
- **Migration v1 → v2** : la v2 a explicitement abandonné toute migration ; aucun test de migration à écrire.
- **CI** : pas d'intégration CI dans le périmètre de ce plan (la décision « pas de déploiement prod v2 » du 2026-05-31 a aussi gelé l'ajout d'une CI). Les specs s'exécutent localement via `docker compose exec app yarn playwright test`.

## 4. Stratégie

### 4.1 Granularité

**Décision** : un parcours métier complet par `test()`, regroupé par domaine fonctionnel dans une spec. Une spec = un fichier `.spec.ts` qui contient plusieurs `test()` cohérents autour d'un même domaine (ex : `e2e/event/registrations-lifecycle.spec.ts` contient approve, reject, resubmit).

**Justification** : un parcours métier complet est plus lisible et plus fidèle à l'usage réel qu'un test atomique par action. Le regroupement par domaine évite la prolifération de fichiers (~25 specs au lieu de ~60).

Chaque parcours suit le pattern : **setup (Prisma) → login → actions UI → assertions (UI + BDD + Mailpit + PDF + audit) → cleanup (afterAll)**.

### 4.2 Données : Prisma in-test (pattern existant)

**Décision** : on conserve et on étend le pattern actuel de `e2e/helpers/db.ts` qui appelle Prisma directement depuis le test (Playwright tourne dans le container `app` qui embarque Prisma).

**Pas de route `/api/test/*` dev-only** : la duplication d'instanciation et la complexité ne se justifient pas tant que Playwright tourne dans le même container que Next.

**Conventions de marqueurs E2E** (héritées du plan v2-11, conservées stables pour ne pas casser les specs existantes) :

| Entité | Marqueur | Usage |
|---|---|---|
| User.email | suffixe `@v2-11-e2e.test` | Cleanup `endsWith` |
| Organization.slug | préfixe `e2e-` | Cleanup `startsWith` |
| Event.slug | préfixe `e2e-` | Cleanup `startsWith` |

Chaque spec cleanup en `afterAll` via `cleanupE2ETestData()` étendu pour couvrir les nouvelles entités (CategoryTemplate, BlockedEmail, BlockedDocument, EventMembership, OrgMembership).

### 4.3 Helpers `e2e/helpers/` à livrer

| Fichier | Existe ? | Rôle |
|---|---|---|
| `db.ts` | ✓ existe | Étendu : factories pour staff users, orgs avec rôles, events, registrations, categories, blocked-*, templates, memberships event/org |
| `auth.ts` | nouveau | `loginAs(page, user)` via UI `/login` ; `loginAsStaff(page, { role })`, `loginAsOrgRole(page, { orgId, role })`, etc. |
| `mailpit.ts` | nouveau | `clear()` ; `search({ to, subject?, since? })` ; `expectMail({ to, subjectPattern, bodyPattern? })` ; URL interne `http://mailpit:8025/api/v1/*` |
| `pdf.ts` | nouveau | `expectPdfResponse(response, { minBytes = 1000 })` ; assert content-type + length |
| `audit.ts` | nouveau | `expectLastActivity({ type, orgId?, eventId?, userId?, targetId? })` via Prisma direct |

**Ce qu'on ne fait pas** : pas de Page Object Model lourd, pas de fixtures Playwright globales. Le pattern actuel (helpers fonctionnels stateless) suffit.

### 4.4 Artefacts couverts

| Artefact | Méthode |
|---|---|
| **Email** | Avant chaque parcours qui en envoie : `mailpit.clear()`. Après l'action : `mailpit.expectMail({ to: ..., subjectPattern: /Bienvenue/ })` via l'API HTTP Mailpit (`http://mailpit:8025/api/v1/search?query=to:...`). |
| **PDF badge** | `page.request.get('/api/admin/.../badges/[id]')` puis `expectPdfResponse(response, { minBytes: 5000 })`. Pas d'analyse du contenu. |
| **Scan / check-in** | `page.request.post('/api/admin/.../scan/verify', { data: { payload: badgeId } })` ; assertion sur `{ ok, authorized, registration }` + audit `BADGE_SCANNED`. |
| **Audit** | `audit.expectLastActivity({ type: 'REGISTRATION_APPROVED', eventId, targetId: regId })` — lecture directe en BDD ; couvre aussi le flag `staffActor`. |
| **Revue visuelle** | Hors automatisation — voir checklist `2026-06-01-e2e-visual-review-checklist.md`. |

### 4.5 Structure de répertoire

```
e2e/
├── helpers/
│   ├── db.ts           # étendu
│   ├── auth.ts         # nouveau
│   ├── mailpit.ts      # nouveau
│   ├── pdf.ts          # nouveau
│   └── audit.ts        # nouveau
├── staff/              # 5 specs — espace staff applicatif
├── org/                # 5 specs — espace organisation
├── event/              # 10 specs — espace événement
└── public/             # 8 specs — public / auth / participant
                       #   (les 5 specs actuelles migrent ici)
```

Soit **~28 specs** au total, ~150 `test()` cumulés.

### 4.6 Stratégie RBAC

Chaque espace contient **une spec dédiée matrice RBAC** (`<espace>/rbac.spec.ts`) qui :

1. Crée un user de chaque rôle (`createTestStaff({ role: 'STAFF_OBSERVER' })`, etc.).
2. Pour chaque action réservée, tente l'appel API correspondant et assert `403` (ou `404` selon la politique de la route).
3. Pour chaque page réservée, tente la navigation UI et assert la redirection / le 403 / l'absence des boutons d'action.

Cela évite de polluer les specs de parcours métier avec des cas négatifs et garde la matrice RBAC lisible d'un coup d'œil.

### 4.7 Isolation et cleanup

- **Workers** : `workers: 1`, `fullyParallel: false` (déjà configuré dans `playwright.config.ts`). Pas de modification.
- **Cleanup** : `afterAll(() => cleanupE2ETestData())` par spec — supprime toutes les entités marquées `e2e-` ou `@v2-11-e2e.test`.
- **Mailpit** : `beforeEach(() => mailpit.clear())` dans les specs qui vérifient des emails (pas globalement pour ne pas perturber le dev local).

## 5. Pré-requis : bugs à corriger avant les specs concernées

L'inventaire de l'espace org a relevé 5 incohérences qui rendraient certains parcours infaisables ou non significatifs. Elles deviennent **dépendances dures** des tasks correspondantes du plan :

| # | Bug | Impact sur les specs | Task plan |
|---|---|---|---|
| 1 | `GET /api/admin/[orgId]` force `withOrgAuth("OWNER")` alors que la spec dit OWNER/MANAGER/AUDITOR | Spec `org/dashboard.spec.ts` ne peut pas tester MANAGER/AUDITOR en lecture | Bloque T-org-dashboard |
| 2 | Idem pour `GET /api/admin/[orgId]/templates` et `GET /api/admin/[orgId]/events` | Spec `org/templates.spec.ts`, `org/events.spec.ts` | Bloque T-org-templates, T-org-events |
| 3 | `POST /api/admin/[orgId]/members` hardcode `role: "OWNER"` malgré le schéma attendu | Spec `org/members.spec.ts` ne peut pas tester MANAGER/AUDITOR invitation | Bloque T-org-members |
| 4 | `PATCH /api/admin/[orgId]/members/[userId]` (changement de rôle) non implémenté | Spec `org/members.spec.ts` — promotion rôle | Bloque T-org-members |
| 5 | Wrappers `withOrgAuth("OWNER")` à abaisser à `AUDITOR` sur tous les GET de lecture | Toutes specs lecture org | Bloque toutes les T-org-* en lecture |

**Décision** : pour chaque task du plan dépendante d'un bug, on commence par un **patch correctif minimal** (sous-task explicite), puis la spec. Si le user préfère que les bugs soient corrigés en amont dans un commit séparé, on peut les regrouper en première task `T-00-prereq-fixes`.

## 6. Matrice condensée des parcours par espace

> Pour le détail (étapes UI, assertions, edge cases), voir les sections dédiées du plan d'implémentation.

### 6.1 Espace staff (`e2e/staff/*`)

| Spec | Parcours golden | Edge / RBAC |
|---|---|---|
| `orgs.spec.ts` | Create org + invitation OWNER (mail) ; update org ; archive ; restore ; hard delete confirmé | Slug auto-increment ; hard delete confirmation obligatoire ; STAFF_ADMIN ne peut pas hard delete |
| `users.spec.ts` | Create user client (mail invitation) ; create staff SUPPORT ; reset password (mail) ; archive | STAFF_ADMIN ne peut pas créer SUPER_ADMIN ; STAFF_SUPPORT ne peut pas créer staff ; cannot archive last SUPER_ADMIN |
| `settings.spec.ts` | Update PlatformSettings (SMTP non-secret) ; test SMTP (mail) ; sélection badge template platform | STAFF_ADMIN ne peut pas écrire `smtpPassword` ; secrets jamais retournés par GET |
| `activity.spec.ts` | Lecture journal global filtré par type/date/orgId | — |
| `rbac.spec.ts` | — | Matrice 4 rôles × actions critiques |

### 6.2 Espace organisation (`e2e/org/*`)

| Spec | Parcours golden | Edge / RBAC |
|---|---|---|
| `events.spec.ts` | OWNER crée event (wizard 3 steps avec templates + manual cat) ; archive ; restore ; quota events atteint | Slug collision ; quota dépassé |
| `members.spec.ts` | OWNER invite MANAGER (mail) ; OWNER change rôle ; OWNER retire MANAGER | MANAGER ne peut pas inviter ; cannot remove last OWNER |
| `templates.spec.ts` | OWNER crée CategoryTemplate ; MANAGER crée ; OWNER édite ; OWNER supprime | AUDITOR ne peut pas créer ; suppression refuse si template référencé (à vérifier) |
| `settings.spec.ts` | OWNER modifie infos org (name, contact, logo) ; OWNER sélectionne badge template (cascade) | MANAGER ne peut pas éditer ; payload SMTP rejeté |
| `rbac.spec.ts` | — | Matrice OWNER/MANAGER/AUDITOR × 10 actions ; staff sans OrgMembership accède avec `staffActor=true` |

### 6.3 Espace événement (`e2e/event/*`)

| Spec | Parcours golden | Edge / RBAC |
|---|---|---|
| `dashboard.spec.ts` | ADMIN consulte KPI ; OPERATOR voit "Mes scans" ; PRINTER redirigé vers `/badges` | VIEWER agrégé seul |
| `categories.spec.ts` | ADMIN crée catégorie ; ADMIN importe templates org ; ADMIN édite ; ADMIN supprime | Number collision ; suppression refusée si inscriptions liées |
| `registrations-lifecycle.spec.ts` | OPERATOR approuve (mail + audit) ; OPERATOR rejette avec motif (mail + audit) ; participant resoumet ; OPERATOR ré-approuve | Double approve idempotent ; rate-limit reject mass |
| `registrations-admin.spec.ts` | ADMIN crée inscription manuelle (APPROVED par défaut) ; ADMIN bloque email (mail futur refusé) ; ADMIN bloque document ; ADMIN voit doublons ; ADMIN toggle all-access ; ADMIN exporte CSV (audit) | OPERATOR ne peut pas export / block / manual create |
| `badges-print.spec.ts` | PRINTER télécharge PDF individuel ; PRINTER imprime batch ; ADMIN toggle all-access depuis badge | OPERATOR sans `badge.print` refusé sur batch ; PDF format check |
| `scan-checkin.spec.ts` | OPERATOR scan via API verify → authorized=true (APPROVED) ; scan REJECTED → denied ; scan event étranger → foreign-event ; check-in direct par regId | PRINTER refusé ; payload malformé |
| `members.spec.ts` | ADMIN invite OPERATOR (mail si nouveau user) ; ADMIN retire membership | OPERATOR ne peut pas inviter ; cannot remove last ADMIN (à confirmer côté code) |
| `settings.spec.ts` | ADMIN modifie titre/lieu/date/contact override ; ADMIN sélectionne badge template event (cascade event > org > platform) | OPERATOR refusé |
| `activity.spec.ts` | ADMIN voit tous les logs event ; OPERATOR voit ses scans uniquement | VIEWER masque détails |
| `archive.spec.ts` | OWNER org archive event ; OWNER org restaure ; impact sur registrationOpen | ADMIN event seul ne peut pas archiver |
| `badge-template-selection.spec.ts` (existant, conservé) | ADMIN sélectionne `recto-verso-v1` puis revient à l'hérité | Repris tel quel, sans modification de la logique |
| `rbac.spec.ts` | — | Matrice ADMIN/OPERATOR/PRINTER/VIEWER × ~15 actions |

### 6.4 Espace public / auth / participant (`e2e/public/*`)

> 4 specs existantes migrent vers `e2e/public/` et sont enrichies. La 5e (`badge-template-selection.spec.ts`) migre vers `e2e/event/` (action admin, voir 6.3).

| Spec | Parcours golden | Edge |
|---|---|---|
| `auth-register.spec.ts` (enrichit existant) | Création compte + verify email + login | Recaptcha invalide ; email taken ; token expiré ; rate limit |
| `auth-password-reset.spec.ts` (nouveau) | Forgot → mail → reset → login OK | Anti-enumeration (200 OK même si email inconnu) ; token expiré |
| `auth-setup-password.spec.ts` (nouveau) | Setup password via invite token (user créé par staff) | Token expiré, déjà consommé |
| `account-profile.spec.ts` (enrichit existant) | Édition profil avec uploads photo + document | Upload > 5 Mo ; format invalide ; BlockedDocument number |
| `event-register.spec.ts` (enrichit existant) | Inscription event complète (login → register → success) | Profil incomplet redirige ; déjà inscrit ; event archivé ; blocked email |
| `registration-resubmit.spec.ts` (enrichit existant) | Resubmit après rejet (profile edit + resubmit, mail) | Status non-REJECTED refuse ; multiple resubmits |
| `badge-public.spec.ts` (nouveau) | `/verify/[badgeId]` page publique ; `/badge/[id]` téléchargement (auth) | Registration non APPROVED ; catégorie anonyme masque infos |
| `security.spec.ts` (nouveau) | BlockedEmail empêche inscription ; rate limit `/api/auth/register` ; XSS sanitization profil | Captcha bypass impossible |

## 7. Décisions / arbitrages

| Décision | Pourquoi |
|---|---|
| Prisma direct dans helpers vs route `/api/test/*` | Pattern déjà en place ; pas de gain à abstraire derrière une API tant que Playwright tourne dans le container. |
| Une spec par domaine fonctionnel (vs par page) | Lisibilité ; parcours métier > test atomique. |
| Une spec dédiée RBAC par espace (vs assertions négatives dispersées) | Matrice RBAC lisible d'un coup d'œil ; pas de pollution des parcours golden. |
| `loginAs` via UI `/login` (vs cookie programmatique) | NextAuth credentials passe par `csrfToken` + `signin/credentials` ; le détour UI coûte ~500 ms mais évite de dupliquer la logique d'auth dans les helpers. À reconsidérer si la suite devient lente (> 5 min). |
| Conservation du suffixe `@v2-11-e2e.test` | Stabilité du cleanup existant ; ce n'est pas un marqueur de plan mais le marqueur conventionnel E2E v2. |
| Pas de Page Object Model | YAGNI ; les sélecteurs par accessible name (`getByRole`, `getByLabel`) restent stables et lisibles. |
| Scan testé via API uniquement | UI scan exige caméra → impossible en CI. |
| Pas de tests de migration | La v2 a abandonné toute migration v1→v2. |
| Cypress legacy conservé tel quel | Dossier `cypress/` vide ; ne pas y toucher. |

## 8. Critères de validation de la couverture

La couverture est considérée comme **complète** quand :

1. **Toutes les pages** (35) sont visitées par au moins un `test()` (en navigation ou en assertion d'accès).
2. **Toutes les routes API** mutatives (POST/PATCH/DELETE) ont au moins un test golden path et un test négatif RBAC.
3. **Tous les `ActivityType` du schéma** sont assertés au moins une fois.
4. **Tous les emails déclenchés** (8 templates identifiés) sont vérifiés via Mailpit au moins une fois.
5. **La checklist visuelle manuelle** a été cochée intégralement (sortie de release).

## 9. Annexes

Les inventaires détaillés produits par les agents d'exploration sont conservés dans l'historique du plan d'implémentation `../plans/2026-06-01-v2-13-e2e-coverage.md` (section « Inventaire de référence par task »).

## 10. Bugs détectés pendant l'implémentation des specs (2026-06-01)

Au-delà des 5 bugs initialement identifiés (corrigés en T00.1), l'écriture des 29 specs a fait remonter ~14 incohérences entre la spec attendue et le comportement réel du code v2. Elles sont listées ici pour arbitrage. Aucun fix n'a été appliqué — les specs valident le comportement réel observé, avec un commentaire inline pointant l'écart.

### 10.1 RBAC / permissions trop restrictives

| # | Bug | Route / fichier | Symptôme | Arbitrage |
|---|---|---|---|---|
| B1 | `GET /api/admin/[orgId]/activity` force `withOrgAuth("OWNER")` | `src/app/api/admin/[orgId]/activity/route.ts:6` | AUDITOR ne peut pas lire le journal d'activité de l'org alors que la matrice RBAC dit `Lire activity \| ✓ \| ✓ \| ✓` | Abaisser à `withOrgAuth("AUDITOR")` (6e bug du même type que T00.1) |
| B2 | `POST /api/admin/[orgId]/templates` réservé OWNER | `src/app/api/admin/[orgId]/templates/route.ts:23` | MANAGER ne peut pas créer un CategoryTemplate alors que la matrice dit `Créer CategoryTemplate \| ✓ \| ✓ \| ✗` | Abaisser à `withOrgAuth("MANAGER")` ou amender la matrice |
| B3 | `POST /approve` et `/reject` registration : `minRole: "ADMIN"` | `src/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/(approve\|reject)/route.ts` | OPERATOR ne peut pas approuver/rejeter alors que `EVENT_PERMISSION_ROLES["registration.approve"] = ["ADMIN", "OPERATOR"]` | Abaisser `minRole` à `"OPERATOR"` (la permission est déjà déclarée correctement, c'est le gate route qui est trop strict) |
| B4 | `GET /badges/[badgeId]` route fait `requireEventRole("VIEWER")` qui rejette PRINTER pur | `src/app/api/admin/[orgId]/events/[eventId]/badges/[badgeId]/route.tsx` | Hiérarchie partielle : PRINTER ne satisfait pas VIEWER. Le check 403 arrive avant la vérification de permission. PRINTER ne peut donc pas télécharger un PDF | Remplacer par `requireEventPermission("badge.print")` direct, sans gate VIEWER préalable |
| B5 | Routes `/registrations/print` exigent ADMIN | Routes batch + unitaire de print | PRINTER ne peut pas marquer un lot comme imprimé alors que c'est sa raison d'être | Abaisser à `minRole: "PRINTER"` (ou utiliser `requireEventPermission("badge.print")`) |
| B6 | `STAFF_ADMIN` peut modifier `smtpPassword` | `src/app/api/staff/settings/route.ts` | Le gate est `minRole: STAFF_ADMIN` sans restriction supplémentaire sur le champ ; la spec attend `SUPER_ADMIN_REQUIRED` pour les secrets | Ajouter une vérification par champ dans le handler PATCH (rejeter `smtpPassword`/`recaptchaSecretKey` si actor !== SUPER_ADMIN) |

### 10.2 UI / pages manquantes ou cassées

| # | Bug | Fichier | Symptôme | Arbitrage |
|---|---|---|---|---|
| B7 | `/staff/organizations/[orgId]` pas de form d'édition | `src/app/staff/organizations/[orgId]/page.tsx` | Page read-only seule ; pas de form pour modifier les infos. Le test passe via API direct | Ajouter un `OrgInfoForm` côté UI staff ; ou décider que l'édition n'est exposée que par le côté org owner |
| B8 | `/badge/[id]` page cassée | `src/app/badge/[id]/page.tsx` | La page fait `fetch('/api/verify/${id}')` mais cette route n'existe pas (seul `/api/public/verify/[badgeId]` existe). Page bloquée sur « Chargement… » | Soit créer `/api/verify/[id]`, soit corriger le fetch vers `/api/public/verify/[badgeId]`, soit créer une route participant authentifiée |
| B9 | `/verify/[badgeId]` (page server) ne log pas `BADGE_SCANNED` | `src/app/verify/[badgeId]/page.tsx` | Seul l'endpoint API `/api/public/verify/[badgeId]` logge. Si un humain visite le QR (cas typique), aucun scan audité | Ajouter un `logActivity` dans le server component ou rediriger / proxifier vers l'API |
| B10 | Layout `/admin/[orgId]` redirige MANAGER/AUDITOR vers `/select` | `src/app/admin/[orgId]/layout.tsx:29` | Le check d'accès n'autorise que OWNER ou staff. MANAGER/AUDITOR ne peuvent pas accéder aux pages admin par UI, seulement par API direct | Soit accepter `requireOrgRole(AUDITOR)` au niveau layout, soit rediriger ailleurs (vers une vue lecture seule) |
| B11 | Wizard event UI mutuellement exclusif | `src/components/event/EventCreationWizard.tsx` | L'API accepte `templateIds` + `manualCategories` ensemble, mais l'UI impose un toggle XOR. La spec demandait « 2 templates + 1 catégorie manuelle » dans le même wizard | Fusionner les deux modes en un seul écran, ou laisser l'UI restrictive et amender la spec |

### 10.3 Codes HTTP / sémantique

| # | Bug | Route | Symptôme | Arbitrage |
|---|---|---|---|---|
| B12 | Quota event registration renvoie **429** au lieu de 409 | `src/app/api/events/[slug]/register/route.ts:127` | Le code retourné `QUOTA_EXCEEDED` est correct mais le status HTTP 429 (Too Many Requests) est sémantiquement incorrect pour un quota dépassé | Passer en 409 (Conflict) ou 403 (Forbidden) |
| B13 | `BADGE_BATCH_PRINTED` jamais émis sur approve | `/api/admin/.../registrations/[regId]/approve/route.ts` | Approve n'imprime pas automatiquement le badge ; l'audit `BADGE_BATCH_PRINTED` est strictement réservé à `/registrations/print` (lot) | OK si c'est le design voulu ; sinon ajouter l'émission de l'audit à l'approve quand l'event a une option « auto-print ». À documenter dans la spec event |
| B14 | Print sur PENDING : skip silencieux | `/api/admin/.../registrations/print/route.ts` | La route filtre par `status: "APPROVED"` dans le `findMany`, donc une PENDING est ignorée silencieusement (`printed: 0`) au lieu de renvoyer un 409 explicite | Soit accepter (UX simple), soit renvoyer un 409 avec liste des IDs rejetés |

### 10.4 Helper E2E inconsistant

| # | Bug | Fichier | Symptôme | Arbitrage |
|---|---|---|---|---|
| B15 | `seedInviteToken` hashe le token alors que l'app cherche en clair | `e2e/helpers/db.ts:seedInviteToken` | Le helper stocke `hashToken(plain)` dans `user.inviteToken`, mais `/api/auth/setup-password` cherche `findUnique({ where: { inviteToken: token }})` en valeur claire (les autres flows d'invitation posent `randomBytes(...).toString("hex")` directement) | Soit corriger le helper pour stocker en clair, soit refactor `/api/auth/setup-password` pour hasher comme `verify-email`/`reset-password` (recommandé pour parité de sécurité). Bug contourné localement dans `e2e/public/auth-setup-password.spec.ts` via une fonction `seedPlainInviteToken` |
| B16 | `createTestEventMember` posait `OrgMembership AUDITOR` par défaut | `e2e/helpers/db.ts:createTestEventMember` (corrigé en cours d'impl T20-T25) | `effectiveEventRole` résout l'OrgMembership AVANT l'EventMembership, donc l'AUDITOR org écrasait silencieusement le rôle event (un OPERATOR/PRINTER devenait VIEWER effectivement) | **Déjà fixé** par l'agent G1 : ajout d'une option `attachOrgAuditor?: boolean` (défaut `false`). À valider que les autres specs (vague 2) ne dépendaient pas de l'ancien comportement implicite |

### 10.5 Priorité d'arbitrage

| Priorité | Bugs | Raison |
|---|---|---|
| **P0 (bloquant)** | B8 (`/badge/[id]` cassé), B15 (helper inviteToken) | Fonctionnalité utilisateur cassée / risque de confusion en exec Playwright |
| **P1 (bloquant pour T31)** | B1, B2, B3, B4, B5, B6 | RBAC mal aligné avec la matrice → tests rouges si on attend la matrice |
| **P2 (à documenter)** | B7, B9, B10, B11 | UI à compléter ou amendement de spec |
| **P3 (cosmétique)** | B12, B13, B14 | Sémantique HTTP / comportements implicites |

**Recommandation** : faire un commit `fix(v2): RBAC alignment + helpers (T00.1 round 2)` qui traite B1-B6 + B15 + B16 (déjà corrigé), avant d'exécuter Playwright pour T31. Les bugs P2/P3 peuvent être traités séparément (ou rester en backlog v3).
