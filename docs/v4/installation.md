# Installation - Badge v4

> Cette page complete le `README.md` racine avec les specificites v4. Pour la
> methode generale de demarrage (`make dev`, seed, variables d'environnement),
> se referer au README.

## Initialiser un nouveau poste

```bash
git clone <depot> && cd badge
make init
```

`make init` enchaine, en s'arretant au premier echec :

| Etape | Cible | Role |
|-------|-------|------|
| 1 | `init-check` | Verifie `docker`, `docker compose` v2, `openssl`, `curl`, `nc`, le daemon Docker et que les ports publies par `docker-compose.dev.yml` sont libres (controle saute si la stack tourne deja). |
| 2 | `init-env` | Garantit `NPM_TOKEN` dans `.env` : valeur existante, sinon variable du shell, sinon saisie masquee (voir « Jeton du registre »). N'ecrit que cette ligne. |
| 3 | `dev-build` | Build de l'image dev et demarrage de la stack. |
| 4 | `init-wait` | Attend que l'app reponde sur `localhost:3785` (5 min max ; le premier `yarn install` est long). |
| 5 | `db-push` puis `db-seed` | Schema Prisma et donnees de dev (dont les templates de badge). |
| 6 | `dev-https` puis `dev-https-check` | `/etc/hosts` + CA Caddy (mot de passe admin demande), puis verification. |

Comptes crees par le seed : `admin@badge.local` (SUPER_ADMIN), `admin2@`, `support@`,
`observer@`, `participant@badge.local`, mot de passe `123456` (cf. `prisma/seed.ts`).

> Un port deja pris (autre stack Docker exposant 80/443, MySQL local sur 33060...) fait
> echouer `init-check` avec la liste des ports : arreter le service concerne et relancer.
> Pour que l'IDE voie les types Prisma, lancer aussi `yarn install` sur l'hote (avec
> `NPM_TOKEN` exporte) puis `make db-generate`.

## Services et URLs (dev)

Le reverse proxy Caddy sert les sous-domaines `*.badge.local` en **HTTPS** via
sa CA interne (`tls internal`). Le HTTP est redirige vers HTTPS.

| Service | Port direct | URL via Caddy (HTTPS) | Description |
|---------|-------------|-----------------------|-------------|
| `app` | 3785 | `https://badge.local` | Next.js avec hot reload |
| `mysql` | 33060 | -- | Base de donnees MySQL |
| `phpmyadmin` | 8080 | `https://pma.badge.local` | Interface admin BDD |
| `worker` | -- | -- | Worker de la queue d'emails (`tsx watch`, polling 500 ms) |
| `renderer` | -- (jamais publie) | -- | Service de rendu des badges (Chromium) : PDF, document fige, epreuve PNG. Image `ghcr.io/tigamadou/pdf-engine-renderer`, tag egal a la version du moteur, **linux/amd64** (emulee par Rosetta sur Mac Apple Silicon). Reseau compose interne `rendu`, joint par `app` via `RENDERER_URL=http://renderer:3000`. Premier telechargement : `docker login ghcr.io` (jeton `read:packages`). |
| `mailpit` | 8025 | `https://mail.badge.local` | Capture d'emails |
| `rustfs` | 9001 | `https://s3.badge.local` | Console RustFS (stockage S3, `rustfsadmin` / `rustfsadmin`) |
| `caddy` | 80 / 443 | -- | Reverse proxy dev HTTPS |

Les ports directs (`localhost:3785`, `localhost:8080`, `localhost:8025`)
restent exposes en parallele.

## HTTPS local

Il n'y a **aucun certificat a generer** : Caddy signe lui-meme les certificats
`*.badge.local` avec une autorite locale (`Caddy Local Authority`) creee au
premier demarrage et persistee dans le volume `caddy_data_dev`. Le travail
consiste seulement a resoudre les domaines vers `127.0.0.1` et a faire confiance
a cette racine.

### 1. Tout configurer en une commande

```bash
make dev            # la stack doit tourner (la CA est generee par le conteneur)
make dev-https      # /etc/hosts + approbation de la CA (mot de passe admin demande)
make dev-https-check
```

`make dev-https` est **idempotent** : il n'ajoute a `/etc/hosts` que les domaines
manquants et ne reinstalle pas une CA deja approuvee. Les domaines traites sont
lus dans `Caddyfile.dev`, donc ajouter un site au proxy suffit a le couvrir.

| Commande | Role |
|----------|------|
| `make dev-https` | Enchaine `dev-https-hosts` + `dev-https-trust`. |
| `make dev-https-hosts` | Ajoute les domaines manquants a `/etc/hosts`. |
| `make dev-https-trust` | Extrait la racine CA du conteneur et l'installe dans le magasin systeme (macOS : trousseau Systeme ; Linux : `/usr/local/share/ca-certificates`). |
| `make dev-https-check` | Verifie sans `-k` que la chaine est valide sur chaque domaine. |
| `make dev-https-untrust` | Retire les CA Caddy du magasin systeme. |

> **Apres un `docker compose -f docker-compose.dev.yml down -v`** : le volume
> `caddy_data_dev` disparait, Caddy regenere une CA differente et l'ancienne
> racine approuvee ne vaut plus rien. Lancer `make dev-https-untrust` puis
> `make dev-https` pour repartir propre (sinon les vieilles racines s'accumulent
> dans le trousseau).

**Firefox** utilise son propre magasin de certificats et n'est pas couvert par
ces cibles : importer la racine via *Parametres > Vie privee et securite >
Certificats*. Pour l'obtenir :

```bash
docker compose -f docker-compose.dev.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

### 2. Aligner l'URL de base de l'app

L'app doit se savoir servie en `https://badge.local` pour que les liens des
emails et les callbacks NextAuth soient coherents. La valeur committable vit
dans `docker/compose.dev.env` :

```
NEXTAUTH_URL=https://badge.local
```

> Attention : un `.env` present a la racine du projet est charge **apres**
> `docker/compose.dev.env` et **ecrase** cette valeur. Si vous avez un `.env`
> local avec `NEXTAUTH_URL=http://localhost:3000`, mettez-le a jour vers
> `https://badge.local` (ou retirez la ligne) puis recreez le conteneur app :
> `docker compose -f docker-compose.dev.yml up -d --no-deps app`. Ce redemarrage
> invalide les sessions en cours (changement d'origine http -> https).

### Verification

```bash
make dev-https-check   # attendu : une ligne "OK <domaine> (http=308 -> https=200)" par site
```

Une ligne `KO` signifie soit que le domaine n'est pas dans `/etc/hosts`, soit que
la CA approuvee ne correspond plus a celle du conteneur (cas du `down -v`).

Dans le navigateur (apres confiance CA) : `https://badge.local` affiche le
cadenas sans avertissement. Les liens captures dans Mailpit
(`https://mail.badge.local`) commencent par `https://badge.local`.

## Stockage S3 : RustFS

Le dev, la CI, la preprod et la prod utilisent [RustFS](https://github.com/rustfs/rustfs)
(Apache-2.0), image `rustfs/rustfs` au tag fige `1.0.1-preview.16`. MinIO n'est plus
distribue : images retirees de Docker Hub puis de quay.io, binaires `dl.min.io` en 410,
depot archive.

En prod/preprod, le service `rustfs` (conteneurs `badge-rustfs` / `badge-rustfs-preprod`,
volumes `rustfs_data` / `rustfs_data_preprod`) lit `RUSTFS_ACCESS_KEY` /
`RUSTFS_SECRET_KEY` dans `.env.production` / `.env.preprod` ; l'app y lit
`S3_ENDPOINT` et `S3_ACCESS_KEY` / `S3_SECRET_KEY` (memes valeurs). `S3_ENDPOINT` vise le
`container_name` (`http://badge-rustfs:9000` / `http://badge-rustfs-preprod:9000`) : l'alias
`rustfs` existe dans les deux stacks sur le reseau partage `badge_web` et serait ambigu.
Les anciennes variables `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` ne servent plus. La
console est servie par Caddy sur `s3.badge.bj` / `preprod.s3.badge.bj`
(`/rustfs/console/`). Les volumes MinIO n'etant pas repris, les anciens volumes
`minio_data*` peuvent etre supprimes une fois la bascule validee.

`storage.ts` ne change pas : RustFS couvre les commandes S3 utilisees (Put/Get/Delete,
ListObjectsV2, DeleteObjects, Head/CreateBucket, `forcePathStyle`). Le bucket `badge-dev`
est cree au premier upload.

> **Poste existant** : l'ancien volume `minio_data_dev` n'est pas repris. Les fichiers
> uploades en dev avant la bascule sont perdus pour l'app (la base peut encore y faire
> reference) : repartir d'une base propre avec `make db-seed`. Une fois rassure, le
> volume orphelin se supprime avec `docker volume rm badge_minio_data_dev`.

## Paiements FedaPay (dev)

Les abonnements se paient via FedaPay (voir [`features/paiements-fedapay.md`](features/paiements-fedapay.md)). La configuration se fait par variables d'environnement (`.env.example`).

1. Creer un compte **sandbox** sur FedaPay et recuperer la **cle secrete** sandbox (`sk_sandbox_...`).
2. Renseigner dans `.env` : `FEDAPAY_ENVIRONMENT=sandbox`, `FEDAPAY_SECRET_KEY` (cle secrete) et `FEDAPAY_WEBHOOK_SECRET` (secret du webhook, etape 3), puis redemarrer `app` et `worker` (`make dev`). Ces secrets ne sont ni en base ni dans une reponse API.
3. Declarer le webhook dans le tableau de bord FedaPay avec l'URL `${NEXTAUTH_URL}/api/webhooks/fedapay`, evenements `transaction.*`, et copier son secret dans `FEDAPAY_WEBHOOK_SECRET`.
4. FedaPay doit joindre l'app : exposer le port via un tunnel (ex. `cloudflared tunnel --url http://localhost:3785`), mettre l'URL du tunnel dans `NEXTAUTH_URL` puis redemarrer `app`. Sans tunnel, le paiement reste confirme par la page de retour, et le webhook peut etre rejoue a la main depuis le tableau de bord FedaPay.
5. Donner un `price` a un plan dans `/platform/plans`, puis payer depuis `/org/[orgId]/subscription` avec un compte `OWNER` (numeros de test de la sandbox FedaPay).

Rappels et paiements orphelins sont traites par le conteneur `worker` : le relancer apres modification de `endDate` pour tester sans attendre l'heure suivante.

## Tests

Toutes les commandes tournent dans le conteneur dev (`make dev` prealable).

| Commande | Description |
|----------|-------------|
| `make test [FILE=chemin]` | Suite Vitest complete (unitaire lib + integration API), ou un seul fichier, sur la **base de test** `badge_test` et le bucket `badge-test` (jamais la base de dev). |
| `make test-db` | Cree et met au schema la base de test (`prisma db push`) ; appele par `make test`, `test-unit` et `test-coverage`. |
| `make test-unit` | Sous-ensemble unitaire cible sur `src/lib`. |
| `make test-coverage` | Vitest + rapport de couverture V8. **Seuils 100%** (lignes/branches/fonctions/statements) sur `src/lib/**` et `src/app/api/**` = gate (`vitest.config.ts`). |
| `make test-e2e [FILE=chemin]` | Playwright (chromium systeme) dans le conteneur, contre `http://localhost:3000`. Le worker doit tourner (les specs qui lisent Mailpit en dependent). |
| `make test-e2e-ui` | Playwright mode UI depuis l'hote (fenetre Electron ; app sur `localhost:3785`). |
| `make test-all` | `lint` + `typecheck` + `test` + `test-e2e`, s'arrete au premier echec. |
| `make ci` | Memes checks que la CI GitHub : `db-push` + `lint` + `typecheck` + `test-coverage` (seuils 100 %) + `test-e2e`. |

> **Worker d'emails** (spec 23) : les emails passent par une queue MySQL traitee par le service
> `worker`. Variables `JOB_POLL_INTERVAL_MS` (defaut 2000, 500 en dev) et
> `JOB_EMAIL_CONCURRENCY` (defaut 5). Diagnostic :
> `docker compose -f docker-compose.dev.yml logs -f worker`. `make db-push` relance le
> worker (il a son propre client Prisma). Voir `docs/v4/features/queue-emails.md`.

> **Base de test** : Vitest tourne sur `<base de dev>_test` (`badge_test`), que
> `src/test-setup.ts` vide avant chaque test ; la base de dev n'est plus touchee et le
> worker n'est plus arrete. Un garde-fou (`src/test-guard.ts`) refuse toute base dont le nom
> ne finit pas par `_test` : lancer Vitest a la main sur la base de dev echoue. Les nouveaux
> tests preparent leurs donnees avec `src/test/factories.ts` (`@faker-js/faker`, vraie base,
> pas de mock de Prisma) ; regles completes : `CLAUDE.md`, « Regles de test ». Les tests e2e
> tournent contre l'app (base de dev) avec leurs propres fixtures (`e2e/helpers/`).

> **Templates de badge** (v4, plan 12) : `make db-seed` installe aussi les modeles de
> badge livres avec l'application, depuis `prisma/badge-templates/`. Sans lui, aucun
> badge n'est imprimable et `resolveTemplate` echoue explicitement. `make
> validate-badge-templates` verifie qu'aucune reference n'est orpheline, que chaque
> template installe est au format v3 (le moteur ne sait plus rendre du v1 ; une ligne v2
> est lue en memoire) et que ses
> liaisons de variables sont completes ; `make migrate-badge-template-refs` convertit
> les anciennes references texte d'une base anterieure au plan 12 (inutile sur une
> base neuve).

| Commande | Description |
|----------|-------------|
| `make migrate-installed-templates [ARGS=--apply]` | Migre les templates installes (formats v1 et v2) vers le format 3 et genere leur epreuve `proof.png` par le service de rendu (dry-run par defaut ; une ligne sautee n'ecrit rien) |

Voir `docs/v4/features/templates-badges.md` pour le format du manifeste.

> **Release du moteur 2.0.0 — ordre de deploiement.** Une ligne au format 2 s'imprime
> (migration en memoire), une ligne au format 1 est refusee (message qui nomme
> `make migrate-installed-templates`). Procedure complete (sauvegarde, service de rendu,
> `verify-engine`, deploiement, migration, verification, retour arriere) : `DEPLOYMENT.md`,
> « Moteur 2.0.0 : service de rendu ». Cibles `-preprod` / `-prod` : `make
> migrate-installed-templates-prod` (conteneur `tools`, qui contient `scripts/`, `src/` et
> `tsx`), `make validate-badge-templates-prod`. Detail :
> `docs/v4/features/templates-badges.md`, « Migration d'une base anterieure ».

**Pre-requis Playwright / RustFS** : le chromium systeme est installe dans le conteneur
`app` (cf. commentaire de la cible `test-e2e` dans le `Makefile`) ; le stockage objet
(RustFS) doit tourner (`make dev` le demarre) pour les tests d'upload.

## Stacks d'agents

Pour paralleliser le travail de sous-agents, chacun dispose d'un worktree et d'une **stack
legere** : `app`, `worker` et `agent-mailpit` lui sont propres ; MySQL, RustFS et le renderer
sont ceux de la stack principale, qui doit tourner (`make dev`). Surcouche :
`docker-compose.agent.yml` ; configuration locale du worktree : `.agent.env` (non versionne),
lu par le `Makefile` (`DEV_COMPOSE`, `DB_NAME`, `DB_HOST`, `S3_TEST_BUCKET`).

| Commande | Description |
|----------|-------------|
| `scripts/agent-stack.sh up <lot> <branche-base>` | Cree `../badge-wt-<lot>` sur `feat/commandes-impression-<lot>`, demarre la stack `badge-ag-<lot>` (port 3790-3799, `127.0.0.1`), applique le schema et seede `badge_<lot>`, prepare `badge_<lot>_test` |
| `scripts/agent-stack.sh status` | Stacks d'agents, ports, worktrees |
| `scripts/agent-stack.sh down <lot>` | Arrete la stack et supprime ses volumes ; garde worktree, branche, bases et buckets |
| `make db-drop-agent LOT=<lot>` | Supprime les bases `badge_<lot>` et `badge_<lot>_test` (destructif, apres fusion) |

Dans le worktree, toutes les commandes `make` visent la stack de l'agent (base `badge_<lot>`,
tests sur `badge_<lot>_test` et le bucket `badge-<lot>-test`). Limites : 3 stacks au plus
(environ 1,5 Go de RAM chacune, surtout le serveur Next), images `badge-app` et `badge-worker`
reutilisees (construites par la stack principale), `NPM_TOKEN` requis dans `.env`. L'agent ne
rejoint pas le reseau par defaut de la stack principale (le Caddy principal y resout `app`) :
MySQL et RustFS sont joints par `host.docker.internal`, le renderer par le reseau `badge_rendu`.

## Jeton du registre

Le moteur de rendu est le package `@tigamadou/pdf-engine`, publié depuis pdfStudio sur GitHub Packages. Monter de version : `yarn add @tigamadou/pdf-engine@<version>`, puis `make verify-engine` (voir « Monter de version le moteur »).

Le package est privé : l'installation exige un jeton GitHub (classic) de portée
`read:packages`, lu par `.npmrc` dans la variable `NPM_TOKEN`. Il n'est jamais écrit dans
un fichier versionné. Trois emplacements :

1. **Poste local** : `NPM_TOKEN=...` dans le `.env` du dépôt (gitignoré) ; Compose le
   transmet au build de `Dockerfile.dev` (secret de build) et au conteneur.
2. **CI** : secret de dépôt GitHub `NPM_TOKEN` (Settings > Secrets and variables > Actions).
   Les pull requests venant d'un fork ne reçoivent pas ce secret : leur installation
   échoue en 401.
3. **Serveur** : dans le `.env` du dossier de déploiement (celui qui contient le
   `docker-compose.yml`), lu par Compose pour l'interpolation, ou dans l'environnement du
   shell. Jamais dans `.env.production` / `.env.preprod` : ces fichiers sont copiés dans
   une couche de l'image du builder et y laisseraient le jeton.

## Integration continue (GitHub Actions)

Le workflow `.github/workflows/ci.yml` s'execute sur chaque **push** et **pull request**
vers `development`. Quatre jobs paralleles bloquants :

1. **lint** — `yarn lint` (ESLint, 0 erreur ; warnings au niveau baseline toleres).
2. **typecheck** — `yarn tsc --noEmit`.
3. **unit-integration** — service MySQL 8, `prisma db push`, `yarn vitest run --coverage` (les seuils 100% font gate). Le service de rendu y est remplace par un faux exporteur (`src/test-setup.ts`) : aucune image Chromium.
4. **e2e** — services MySQL + Mailpit + RustFS + `renderer` (`ghcr.io/tigamadou/pdf-engine-renderer`, port 3100, `RENDERER_URL=http://127.0.0.1:3100`), `prisma db seed`, build Next + `yarn start`, `yarn playwright test` (rapport uploade en artefact si echec).

> Le job **e2e** reste rouge tant que la couverture E2E (Phase 3 du plan
> `v4-02`) n'est pas verte. Ne l'ajouter aux checks **requis** qu'une fois la
> suite Playwright stabilisee.

### Protection de branche (action manuelle GitHub)

A configurer a la main dans **Settings > Branches > Branch protection rules** du depot :

- Regle sur `development` : **Require a pull request before merging** (interdit le push direct).
- **Require status checks to pass before merging** + selectionner les checks requis :
  `lint`, `typecheck`, `unit-integration` (ajouter `e2e` une fois la Phase 3 verte).
- **Require branches to be up to date before merging** (recommande).

> Cette activation est une operation **manuelle** de l'administrateur du depot :
> elle ne peut pas etre automatisee par le workflow lui-meme.
