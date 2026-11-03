# Politique de tests - Badge v4

> Commandes et CI : [`installation.md`](../installation.md).

> **Pas de contournement** : un `test.skip`/`test.fixme` n'est admis que s'il
> reference un bug applicatif ouvert. Les trois contournements historiques
> (verify-email en self-fetch SSR, PRINTER refuse sur les badges, page orpheline
> `/badge/[id]`) ont ete **corriges cote code** avant la reorganisation des specs
> E2E — cf. plan `plans/2026-07-20-01-v4-fixes-bugs-pre-e2e.md`. Un test ne doit
> jamais etre adapte pour masquer un defaut applicatif.

La couverture est organisee en **trois couches complementaires**, chacune avec un
outil, un perimetre et un objectif de couverture propres.

## 1. Unitaire (Vitest) — logique metier `src/lib`

- **Outil** : Vitest 4 + `@vitest/coverage-v8`.
- **Perimetre** : `src/lib/**` (helpers d'autorisation, mail, storage, settings,
  subscription, validators, badge-templates, rendu compris).
- **Seuils = gate** : **100%** lignes / branches / fonctions / statements
  (`vitest.config.ts`). Un trou fait echouer `make test-coverage` et la CI.
- **Exclusions justifiees** (commentees dans `vitest.config.ts`) : `prisma.ts`
  (singleton trivial), assets binaires et fichiers type-only, wrapper `auth/[...nextauth]`
  (delegue a NextAuth ; logique dans `src/lib/auth.ts`, couverte a 100%).
- **Service de rendu des badges** : les tests Vitest n'appellent jamais le vrai service.
  `src/test-setup.ts` installe avant chaque test un **faux exporteur**
  (`src/lib/__tests__/helpers/fake-exporter.ts`, via `overrideExporter`) : `freeze` retire les
  scripts, `pdf` produit un PDF factice d'une page par page du document, `image` un PNG 1x1,
  `failNext(code)` fait echouer l'appel suivant (`UNAVAILABLE`, `TIMEOUT`, `RENDER_FAILED`).
  Le rendu reel est exerce par l'E2E (Playwright) et par `make db-seed`.
- Les **composants React** ne sont pas vises par l'unitaire : ils sont couverts par l'E2E.

## 2. Integration API (Vitest + vraie MySQL) — `src/app/api`

- **Perimetre** : les 76 routes `src/app/api/**/route.ts(x)` (+ `route.tsx` badges).
- **Seuils = gate** : **100%** lignes / branches / fonctions / statements.
- **Pas de mock de Prisma ni des regles metier** : les tests utilisent la **vraie
  MySQL de test** (`badge_test`) et seedent leurs fixtures via Prisma. Le reset global
  (`src/test-setup.ts`, `deleteMany` en `beforeEach`) garantit l'isolation.
  Exception ciblee toleree : `vi.spyOn(prisma.<model>, "<method>").mockRejectedValueOnce(...)`
  **mono-appel** (restaure aussitot) pour exercer les branches d'erreur defensives
  (`throw err` non-`AuthError` / non-`P2002`) inatteignables avec un flux DB normal.
- **Contrat minimal par route** : 1 golden path (2xx), 1 cas 401 (non authentifie),
  1 cas 403 par frontiere de role pertinente, 1 cas 400 (validation), 1 cas 404 le
  cas echeant, et l'assertion `logActivity` pour toute action sensible.
- **Secrets** : aucune reponse testee ne doit exposer hash bcrypt, `smtpPassword`,
  `recaptchaSecretKey`, ni token d'invitation/edition non hashe.

### Contrainte d'execution (base partagee)

`vitest.config.ts` fixe `fileParallelism: false` : les fichiers de test partagent
une **base MySQL unique** avec reset en `beforeEach`. Consequences :

- Ne **jamais** lancer deux runs Vitest en parallele.
- `make test` tourne sur la base `badge_test` : la base de dev (et son seed, `make db-seed` /
  `make db-seed-demo`) n'est pas touchee.

## 3. E2E (Playwright) — pages et interactions

- **Outil** : Playwright (chromium systeme dans le conteneur ; mode UI depuis l'hote).
- **Perimetre** : chaque page `src/app/**/page.tsx` a au moins 1 spec de rendu + 1 spec
  par interaction utilisateur (formulaire, bouton d'action, filtre, navigation), y
  compris etats vides et erreurs 403/404 en navigation.
- **Convention : UN FICHIER PAR PAGE**, nomme d'apres son segment de route —
  `e2e/<espace>/<page>.spec.ts` (espaces : `org`, `event`, `platform`, `public`,
  + `transverse` pour ce qui traverse tous les layouts). Chaque fichier est
  **auto-suffisant** : rendu, actions UI, gardes de role (positives ET negatives),
  garde-fous metier et etats limites de SA page y vivent. Les anciens fichiers
  transversaux (`pages-render`, `rbac`, `interactions`) ont ete **dissous** et
  redistribues ; le residu d'entree dans l'espace vit dans un `access.spec.ts`
  par espace. Detail complet : [`e2e/README.md`](../../../e2e/README.md).
- **Contrat « test UI » (fidelite, plan 2026-07-20-04)** :
  - **JAMAIS de `page.request.*` dans une spec UI.** Toute action passe par
    l'interface (`click`/`fill`/`check`/`selectOption`/`setInputFiles`). Le seed
    des pre-conditions via `db.ts` et les assertions via DB/Mailpit/audit restent
    autorises.
  - **Parcours de connexion complet** via `loginAndEnter` (`e2e/helpers/nav.ts`) :
    si l'utilisateur a >= 2 espaces (ex. OWNER org + ADMIN event) il passe par
    `/select` et clique la carte ; sinon redirection auto. On **verifie l'URL** a
    chaque etape (`toHaveURL`).
  - **Chaque action assert sa reponse** — succes (feedback UI + effet DB/mail/audit)
    ou echec (message d'erreur UI + absence d'effet).
  - **Gardes de role → assertion UI** (bouton masque, nav absente, redirection,
    message). Les 403/409/validation **sans surface UI** sont deportes en
    integration Vitest, jamais laisses en `page.request` dans une spec UI.
  - **Hors-perimetre UI** : securite/anti-abus sans parcours (rate-limit 429,
    cookie efface/falsifie) vivent dans `e2e/transverse/security.spec.ts`.
- Reutiliser `e2e/helpers/` (auth, db, mailpit, pdf, audit) et `e2e/fixtures/`
  avant d'en creer de nouveaux.
- Les tests E2E **seedent leurs propres fixtures** (via Prisma) et ne dependent pas
  du seed global.
- **Isolation de l'etat global** : une spec qui mute un etat partage (ex.
  `PlatformSettings`) doit en prendre un snapshot et le restaurer dans `afterAll`,
  sinon elle casse les specs suivantes.

## Matrice RBAC (frontieres a tester)

Les tests d'integration et E2E doivent couvrir les frontieres de role a chaque niveau.
Source d'autorite : `src/lib/auth.ts`, `src/lib/auth-helpers.ts`, `docs/v2/features/multi-tenancy-rbac.md`.

| Niveau | Roles (du + haut au + bas) | Note |
|---|---|---|
| Staff plateforme | `SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER` | v4 : `SUPER_ADMIN` a tous les droits (audit `staffActor=true`). |
| Organisation | `OWNER > MANAGER > AUDITOR` | Garde-fou dernier `OWNER` (`assertNotLastOwner`). |
| Evenement | `ADMIN > OPERATOR > {PRINTER, VIEWER}` | Permissions atomiques (`badge.print`, `event.settings.update`, ...) via `hasEventPermission`. |

Garde-fous metier a asserter : dernier `OWNER`, dernier `SUPER_ADMIN`, `SLUG_TAKEN`,
`NUMBER_TAKEN`, `CATEGORY_HAS_REGISTRATIONS`, limites d'abonnement
(`EVENT_LIMIT` / `PARTICIPANT_LIMIT`), emails/documents bloques, gate profil
(`PROFILE_NOT_APPROVED` a l'inscription 403 et a l'approbation 409).

Validation des profils (plan 08) — frontieres staff a tester :
`/api/platform/profiles*` (lecture `STAFF_OBSERVER`, decision `STAFF_SUPPORT+`) ;
`/api/platform/rejection-reasons*` (lecture `STAFF_OBSERVER`, ecriture
`STAFF_ADMIN+`). Rejet d'inscription sur motif catalogue : `REASON_WRONG_SCOPE`,
`REASON_NOT_FOUND`.

## Commandes

Voir [`installation.md`](../installation.md) > "Tests" (`make test`, `test-unit`,
`test-coverage`, `test-e2e`, `test-all`) et "Integration continue" (workflow
`.github/workflows/ci.yml`, protection de branche).
