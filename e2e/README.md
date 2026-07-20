# Tests E2E (Playwright) — convention

> Plan de reference : [`docs/v4/plans/2026-07-20-03-v4-e2e-reorg-par-page.md`](../docs/v4/plans/2026-07-20-03-v4-e2e-reorg-par-page.md).

## Structure : un fichier par page

Un fichier de specs par **page** de l'application, nomme d'apres son segment de
route : `e2e/<espace>/<page>.spec.ts`. Espaces : `org`, `event`, `platform`,
`public` (+ `transverse` pour ce qui traverse tous les layouts, ex. deconnexion).

Chaque fichier est **auto-suffisant** : tout ce qui concerne la page y vit. Les
anciens fichiers transversaux (`pages-render.spec.ts`, `rbac.spec.ts`,
`interactions.spec.ts`) sont **dissous** et leur contenu redistribue par page.
Le residu strictement transverse (gates de layout : non-connecte -> login,
mauvais espace -> redirection, ressource introuvable -> 404) va dans un
`access.spec.ts` par espace.

Un seul `describe` par fichier, nomme d'apres la page (ex. `Org — Membres`).

## Sections d'un fichier

Dans cet ordre :

1. **Acces & rendu** — le role autorise voit la page ; redirections d'acces.
2. **Actions UI** — une action = un test, via l'interaction reelle.
3. **Etats** — vide, garde-fous visibles (ex. bouton masque), erreurs affichees.
4. **Gardes & API** — ce que l'UI ne peut pas declencher.

## Regle UI-first, API pour l'inatteignable

Toute action disposant d'une UI se teste **via le clic / le formulaire reel**.
On passe par `page.request.*` uniquement pour ce que l'UI ne peut pas produire :

- codes d'erreur par role (403), garde-fous metier (409), validation (400),
  limites d'upload (413/415) ;
- endpoints **sans surface UI**.

Les endpoints sans page (ex. blocklist plateforme) restent couverts par les
tests d'integration Vitest : **ne pas** creer de spec E2E pour eux, et ne pas
supposer silencieusement leur couverture.

## Definition of done d'une page-spec

1. 1 test de rendu golden + les redirections d'acces.
2. 1 test par action UI listee pour la page.
3. Au moins 1 negatif de role (role insuffisant -> 403 / redirection).
4. Chaque garde-fou metier de la page (`LAST_OWNER`, `SLUG_TAKEN`,
   `NUMBER_TAKEN`, `CATEGORY_HAS_REGISTRATIONS`, `EVENT_LIMIT`,
   `SUBSCRIPTION_INACTIVE`, `BAD_TYPE`/`TOO_LARGE`, `UNKNOWN_TEMPLATE`,
   `LAST_SUPER_ADMIN`, `EMAIL_TAKEN`, `NAME_TAKEN`...).
5. Les etats vides.
6. Un `test.afterAll` de cleanup.
7. **Aucun `test.skip`/`test.fixme`** qui ne reference pas un bug applicatif
   ouvert. Un test ne s'adapte jamais pour masquer un defaut du code.

## Helpers

Reutiliser avant d'en creer (`e2e/helpers/`) :

- `auth.ts` — `loginAs`, `loginAsStaff`, `loginAsOrgMember`, `loginAsEventMember`.
  Preferer les variantes par role a `createTest* + loginAs` manuels.
- `db.ts` — seed Prisma direct (`createTestOrgWithOwner` accepte
  `activeSubscription: false` pour une org bloquee), `cleanupE2ETestData`.
- `audit.ts` — `expectLastActivity` / `expectNoActivity`.
- `mailpit.ts` — `mailpit.expectMail`. `pdf.ts` — `expectPdfResponse`.
- `fixtures/` — `ensureFixtures()` (jpeg, pdf, txt, fichier > 5 Mo).

## Conventions d'execution

- `workers: 1` (execution sequentielle) : les specs partagent la MySQL de dev.
- Emails de test suffixes `@v2-11-e2e.test`, slugs prefixes `e2e-` : c'est la
  base du cleanup global. Chaque fichier appelle `cleanupE2ETestData()` +
  `disconnectDb()` dans `test.afterAll`.
- Locale `fr-FR` : les selecteurs `getByRole`/`getByLabel` dependent des
  libelles francais de l'UI.

## Commandes

- Dans le conteneur : `make test-e2e`
- Mode UI depuis l'hote : `make test-e2e-ui`
- Un fichier : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/<espace>/<page>.spec.ts`
