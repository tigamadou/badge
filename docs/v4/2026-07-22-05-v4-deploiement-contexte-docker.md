# Deploiement par contexte Docker SSH — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommande) ou superpowers:executing-plans pour implementer ce plan task-par-task. Les etapes utilisent la syntaxe checkbox (`- [ ]`).

**Spec de reference :** [`../specs/2026-07-22-05-v4-deploiement-contexte-docker.md`](../specs/2026-07-22-05-v4-deploiement-contexte-docker.md)

**Goal:** Deployer la production et la preproduction depuis le Mac via un contexte Docker SSH, de sorte que **seules les images et les volumes** persistent sur le serveur — plus aucun code source, plus aucun fichier `.env`, plus aucun fichier Compose.

**Architecture:** Un contexte Docker (`docker context create badge --docker "host=ssh://root@173.212.217.54"`) fait pointer le client local vers le demon distant. Compose lit les fichiers `-f` et les `env_file` **en local** et n'envoie au demon que la configuration resolue plus le contexte de build ; BuildKit builde sur le serveur (donc en amd64, sans emulation) et ne conserve que les layers. Les trois `docker-compose*.yml` distants sont remplaces par une base commune plus deux overrides courts. Le `Caddyfile`, qui ne peut plus etre bind-monte, est bake dans une image dediee.

**Tech Stack:** Docker contexts + BuildKit, Docker Compose v2 (merge multi-fichiers, `--env-file`), Caddy 2, GNU Make, MySQL 8, MinIO, Prisma 6.

## Global Constraints

1. **Aucun commit sans demande explicite de l'utilisateur.** Les etapes « Commit » de ce plan ne valent **pas** autorisation : elles decrivent le decoupage souhaite *si* un commit est demande.
2. **Actions a risque : demander avant.** Toute commande touchant la production, la preproduction ou le serveur (`docker --context badge … up`, `down`, `rm`, `ssh`, suppression de dossiers distants) doit etre annoncee et confirmee avant execution. Cela couvre la totalite des Tasks 3, 5 et 6.
3. **Aucun volume ne doit etre renomme.** Les noms reels attendus sont, en prod : `badge_mysql_data`, `badge_uploads_data`, `badge_minio_data`, `badge_caddy_data`, `badge_caddy_config` ; en preprod : `badge-preprod_mysql_data_preprod`, `badge-preprod_uploads_data_preprod`, `badge-preprod_minio_data_preprod`. Un renommage silencieux equivaut a une perte de donnees.
4. **Preprod avant prod, toujours.** Aucune commande visant la production n'est lancee avant que la Task 3 (bascule preprod) ne soit validee.
5. **Rien n'est supprime sur le serveur avant la Task 6**, elle-meme conditionnee a la validation des deux environnements et a une confirmation explicite.
6. **Langue :** commentaires et documentation en francais ; identifiants, noms de fichiers et messages de commit en ASCII. Style conventional commits.
7. **Serveur :** `root@173.212.217.54`, heberge **les deux** environnements. Un seul contexte Docker, nomme `badge`, suffit.
8. **Ce changement ne touche aucun code applicatif.** `make lint`, `make typecheck` et Vitest ne le couvrent pas : la verification est operationnelle (`docker compose config`, puis deploiements reels).

---

## Progression

| Task | Perimetre | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Base Compose + overrides prod/preprod + `Dockerfile.caddy` + `.dockerignore` | [ ] | | |
| 2 | Contexte Docker + reecriture du Makefile + doc d'exploitation | [ ] | | |
| 3 | Bascule preprod + validation | [ ] | | |
| 4 | Reconciliation de `.env.production` (bloquant pour la Task 5) | [ ] | | |
| 5 | Bascule prod + validation | [ ] | | |
| 6 | Rapatriement des backups, note de perimetre, nettoyage serveur | [ ] | | |

---

## Etat initial (constate le 2026-07-22)

Ces faits ont ete verifies dans le depot avant redaction. Ils justifient plusieurs decisions ci-dessous ; les revalider si le plan est execute longtemps apres.

- **Deploiement actuel :** `make deploy-prod` = `rsync -avz --delete` du depot vers `~/prod/badge` puis `ssh … "make prod-build && make prod-db-push"`. Idem preprod vers `~/preprod/badge`.
- **Projet Compose de la prod :** aucune cle `name:` dans `docker-compose.yml` -> le projet vaut le nom du dossier, soit `badge` (dossier serveur `~/prod/badge`). Le dossier local s'appelle aussi `badge` : figer `name: badge` conserve donc les noms de volumes actuels.
- **Projet Compose de la preprod :** `name: badge-preprod`, cles de volumes suffixees (`mysql_data_preprod`…).
- **`docker-entrypoint.sh`** contient deja `prisma db push --accept-data-loss` : le schema est synchronise a **chaque demarrage** du conteneur `app`. La cible `prod-db-push` etait donc redondante ; les nouvelles cibles `deploy-*` ne la reprennent pas.
- **`.dockerignore`** exclut `.git`, `node_modules`, `.next`, `.env`, `.env*.local`, `*.md`, `specs/`. Il **n'exclut pas** `.env.production`, `.env.preprod`, `uploads/`, `backups/`, `coverage/`, `.plan-logs/`.
- **`.env.production` est obsolete.** Variables lues par le code v4 (`grep -rhoE "process\.env\.[A-Z0-9_]+" src/ prisma/ scripts/`) : `BASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NODE_ENV`, `PLATFORM_SMTP_{FROM,HOST,PASSWORD,PORT,SECURE,USER}`, `S3_{ACCESS_KEY,BUCKET,ENDPOINT,REGION,SECRET_KEY}`, `SEED_MODE`, `UPLOADS_ROOT`, `UPLOAD_TOKEN_SECRET`. `.env.production` n'en contient **aucune** parmi `BASE_URL`, `PLATFORM_SMTP_*`, `S3_*`, `UPLOAD_TOKEN_SECRET`, et ne contient pas non plus `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (consommees par le conteneur MinIO). `.env.preprod` les contient toutes. -> Task 4.
- **MySQL est publie sur l'IP publique** : `3306:3306` en prod, `33061:3306` en preprod. Aucun consommateur externe (`app` et `phpmyadmin` passent par le reseau Docker interne). Le durcissement est integre a la Task 1 (decision spec du 2026-07-22).

---

## Task 1 : Base Compose, overrides, image Caddy, durcissement du contexte de build

**Files:**
- Modify: `docker-compose.yml` (reecrit integralement — devient la base commune, sans `container_name`, `ports`, `env_file` ni `networks` de service)
- Create: `compose/prod.yml`
- Create: `compose/preprod.yml`
- Delete: `docker-compose.preprod.yml`
- Create: `Dockerfile.caddy`
- Modify: `.dockerignore`
- Unchanged: `docker-compose.dev.yml`, `Dockerfile`, `Caddyfile`, `docker-entrypoint.sh`

**Interfaces:**
- Consumes: rien (premiere task).
- Produces: les invocations Compose exactes utilisees par la Task 2 —
  `docker compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production <cmd>`
  `docker compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod <cmd>`
  Noms de conteneurs inchanges : `badge-app`, `badge-db`, `badge-pma`, `badge-minio`, `badge-caddy` (prod) ; `badge-app-preprod`, `badge-db-preprod`, `badge-pma-preprod`, `badge-minio-preprod` (preprod).
  Tags d'image produits : `badge-app:{prod,preprod}`, `badge-tools:{prod,preprod}`, `badge-caddy:prod`.

- [ ] **Step 1 : Ecrire la base commune**

Remplacer integralement le contenu de `docker-compose.yml` par :

```yaml
# Base commune aux stacks distantes (production et preproduction).
#
# Ne se lance JAMAIS seule : toujours avec un override.
#   docker --context badge compose -f docker-compose.yml -f compose/prod.yml    --env-file .env.production up -d --build
#   docker --context badge compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod    up -d --build
#
# Ce fichier ne declare NI container_name, NI ports, NI env_file, NI rattachement
# reseau explicite : tout ce qui differe entre les deux environnements vit dans
# l'override correspondant. Le developpement local passe par
# docker-compose.dev.yml, independant de ce fichier.
#
# Les chemins relatifs (build.context, env_file des overrides) se resolvent
# depuis le repertoire de projet, c'est-a-dire le dossier du PREMIER `-f` :
# la racine du depot.

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    expose:
      - "3000"
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  phpmyadmin:
    image: phpmyadmin:5
    expose:
      - "80"
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      UPLOAD_LIMIT: 64M
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: badge
    volumes:
      - mysql_data:/var/lib/mysql
    # Jamais publie sur l'hote : `app` et `phpmyadmin` joignent mysql par le
    # reseau Docker interne. Acces direct depuis le poste = tunnel SSH
    # (ssh -L 3307:localhost:3306 root@<serveur>) ou phpMyAdmin derriere Caddy.
    expose:
      - "3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  # Stockage objet S3-compatible (cf. v4 Task 5.1). L'API S3 (9000) n'est jamais
  # exposee publiquement : `app` l'atteint en HTTP sur le reseau Docker interne.
  minio:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    expose:
      - "9000"
      - "9001"
    restart: unless-stopped

  # Taches ponctuelles (seed, smoke tests, scripts). Utilise le stage `builder`
  # du Dockerfile, qui contient yarn, tsx, src/ et node_modules — tous absents
  # de l'image runner standalone. Le profile `tools` l'exclut de `up` : il ne
  # tourne que sur `docker compose run --rm tools ...`.
  tools:
    profiles: ["tools"]
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy

volumes:
  mysql_data:
  uploads_data:
  minio_data:

# Reseau partage entre les deux stacks : c'est par la que le Caddy de prod joint
# les conteneurs preprod. Declare `external`, donc cree hors Compose — la cible
# interne `ctx-check` du Makefile s'en charge.
networks:
  web:
    external: true
    name: badge_web
```

- [ ] **Step 2 : Ecrire l'override de production**

Creer `compose/prod.yml` :

```yaml
# Override production.
#
# `name: badge` conserve les noms de volumes existants (badge_mysql_data,
# badge_uploads_data, badge_minio_data, badge_caddy_data, badge_caddy_config) :
# aucune migration de donnees. NE PAS RENOMMER ce projet.
name: badge

services:
  # Unique reverse proxy de l'hote : sert la production ET la preproduction
  # (cf. Caddyfile). Seul conteneur a detenir 80/443, ce qui permet d'obtenir de
  # vrais certificats Let's Encrypt pour les deux environnements.
  #
  # La config est bakee dans l'image (Dockerfile.caddy) : un bind mount
  # ./Caddyfile se resoudrait sur le SERVEUR, ou le depot n'existe plus.
  # Reload a chaud sans coupure : cf. docs/v4/installation.md.
  caddy:
    image: badge-caddy:prod
    build:
      context: .
      dockerfile: Dockerfile.caddy
    container_name: badge-caddy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - default
      - web
    depends_on:
      - app
      - phpmyadmin
    restart: unless-stopped

  app:
    image: badge-app:prod
    container_name: badge-app
    env_file:
      - .env.production

  phpmyadmin:
    container_name: badge-pma

  mysql:
    container_name: badge-db
    env_file:
      - .env.production

  minio:
    container_name: badge-minio
    env_file:
      - .env.production
    environment:
      # Console derriere Caddy (HTTPS) : sans cette URL publique, MinIO redirige
      # vers son adresse interne et le login echoue. MINIO_SERVER_URL n'est pas
      # defini volontairement (API S3 non exposee publiquement).
      MINIO_BROWSER_REDIRECT_URL: https://s3.badge.bj

  tools:
    image: badge-tools:prod
    env_file:
      - .env.production

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3 : Ecrire l'override de preproduction**

Creer `compose/preprod.yml` :

```yaml
# Override preproduction.
#
# Tourne sur la meme machine que la prod : projet, conteneurs et volumes
# distincts, ports hote decales pour l'acces direct / debug.
#
# Pas de service caddy ici : le Caddy de la stack de production est l'unique
# reverse proxy de l'hote et sert aussi les domaines preprod.* via le reseau
# partage `badge_web`.
#
# Les volumes portent un `name:` explicite pour conserver les noms REELS crees
# par l'ancien docker-compose.preprod.yml, dont les cles etaient suffixees
# `_preprod`. Sans ces `name:`, Compose creerait des volumes vides.
name: badge-preprod

services:
  app:
    image: badge-app:preprod
    container_name: badge-app-preprod
    env_file:
      - .env.preprod
    ports:
      - "3500:3000"
    networks:
      - default
      - web

  phpmyadmin:
    container_name: badge-pma-preprod
    ports:
      - "8081:80"
    networks:
      - default
      - web

  mysql:
    container_name: badge-db-preprod
    env_file:
      - .env.preprod

  minio:
    container_name: badge-minio-preprod
    env_file:
      - .env.preprod
    environment:
      MINIO_BROWSER_REDIRECT_URL: https://preprod.s3.badge.bj
    ports:
      - "9002:9000"
      - "10001:9001"
    networks:
      - default
      - web

  tools:
    image: badge-tools:preprod
    env_file:
      - .env.preprod

volumes:
  mysql_data:
    name: badge-preprod_mysql_data_preprod
  uploads_data:
    name: badge-preprod_uploads_data_preprod
  minio_data:
    name: badge-preprod_minio_data_preprod
```

- [ ] **Step 4 : Creer l'image Caddy**

Creer `Dockerfile.caddy` :

```dockerfile
# Le Caddyfile est bake dans l'image : avec un contexte Docker distant, un bind
# mount ./Caddyfile se resoudrait sur le serveur, ou le depot n'existe plus.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
```

- [ ] **Step 5 : Supprimer l'ancien compose de preproduction**

```bash
git rm docker-compose.preprod.yml
```

- [ ] **Step 6 : Durcir `.dockerignore`**

Remplacer integralement le contenu de `.dockerignore` par :

```
.git
.gitignore
node_modules
.next
npm-debug.log*
*.md
specs/

# Secrets : le stage `builder` du Dockerfile fait `COPY . .` et sert de base a
# l'image `tools`. Sans ces exclusions, les secrets des DEUX environnements
# distants sont embarques dans une image.
.env
.env*.local
.env.production
.env.preprod

# Le contexte de build part desormais du poste local et transite par SSH.
# Ces dossiers etaient exclus par RSYNC_EXCLUDES, variable supprimee.
uploads
backups
coverage
.plan-logs
test-results
playwright-report
```

- [ ] **Step 7 : Valider la configuration resolue de la preprod, sans rien demarrer**

`docker compose config` est purement local : il ne contacte aucun demon et ne demarre rien. C'est le garde-fou principal de ce plan.

Run :
```bash
docker compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod config
```

Expected — controler nommement dans la sortie :
- `name: badge-preprod`
- quatre services actifs (`app`, `mysql`, `phpmyadmin`, `minio`) plus `tools` sous profile
- `container_name: badge-app-preprod`, `badge-db-preprod`, `badge-pma-preprod`, `badge-minio-preprod`
- section `volumes:` contenant exactement `name: badge-preprod_mysql_data_preprod`, `name: badge-preprod_uploads_data_preprod`, `name: badge-preprod_minio_data_preprod`
- **aucune** publication de port pour `mysql` (le durcissement a bien pris)
- ports publies : `3500:3000` (app), `8081:80` (pma), `9002:9000` et `10001:9001` (minio)
- le service `app` porte bien `DATABASE_URL`, `NEXTAUTH_URL`, `S3_ENDPOINT`, `UPLOAD_TOKEN_SECRET` resolus depuis `.env.preprod`
- **aucun service `caddy`**

- [ ] **Step 8 : Valider la configuration resolue de la prod, sans rien demarrer**

Run :
```bash
docker compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production config
```

Expected :
- `name: badge`
- cinq services actifs, `caddy` inclus
- `container_name: badge-app`, `badge-db`, `badge-pma`, `badge-minio`, `badge-caddy`
- section `volumes:` **sans** cle `name:` (les noms reels seront `badge_<cle>`)
- **aucune** publication de port pour `mysql`
- ports publies uniquement sur `caddy` : `80`, `443`, `443/udp`
- `MINIO_BROWSER_REDIRECT_URL: https://s3.badge.bj`

Note attendue : la sortie montrera l'absence de `S3_*`, `PLATFORM_SMTP_*`, `BASE_URL`, `UPLOAD_TOKEN_SECRET` et `MINIO_ROOT_*` sur les services de prod. **C'est le probleme traite en Task 4**, pas une erreur de cette task.

- [ ] **Step 9 : Verifier que le Caddyfile est bien valide avant d'etre bake**

Run :
```bash
make caddy-validate
```
Expected : `Valid configuration`.

- [ ] **Step 10 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add docker-compose.yml compose/prod.yml compose/preprod.yml Dockerfile.caddy .dockerignore
git rm --cached docker-compose.preprod.yml
git commit -m "refactor(infra): base compose + overrides prod/preprod, caddy bake, dockerignore durci"
```

---

## Task 2 : Contexte Docker, reecriture du Makefile, documentation d'exploitation

**Files:**
- Modify: `Makefile` (bloc `.PHONY`, suppression du bloc « Production », « Preproduction », « Deploiement », des cibles Caddy distantes et des cibles d'exploitation ; ajout du bloc « Deploiement distant »)
- Modify: `docs/v4/installation.md` (nouvelle section « Exploitation des environnements distants »)

**Interfaces:**
- Consumes: les invocations Compose produites par la Task 1.
- Produces: `make deploy-prod`, `make deploy-preprod`, et la cible interne `ctx-check`. Variables Make exposees : `SERVER`, `DOCKER_CTX`, `DOCKER`, `COMPOSE_PROD`, `COMPOSE_PREP`.

- [ ] **Step 1 : Creer le contexte Docker et verifier la connectivite**

Run :
```bash
docker context create badge --docker "host=ssh://root@173.212.217.54"
docker --context badge version --format '{{.Server.Version}}'
```
Expected : la version du demon **distant** s'affiche (ex. `27.x`). Si la commande demande un mot de passe ou echoue en `permission denied`, l'authentification SSH par cle n'est pas operationnelle — s'arreter et le signaler plutot que de contourner.

Verification que les deux stacks sont bien vues :
```bash
docker --context badge ps --format '{{.Names}}'
```
Expected : `badge-app`, `badge-db`, `badge-pma`, `badge-caddy`, `badge-minio` et leurs equivalents `-preprod`.

- [ ] **Step 2 : Relever l'etat de reference des volumes distants**

A conserver : c'est la reference qui prouvera, en Tasks 3 et 5, qu'aucun volume n'a ete recree.

Run :
```bash
docker --context badge volume ls --format '{{.Name}}' | sort
```
Expected — au minimum ces neuf noms :
```
badge-preprod_minio_data_preprod
badge-preprod_mysql_data_preprod
badge-preprod_uploads_data_preprod
badge_caddy_config
badge_caddy_data
badge_minio_data
badge_mysql_data
badge_uploads_data
```
Si un nom differe de ce qui est attendu, **s'arreter** : les `name:` de `compose/preprod.yml` (Task 1, Step 3) doivent etre corriges pour coller a la realite avant tout `up`.

- [ ] **Step 3 : Reecrire l'en-tete `.PHONY` du Makefile**

Remplacer les lignes 1 a 11 de `Makefile` par :

```makefile
.PHONY: dev dev-down dev-build dev-restart \
        deploy-prod deploy-preprod ctx-check \
        caddy-validate caddy-fmt \
        test test-unit test-coverage test-all test-e2e test-e2e-ui lint typecheck build logs \
        validate-badge-templates \
        db-push db-seed db-seed-demo db-studio db-generate db-reset
```

- [ ] **Step 4 : Supprimer les blocs devenus morts**

Supprimer de `Makefile` :
- les variables `SERVER`, `BACKUP_DIR`, `TS`, `PROD_DIR`, `PREPROD_DIR`, `PREPROD_COMPOSE`, `NET` et la cible `net-create` (bloc en tete de fichier) ;
- le bloc `# Production` en entier : `prod`, `prod-build`, `prod-down`, `prod-logs`, `prod-db-push`, `prod-db-reset` ;
- le bloc `# Preproduction` en entier : `preprod`, `preprod-build`, `preprod-down`, `preprod-logs`, `preprod-db-push`, `preprod-db-reset` ;
- dans le bloc `# Caddy`, les seules cibles distantes : `caddy-reload`, `caddy-check`, `caddy-logs`. **Conserver `caddy-validate` et `caddy-fmt`** : elles tournent sur le demon local via `docker run` et ne touchent aucun environnement distant ;
- le bloc `# Reset & deploiement v2` en entier : `backup-prod`, `migrate-uploads-clear`, `smoke-tests`, `smoke-tests-preprod`, `rollback-prod` ;
- le bloc `# Deploiement` en entier : `RSYNC_EXCLUDES`, `RSYNC`, `upload-prod`, `deploy-prod`, `upload-preprod`, `deploy-preprod`, `upload-prod-dry`, `upload-preprod-dry`, `upload`, `deploy`, `download-uploads`, `download-db`.

Ne toucher a **aucune** cible de developpement (`dev*`, `test*`, `lint`, `typecheck`, `build`, `logs`, `validate-badge-templates`, `db-*`).

- [ ] **Step 5 : Ajouter le nouveau bloc de deploiement**

Ajouter en fin de `Makefile` :

```makefile
# ============================================================
#  Deploiement distant (production / preproduction)
# ============================================================
# Tout passe par un contexte Docker SSH. Compose lit les fichiers -f et les
# env_file EN LOCAL et n'envoie au demon distant que la configuration resolue,
# plus le contexte de build. Consequence : aucun code source, aucun .env et
# aucun fichier compose ne persiste sur le serveur — seules les images et les
# volumes y vivent.
#
# Le build tourne sur le serveur (amd64, pas d'emulation) et le cache de layers
# y reste : seul le delta du contexte transite a chaque deploiement.
#
# Le schema Prisma est synchronise par docker-entrypoint.sh au demarrage du
# conteneur `app` (`prisma db push`) : aucune cible dediee n'est necessaire.
#
# Les operations rares (logs, arret, dump, restauration, reload Caddy, smoke
# tests) sont documentees dans docs/v4/installation.md.
SERVER       = root@173.212.217.54
DOCKER_CTX   = badge
DOCKER       = docker --context $(DOCKER_CTX)
COMPOSE_PROD = $(DOCKER) compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production
COMPOSE_PREP = $(DOCKER) compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod

# Cible interne : cree le contexte Docker puis le reseau partage s'ils manquent.
# Idempotente et silencieuse. Pas destinee a un appel direct.
ctx-check:
	@docker context inspect $(DOCKER_CTX) >/dev/null 2>&1 \
	  || docker context create $(DOCKER_CTX) --docker "host=ssh://$(SERVER)" >/dev/null
	@$(DOCKER) network inspect badge_web >/dev/null 2>&1 \
	  || $(DOCKER) network create badge_web >/dev/null

deploy-prod: ctx-check
	$(COMPOSE_PROD) up -d --build

deploy-preprod: ctx-check
	$(COMPOSE_PREP) up -d --build
```

- [ ] **Step 6 : Verifier le Makefile sans rien executer**

Run :
```bash
make -n deploy-preprod
make -n deploy-prod
```
Expected : les commandes affichees correspondent exactement aux invocations Compose de la Task 1, avec `docker --context badge` en tete et le bon `--env-file`. `make -n` n'execute rien.

Run :
```bash
make -n prod-build deploy 2>&1 | head -5
```
Expected : `make: *** No rule to make target 'prod-build'` — confirme la suppression.

Run :
```bash
make -n dev test lint >/dev/null && echo "cibles dev intactes"
```
Expected : `cibles dev intactes`.

- [ ] **Step 7 : Documenter l'exploitation**

Ajouter a `docs/v4/installation.md` une section « Exploitation des environnements distants ». Elle doit etre livree **dans le meme changement** que la suppression des cibles : sans elle, la procedure de rollback — seul filet de securite apres un deploiement rate — disparait.

Contenu exact a inserer :

````markdown
## Exploitation des environnements distants

Le deploiement se fait depuis le poste local via un contexte Docker SSH
(`make deploy-prod`, `make deploy-preprod`). Aucun code source, aucun `.env` et
aucun fichier Compose ne vit sur le serveur : seules les images et les volumes.
Les operations ci-dessous s'executent donc **depuis le poste**, jamais en SSH
interactif sur le serveur.

Prefixes utilises ci-dessous :

```bash
DOCKER="docker --context badge"
PROD="$DOCKER compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production"
PREP="$DOCKER compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod"
```

### Consulter les logs

```bash
$DOCKER logs -f --tail 200 badge-app
$DOCKER logs -f --tail 200 badge-app-preprod
```

### Arreter une stack

```bash
$PROD down     # ATTENTION : coupe la production (Caddy inclus)
$PREP down
```

`down` ne supprime pas les volumes nommes. Ne **jamais** ajouter `-v`.

### Recharger la configuration Caddy sans coupure

Le `Caddyfile` est bake dans l'image `badge-caddy:prod`. Deux options :

```bash
# A chaud, sans redemarrer le conteneur (a privilegier)
$DOCKER cp Caddyfile badge-caddy:/etc/caddy/Caddyfile
$DOCKER exec badge-caddy caddy reload --config /etc/caddy/Caddyfile

# Ou en rebuildant l'image (recree le conteneur, ~1s de coupure)
make deploy-prod
```

Valider la syntaxe avant, en local : `make caddy-validate`.

### Verifier que Caddy joint ses upstreams

```bash
for up in badge-app:3000 badge-pma:80 badge-minio:9001 \
          badge-app-preprod:3000 badge-pma-preprod:80 badge-minio-preprod:9001; do
  if $DOCKER exec badge-caddy wget -q -T3 -O /dev/null "http://$up" 2>/dev/null; then
    echo "OK   $up"
  else
    echo "FAIL $up"
  fi
done
```

### Acceder a MySQL depuis le poste

MySQL n'est plus publie sur l'IP publique. Passer par phpMyAdmin
(`https://pma.badge.bj`) ou par un tunnel SSH :

```bash
ssh -L 3307:localhost:3306 root@173.212.217.54
# puis, dans un autre terminal, se connecter sur localhost:3307
```

Le tunnel ne fonctionne que si le port est joignable depuis l'hote : sinon,
utiliser `$DOCKER exec -it badge-db mysql -u root -p`.

### Sauvegarder (dump SQL + archive des uploads)

Les archives atterrissent **sur le poste**, plus a cote de la production.

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

$DOCKER exec badge-db sh -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers badge' \
  > backups/badge-$TS.sql

$DOCKER run --rm -v badge_uploads_data:/data alpine \
  tar -czf - -C /data . > backups/uploads-$TS.tar.gz
```

Verifier que les fichiers ne sont pas vides avant de considerer le backup
comme fait : `ls -lh backups/`.

### Restaurer (rollback)

Operation destructive : elle ecrase la base et les uploads de production.
Faire un backup **avant**, meme apres un incident.

```bash
SQL=backups/badge-XXXX.sql
UPLOADS=backups/uploads-XXXX.tar.gz

$DOCKER exec badge-db sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"'
$DOCKER exec -i badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge' < "$SQL"

$DOCKER exec badge-app sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true'
$DOCKER run --rm -i -v badge_uploads_data:/data alpine tar -xzf - -C /data < "$UPLOADS"

$DOCKER restart badge-app
```

### Smoke tests

Le service `tools` (profile `tools`, stage `builder`) contient `scripts/` et
`tsx`, absents de l'image runner.

```bash
$PROD run --rm tools yarn tsx scripts/smoke-tests.ts
$PREP run --rm tools yarn tsx scripts/smoke-tests.ts
```

### Inspecter images et volumes

```bash
$DOCKER images | grep badge
$DOCKER volume ls --format '{{.Name}}' | sort
```

Les tags attendus sont `badge-app:prod`, `badge-app:preprod`,
`badge-tools:prod`, `badge-tools:preprod`, `badge-caddy:prod`. Un build de
preprod n'ecrase jamais l'image servant la production.
````

- [ ] **Step 8 : Retirer de la documentation les references aux cibles supprimees**

Run :
```bash
grep -rn "make prod\|make preprod\|make upload\|make deploy\|make backup-prod\|make rollback-prod\|make smoke-tests\|make caddy-reload\|make caddy-check\|make caddy-logs\|make download-\|docker-compose.preprod.yml\|~/prod/badge\|~/preprod/badge" docs/ README.md CLAUDE.md
```
Expected : chaque occurrence est soit mise a jour vers `make deploy-prod` / `make deploy-preprod` / la nouvelle section d'exploitation, soit supprimee. Exceptions legitimes a conserver telles quelles : les specs et plans **historiques** de `docs/v4/specs/` et `docs/v4/plans/`, qui documentent un etat passe — sauf la spec de backups, traitee en Task 6.

- [ ] **Step 9 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add Makefile docs/
git commit -m "refactor(infra): deploiement par contexte docker ssh, doc d'exploitation"
```

---

## Task 3 : Bascule de la preproduction

**Files:** aucun fichier modifie. Cette task est operationnelle.

**Interfaces:**
- Consumes: `make deploy-preprod` (Task 2), l'etat de reference des volumes (Task 2, Step 2).
- Produces: la validation qui debloque la Task 5.

> **Action a risque.** Chaque step de cette task agit sur la preproduction. Annoncer et faire confirmer avant execution.

- [ ] **Step 1 : Backup preventif de la preprod**

Meme si la preprod est reconstructible, un volume recree par erreur doit rester rattrapable.

Run :
```bash
mkdir -p backups
docker --context badge exec badge-db-preprod sh -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers badge' \
  > backups/preprod-pre-bascule.sql
ls -lh backups/preprod-pre-bascule.sql
```
Expected : fichier non vide (> 10 Ko).

- [ ] **Step 2 : Deployer**

Run :
```bash
make deploy-preprod
```
Expected : le build s'execute **sur le serveur** (les logs BuildKit defilent en local mais les etapes tournent a distance), puis `Container badge-app-preprod Started`. Duree du premier build : plusieurs minutes (aucun cache pour la nouvelle base). Les suivants sont incrementaux.

En cas d'echec sur le transfert du contexte, ne pas relancer en boucle : verifier `.dockerignore` (Task 1, Step 6) et la taille du contexte avec `du -sh --exclude=node_modules --exclude=.next --exclude=.git .`.

- [ ] **Step 3 : Verifier qu'aucun volume n'a ete recree**

Run :
```bash
docker --context badge volume ls --format '{{.Name}}' | sort | grep preprod
```
Expected — exactement les trois noms releves en Task 2, Step 2 :
```
badge-preprod_minio_data_preprod
badge-preprod_mysql_data_preprod
badge-preprod_uploads_data_preprod
```
Si un nom sans suffixe apparait (`badge-preprod_mysql_data`), **s'arreter immediatement** : Compose a cree des volumes vides. Corriger les `name:` de `compose/preprod.yml`, faire `down`, supprimer les volumes parasites, redeployer.

- [ ] **Step 4 : Verifier la sante des conteneurs**

Run :
```bash
docker --context badge ps --filter name=preprod --format '{{.Names}}\t{{.Status}}'
```
Expected : `badge-app-preprod`, `badge-db-preprod`, `badge-pma-preprod`, `badge-minio-preprod` en `Up`, la base en `Up (healthy)`.

Run :
```bash
docker --context badge logs --tail 40 badge-app-preprod
```
Expected : `Running database migrations...` puis `Starting application...` puis le demarrage Next.js, sans trace d'erreur de connexion BDD ou S3.

- [ ] **Step 5 : Verifier que les donnees sont intactes**

Run :
```bash
docker --context badge exec badge-db-preprod sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM badge.Organization; SELECT COUNT(*) FROM badge.Event;"'
```
Expected : les memes ordres de grandeur qu'avant la bascule (a relever avant le Step 2 si un doute existe). Zero partout signifie une base vide -> volume recree, revenir au Step 3.

- [ ] **Step 6 : Verifier le service derriere Caddy**

Run :
```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://preprod.badge.bj
```
Expected : `200`.

- [ ] **Step 7 : Verifier que MySQL n'est plus joignable de l'exterieur**

Run :
```bash
nc -zv -w 3 173.212.217.54 33061
```
Expected : echec de connexion (`Connection refused` ou timeout). Un succes signifie que l'ancien conteneur publiant le port tourne encore.

- [ ] **Step 8 : Smoke tests**

Run :
```bash
docker --context badge compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod \
  run --rm tools yarn tsx scripts/smoke-tests.ts
```
Expected : tous verts.

- [ ] **Step 9 : Consigner le resultat dans la table de Progression**

Mettre la Task 3 a `[x]`, dater, et noter les eventuels ecarts constates (duree de build, avertissements).

---

## Task 4 : Reconciliation de `.env.production`

**Files:**
- Modify: `.env.production` (**hors depot** — ce fichier est gitignore ; ne jamais le commiter)
- Modify: `.env.production.example`

**Interfaces:**
- Consumes: la liste des variables lues par le code, etablie dans « Etat initial ».
- Produces: un `.env.production` complet, pre-requis dur de la Task 5.

> **Bloquant.** Deployer la Task 5 avec le `.env.production` actuel produirait une application de production sans configuration S3 ni SMTP, et un MinIO aux identifiants par defaut. Cette task exige des **valeurs secretes que seul l'utilisateur peut fournir** : ne rien inventer, ne rien recopier depuis `.env.preprod`.

- [ ] **Step 1 : Etablir l'ecart exact**

Run :
```bash
comm -13 <(grep -oE "^[A-Z0-9_]+" .env.production | sort -u) \
         <(grep -oE "^[A-Z0-9_]+" .env.preprod    | sort -u)
```
Expected : la liste des cles presentes en preprod et absentes en prod. Au 2026-07-22 :
```
BASE_URL
MINIO_ROOT_PASSWORD
MINIO_ROOT_USER
NEXT_PUBLIC_RECAPTCHA_SITE_KEY
PLATFORM_SMTP_FROM
PLATFORM_SMTP_HOST
PLATFORM_SMTP_PASSWORD
PLATFORM_SMTP_PORT
PLATFORM_SMTP_SECURE
PLATFORM_SMTP_USER
S3_ACCESS_KEY
S3_BUCKET
S3_ENDPOINT
S3_REGION
S3_SECRET_KEY
UPLOAD_TOKEN_SECRET
```

Et l'ecart inverse (cles obsoletes en prod) :
```bash
comm -23 <(grep -oE "^[A-Z0-9_]+" .env.production | sort -u) \
         <(grep -oE "^[A-Z0-9_]+" .env.preprod    | sort -u)
```
Expected : `RECAPTCHA_SITE_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PASSWORD`, `SMTP_PORT`, `SMTP_USER`.

- [ ] **Step 2 : Demander a l'utilisateur les valeurs manquantes**

Presenter la liste du Step 1 et demander, poste par poste :
- **SMTP plateforme** (`PLATFORM_SMTP_*`) : le SMTP de production. Rappel `docs/v4` : le SMTP est **plateforme uniquement**, sans cascade.
- **MinIO** (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`) : identifiants a definir. **Attention** — le conteneur MinIO de prod tourne aujourd'hui avec les valeurs par defaut (`minioadmin`). Changer ces variables sur un MinIO deja initialise ne modifie pas les comptes existants ; il faudra creer le nouveau compte via la console avant, ou assumer de conserver l'existant. A trancher avec l'utilisateur.
- **S3** (`S3_*`) : `S3_ENDPOINT` pointe le MinIO interne (`http://minio:9000`), `S3_BUCKET` et `S3_REGION` a definir, `S3_ACCESS_KEY` / `S3_SECRET_KEY` cohérents avec MinIO.
- **`UPLOAD_TOKEN_SECRET`** : secret aleatoire, a generer (`openssl rand -hex 32`). Ne **pas** reutiliser celui de preprod.
- **`BASE_URL`** : `https://badge.bj`.
- **`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`** : la cle publique reCAPTCHA de production.

Ne pas ecrire le fichier tant que toutes les valeurs ne sont pas obtenues. En cas de blocage sur un poste, s'arreter et le signaler.

- [ ] **Step 3 : Ecrire `.env.production`**

Ajouter les cles manquantes et retirer les huit cles obsoletes listees au Step 1. Conserver `DATABASE_URL`, `MYSQL_ROOT_PASSWORD`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `RECAPTCHA_SECRET_KEY` a l'identique — **ne pas regenerer `NEXTAUTH_SECRET`**, cela invaliderait toutes les sessions en cours.

- [ ] **Step 4 : Verifier qu'il ne manque plus rien**

Run :
```bash
comm -13 <(grep -oE "^[A-Z0-9_]+" .env.production | sort -u) \
         <(grep -oE "^[A-Z0-9_]+" .env.preprod    | sort -u)
```
Expected : sortie **vide**.

Run :
```bash
docker compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production config \
  | grep -E "S3_ENDPOINT|UPLOAD_TOKEN_SECRET|PLATFORM_SMTP_HOST|BASE_URL"
```
Expected : les quatre variables apparaissent, resolues, sur le service `app`.

- [ ] **Step 5 : Mettre `.env.production.example` a jour**

Aligner l'exemple sur les cles reelles, **valeurs remplacees par des placeholders**. Ce fichier-la est versionne : verifier qu'aucun secret n'y figure.

Run :
```bash
git diff .env.production.example
git status --short .env.production
```
Expected : le diff de l'exemple ne contient que des placeholders ; `.env.production` **n'apparait pas** dans `git status` (il est gitignore).

- [ ] **Step 6 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add .env.production.example
git commit -m "chore(infra): aligne .env.production.example sur les variables v4"
```

---

## Task 5 : Bascule de la production

**Files:** aucun fichier modifie. Cette task est operationnelle.

**Interfaces:**
- Consumes: `make deploy-prod` (Task 2), la validation preprod (Task 3), `.env.production` reconcilie (Task 4).
- Produces: la validation qui debloque la Task 6.

> **Action a risque maximale.** Chaque step agit sur la production en service. Annoncer et faire confirmer chaque step. Ne pas enchainer sans verifier.

- [ ] **Step 1 : Verifier les pre-requis**

Les Tasks 3 et 4 doivent etre a `[x]` dans la table de Progression. Si `.env.production` n'a pas ete reconcilie, **s'arreter** : le deploiement produirait une prod sans S3 ni SMTP.

- [ ] **Step 2 : Backup complet de la production**

Run :
```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker --context badge exec badge-db sh -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers badge' \
  > backups/badge-$TS.sql
docker --context badge run --rm -v badge_uploads_data:/data alpine \
  tar -czf - -C /data . > backups/uploads-$TS.tar.gz
ls -lh backups/badge-$TS.sql backups/uploads-$TS.tar.gz
```
Expected : deux fichiers non vides. Un dump de quelques centaines d'octets signale un echec d'authentification — **ne pas continuer**.

- [ ] **Step 3 : Relever l'etat de reference avant bascule**

Run :
```bash
docker --context badge exec badge-db sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM badge.Organization; SELECT COUNT(*) FROM badge.Event; SELECT COUNT(*) FROM badge.Registration;"'
docker --context badge volume ls --format '{{.Name}}' | grep '^badge_' | sort
```
Noter les trois compteurs et les cinq noms de volumes : ils servent de reference au Step 6.

- [ ] **Step 4 : Deployer**

Run :
```bash
make deploy-prod
```
Expected : build sur le serveur, puis recreation des conteneurs. `badge-caddy` est recree (nouvelle image `badge-caddy:prod`) — coupure de l'ordre de la seconde. Les certificats survivent : ils vivent dans le volume `badge_caddy_data`, non recree.

- [ ] **Step 5 : Verifier la sante des conteneurs**

Run :
```bash
docker --context badge ps --filter name=badge- --format '{{.Names}}\t{{.Status}}' | grep -v preprod
docker --context badge logs --tail 40 badge-app
```
Expected : `badge-app`, `badge-db` (healthy), `badge-pma`, `badge-minio`, `badge-caddy` en `Up` ; logs applicatifs sans erreur de connexion BDD ou S3.

- [ ] **Step 6 : Verifier que les donnees sont intactes**

Run :
```bash
docker --context badge volume ls --format '{{.Name}}' | grep '^badge_' | sort
docker --context badge exec badge-db sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -e "SELECT COUNT(*) FROM badge.Organization; SELECT COUNT(*) FROM badge.Event; SELECT COUNT(*) FROM badge.Registration;"'
```
Expected : les memes cinq volumes et les memes trois compteurs qu'au Step 3. Tout ecart -> restaurer depuis le backup du Step 2 (procedure dans `docs/v4/installation.md`) avant d'aller plus loin.

- [ ] **Step 7 : Verifier le service**

Run :
```bash
for u in https://badge.bj https://pma.badge.bj https://s3.badge.bj \
         https://preprod.badge.bj https://preprod.pma.badge.bj https://preprod.s3.badge.bj; do
  printf '%s -> ' "$u"; curl -sS -o /dev/null -w '%{http_code}\n' "$u"
done
```
Expected : `200` (ou une redirection attendue) partout. Les trois URL preprod valident que le Caddy rebati sert **toujours** les deux environnements.

- [ ] **Step 8 : Verifier que MySQL n'est plus joignable de l'exterieur**

Run :
```bash
nc -zv -w 3 173.212.217.54 3306
```
Expected : echec de connexion.

- [ ] **Step 9 : Verifier les uploads et le stockage S3**

Ouvrir `https://badge.bj`, se connecter, afficher une page portant un logo d'organisation ou une photo servie par `/api/files`. Expected : l'image s'affiche. Un 404 ou une image cassee signale un probleme de configuration S3 (Task 4) — restaurer si necessaire.

- [ ] **Step 10 : Smoke tests**

Run :
```bash
docker --context badge compose -f docker-compose.yml -f compose/prod.yml --env-file .env.production \
  run --rm tools yarn tsx scripts/smoke-tests.ts
```
Expected : tous verts.

- [ ] **Step 11 : Verifier les tags d'image**

Run :
```bash
docker --context badge images --format '{{.Repository}}:{{.Tag}}' | grep badge | sort
```
Expected : `badge-app:preprod`, `badge-app:prod`, `badge-caddy:prod`, `badge-tools:preprod`, `badge-tools:prod`. La presence des deux tags distincts confirme qu'un build de preprod n'ecrase pas l'image de production.

- [ ] **Step 12 : Consigner le resultat dans la table de Progression**

---

## Task 6 : Rapatriement des backups, note de perimetre, nettoyage du serveur

**Files:**
- Modify: `docs/v4/specs/2026-05-31-v4-stockage-s3-et-backups.md` (note de perimetre)
- Modify: `.gitignore` si necessaire (verifier que `backups/` y figure deja)

**Interfaces:**
- Consumes: la validation des Tasks 3 et 5.
- Produces: l'etat final — serveur ne contenant que des images et des volumes.

- [ ] **Step 1 : Rapatrier les backups historiques du serveur**

Run :
```bash
mkdir -p backups/serveur-prod
rsync -avz root@173.212.217.54:~/prod/badge/backups/ backups/serveur-prod/
ls -lh backups/serveur-prod/ | head -20
```
Expected : les dumps et archives historiques sont presents en local. Verifier qu'aucun n'est de taille nulle.

Run :
```bash
grep -n "backups" .gitignore
```
Expected : `backups/` est ignore. Sinon, l'ajouter — ces fichiers ne doivent jamais partir dans git.

- [ ] **Step 2 : Verifier qu'il ne reste rien d'autre a recuperer**

Run :
```bash
ssh root@173.212.217.54 "ls -la ~/prod/badge ~/preprod/badge && du -sh ~/prod/badge ~/preprod/badge"
```
Expected : passer en revue le listing et confirmer avec l'utilisateur qu'aucun fichier n'a ete cree manuellement sur le serveur (script d'exploitation, note, certificat, dump ponctuel) et ne serait perdu. En cas de doute sur un fichier, le rapatrier avant.

- [ ] **Step 3 : Ajouter la note de perimetre a la spec de backups**

La spec `docs/v4/specs/2026-05-31-v4-stockage-s3-et-backups.md` (non implementee) prevoit un cron de l'hote appelant `make backup-prod` depuis `~/prod/badge`. Ces deux premisses n'existent plus.

Inserer juste apres le bloc de statut, en tete du fichier :

```markdown
> **Note de perimetre (2026-07-22)** — La refonte du deploiement
> ([spec](2026-07-22-05-v4-deploiement-contexte-docker.md)) supprime les deux
> premisses de cette spec : `make backup-prod` n'existe plus et le serveur n'a
> plus de checkout du depot. Le pipeline decrit ci-dessous doit etre revu avant
> implementation, soit sous forme d'un script embarque dans l'image et declenche
> via le contexte Docker, soit d'un cron serveur invoquant directement des
> commandes `docker`. Le declencheur et les chemins mentionnes plus bas sont
> donc **caducs** ; le reste de la spec (chiffrement `age`, retention GFS,
> perimetre du snapshot, procedure de restauration) reste valable.
```

- [ ] **Step 4 : Demander explicitement l'autorisation de supprimer les dossiers serveur**

Ne **jamais** enchainer automatiquement depuis le Step 3. Presenter a l'utilisateur : les deux environnements sont valides, les backups sont rapatries, voici ce qui sera supprime. Attendre une confirmation explicite.

- [ ] **Step 5 : Supprimer les checkouts serveur (apres confirmation seulement)**

Run :
```bash
ssh root@173.212.217.54 "rm -rf ~/prod/badge ~/preprod/badge"
ssh root@173.212.217.54 "ls -la ~/prod ~/preprod 2>/dev/null; echo '---'; ls ~"
```
Expected : les deux dossiers ont disparu. Les dossiers parents vides peuvent etre supprimes aussi.

- [ ] **Step 6 : Verifier l'etat final**

Run :
```bash
ssh root@173.212.217.54 "find ~ -maxdepth 3 -name '.env*' -o -maxdepth 3 -name 'docker-compose*.yml' | head"
```
Expected : sortie **vide** — aucun `.env` ni fichier Compose ne subsiste sur le serveur.

Run :
```bash
docker --context badge ps --format '{{.Names}}\t{{.Status}}'
curl -sS -o /dev/null -w 'prod %{http_code}\n' https://badge.bj
curl -sS -o /dev/null -w 'preprod %{http_code}\n' https://preprod.badge.bj
```
Expected : les neuf conteneurs `Up`, les deux environnements en `200`. La suppression des dossiers n'a rien casse.

- [ ] **Step 7 : Commit (uniquement si l'utilisateur le demande)**

```bash
git add docs/v4/specs/2026-05-31-v4-stockage-s3-et-backups.md .gitignore
git commit -m "docs(infra): note de perimetre sur la spec backups apres refonte du deploiement"
```

- [ ] **Step 8 : Cloturer la table de Progression**

Passer les six tasks a `[x]` avec leurs dates, et noter dans la ligne de la Task 6 tout ecart constate (fichiers serveur inattendus, backups manquants).

---

## Criteres d'acceptation globaux

- `make deploy-prod` et `make deploy-preprod` deploient les deux environnements depuis le poste, sans aucun SSH manuel.
- `find ~ -name '.env*' -o -name 'docker-compose*.yml'` sur le serveur ne retourne rien.
- Les neuf volumes portent exactement les memes noms qu'avant la bascule ; les compteurs BDD de prod sont inchanges.
- `docker --context badge images` montre les tags `:prod` et `:preprod` distincts.
- `https://badge.bj` et `https://preprod.badge.bj` repondent `200`, les images servies par `/api/files` s'affichent.
- Le port 3306 n'est plus joignable depuis l'exterieur, ni en prod ni en preprod.
- Le Makefile ne contient plus aucune cible distante hors `deploy-prod`, `deploy-preprod` et `ctx-check` ; les cibles de developpement sont intactes.
- `docs/v4/installation.md` documente toutes les operations d'exploitation qui ont perdu leur cible Make.
