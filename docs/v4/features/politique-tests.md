# Politique de tests - Badge v4

> Commandes et CI : [`installation.md`](../installation.md).

La couverture est organisee en **trois couches complementaires**, chacune avec un
outil, un perimetre et un objectif de couverture propres.

## 1. Unitaire (Vitest) — logique metier `src/lib`

- **Outil** : Vitest 4 + `@vitest/coverage-v8`.
- **Perimetre** : `src/lib/**` (helpers d'autorisation, mail, storage, settings,
  subscription, validators, badge-templates hors rendu React-PDF).
- **Seuils = gate** : **100%** lignes / branches / fonctions / statements
  (`vitest.config.ts`). Un trou fait echouer `make test-coverage` et la CI.
- **Exclusions justifiees** (commentees dans `vitest.config.ts`) : `prisma.ts`
  (singleton trivial), assets binaires et fichiers type-only, templates React-PDF
  (`template.tsx`, couverts par `build-context` + E2E), wrapper `auth/[...nextauth]`
  (delegue a NextAuth ; logique dans `src/lib/auth.ts`, couverte a 100%).
- Les **composants React** ne sont pas vises par l'unitaire : ils sont couverts par l'E2E.

## 2. Integration API (Vitest + vraie MySQL) — `src/app/api`

- **Perimetre** : les 76 routes `src/app/api/**/route.ts(x)` (+ `route.tsx` badges).
- **Seuils = gate** : **100%** lignes / branches / fonctions / statements.
- **Pas de mock de Prisma ni des regles metier** : les tests utilisent la **vraie
  MySQL de dev** et seedent leurs fixtures via Prisma. Le reset global
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
- Chaque `make test` **vide la base de dev** -> relancer `make db-seed` pour l'app manuelle.

## 3. E2E (Playwright) — pages et interactions

- **Outil** : Playwright (chromium systeme dans le conteneur ; mode UI depuis l'hote).
- **Perimetre** : chaque page `src/app/**/page.tsx` a au moins 1 spec de rendu + 1 spec
  par interaction utilisateur (formulaire, bouton d'action, filtre, navigation), y
  compris etats vides et erreurs 403/404 en navigation.
- **Convention** : 1 fichier spec par page ou groupe coherent, dans
  `e2e/{public,account,org,event,platform,transverse}/`. Reutiliser `e2e/helpers/`
  (auth, db, mailpit, pdf, audit) et `e2e/fixtures/` avant d'en creer de nouveaux.
- Les tests E2E **seedent leurs propres fixtures** (via Prisma) et ne dependent pas
  du seed global.

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
(`EVENT_LIMIT` / `PARTICIPANT_LIMIT`), emails/documents bloques.

## Commandes

Voir [`installation.md`](../installation.md) > "Tests" (`make test`, `test-unit`,
`test-coverage`, `test-e2e`, `test-all`) et "Integration continue" (workflow
`.github/workflows/ci.yml`, protection de branche).
