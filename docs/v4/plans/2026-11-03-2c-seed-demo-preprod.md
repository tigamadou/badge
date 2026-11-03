# Vague 2 · Lot 2c — Préprod rechargée avec la démo — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2b, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2c feat/seed-demo`, branche `feat/seed-demo-2c`. Toutes les
> commandes `make` se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`.
> En exécution automatisée, un commit par tâche est autorisé sur la branche du plan ; sinon aucun
> commit sans demande explicite.

**Objectif :** à chaque déploiement préprod, remettre la base à zéro puis la remplir (seed minimal
+ seed de démo), avec une cible `make` équivalente à la main, et des tests de fumée adaptés ; le
chemin prod reste strictement inchangé.

**Architecture :** un service compose ponctuel `seed-demo` (profil `tools`, image `tools`) enchaîne
reset, nettoyage du préfixe `demo/` du stockage, seed minimal, seed de démo. `deploy.sh` l'appelle
uniquement quand `ENV=preprod`, app et worker arrêtés, avant leur relance. `make preprod-reload-demo`
(confirmation interactive) appelle le même service. `scripts/smoke-tests.ts` choisit ses
vérifications d'après `BADGE_ENV`.

**Spec :** [`specs/2026-11-03-37-v4-seed-de-demo.md`](../specs/2026-11-03-37-v4-seed-de-demo.md)
(« Précisions » et « Organisation du travail » font autorité). Socle :
[`2026-11-03-1-socle-seed-demo.md`](2026-11-03-1-socle-seed-demo.md).

## Amendements (relecture croisée de l'orchestrateur, 2026-11-03)

Le contrat du socle est figé dans `2026-11-03-1-socle-seed-demo.md` (« Contrats figés ») ; il prime
sur les hypothèses de ce plan :
- `SEED_MODE` : `minimal` | `demo` | `super-admin` ; le service `init` (prod et préprod) appelle déjà
  `SEED_MODE=super-admin` (socle) ; `prisma/seed-super-admin.ts` est supprimé.
- Le nettoyage du stockage de démo (préfixe `demo/` **et** clés suivies du manifeste
  `demo/_tracked-keys.json`) est fait par le seed de démo lui-même : ne pas le dupliquer.
- Compte staff de démo vérifié par les tests de fumée préprod : le premier compte staff de
  `DEMO_BADGE_LOCAL_EMAILS` (`prisma/seed/constants.ts`).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Aligner sur le contrat du socle, vérifier l'image `tools` | [ ] | | |
| 2 | Service `seed-demo`, cible `make preprod-reload-demo`, commentaires du Makefile | [ ] | | |
| 3 | `deploy.sh` : chemin préprod + test shell | [ ] | | |
| 4 | Tests de fumée selon `BADGE_ENV` | [ ] | | |
| 5 | Documentation | [ ] | | |
| 6 | Vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables : `deploy.sh`, `docker-compose.preprod.yml`, `Makefile`, `scripts/smoke-tests.ts`,
`scripts/__tests__/smoke-tests.test.ts`, `scripts/__tests__/deploy-sh.test.ts` (nouveau),
`DEPLOYMENT.md`, `docs/v4/installation.md` (section préprod uniquement).
**En lecture seule** : `prisma/seed.ts`, `prisma/seed/**`, `prisma/seed-super-admin.ts`,
`src/lib/badge-env.ts`, `docker-compose.yml`, `Dockerfile*`, `.github/workflows/**`. Besoin d'y
toucher → s'arrêter et le signaler.

## Global Constraints

- Tests (CLAUDE.md « Règles de test ») : base `_test` uniquement, pas de mock de Prisma, données
  via `src/test/factories.ts` (graine fixe par fichier) ; ne jamais modifier le code de production
  pour faire passer un test.
- **Jamais de SSH, jamais de déploiement, aucune action sur un serveur distant.** Tout se vérifie
  en local : `sh -n`, `docker` simulé par un faux binaire dans les tests, séquence préprod rejouée
  contre la stack locale du worktree avec `BADGE_ENV=preprod`.
- **Chemin prod inchangé** : pour `ENV=prod`, `deploy.sh` exécute exactement les mêmes commandes
  qu'avant (vérifié par test) ; `docker-compose.yml` n'est pas touché.
- Pas de `make db-reset`, `prod-*` ni `--force-reset` contre la base de dev du worktree : la
  séquence de reset ne se rejoue que sur la base de la stack du lot (`badge_2c`).
- Smoke tests en `prod` : « 0 organisation / 0 évènement » inchangés.
- Messages de commit en français ASCII, conventional commits, sans mention d'IA.

## Review Focus

- `ENV=prod` : aucune commande en plus ni en moins, même ordre (test sur le journal du faux `docker`).
- `BADGE_ENV` absent ou inconnu dans les smoke tests : échec explicite, jamais un repli silencieux
  sur les contrôles préprod.
- Échec du reset ou d'un seed en préprod : `deploy.sh` s'arrête (`set -e`) et ne relance pas
  `app`/`worker` sur une base à moitié remplie.
- La cible `make` refuse sans « yes » et n'agit que sur le projet compose `badge-preprod`.
- Le nettoyage du stockage ne touche que le préfixe `demo/` (jamais `orgs/`, `print-sheets/`…).

---

### Task 1: Aligner sur le contrat du socle, vérifier l'image `tools`

**Files:** aucun fichier modifié (notes dans la table de progression).

- [ ] **Step 1 :** lire `src/lib/badge-env.ts` (exports exacts : lecture de `BADGE_ENV`, type
  `BadgeEnv`), `prisma/seed.ts` (sélection par `SEED_MODE`), `prisma/seed/demo/index.ts` et
  `context.ts` (constantes exportées : email du compte staff de démo principal, domaine
  `@demo.local`, préfixe des organisations/slugs `demo-`, préfixe de stockage `demo/` et son
  nettoyage éventuel), `docker-compose.preprod.yml` (`BADGE_ENV: preprod` posé). Si le plan du
  socle existe, le comparer au code ; s'il diffère de ce plan 2c, adapter les noms ci-dessous et
  noter l'écart.
- [ ] **Step 2 :** noter dans « Notes » les valeurs retenues : (a) commande du seed minimal et du
  seed de démo (attendu : `yarn tsx prisma/seed.ts` et `SEED_MODE=demo yarn tsx prisma/seed.ts`) ;
  (b) email du staff de démo principal ; (c) critère « organisation de démo » (attendu : slug
  commençant par `demo-`) ; (d) si le seed de démo vide lui-même le préfixe `demo/`.
- [ ] **Step 3 :** vérifier l'image `tools` (stage `builder` du `Dockerfile`, lecture seule) :
  `yarn install` complet sans `--production`, donc `tsx` et `@faker-js/faker` (devDependencies)
  et `pdf-lib` (dependencies) sont présents ; `COPY . .` embarque `prisma/` et `scripts/` sauf
  exclusion dans `.dockerignore`. Vérifier `.dockerignore` et que `prisma/seed/` n'y est pas exclu.
  **Si l'un manque : s'arrêter, statut NEEDS_CONTEXT, signaler (modifier le Dockerfile est une
  décision à remonter).**

### Task 2: Service `seed-demo`, cible `make`, commentaires du Makefile

**Files:** Modify `docker-compose.preprod.yml`, `Makefile`.

**Interfaces — Produces :** service compose `seed-demo` (profil `tools`) ; cible
`preprod-reload-demo`, appelée aussi par la doc (Task 5).

- [ ] **Step 1 :** dans `docker-compose.preprod.yml`, ajouter le service `seed-demo` à côté de
  `tools` : même image, `env_file`, `environment` (dont `RENDERER_URL`), réseaux `default` et
  `rendu`, `restart: "no"`, `profiles: ["tools"]`, `depends_on` mysql, renderer **et rustfs**
  (`service_healthy`). Commande `sh -c` en chaîne `&&`, dans cet ordre : `npx prisma db push
  --force-reset --accept-data-loss` ; nettoyage du préfixe de stockage `demo/` via
  `yarn tsx -e` appelant `deletePrefix("demo/")` de `src/lib/storage.ts` (omis si Task 1 (d)
  montre que le seed de démo le fait déjà) ; seed minimal ; seed de démo. Commentaire d'en-tête :
  destructif, préprod seulement, lancé par `deploy.sh` ou `make preprod-reload-demo`.
- [ ] **Step 2 :** dans le `Makefile`, ajouter `preprod-reload-demo` (et dans `.PHONY`), calquée sur
  `preprod-db-reset` : avertissement « ERASE all PREPROD data », confirmation `yes`, puis
  `$(PREPROD_COMPOSE) stop app worker`, `$(PREPROD_COMPOSE) run --rm seed-demo`,
  `$(PREPROD_COMPOSE) up -d app worker`. Aucun `docker exec` sur un conteneur de prod.
- [ ] **Step 3 :** commentaires du Makefile : `db-seed-demo` n'est plus « reservé au dev local /
  smoke test 0 org » mais « dev et preprod, refuse en prod (`BADGE_ENV`) » ; `preprod-db-reset`
  renvoie à `preprod-reload-demo` ; `smoke-tests-preprod` précise qu'il attend la démo.
- [ ] **Step 4 :** valider : `docker compose -f docker-compose.preprod.yml --profile tools config
  --quiet` (avec un `.env.preprod` factice hors dépôt si besoin, jamais committé) et
  `make -n preprod-reload-demo` (confirmation non simulée : lire la sortie).

### Task 3: `deploy.sh` — chemin préprod + test shell

**Files:** Modify `deploy.sh` ; Create `scripts/__tests__/deploy-sh.test.ts`.

**Interfaces — Consumes :** service `seed-demo` (Task 2).

- [ ] **Step 1 : test d'abord** (`deploy-sh.test.ts`, Vitest, `child_process`). Le test crée un
  répertoire temporaire servant de `HOME` avec `~/<env>/badge/`, un faux `docker` en tête du
  `PATH` (script `sh` qui ajoute `"$@"` à un fichier journal et sort 0), puis lance `sh deploy.sh
  <env> sha-test`. Cas :
  1. `sh -n deploy.sh` réussit ;
  2. `ENV=prod` : le journal est **exactement** `compose pull renderer app tools`,
     `compose up -d --no-deps renderer init app worker`, `image prune -f` (valeurs figées dans le
     test = commandes d'origine, sans `-f docker-compose.preprod.yml` ni `seed-demo`) ;
  3. `ENV=preprod` : le journal contient `-f docker-compose.preprod.yml stop app worker`, puis
     `... run --rm seed-demo`, puis `... up -d --no-deps renderer init app worker`, dans cet
     ordre, et `seed-demo` apparaît après `pull` et avant le `up` final ;
  4. `ENV=preprod` avec un faux `docker` qui échoue (code 1) sur `seed-demo` : `deploy.sh` sort
     non-zéro et le journal ne contient aucun `up -d` après l'échec.
- [ ] **Step 2 :** lancer le test : cas 3 et 4 en échec, cas 1 et 2 verts (le prod existant).
- [ ] **Step 3 :** dans `deploy.sh`, après le `pull` (étape 1) et avant l'étape 2, ajouter un bloc
  conditionnel `if [ "$ENV" = "preprod" ]; then ... fi` : message, `docker compose $F stop app
  worker`, `docker compose $F run --rm seed-demo`. L'étape 2 (`up -d --no-deps renderer init app
  worker`) reste inchangée et s'exécute ensuite pour les deux environnements (`init` repasse
  `db push` sur la base déjà au schéma : sans effet). Ne modifier aucune autre ligne.
- [ ] **Step 4 :** relancer : 4 cas verts. `git diff deploy.sh` ne montre que l'ajout du bloc.

### Task 4: Tests de fumée selon `BADGE_ENV`

**Files:** Modify `scripts/smoke-tests.ts`, `scripts/__tests__/smoke-tests.test.ts`.

**Interfaces — Produces :** `export async function dataChecks(prisma: PrismaClient, env:
BadgeEnv): Promise<CheckResult[]>` (types alignés sur `badge-env.ts`, Task 1) ; `runChecks`
l'appelle et lit l'environnement via la fonction de `src/lib/badge-env.ts`.

- [ ] **Step 1 : tests d'abord** (base `_test`, fabriques, nettoyage de ce que le test crée) :
  - `prod` avec une organisation en base → un résultat `ok: false` ; sans organisation ni
    évènement → tout `ok` ;
  - `preprod` sans organisation de démo → `ok: false` ; avec une organisation de démo (critère
    Task 1 (c)) et le staff de démo principal (email Task 1 (b)) → tout `ok` ; staff principal
    absent → `ok: false` ; une organisation non démo seule ne suffit pas ;
  - `preprod` : aucune vérification « 0 organisation / 0 évènement » n'apparaît dans les noms ;
  - environnement absent ou inconnu → erreur explicite (message nommant `BADGE_ENV`), pas de repli.
- [ ] **Step 2 :** lancer : échec attendu (`dataChecks` non défini).
- [ ] **Step 3 :** extraire de `runChecks` les contrôles dépendants de l'environnement dans
  `dataChecks` : `prod` = les deux contrôles actuels (messages inchangés) ; `preprod` = « au moins un
  staff » (déjà commun, conservé), « au moins une organisation de démo », « compte staff de démo
  principal présent ». Les contrôles communs (SELECT 1, PlatformSettings, staff, HTTP) restent
  dans `runChecks`. Un environnement `dev` utilise les contrôles préprod.
- [ ] **Step 4 :** relancer : tests verts, helpers existants (`assert`, `SmokeError`) inchangés.

### Task 5: Documentation

**Files:** Modify `DEPLOYMENT.md`, `docs/v4/installation.md`.

- [ ] **Step 1 :** `DEPLOYMENT.md` : nouvelle section « Préprod rechargée à chaque déploiement » —
  séquence (pull, arrêt `app`/`worker`, `seed-demo` : reset + nettoyage `demo/` + seed minimal +
  seed de démo, relance) ; **destructif : toute donnée saisie à la main en préprod est perdue à
  chaque déploiement** ; la prod n'est pas concernée (garde-fou `BADGE_ENV`) ; mot de passe commun
  de démo et SUPER_ADMIN de `SEED_SUPER_ADMIN_*` ; cible `make preprod-reload-demo` ; fichiers à
  recopier : `deploy.sh`, `docker-compose.preprod.yml` ; smoke tests selon `BADGE_ENV`
  (`make smoke-tests-preprod`). Corriger la section `init` (« préprod : voir ci-dessous »).
- [ ] **Step 2 :** `docs/v4/installation.md` : ajouter une courte section « Préprod : démo
  rechargée » (renvoi à `DEPLOYMENT.md`, cible `make`, `BADGE_ENV=preprod`, comptes de démo
  `*@demo.local` et fichier de comptes selon le socle) ; ne pas toucher aux parties dev (socle).
- [ ] **Step 3 :** relire les deux fichiers : aucune commande documentée n'est inexistante
  (`grep` des cibles dans le `Makefile`).

### Task 6: Vérification

- [ ] **Step 1 :** `make lint && make typecheck && make test-coverage` verts (gates 100 % inchangés ;
  `scripts/` hors périmètre de couverture mais ses tests tournent).
- [ ] **Step 2 :** `sh -n deploy.sh` ; `docker compose -f docker-compose.preprod.yml --profile tools
  config --quiet` ; `git diff -- deploy.sh docker-compose.yml` : seul le bloc préprod est ajouté,
  `docker-compose.yml` intact.
- [ ] **Step 3 : séquence préprod rejouée en local** (jamais en dehors de la stack du lot, base
  `badge_2c`) : dans le worktree, avec `BADGE_ENV=preprod` et le `DATABASE_URL` de la stack,
  exécuter dans l'ordre les commandes de `seed-demo` — `npx prisma db push --force-reset
  --accept-data-loss`, nettoyage `demo/` (stockage de dev), `yarn tsx prisma/seed.ts`,
  `SEED_MODE=demo yarn tsx prisma/seed.ts` — puis `BADGE_ENV=preprod BASE_URL=<app de la stack>
  yarn tsx scripts/smoke-tests.ts` : tout `OK`. Relever la durée. Rejouer avec `BADGE_ENV=prod` : le
  seed de démo refuse (garde-fou du socle) ; `BADGE_ENV` absent : smoke tests en erreur explicite.
- [ ] **Step 4 :** mettre à jour la table de progression (statuts, dates, durée mesurée, écarts du
  socle). Ne rien déployer, ne rien pousser.
