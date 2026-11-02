# Vague 0 — Règles de test du projet et stacks d'agents — Plan d'implémentation

> **Exécution :** séquentielle, dans le dossier principal, avant toute autre vague. Sous-skill :
> `superpowers:executing-plans`. Aucun commit sans demande explicite de l'utilisateur.
> `Makefile`, `docker-compose*.yml` et `Dockerfile*` sont des **actions à risque** du projet :
> présenter chaque diff de ces fichiers à l'utilisateur avant de l'appliquer.

**Objectif :**
1. **Pour tout le projet** : les tests Vitest tournent sur une base de test dédiée
   (`badge_test`), protégée par un garde-fou ; la base de dev n'est plus vidée ; des fabriques
   de données (`@faker-js/faker`) écrivant dans la vraie base deviennent la norme des nouveaux
   tests.
2. **Pour les agents** : une stack légère par worktree (app, worker, Mailpit), qui partage le
   MySQL, le RustFS et le renderer de la stack principale.

**Architecture :** une variable `DEV_COMPOSE` dans le `Makefile` (surchargée par un `.agent.env`
local) ; une cible `test-db` qui crée et met au schéma la base de test ; une surcouche
`docker-compose.agent.yml` qui désactive MySQL, RustFS, renderer, Caddy et phpMyAdmin pour
l'agent, branche app et worker sur les services partagés (MySQL et RustFS par les ports publiés
de l'hôte, renderer par le réseau externe `badge_rendu`) et remplace Mailpit par un service
`agent-mailpit` ; un script `scripts/agent-stack.sh` qui crée worktree, branche et stack.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md) (décisions 14 à 17)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | `DEV_COMPOSE` et `.agent.env` dans le Makefile | [ ] | | |
| 2 | Base de test dédiée + garde-fou (tout le projet) | [ ] | | |
| 3 | Fabriques de données de test | [ ] | | |
| 4 | Surcouche `docker-compose.agent.yml` | [ ] | | |
| 5 | Script `scripts/agent-stack.sh` | [ ] | | |
| 6 | Preuve : stack principale + 2 stacks d'agents | [ ] | | |
| 7 | Documentation et règles (CLAUDE.md, installation) | [ ] | | |

## Global Constraints

- Sans `.agent.env`, les commandes `make` de dev gardent leur comportement, sauf les cibles de
  test, qui visent désormais `badge_test`.
- Base de test : `<base de dev>_test` (`badge_test` pour la stack principale,
  `badge_<lot>_test` pour un agent). Base de dev d'un agent : `badge_<lot>`.
- Garde-fou : la configuration de test lève une erreur explicite si le nom de la base de
  `DATABASE_URL` ne finit pas par `_test`.
- Pas de mock de Prisma ni du MySQL : les fabriques écrivent dans la vraie base de test.
- Agents : 3 stacks au plus ; port de l'app dans 3790–3799 (seul port publié, lié à
  `127.0.0.1`) ; bucket `badge-<lot>` ; la stack principale doit tourner.
- L'agent ne rejoint **pas** le réseau par défaut de la stack principale (le Caddy principal y
  résout `app`). Hôte des services partagés : `host.docker.internal` (avec
  `extra_hosts: host-gateway` pour Linux).
- `.agent.env` est ignoré par git.

## Review Focus

- Aucun chemin ne peut faire tourner Vitest sur la base de dev (principale ou d'agent) : vérifier
  `make test`, `make test-unit`, `make test-coverage`, `yarn vitest` lancé à la main.
- Le Caddy principal sert toujours la stack principale quand des agents tournent.
- `make test` d'un agent ne touche ni `badge`, ni `badge_test`, ni la base d'un autre agent.
- Les e2e d'un agent vident **son** Mailpit, jamais celui de la stack principale.
- La première exécution sur un poste neuf (base de test absente) fonctionne sans étape manuelle.

---

### Task 1: `DEV_COMPOSE`

**Files:** Modify `Makefile`, `.gitignore`

- [ ] En tête : `-include .agent.env` puis `DEV_COMPOSE ?= docker compose -f docker-compose.dev.yml`.
- [ ] Remplacer les 35 occurrences de `docker compose -f docker-compose.dev.yml` par
  `$(DEV_COMPOSE)` ; les cibles prod et preprod gardent leurs variables.
- [ ] `.gitignore` : `.agent.env`.
- [ ] Vérifier `make -n dev` identique à avant sans `.agent.env`.

### Task 2: Base de test dédiée et garde-fou

**Files:** Modify `Makefile`, `src/test-setup.ts`, `vitest.config.ts` si besoin ; Create un test du
garde-fou (fonction pure `assertTestDatabase(url: string): void` dans `src/test-guard.ts`,
testée dans `src/lib/__tests__/test-guard.test.ts` ou équivalent).

- [ ] Variable `TEST_DATABASE_URL` dérivée de la base de dev (`…/badge` → `…/badge_test` ;
  `…/badge_2a` → `…/badge_2a_test`), surchargeable.
- [ ] Cible `test-db` : crée la base si absente (`CREATE DATABASE IF NOT EXISTS`) et applique le
  schéma (`prisma db push --skip-generate`) avec `DATABASE_URL=$(TEST_DATABASE_URL)`.
- [ ] `test`, `test-unit`, `test-coverage` : dépendent de `test-db`, s'exécutent dans un
  conteneur éphémère `$(DEV_COMPOSE) run --rm --no-deps -e DATABASE_URL=$(TEST_DATABASE_URL) app yarn vitest …`
  (pas besoin du serveur Next) ; **plus d'arrêt ni de relance du worker**.
- [ ] `src/test-setup.ts` appelle `assertTestDatabase(process.env.DATABASE_URL)` avant tout
  `beforeEach`. Tests du garde-fou : `…/badge` refusé, `…/badge_2a` refusé, `…/badge_test` et
  `…/badge_2a_test` acceptés, URL absente refusée.
- [ ] Vérifier : `make db-seed-demo`, `make test` complet, puis les données de démo de la base de
  dev sont intactes (compter les organisations avant / après).

### Task 3: Fabriques de données

**Files:** `package.json` (`@faker-js/faker` en devDependency), Create `src/test/factories.ts` ;
Test `src/test/__tests__/factories.test.ts`

- [ ] Fabriques minimales, chacune écrivant dans la base via Prisma et acceptant des
  surcharges : `makeUser`, `makeStaff(role)`, `makeOrg`, `makeEvent(orgId)`,
  `makeCategory(eventId)`, `makeRegistration(eventId, categoryId, status)`,
  `makeInstalledTemplate({ pages })`, `makePrintLayout`, `makePrintOrder({ eventId, status, type })`.
  Données réalistes et uniques (faker + suffixe), graine fixée par fichier
  (`faker.seed`) pour des tests reproductibles.
- [ ] Les tests existants **ne sont pas réécrits** ; la règle s'applique aux nouveaux tests
  (vagues 1 et 2 comprises).

### Task 4: Surcouche agent

**Files:** Create `docker-compose.agent.yml`

- [ ] `mysql`, `rustfs`, `renderer`, `caddy`, `phpmyadmin`, `mailpit` : `profiles: ["manual"]`
  (non démarrés).
- [ ] Nouveau service `agent-mailpit` (image Mailpit, sans port publié).
- [ ] `app` et `worker` : `depends_on: !reset {}` ; `ports` de l'app :
  `!override ["127.0.0.1:${AGENT_APP_PORT}:3000"]` ; `extra_hosts: ["host.docker.internal:host-gateway"]` ;
  `environment` : `DATABASE_URL=mysql://root:password@host.docker.internal:33060/badge_${AGENT_LOT}`,
  `S3_ENDPOINT=http://host.docker.internal:9000`, `S3_BUCKET=badge-${AGENT_LOT}`,
  `PLATFORM_SMTP_HOST=agent-mailpit`, `NEXTAUTH_URL=http://localhost:${AGENT_APP_PORT}`,
  `RENDERER_URL=http://renderer:3000` ; réseaux : `default` (du projet de l'agent) et
  `rendu` déclaré `external: true, name: badge_rendu`.
- [ ] Image `app` : même nom d'image que la stack principale (pas de rebuild par agent) ;
  cache Yarn dans un volume nommé partagé (`badge_yarn_cache`, externe).
- [ ] e2e de l'agent : `MAILPIT_URL` du helper pointe vers `http://agent-mailpit:8025` (variable
  d'environnement lue par `e2e/helpers/mailpit.ts`, à introduire si absente).
- [ ] Vérifier `docker compose -p badge-2a -f docker-compose.dev.yml -f docker-compose.agent.yml config` :
  seuls `app`, `worker`, `agent-mailpit` ; un seul port publié.

### Task 5: Script `scripts/agent-stack.sh`

**Files:** Create `scripts/agent-stack.sh` (exécutable)

Usage : `scripts/agent-stack.sh up <lot> <branche-base>` | `down <lot>` | `status`.

- [ ] Préalables vérifiés : stack principale démarrée (MySQL et RustFS sains, renderer présent),
  `NPM_TOKEN` dans `.env`, moins de 3 stacks d'agents, mémoire Docker disponible
  (avertissement sous 3 Go libres).
- [ ] `up` : worktree `../badge-wt-<lot>` sur `feat/commandes-impression-<lot>` (depuis
  `<branche-base>`) ; copie de `.env` ; premier port libre de 3790–3799 ; écriture de
  `.agent.env` (`AGENT_LOT`, `AGENT_APP_PORT`, `DEV_COMPOSE = docker compose -p badge-<lot> -f docker-compose.dev.yml -f docker-compose.agent.yml`) ;
  création des bases `badge_<lot>` et `badge_<lot>_test` ; dans le worktree : `make dev`,
  installation de Chromium pour les e2e (commande actuelle de `test-e2e`), `make db-push`,
  `make db-seed`, `make test-db`. Affiche le worktree et `http://localhost:<port>`.
- [ ] `down` : arrêt et suppression des conteneurs et volumes **du projet de l'agent** ; ne
  supprime ni le worktree, ni la branche, ni ses bases (proposer la commande de suppression des
  bases et du bucket, à lancer après fusion).
- [ ] `status` : stacks d'agents, port, worktree, bases.

### Task 6: Preuve

- [ ] Stack principale démarrée avec le seed démo. `up demo1` et `up demo2` depuis
  `feat/commandes-impression`. En parallèle : `make test` complet dans chaque worktree et dans le
  dossier principal ; `make test-e2e FILE=e2e/platform/settings.spec.ts` (utilise Mailpit) dans
  chaque worktree.
- [ ] Contrôles : tous verts ; organisations de démo de la base `badge` intactes ;
  `https://badge.local` sert toujours la stack principale ; `docker stats` (noter la RAM par
  stack d'agent dans la Progression).
- [ ] `down demo1`, `down demo2`, puis suppression des worktrees, branches, bases et buckets de
  démonstration **après accord de l'utilisateur**.

### Task 7: Documentation et règles

**Files:** Modify `CLAUDE.md` (sections Environnement d'exécution et règles de test),
`.claude/CLAUDE.md` (section 4 si besoin), `docs/v4/installation.md`

- [ ] Les règles sont déjà dans `CLAUDE.md` (section « Règles de test ») : retirer la mention
  « tant qu'elle n'est pas terminée » une fois la vague livrée, et ajuster les commandes de la
  section « Environnement d'exécution » (`make test-db`, `make test` ne vide plus la base de dev).
- [ ] Section « Stacks d'agents » : principe, services partagés, commandes du script, limites,
  nettoyage.
