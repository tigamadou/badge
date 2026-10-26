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

## Contrat « test UI » (strict)

1. **ZERO `page.request.*` dans une spec E2E.** Toute action testee passe par
   l'UI : `click`, `fill`, `check`, `selectOption`, `setInputFiles`. Le seed des
   **pre-conditions** via `helpers/db.ts` reste autorise ; les **assertions**
   via lecture DB (`getDb()`), Mailpit et audit (`expectLastActivity`) aussi.
2. **Parcours de connexion complet.** Utiliser `loginAndEnter` (`helpers/nav.ts`) :
   si l'utilisateur a **>= 2 espaces** (ex. `makeEventAdminUser` = OWNER org +
   ADMIN event), `/select` s'affiche et le test **clique la carte** ; s'il n'en a
   qu'un, la redirection est automatique. Dans les deux cas l'URL est assertee.
3. **Verifier l'URL a chaque etape** : `await expect(page).toHaveURL(...)` apres
   chaque navigation/action changeant de page. Une 404 attendue s'assert via son
   **rendu**, pas via `res.status()`.
4. **Naviguer via la nav du shell** (`OrgShell`/`EventShell`/`StaffShell`) plutot
   que par deep-link `goto`, chaque fois que la page de depart le permet.
5. **Chaque action assert sa REPONSE attendue — succes ET echec.**
   - *Succes* : feedback UI (message, ligne ajoutee/retiree, tag, redirection)
     **+** effet persistant (DB / mail / audit).
   - *Echec attendu* : le **message d'erreur affiche dans l'UI** (« Ce nom existe
     deja », « Impossible : dernier OWNER », « Adresse deja utilisee »...) **et**
     l'absence d'effet en base.
6. **Gardes de role -> assertion UI quand elle est observable** : bouton masque,
   entree de nav absente, redirection, ou message d'erreur apres soumission.
   Les codes HTTP purs **non atteignables par l'UI** sont couverts par
   l'integration Vitest — jamais par un `page.request` dans une spec UI.
7. **Hors-perimetre UI** : rate-limit (429), cookie de session efface/falsifie,
   log de l'endpoint public de scan. Ces tests vivent dans
   `transverse/securite.spec.ts`, explicitement etiquetes hors « test UI ».

## Tests transverses en viewport mobile

`transverse/responsive.spec.ts` rejoue des parcours en 375x812 (`isMobile`,
`hasTouch`) : tiroir de navigation, absence de debordement horizontal sur
quelques pages de chaque espace, deconnexion depuis le tiroir (modale dans le
viewport). Toute nouvelle page a fort contenu (tableau) peut y etre ajoutee.

## Definition of done d'une page-spec

1. **Aucun `page.request`.**
2. 1 test de rendu golden + les redirections d'acces, **URL assertee**.
3. 1 test par action UI de la page, **avec sa reponse attendue** (regle 5).
4. Les gardes de role exprimees en **etat UI** (bouton masque / redirection /
   message), pas en code HTTP.
5. Chaque garde-fou metier **qui s'affiche dans l'UI** (`LAST_OWNER`,
   `SLUG_TAKEN`, `NUMBER_TAKEN`, `CATEGORY_HAS_REGISTRATIONS`, `EVENT_LIMIT`,
   `SUBSCRIPTION_INACTIVE`, `BAD_TYPE`/`TOO_LARGE`, `UNKNOWN_TEMPLATE`,
   `LAST_SUPER_ADMIN`, `EMAIL_TAKEN`, `NAME_TAKEN`...) teste **via l'UI**.
6. Les etats vides.
7. Un `test.afterAll` de cleanup.
8. **Aucun `test.skip`/`test.fixme`** qui ne reference pas un bug applicatif
   ouvert. Un test ne s'adapte jamais pour masquer un defaut du code.

## Helpers

Reutiliser avant d'en creer (`e2e/helpers/`) :

- `auth.ts` — `loginAs`, `loginAsStaff`, `loginAsOrgMember`, `loginAsEventMember`.
  Preferer les variantes par role a `createTest* + loginAs` manuels.
- `db.ts` — seed Prisma direct (`createTestOrgWithOwner` accepte
  `activeSubscription: false` pour une org bloquee), `cleanupE2ETestData`.
- `audit.ts` — `expectLastActivity` / `expectNoActivity`.
- `mailpit.ts` — `mailpit.expectMail`. `pdf.ts` — `expectPdfResponse`.
- `feedback.ts` — `toast`, `countRequests`, `failWith500Html`, `abortNetwork`
  (toasts sonner, double clic, erreurs simulées).
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
