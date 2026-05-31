# Stockage S3 (MinIO) et backups hebdomadaires — Implementation Plan

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0  | [ ] | -- | -- |
| 1  | [ ] | -- | -- |
| 2  | [ ] | -- | -- |
| 3  | [ ] | -- | -- |
| 4  | [ ] | -- | -- |
| 5  | [ ] | -- | -- |
| 6  | [ ] | -- | -- |
| 7  | [ ] | -- | -- |
| 8  | [ ] | -- | -- |
| 9  | [ ] | -- | -- |
| 10 | [ ] | -- | -- |
| 11 | [ ] | -- | -- |
| 12 | [ ] | -- | -- |
| 13 | [ ] | -- | -- |
| 14 | [ ] | -- | -- |
| 15 | [ ] | -- | -- |
| 16 | [ ] | -- | -- |
| 17 | [ ] | -- | -- |
| 18 | [ ] | -- | -- |
| 19 | [ ] | -- | -- |
| 20 | [ ] | -- | -- |
| 21 | [ ] | -- | -- |
| 22 | [ ] | -- | -- |
| 23 | [ ] | -- | -- |
| 24 | [ ] | -- | -- |

**Derniere session** : aucune, plan jamais commence.
**Prochaine etape** : Task 0.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le stockage S3 multi-tenant via MinIO self-hosted et un pipeline complet de sauvegarde hebdomadaire (BDD + bucket + config) chiffre par age, pousse vers Hetzner Storage Box, avec restauration interactive et garde-fous.

**Architecture:** Service MinIO ajoute a Docker Compose, expose en interne uniquement en prod. Bucket unique `badge-{env}` avec prefixes `orgs/{orgId}/events/{eventId}/...`. Adaptation de `src/lib/storage.ts` vers `@aws-sdk/client-s3` (API stable, implementation S3). Pipeline backup en script shell maison (`mysqldump` + `mc mirror` + `tar | zstd | age` streaming) declenche par cron de l'hote chaque dimanche 03h00. Push vers Hetzner Storage Box (BX11, 3,20 EUR/mois fixe 1 To) via rclone SFTP. Retention GFS 4 hebdo + 6 mensuels. Restore interactif avec double confirmation et snapshot de precaution automatique. Monitoring par email SMTP synchrone + log JSON local rotatif.

**Tech Stack:** MinIO (latest), `@aws-sdk/client-s3` v3, GNU Make, Bash, `mc` (MinIO Client), `rclone` (SFTP), `age` (chiffrement asymetrique), `zstd`, `jq`, `msmtp`, `mysqldump`, Prisma 6, Vitest 4, Docker Compose 2, logrotate, cron.

**Spec:** [`docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md`](../specs/2026-05-31-v2-08-stockage-s3-et-backups.md)

---

## File Structure

**Files to create:**

- `docker-compose.restore-test.yml` -- environnement isole pour `scripts/test-restore.sh`
- `prisma/schema.prisma` -- modifie (ajout `ActivityType.BACKUP_RESTORE`)
- `src/lib/__tests__/storage.test.ts` -- tests integration contre MinIO de dev
- `scripts/backup-prod.sh` -- orchestrateur principal du backup
- `scripts/restore-from-backup.sh` -- restore interactif depuis snapshot
- `scripts/test-restore.sh` -- test trimestriel manuel restore isole
- `scripts/rotate-snapshots.sh` -- retention GFS local + distant
- `scripts/list-snapshots.sh` -- fusion liste locale + distante
- `scripts/minio-init.sh` -- bootstrap bucket + cle applicative + policy
- `scripts/install-backup-deps.sh` -- installation des binaires (root)
- `scripts/audit-permissions.sh` -- verifie les permissions filesystem
- `scripts/_lib/log.sh` -- helpers log JSON Lines + stdout
- `scripts/_lib/email.sh` -- envoi msmtp + templates succes/echec
- `scripts/_lib/env.sh` -- chargement `.env.production` + validation des vars requises
- `ops/cron/badge-backup` -- crontab a deposer dans `/etc/cron.d/`
- `ops/logrotate/badge-backup` -- config logrotate a deposer dans `/etc/logrotate.d/`
- `ops/rclone/rclone.conf.example` -- template config Hetzner SFTP
- `ops/age/age-recipients.txt.example` -- template recipients age
- `docs/v2/features/stockage-fichiers-s3.md` -- doc fonctionnelle stockage
- `docs/v2/features/backups-hebdomadaires.md` -- doc fonctionnelle backups
- `docs/v2/operations/README.md` -- index des runbooks ops
- `docs/v2/operations/restore.md` -- procedure de restauration detaillee
- `docs/v2/operations/age-keys.md` -- creation/rotation/coffre des cles age

**Files to modify:**

- `docker-compose.yml` -- ajout service `minio`, volume `minio-data`, retrait `uploads_data` du service `app`
- `docker-compose.dev.yml` -- ajout service `minio`
- `docker/compose.dev.env` -- ajout variables `S3_*`, `MINIO_*`
- `.env.example` -- ajout variables `S3_*`, `MINIO_*`, `BACKUP_*`, `RCLONE_*`, `HETZNER_*`, `BACKUP_NOTIFY_EMAIL`, `AGE_RECIPIENTS_FILE`
- `.env.production.example` -- meme ajouts que `.env.example`, valeurs vides
- `.gitignore` -- ajout `ops/rclone/rclone.conf`, `ops/age/age-recipients.txt`
- `package.json` -- ajout `@aws-sdk/client-s3`
- `prisma/schema.prisma` -- ajout `ActivityType.BACKUP_RESTORE`
- `src/lib/storage.ts` -- bascule `fs/promises` -> `@aws-sdk/client-s3`, ajout `deleteFile`/`deletePrefix`
- `src/app/api/files/[...path]/route.ts` -- adaptation pour la nouvelle API
- `src/app/api/upload/route.ts` -- adaptation pour la nouvelle structure de cles
- `Makefile` -- ajout cibles `minio-init`, `backup-prod`, `backup-prod-dry-run`, `backup-list`, `backup-list-local`, `backup-list-remote`, `restore-from-backup`, `install-backup-deps`
- `docs/v2/features/deploiement-initial.md` -- renvoi vers les nouvelles features stockage et backups
- `docs/v2/README.md` -- entree 8 dans les tableaux sous-specs et plans
- `docs/v2/architecture.md` -- mention MinIO et bucket multi-tenant

**Files removed:** aucun.

---

## Pre-flight

### Task 0: Verifier l'etat du depot et les pre-requis

- [ ] **Step 0.1: Confirmer la branche et l'absence de modifications en cours**

Run: `git status && git branch --show-current`

Expected: `On branch feat/v2-sass`, working tree clean (ou avec uniquement des fichiers untracked sans rapport).

- [ ] **Step 0.2: Verifier la presence de la spec**

Run: `test -f docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md && echo OK`

Expected: `OK`. Si absent, la spec doit etre committee avant d'executer ce plan (`docs(v2): spec v2-08 stockage S3 (MinIO) et backups hebdomadaires`).

- [ ] **Step 0.3: Verifier que les conteneurs dev tournent**

Run: `docker compose -f docker-compose.dev.yml ps`

Expected: services `app`, `mysql`, `mailpit`, `phpmyadmin` en `running`. Sinon : `make dev`.

- [ ] **Step 0.4: Verifier la version de Node et yarn dans le conteneur app**

Run: `docker compose -f docker-compose.dev.yml exec app sh -c 'node --version && yarn --version'`

Expected: Node >= 22.x, yarn >= 4.x (corepack).

- [ ] **Step 0.5: Repertorier les appelants actuels de storage.ts**

Run: `grep -rn --include="*.ts" --include="*.tsx" "from.*['\"]@/lib/storage['\"]" src/`

Expected: exactement 2 lignes :
- `src/app/api/files/[...path]/route.ts:2:import { getFile } from "@/lib/storage";`
- `src/app/api/upload/route.ts:4:import { uploadFile } from "@/lib/storage";`

Si d'autres appelants existent, les noter pour les inclure dans Task 4.

- [ ] **Step 0.6: Note de demarrage**

Aucune commande. Cette task est purement un check d'environnement. Pas de commit.

---

## Palier 1 -- Infrastructure stockage MinIO

> Objectif du palier : MinIO tourne dans Docker (dev + prod), le bucket est cree, une cle applicative scopee est generee, la cible `make minio-init` est idempotente. Aucun code applicatif n'est encore modifie.

### Task 1: Ajouter le service MinIO a Docker Compose (dev + prod) et les variables d'env

**Files:**

- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `docker/compose.dev.env`
- Modify: `.env.example`
- Modify: `.env.production.example`

- [ ] **Step 1.1: Ajouter le service `minio` a `docker-compose.yml` (prod)**

Modifier `docker-compose.yml` pour ajouter le service `minio` avant la section `volumes:`, et ajouter `minio-data` dans la liste des volumes. Le service n'expose aucun port public (acces interne uniquement, via le reseau Docker par defaut).

Remplacer integralement le contenu du fichier par :

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: badge-caddy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
      - phpmyadmin
    restart: unless-stopped

  app:
    container_name: badge-app
    build:
      context: .
      dockerfile: Dockerfile
    expose:
      - "3000"
    env_file:
      - .env.production
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_started
    restart: unless-stopped

  phpmyadmin:
    container_name: badge-pma
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
    container_name: badge-db
    image: mysql:8
    env_file:
      - .env.production
    environment:
      MYSQL_DATABASE: badge
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  minio:
    container_name: badge-minio
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    env_file:
      - .env.production
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql_data:
  caddy_data:
  caddy_config:
  minio_data:
```

> Changements importants :
> - Le volume `uploads_data` est **retire** du service `app` (la v2 n'ecrit plus sur le filesystem local : tout passe par MinIO). Le volume `uploads_data` ne figure plus dans la liste des volumes nommes.
> - Le service `app` declare `depends_on: minio: condition: service_started` pour garantir que MinIO est lance avant l'app (le SDK S3 echouera autrement au premier upload).
> - Aucun port MinIO n'est expose publiquement (`9000` et `9001` restent internes au reseau Docker).

- [ ] **Step 1.2: Ajouter le service `minio` a `docker-compose.dev.yml`**

Modifier `docker-compose.dev.yml` pour ajouter le service `minio` avec ports exposes sur l'hote (`9000` data, `9001` console) pour introspection en dev :

Remplacer integralement le contenu du fichier par :

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    env_file:
      - docker/compose.dev.env
      - path: .env
        required: false
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_started

  mysql:
    image: mysql:8
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: badge
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  phpmyadmin:
    image: phpmyadmin
    ports:
      - "8080:80"
    environment:
      PMA_HOST: mysql
      PMA_USER: root
      PMA_PASSWORD: password
    depends_on:
      mysql:
        condition: service_healthy

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    env_file:
      - docker/compose.dev.env
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
  minio_data:
```

- [ ] **Step 1.3: Ajouter les variables MinIO a `docker/compose.dev.env`**

Lire le fichier actuel :

```bash
cat docker/compose.dev.env
```

Ajouter a la fin (sans toucher aux variables existantes) :

```
# MinIO (S3-compatible local pour dev)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=badge-app-dev
S3_SECRET_KEY=badge-app-dev-secret-change-me
S3_BUCKET=badge-dev
```

> Les valeurs dev sont volontairement faibles (env de dev seulement). En prod, les memes variables seront definies avec des secrets forts dans `.env.production`.

- [ ] **Step 1.4: Ajouter les variables MinIO a `.env.example`**

Si `.env.example` existe a la racine, lui ajouter le meme bloc qu'a l'etape precedente (`MINIO_*` et `S3_*`) ainsi que les variables backup. Sinon, le creer avec uniquement le bloc cible v2-08 :

Ajouter a `.env.example` (creer le fichier s'il n'existe pas) :

```
# === MinIO (stockage S3-compatible) ===
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=badge-app
S3_SECRET_KEY=CHANGE_ME
S3_BUCKET=badge-dev

# === Backup ===
BACKUP_LOCAL_DIR=/var/backups/badge/snapshots
BACKUP_STAGING_DIR=/var/backups/badge/staging
BACKUP_LOG_DIR=/var/log/badge
AGE_RECIPIENTS_FILE=/etc/badge/age-recipients.txt
RCLONE_CONFIG=/etc/badge/rclone.conf
HETZNER_REMOTE_NAME=hetzner
HETZNER_REMOTE_PATH=badge-backups
RETENTION_WEEKLY=4
RETENTION_MONTHLY=6
BACKUP_NOTIFY_EMAIL=ops@example.tld
```

> Si `.env.example` a deja un contenu, ajouter ce bloc a la fin sans toucher au reste.

- [ ] **Step 1.5: Ajouter les memes variables a `.env.production.example`**

Si `.env.production.example` existe (cree par le plan v2-07), lui ajouter exactement le meme bloc qu'a l'etape 1.4, avec les valeurs prefixees `CHANGE_ME` :

Ajouter a la fin de `.env.production.example` :

```
# === MinIO (stockage S3-compatible) ===
MINIO_ROOT_USER=CHANGE_ME
MINIO_ROOT_PASSWORD=CHANGE_ME_long_random_secret
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=badge-app
S3_SECRET_KEY=CHANGE_ME_app_scoped_key
S3_BUCKET=badge-prod

# === Backup ===
BACKUP_LOCAL_DIR=/var/backups/badge/snapshots
BACKUP_STAGING_DIR=/var/backups/badge/staging
BACKUP_LOG_DIR=/var/log/badge
AGE_RECIPIENTS_FILE=/etc/badge/age-recipients.txt
RCLONE_CONFIG=/etc/badge/rclone.conf
HETZNER_REMOTE_NAME=hetzner
HETZNER_REMOTE_PATH=badge-backups
RETENTION_WEEKLY=4
RETENTION_MONTHLY=6
BACKUP_NOTIFY_EMAIL=ops@example.tld
```

Si `.env.production.example` n'existe pas encore (plan v2-07 non execute), le creer avec uniquement ce bloc et noter dans le commit que les variables non-v2-08 viendront via v2-07.

- [ ] **Step 1.6: Demarrer la stack dev avec MinIO**

```bash
make dev-down
make dev
```

Verifier que MinIO est `running` :

```bash
docker compose -f docker-compose.dev.yml ps
```

Expected: 5 services en `running`, dont `<dir>-minio-1` (le prefixe varie selon le nom du projet Compose).

- [ ] **Step 1.7: Verifier l'acces a la console MinIO de dev**

Ouvrir `http://localhost:9001` dans un navigateur, ou faire :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9001
```

Expected: `200`.

Login avec `minioadmin` / `minioadmin`. La console s'ouvre, aucun bucket n'est encore present (cree par Task 2).

- [ ] **Step 1.8: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml docker/compose.dev.env .env.example .env.production.example
git commit -m "feat(v2): ajouter service MinIO a docker-compose dev et prod"
```

---

### Task 2: Script `minio-init.sh` + cible Makefile `minio-init`

**Files:**

- Create: `scripts/minio-init.sh`
- Modify: `Makefile`

> Ce script est idempotent : il cree le bucket si absent, cree la cle applicative si absente, attache une policy scopee. Execute en dev manuellement, en prod au deploiement initial.

- [ ] **Step 2.1: Creer `scripts/minio-init.sh`**

Creer le fichier avec le contenu suivant :

```bash
#!/usr/bin/env bash
#
# minio-init.sh
# Bootstrap idempotent du bucket et de la cle applicative pour Badge v2.
#
# Pre-requis : `mc` (MinIO Client) doit etre installe et accessible dans PATH,
# soit cote hote, soit cote conteneur via `docker compose exec -T minio mc`.
#
# Variables d'env requises :
#   MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
#   S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
#
# Mode :
#   - Par defaut : utilise `mc` cote hote, point d'acces $S3_ENDPOINT
#   - DOCKER=1   : utilise `docker compose exec -T minio mc`

set -euo pipefail

# --- Chargement env ---
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi
if [ -f .env.production ] && [ "${USE_PROD_ENV:-0}" = "1" ]; then
  set -a; . ./.env.production; set +a
fi
if [ -f docker/compose.dev.env ] && [ "${USE_DEV_ENV:-1}" = "1" ]; then
  set -a; . ./docker/compose.dev.env; set +a
fi

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER manquant}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD manquant}"
: "${S3_ENDPOINT:?S3_ENDPOINT manquant}"
: "${S3_BUCKET:?S3_BUCKET manquant}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY manquant}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY manquant}"

# --- Helpers ---
MC_ALIAS="badge-init"

mc_cmd() {
  if [ "${DOCKER:-0}" = "1" ]; then
    docker compose -f docker-compose.dev.yml exec -T minio mc "$@"
  else
    mc "$@"
  fi
}

log() { printf '[minio-init] %s\n' "$*"; }

# --- 1. Alias mc vers MinIO ---
log "Configuration de l'alias mc ($MC_ALIAS -> $S3_ENDPOINT)"
mc_cmd alias set "$MC_ALIAS" "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null

# --- 2. Bucket ---
if mc_cmd ls "$MC_ALIAS/$S3_BUCKET" > /dev/null 2>&1; then
  log "Bucket '$S3_BUCKET' existe deja, OK"
else
  log "Creation du bucket '$S3_BUCKET'"
  mc_cmd mb "$MC_ALIAS/$S3_BUCKET"
fi

# --- 3. Policy applicative scopee sur le bucket ---
POLICY_NAME="badge-app-${S3_BUCKET}"
POLICY_FILE="$(mktemp)"
trap 'rm -f "$POLICY_FILE"' EXIT

cat > "$POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::${S3_BUCKET}"
    }
  ]
}
JSON

log "Creation/mise a jour de la policy '$POLICY_NAME'"
if [ "${DOCKER:-0}" = "1" ]; then
  docker cp "$POLICY_FILE" "$(docker compose -f docker-compose.dev.yml ps -q minio):/tmp/policy.json"
  mc_cmd admin policy create "$MC_ALIAS" "$POLICY_NAME" /tmp/policy.json || \
    mc_cmd admin policy update "$MC_ALIAS" "$POLICY_NAME" /tmp/policy.json
else
  mc_cmd admin policy create "$MC_ALIAS" "$POLICY_NAME" "$POLICY_FILE" 2>/dev/null || \
    mc_cmd admin policy update "$MC_ALIAS" "$POLICY_NAME" "$POLICY_FILE"
fi

# --- 4. Cle applicative ---
if mc_cmd admin user info "$MC_ALIAS" "$S3_ACCESS_KEY" > /dev/null 2>&1; then
  log "Cle applicative '$S3_ACCESS_KEY' existe deja, OK"
else
  log "Creation de la cle applicative '$S3_ACCESS_KEY'"
  mc_cmd admin user add "$MC_ALIAS" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
fi

log "Attachement de la policy '$POLICY_NAME' a la cle '$S3_ACCESS_KEY'"
mc_cmd admin policy attach "$MC_ALIAS" "$POLICY_NAME" --user "$S3_ACCESS_KEY" 2>/dev/null || true

log "Init MinIO termine. Bucket=$S3_BUCKET, Cle=$S3_ACCESS_KEY, Policy=$POLICY_NAME"
```

Rendre le script executable :

```bash
chmod +x scripts/minio-init.sh
```

- [ ] **Step 2.2: Ajouter la cible `minio-init` au Makefile**

Editer `Makefile` :

1. Ajouter `minio-init` dans la ligne `.PHONY` (premiere ligne).
2. Ajouter le bloc suivant a la fin du fichier (apres la section deploiement) :

```makefile

# ============================================================
#  MinIO (stockage S3-compatible)
# ============================================================
minio-init:
	@DOCKER=1 bash scripts/minio-init.sh

minio-init-prod:
	@USE_PROD_ENV=1 USE_DEV_ENV=0 DOCKER=0 bash scripts/minio-init.sh
```

> `minio-init` (dev) utilise `docker compose exec` car `mc` n'est pas installe sur l'hote du dev. `minio-init-prod` utilise `mc` cote hote (installe par `make install-backup-deps` en Task 7).

- [ ] **Step 2.3: Executer `make minio-init` en dev**

```bash
make minio-init
```

Expected (sortie partielle) :

```
[minio-init] Configuration de l'alias mc (badge-init -> http://minio:9000)
[minio-init] Creation du bucket 'badge-dev'
[minio-init] Creation/mise a jour de la policy 'badge-app-badge-dev'
[minio-init] Creation de la cle applicative 'badge-app-dev'
[minio-init] Attachement de la policy ... a la cle ...
[minio-init] Init MinIO termine. Bucket=badge-dev, Cle=badge-app-dev, Policy=badge-app-badge-dev
```

- [ ] **Step 2.4: Verifier l'idempotence (relancer la commande)**

```bash
make minio-init
```

Expected :

```
[minio-init] Configuration de l'alias mc ...
[minio-init] Bucket 'badge-dev' existe deja, OK
[minio-init] Creation/mise a jour de la policy ...
[minio-init] Cle applicative 'badge-app-dev' existe deja, OK
[minio-init] Attachement de la policy ...
[minio-init] Init MinIO termine. ...
```

Aucune erreur. La commande peut etre relancee N fois.

- [ ] **Step 2.5: Verifier la cle applicative dans la console MinIO**

Ouvrir `http://localhost:9001`, login `minioadmin/minioadmin`, naviguer dans `Identity > Users` : `badge-app-dev` doit apparaitre avec la policy `badge-app-badge-dev` attachee.

Naviguer dans `Buckets` : `badge-dev` doit apparaitre.

- [ ] **Step 2.6: Tester l'isolation de la cle applicative**

Configurer un alias `mc` avec la cle applicative et tenter une operation non-autorisee :

```bash
docker compose -f docker-compose.dev.yml exec -T minio mc alias set badge-app http://minio:9000 badge-app-dev badge-app-dev-secret-change-me
docker compose -f docker-compose.dev.yml exec -T minio mc mb badge-app/autre-bucket 2>&1 || true
```

Expected: la creation du bucket echoue avec une erreur d'autorisation (`Access Denied` ou equivalent). C'est le comportement attendu : la policy ne permet pas `s3:CreateBucket`.

- [ ] **Step 2.7: Commit**

```bash
git add scripts/minio-init.sh Makefile
git commit -m "feat(v2): script minio-init idempotent et cibles Makefile"
```

---

## Palier 2 -- Adaptation du code applicatif

> Objectif : `src/lib/storage.ts` bascule de `fs/promises` vers `@aws-sdk/client-s3`, expose `uploadFile`, `getFile`, `deleteFile`, `deletePrefix`, et les 2 appelants existants migrent vers la nouvelle API et la nouvelle structure de cles. TDD : tests d'integration contre le MinIO de dev en premier.

### Task 3: Installer `@aws-sdk/client-s3` et reecrire `src/lib/storage.ts` en TDD

**Files:**

- Modify: `package.json`
- Create: `src/lib/__tests__/storage.test.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 3.1: Installer la dependance**

```bash
docker compose -f docker-compose.dev.yml exec app yarn add @aws-sdk/client-s3
```

Verifier qu'elle figure dans `package.json` :

```bash
grep -E '"@aws-sdk/client-s3"' package.json
```

Expected: une ligne comme `"@aws-sdk/client-s3": "^3.x.x"`.

- [ ] **Step 3.2: Ecrire le test d'integration FAILING**

Creer `src/lib/__tests__/storage.test.ts` :

```typescript
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  uploadFile,
  getFile,
  deleteFile,
  deletePrefix,
} from "../storage";

const TEST_PREFIX = "test-suite/";

async function cleanup() {
  await deletePrefix(TEST_PREFIX);
}

beforeAll(async () => {
  // Pre-flight : s'assurer que la connexion S3 fonctionne et que le bucket existe.
  // Si MinIO n'est pas accessible, le test echoue ici avec un message clair.
  await deletePrefix(TEST_PREFIX);
});

afterEach(async () => {
  await cleanup();
});

describe("storage (S3 / MinIO)", () => {
  it("uploadFile + getFile round-trip", async () => {
    const key = `${TEST_PREFIX}hello.txt`;
    const body = Buffer.from("Hello MinIO");
    const contentType = "text/plain";

    const returnedKey = await uploadFile(key, body, contentType);
    expect(returnedKey).toBe(key);

    const fetched = await getFile(key);
    expect(fetched.body.toString("utf-8")).toBe("Hello MinIO");
    expect(fetched.contentType).toBe(contentType);
  });

  it("deleteFile supprime un objet", async () => {
    const key = `${TEST_PREFIX}to-delete.txt`;
    await uploadFile(key, Buffer.from("x"), "text/plain");
    await deleteFile(key);
    await expect(getFile(key)).rejects.toThrow();
  });

  it("deletePrefix supprime tout l'arbre sous un prefixe", async () => {
    await uploadFile(`${TEST_PREFIX}orgs/abc/logo.png`, Buffer.from("1"), "image/png");
    await uploadFile(`${TEST_PREFIX}orgs/abc/events/e1/badge.pdf`, Buffer.from("2"), "application/pdf");
    await uploadFile(`${TEST_PREFIX}orgs/xyz/logo.png`, Buffer.from("3"), "image/png");

    const removed = await deletePrefix(`${TEST_PREFIX}orgs/abc/`);
    expect(removed).toBe(2);

    // L'org xyz survit
    const xyz = await getFile(`${TEST_PREFIX}orgs/xyz/logo.png`);
    expect(xyz.body.toString("utf-8")).toBe("3");
  });

  it("getFile sur cle inexistante leve une erreur", async () => {
    await expect(getFile(`${TEST_PREFIX}does-not-exist.txt`)).rejects.toThrow();
  });

  it("uploadFile preserve le contentType binaire", async () => {
    const key = `${TEST_PREFIX}img.png`;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await uploadFile(key, png, "image/png");
    const fetched = await getFile(key);
    expect(fetched.contentType).toBe("image/png");
    expect(fetched.body.equals(png)).toBe(true);
  });
});
```

- [ ] **Step 3.3: Lancer le test, confirmer l'echec attendu**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/storage.test.ts
```

Expected: FAIL. Les imports `deleteFile` et `deletePrefix` n'existent pas encore dans `storage.ts`, et les tests echouent au compile time.

- [ ] **Step 3.4: Reecrire `src/lib/storage.ts` avec le SDK S3**

Remplacer integralement le contenu de `src/lib/storage.ts` par :

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET ?? "";

if (!BUCKET) {
  // Avertissement non-bloquant : utile en build statique ou en migration.
  // Toute operation reelle sans BUCKET produira une erreur claire de l'SDK.
  console.warn("[storage] S3_BUCKET non defini : les operations storage echoueront.");
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getFile(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) {
    throw new Error(`Objet introuvable : ${key}`);
  }
  const chunks: Buffer[] = [];
  // res.Body est un AsyncIterable<Uint8Array> cote Node
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return {
    body: Buffer.concat(chunks),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deletePrefix(prefix: string): Promise<number> {
  let total = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (list.Contents ?? [])
      .map((obj) => obj.Key)
      .filter((k): k is string => typeof k === "string");

    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      total += keys.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return total;
}
```

- [ ] **Step 3.5: Relancer les tests, ils doivent passer**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/storage.test.ts
```

Expected: `5 passed`.

> Si l'erreur est `connect ECONNREFUSED 127.0.0.1:9000` : le conteneur `app` essaie de joindre MinIO via `localhost`. Verifier que `S3_ENDPOINT=http://minio:9000` (et non `localhost`) dans `docker/compose.dev.env`, et redemarrer la stack (`make dev-down && make dev`).

- [ ] **Step 3.6: Verifier typecheck et lint**

```bash
make typecheck && make lint
```

Expected: aucune erreur.

- [ ] **Step 3.7: Commit**

```bash
git add package.json yarn.lock src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(v2): refonte storage.ts vers @aws-sdk/client-s3 (TDD)"
```

---

### Task 4: Adapter les 2 appelants existants de `storage.ts`

**Files:**

- Modify: `src/app/api/files/[...path]/route.ts`
- Modify: `src/app/api/upload/route.ts`

> Les 2 routes existent en v1 et continuent de fonctionner en v2. L'adaptation est minimale : `getFile`/`uploadFile` ont la meme signature, seule la structure des cles change pour respecter le pattern multi-tenant `orgs/{orgId}/events/{eventId}/...`. Pour cette task, on se contente de garantir que les routes compilent et fonctionnent contre MinIO ; les sites d'appel "metier" (qui passent les cles aux routes) seront migres feature par feature dans les plans v2-02 a v2-05.

- [ ] **Step 4.1: Lire la route de download**

```bash
cat src/app/api/files/[...path]/route.ts
```

- [ ] **Step 4.2: Adapter la route de download si necessaire**

La signature de `getFile` est inchangee : `getFile(key) => { body, contentType }`. Si la route fait `getFile(filePath)` et retourne `body`/`contentType` dans la response, aucun changement de code n'est requis. Verifier visuellement que c'est bien le cas.

Si la route comporte une logique de mapping `path -> key` qui prefixait avec un dossier (`uploads/`, `events/`, etc.), la simplifier pour passer directement `key` sans prefixe (les prefixes sont desormais dans la cle elle-meme).

Exemple type, si la route ressemble a :

```typescript
const filePath = params.path.join("/");
const file = await getFile(filePath);
return new Response(file.body, { headers: { "Content-Type": file.contentType } });
```

Aucun changement.

- [ ] **Step 4.3: Lire la route d'upload**

```bash
cat src/app/api/upload/route.ts
```

- [ ] **Step 4.4: Adapter la route d'upload pour respecter la structure de cles multi-tenant**

La signature de `uploadFile` est inchangee : `uploadFile(key, body, contentType) => key`. Adapter uniquement la composition de la cle pour respecter le pattern `orgs/{orgId}/events/{eventId}/...` quand les parametres sont disponibles dans la requete.

Si la route actuelle construit la cle ainsi :

```typescript
const key = `events/${eventId}/registrations/${regId}/${filename}`;
```

La modifier pour :

```typescript
// La presence de orgId dans le payload depend des plans v2-01 a v2-05.
// Si orgId n'est pas disponible ici, prefixer par 'legacy/' temporairement
// et ajouter un TODO referencant le plan multi-tenant correspondant.
const key = orgId
  ? `orgs/${orgId}/events/${eventId}/registrations/${regId}/${filename}`
  : `legacy/events/${eventId}/registrations/${regId}/${filename}`;
```

> Le prefixe `legacy/` est volontaire pendant la transition v1 -> v2. Une fois v2-05 (inscription publique scopee) execute, ce fallback disparait. Pour cette task, l'objectif est de garantir que la route compile et accepte les nouvelles cles ; la couverture metier complete viendra avec les plans suivants.

- [ ] **Step 4.5: Verifier qu'aucune reference a `process.cwd()/uploads` ne subsiste**

```bash
grep -rn --include="*.ts" --include="*.tsx" "process.cwd().*uploads\|join.*['\"]uploads['\"]" src/ || echo "Aucune occurrence"
```

Expected: `Aucune occurrence`. Si des occurrences subsistent dans le code metier (hors `storage.ts`), les noter pour adaptation dans les plans v2-02 a v2-05 (et les laisser inchangees pour cette task).

- [ ] **Step 4.6: Lancer le typecheck**

```bash
make typecheck
```

Expected: 0 erreur.

- [ ] **Step 4.7: Lancer la suite de tests complete**

```bash
make test
```

Expected: tous les tests passent (incluant `src/lib/__tests__/storage.test.ts`).

- [ ] **Step 4.8: Commit**

```bash
git add src/app/api/files src/app/api/upload
git commit -m "feat(v2): adapter les routes files et upload a storage.ts S3"
```

---

### Task 5: Verification du palier 1+2 (lint + typecheck + tests + smoke manuel)

**Files:** aucun. Task de validation.

- [ ] **Step 5.1: Lint complet**

```bash
make lint
```

Expected: 0 erreur, 0 warning bloquant.

- [ ] **Step 5.2: Typecheck complet**

```bash
make typecheck
```

Expected: 0 erreur.

- [ ] **Step 5.3: Tests complets**

```bash
make test
```

Expected: tous les tests passent.

- [ ] **Step 5.4: Smoke test manuel upload/download via curl**

Demarrer `next dev` si necessaire :

```bash
docker compose -f docker-compose.dev.yml exec -d app yarn dev
sleep 5
```

Tester un upload (si la route accepte un POST multipart standard) :

```bash
echo "hello v2" > /tmp/test.txt
curl -X POST -F "file=@/tmp/test.txt" -F "key=test-manual/hello.txt" http://localhost:3000/api/upload || true
```

Verifier que l'objet est dans MinIO :

```bash
docker compose -f docker-compose.dev.yml exec -T minio mc ls badge-init/badge-dev/test-manual/
```

Expected: ligne `hello.txt` listee.

> Si la route `/api/upload` exige une session ou une signature specifique, sauter ce step et faire le smoke via le test d'integration Vitest qui couvre deja le round-trip.

- [ ] **Step 5.5: Nettoyer la cle de test**

```bash
docker compose -f docker-compose.dev.yml exec -T minio mc rm --recursive --force badge-init/badge-dev/test-manual/ || true
```

- [ ] **Step 5.6: Pas de commit (task de validation pure)**

---

## Palier 3 -- Pipeline de backup

> Objectif : `make backup-prod` produit un snapshot chiffre `snapshot-YYYY-MM-DD-HHMMSS.tar.zst.age` contenant BDD + bucket + config, le pousse vers Hetzner, applique la retention GFS (4 hebdo + 6 mensuels) en local et a distance, et envoie un email recapitulatif. Tout est declenchable via cron.

### Task 6: Helpers `_lib` partages (log, email, env)

**Files:**

- Create: `scripts/_lib/log.sh`
- Create: `scripts/_lib/email.sh`
- Create: `scripts/_lib/env.sh`

- [ ] **Step 6.1: Creer `scripts/_lib/log.sh`**

```bash
#!/usr/bin/env bash
#
# scripts/_lib/log.sh
# Helpers de logging JSON Lines + stdout.
# A sourcer depuis les scripts orchestrateurs (backup-prod.sh, etc.).
#
# Variables attendues dans l'env :
#   BACKUP_LOG_DIR (par defaut /var/log/badge)
#   BACKUP_LOG_FILE (par defaut $BACKUP_LOG_DIR/backup.log)

BACKUP_LOG_DIR="${BACKUP_LOG_DIR:-/var/log/badge}"
BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_LOG_DIR/backup.log}"

mkdir -p "$BACKUP_LOG_DIR"

# log_json LEVEL EVENT [KEY VALUE]...
# Ecrit une ligne JSON sur stdout ET dans BACKUP_LOG_FILE.
log_json() {
  local level="$1"
  local event="$2"
  shift 2

  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Construction du JSON via jq pour gerer correctement le quoting.
  local json
  json=$(jq -nc \
    --arg ts "$ts" \
    --arg level "$level" \
    --arg event "$event" \
    '{ts: $ts, level: $level, event: $event}')

  # Ajout des paires cle/valeur supplementaires.
  while [ $# -ge 2 ]; do
    local key="$1"
    local val="$2"
    shift 2
    # Tentative d'interpretation numerique, sinon string.
    if [[ "$val" =~ ^-?[0-9]+$ ]]; then
      json=$(echo "$json" | jq -c --arg k "$key" --argjson v "$val" '. + {($k): $v}')
    else
      json=$(echo "$json" | jq -c --arg k "$key" --arg v "$val" '. + {($k): $v}')
    fi
  done

  echo "$json" | tee -a "$BACKUP_LOG_FILE" > /dev/null
  # Aussi sur stdout pour visibilite humaine (mais non parsable par jq directement).
  echo "[$level] $event $(echo "$json" | jq -c 'del(.ts, .level, .event)')" >&2
}

log_info()  { log_json "info"  "$@"; }
log_warn()  { log_json "warn"  "$@"; }
log_error() { log_json "error" "$@"; }
```

- [ ] **Step 6.2: Creer `scripts/_lib/email.sh`**

```bash
#!/usr/bin/env bash
#
# scripts/_lib/email.sh
# Helpers d'envoi d'email via msmtp en utilisant PLATFORM_SMTP_*.
#
# Variables attendues :
#   PLATFORM_SMTP_HOST, PLATFORM_SMTP_PORT, PLATFORM_SMTP_USER,
#   PLATFORM_SMTP_PASSWORD, PLATFORM_SMTP_FROM, PLATFORM_SMTP_SECURE
#   BACKUP_NOTIFY_EMAIL (destinataire)

# send_email SUBJECT BODY
send_email() {
  local subject="$1"
  local body="$2"

  : "${BACKUP_NOTIFY_EMAIL:?BACKUP_NOTIFY_EMAIL non defini, email non envoye}"
  : "${PLATFORM_SMTP_HOST:?PLATFORM_SMTP_HOST non defini}"
  : "${PLATFORM_SMTP_PORT:?PLATFORM_SMTP_PORT non defini}"
  : "${PLATFORM_SMTP_FROM:?PLATFORM_SMTP_FROM non defini}"

  local tls="off"
  if [ "${PLATFORM_SMTP_SECURE:-false}" = "true" ]; then
    tls="on"
  fi

  local config
  config=$(mktemp)
  trap 'rm -f "$config"' RETURN

  cat > "$config" <<EOF
defaults
auth           on
tls            $tls
tls_starttls   on
logfile        /var/log/badge/msmtp.log

account        badge
host           $PLATFORM_SMTP_HOST
port           $PLATFORM_SMTP_PORT
from           $PLATFORM_SMTP_FROM
user           ${PLATFORM_SMTP_USER:-$PLATFORM_SMTP_FROM}
password       ${PLATFORM_SMTP_PASSWORD:-}

account default : badge
EOF

  {
    printf 'From: %s\n' "$PLATFORM_SMTP_FROM"
    printf 'To: %s\n' "$BACKUP_NOTIFY_EMAIL"
    printf 'Subject: %s\n' "$subject"
    printf 'Content-Type: text/plain; charset=UTF-8\n'
    printf '\n%s\n' "$body"
  } | msmtp --file="$config" "$BACKUP_NOTIFY_EMAIL" || \
    echo "[email] ECHEC envoi a $BACKUP_NOTIFY_EMAIL (sujet: $subject)" >&2
}

# format_size BYTES -> human readable (1.5 Go, 200 Mo, ...)
format_size() {
  local bytes="$1"
  if [ "$bytes" -ge 1073741824 ]; then
    awk -v b="$bytes" 'BEGIN { printf "%.1f Go\n", b / 1073741824 }'
  elif [ "$bytes" -ge 1048576 ]; then
    awk -v b="$bytes" 'BEGIN { printf "%.1f Mo\n", b / 1048576 }'
  elif [ "$bytes" -ge 1024 ]; then
    awk -v b="$bytes" 'BEGIN { printf "%.1f Ko\n", b / 1024 }'
  else
    echo "$bytes B"
  fi
}

# format_duration MILLISECONDS -> human readable (1m23s, ...)
format_duration() {
  local ms="$1"
  local s=$((ms / 1000))
  local m=$((s / 60))
  s=$((s % 60))
  if [ "$m" -gt 0 ]; then
    printf '%dm%02ds\n' "$m" "$s"
  else
    printf '%ds\n' "$s"
  fi
}
```

- [ ] **Step 6.3: Creer `scripts/_lib/env.sh`**

```bash
#!/usr/bin/env bash
#
# scripts/_lib/env.sh
# Chargement de .env.production et validation des variables requises.
#
# Usage :
#   source scripts/_lib/env.sh
#   require_env VAR1 VAR2 ...

# Chargement automatique de .env.production si present dans cwd.
if [ -f .env.production ]; then
  set -a; . ./.env.production; set +a
fi

# require_env VAR [VAR...]
# Sort en erreur si une des variables n'est pas definie ou vide.
require_env() {
  local missing=()
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      missing+=("$var")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "[env] Variables requises manquantes : ${missing[*]}" >&2
    exit 2
  fi
}
```

- [ ] **Step 6.4: Verifier la syntaxe des scripts (bash -n)**

```bash
bash -n scripts/_lib/log.sh
bash -n scripts/_lib/email.sh
bash -n scripts/_lib/env.sh
echo "Syntaxe OK"
```

Expected: `Syntaxe OK`. Aucune erreur de parsing.

- [ ] **Step 6.5: Commit**

```bash
git add scripts/_lib/
git commit -m "feat(v2): helpers shell partages (log JSON, email, env)"
```

---

### Task 7: `install-backup-deps.sh` + templates ops (cron, logrotate, rclone, age)

**Files:**

- Create: `scripts/install-backup-deps.sh`
- Create: `ops/cron/badge-backup`
- Create: `ops/logrotate/badge-backup`
- Create: `ops/rclone/rclone.conf.example`
- Create: `ops/age/age-recipients.txt.example`
- Modify: `.gitignore`

- [ ] **Step 7.1: Creer `scripts/install-backup-deps.sh`**

```bash
#!/usr/bin/env bash
#
# install-backup-deps.sh
# Installe les binaires requis par le pipeline de backup sur l'hote (root requis).
# Idempotent : reverifie chaque binaire avant de l'installer.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Doit etre execute en root (sudo make install-backup-deps)" >&2
  exit 1
fi

log() { printf '[install-deps] %s\n' "$*"; }

# --- 1. apt packages ---
APT_PKGS=(jq zstd msmtp logrotate cron tar gzip ca-certificates curl)

log "Installation des paquets apt : ${APT_PKGS[*]}"
apt-get update -qq
apt-get install -y --no-install-recommends "${APT_PKGS[@]}"

# --- 2. mc (MinIO Client) ---
if command -v mc >/dev/null 2>&1; then
  log "mc deja installe ($(mc --version | head -1))"
else
  log "Installation de mc (MinIO Client)"
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc \
    -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

# --- 3. rclone ---
if command -v rclone >/dev/null 2>&1; then
  log "rclone deja installe ($(rclone --version | head -1))"
else
  log "Installation de rclone"
  curl -fsSL https://rclone.org/install.sh | bash
fi

# --- 4. age ---
if command -v age >/dev/null 2>&1; then
  log "age deja installe ($(age --version))"
else
  log "Installation de age (depuis Debian backports si dispo, sinon binaire)"
  if apt-get install -y age 2>/dev/null; then
    log "age installe via apt"
  else
    AGE_VER="v1.2.0"
    curl -fsSL "https://github.com/FiloSottile/age/releases/download/${AGE_VER}/age-${AGE_VER}-linux-amd64.tar.gz" \
      | tar -xz -C /tmp
    install -m 0755 /tmp/age/age /usr/local/bin/age
    install -m 0755 /tmp/age/age-keygen /usr/local/bin/age-keygen
    rm -rf /tmp/age
  fi
fi

# --- 5. Arborescence backup ---
log "Creation de l'arborescence /var/backups/badge et /var/log/badge"
install -d -o root -g root -m 0700 /var/backups/badge
install -d -o root -g root -m 0700 /var/backups/badge/snapshots
install -d -o root -g root -m 0700 /var/backups/badge/staging
install -d -o root -g root -m 0700 /var/backups/badge/restore-staging
install -d -o root -g adm  -m 0750 /var/log/badge
install -d -o root -g root -m 0755 /etc/badge

# --- 6. Deploiement cron et logrotate ---
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$SRC_DIR/ops/cron/badge-backup" ]; then
  log "Deploiement /etc/cron.d/badge-backup"
  install -m 0644 -o root -g root "$SRC_DIR/ops/cron/badge-backup" /etc/cron.d/badge-backup
fi

if [ -f "$SRC_DIR/ops/logrotate/badge-backup" ]; then
  log "Deploiement /etc/logrotate.d/badge-backup"
  install -m 0644 -o root -g root "$SRC_DIR/ops/logrotate/badge-backup" /etc/logrotate.d/badge-backup
fi

log "Installation terminee. Verifier ensuite :"
log "  - /etc/badge/rclone.conf (copier depuis ops/rclone/rclone.conf.example)"
log "  - /etc/badge/age-recipients.txt (copier depuis ops/age/age-recipients.txt.example)"
log "  - .env.production (BACKUP_*, S3_*, MINIO_*, BACKUP_NOTIFY_EMAIL, PLATFORM_SMTP_*)"
```

Rendre executable :

```bash
chmod +x scripts/install-backup-deps.sh
```

- [ ] **Step 7.2: Creer `ops/cron/badge-backup`**

```bash
mkdir -p ops/cron
```

Contenu de `ops/cron/badge-backup` :

```
# /etc/cron.d/badge-backup
# Backup hebdomadaire Badge prod -- dimanche 03h00.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

0 3 * * 0 root cd /root/badge && /usr/bin/make backup-prod >> /var/log/badge/backup-cron.log 2>&1
```

> `/root/badge` correspond au workdir du serveur (cf. variable `SERVER=root@<ip>` dans le Makefile et `make upload` qui copie vers `~/badge/`). Adapter si le workdir prod change.

- [ ] **Step 7.3: Creer `ops/logrotate/badge-backup`**

```bash
mkdir -p ops/logrotate
```

Contenu de `ops/logrotate/badge-backup` :

```
/var/log/badge/*.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
```

- [ ] **Step 7.4: Creer `ops/rclone/rclone.conf.example`**

```bash
mkdir -p ops/rclone
```

Contenu de `ops/rclone/rclone.conf.example` :

```ini
# Template de configuration rclone pour Hetzner Storage Box.
# Copier en /etc/badge/rclone.conf (root:root 0600) et remplir les valeurs.
#
# Apres avoir cree le fichier final :
#   chmod 0600 /etc/badge/rclone.conf
#   chown root:root /etc/badge/rclone.conf
#
# Tester : rclone --config /etc/badge/rclone.conf lsd hetzner:

[hetzner]
type = sftp
host = uXXXXXX.your-storagebox.de
port = 23
user = uXXXXXX
pass = CHANGE_ME_obscure_via_rclone_obscure
key_file =
shell_type = unix
md5sum_command = none
sha1sum_command = none
```

> Note : pour generer le `pass` chiffre attendu par rclone : `rclone obscure 'MotDePasseEnClair'`.

- [ ] **Step 7.5: Creer `ops/age/age-recipients.txt.example`**

```bash
mkdir -p ops/age
```

Contenu de `ops/age/age-recipients.txt.example` :

```
# Cles publiques age autorisees a dechiffrer les backups Badge.
# Format : une cle publique par ligne (commencer par "age1..."), commentaires en #.
# Au moins 2 destinataires requis (admin principal + secours).
#
# Procedure de creation :
#   age-keygen -o admin-identity.txt    # sur le poste admin, JAMAIS sur le serveur
#   # La sortie indique la cle publique age1xxx... a copier ici.
#   # Le fichier admin-identity.txt va dans un coffre-fort (1Password, Bitwarden).
#
# Copier ce fichier en /etc/badge/age-recipients.txt (root:root 0644) et remplir.

age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Admin principal
age1yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy  # Admin secours
```

- [ ] **Step 7.6: Mettre a jour `.gitignore`**

Verifier la presence des lignes (ajouter a la fin si absentes) :

```bash
grep -q '^ops/rclone/rclone.conf$' .gitignore || echo 'ops/rclone/rclone.conf' >> .gitignore
grep -q '^ops/age/age-recipients.txt$' .gitignore || echo 'ops/age/age-recipients.txt' >> .gitignore
```

Verification :

```bash
grep -E '^ops/(rclone/rclone.conf|age/age-recipients.txt)$' .gitignore
```

Expected: 2 lignes.

- [ ] **Step 7.7: Verifier la syntaxe du script et la presence des templates**

```bash
bash -n scripts/install-backup-deps.sh
ls -1 ops/cron/badge-backup ops/logrotate/badge-backup ops/rclone/rclone.conf.example ops/age/age-recipients.txt.example
```

Expected: aucune erreur, 4 fichiers listes.

- [ ] **Step 7.8: Commit**

```bash
git add scripts/install-backup-deps.sh ops/ .gitignore
git commit -m "feat(v2): install-backup-deps et templates ops (cron, logrotate, rclone, age)"
```

---

### Task 8: `backup-prod.sh` -- script principal du pipeline

**Files:**

- Create: `scripts/backup-prod.sh`

> Script central du palier 3. Suit les 10 etapes definies dans la spec (sections "Pipeline de backup" et "Orchestration").

- [ ] **Step 8.1: Creer `scripts/backup-prod.sh`**

```bash
#!/usr/bin/env bash
#
# backup-prod.sh
# Orchestrateur du backup hebdomadaire Badge v2.
#
# 1. Capture BDD (mysqldump | gzip)
# 2. Miroir bucket MinIO (mc mirror)
# 3. Capture config (.env.production, Caddyfile)
# 4. Metadonnees
# 5. Empaquetage + chiffrement streaming (tar | zstd | age)
# 6. Cleanup staging
# 7. Push vers Hetzner (rclone copy)
# 8. Rotation GFS (local + distant)
# 9. Ecriture last-status.json
# 10. Email de notification (succes ou echec)
#
# Variables d'env requises (chargees depuis .env.production) :
#   MYSQL_ROOT_PASSWORD
#   S3_ENDPOINT, S3_BUCKET, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
#   BACKUP_LOCAL_DIR, BACKUP_STAGING_DIR, BACKUP_LOG_DIR
#   AGE_RECIPIENTS_FILE
#   RCLONE_CONFIG, HETZNER_REMOTE_NAME, HETZNER_REMOTE_PATH
#   RETENTION_WEEKLY, RETENTION_MONTHLY
#   BACKUP_NOTIFY_EMAIL, PLATFORM_SMTP_*
#
# Variables d'execution :
#   DRY_RUN=1            simule sans ecrire ni pousser
#   SNAPSHOT_TAG=<str>   suffixe le snapshot (ex: pre-restore-)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/env.sh
source "$SCRIPT_DIR/_lib/env.sh"
# shellcheck source=_lib/log.sh
source "$SCRIPT_DIR/_lib/log.sh"
# shellcheck source=_lib/email.sh
source "$SCRIPT_DIR/_lib/email.sh"

DRY_RUN="${DRY_RUN:-0}"
SNAPSHOT_TAG="${SNAPSHOT_TAG:-}"

require_env \
  MYSQL_ROOT_PASSWORD \
  S3_ENDPOINT S3_BUCKET MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
  BACKUP_LOCAL_DIR BACKUP_STAGING_DIR \
  AGE_RECIPIENTS_FILE \
  RCLONE_CONFIG HETZNER_REMOTE_NAME HETZNER_REMOTE_PATH \
  BACKUP_NOTIFY_EMAIL

# --- Pre-flight ---
START_TS_MS=$(date +%s%3N)
TS="$(date +%Y-%m-%d-%H%M%S)"
SNAPSHOT_NAME="${SNAPSHOT_TAG}snapshot-${TS}"
ARCHIVE_NAME="${SNAPSHOT_NAME}.tar.zst.age"
STAGING_DIR="${BACKUP_STAGING_DIR}/${SNAPSHOT_NAME}"
ARCHIVE_PATH="${BACKUP_LOCAL_DIR}/${ARCHIVE_NAME}"
STATUS_FILE="${BACKUP_LOCAL_DIR}/../last-status.json"

mkdir -p "$BACKUP_LOCAL_DIR" "$BACKUP_STAGING_DIR" "$BACKUP_LOG_DIR"

if [ ! -f "$AGE_RECIPIENTS_FILE" ]; then
  log_error "backup.preflight" reason "AGE_RECIPIENTS_FILE introuvable: $AGE_RECIPIENTS_FILE"
  send_email "[Badge prod] Backup ECHEC -- $TS" "AGE_RECIPIENTS_FILE introuvable: $AGE_RECIPIENTS_FILE"
  exit 1
fi

RECIPIENT_COUNT=$(grep -cE '^age1' "$AGE_RECIPIENTS_FILE" || true)
if [ "$RECIPIENT_COUNT" -lt 2 ]; then
  log_error "backup.preflight" reason "Moins de 2 recipients age (trouve: $RECIPIENT_COUNT)"
  send_email "[Badge prod] Backup ECHEC -- $TS" "Moins de 2 recipients age (trouve: $RECIPIENT_COUNT)"
  exit 1
fi

# Avertissement si une identite age privee est presente sur le serveur.
if [ -f /root/.config/age/identity.txt ] || ls /root/*-identity.txt 2>/dev/null | head -1 >/dev/null 2>&1; then
  log_warn "backup.preflight" reason "Identite age privee detectee sur le serveur"
fi

log_info "backup.start" snapshot "$SNAPSHOT_NAME" dryRun "$DRY_RUN"

# Helpers d'echec : capture stderr, envoie email, exit.
fail_step() {
  local step="$1"; local detail="$2"
  log_error "$step" detail "$detail"
  local body="Etape echouee : $step
Detail : $detail
Snapshot tente : $SNAPSHOT_NAME

Voir $BACKUP_LOG_DIR/backup.log pour le contexte complet."
  send_email "[Badge prod] Backup ECHEC -- $TS" "$body"
  exit 1
}

# Cleanup staging en cas de sortie (succes ou echec).
trap 'rm -rf "$STAGING_DIR" 2>/dev/null || true' EXIT

# --- DRY-RUN ---
if [ "$DRY_RUN" = "1" ]; then
  log_info "backup.dryrun" message "Plan suivant :"
  cat <<PLAN
  Snapshot : $SNAPSHOT_NAME
  Staging  : $STAGING_DIR
  Archive  : $ARCHIVE_PATH
  Recipients age : $RECIPIENT_COUNT cles
  Etapes :
    1. mysqldump > $STAGING_DIR/db.sql.gz
    2. mc mirror $S3_BUCKET -> $STAGING_DIR/minio/
    3. cp .env.production, Caddyfile
    4. ecrire metadata.json
    5. tar | zstd -19 | age > $ARCHIVE_PATH
    6. rm -rf $STAGING_DIR
    7. rclone copy $ARCHIVE_PATH -> $HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/
    8. rotation GFS (local + $HETZNER_REMOTE_NAME)
    9. mise a jour $STATUS_FILE
   10. email a $BACKUP_NOTIFY_EMAIL
PLAN
  log_info "backup.dryrun" exitCode 0
  exit 0
fi

# --- 1. Capture BDD ---
T0=$(date +%s%3N)
mkdir -p "$STAGING_DIR"
log_info "backup.db.start"
if ! docker compose exec -T mysql \
       mysqldump --single-transaction --routines --triggers --events \
                 -u root -p"$MYSQL_ROOT_PASSWORD" badge \
     | gzip > "$STAGING_DIR/db.sql.gz" 2>>"$BACKUP_LOG_DIR/backup-cron.log"; then
  fail_step "backup.db.dumped" "mysqldump a echoue"
fi
DB_SIZE=$(stat -c '%s' "$STAGING_DIR/db.sql.gz")
if [ "$DB_SIZE" -lt 100 ]; then
  fail_step "backup.db.dumped" "dump suspicieusement petit ($DB_SIZE octets)"
fi
log_info "backup.db.dumped" sizeBytes "$DB_SIZE" durationMs "$(( $(date +%s%3N) - T0 ))"

# --- 2. Miroir MinIO ---
T0=$(date +%s%3N)
mc alias set badge-backup "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null
mkdir -p "$STAGING_DIR/minio"
if ! mc mirror --quiet --overwrite "badge-backup/$S3_BUCKET" "$STAGING_DIR/minio/" > /dev/null 2>>"$BACKUP_LOG_DIR/backup-cron.log"; then
  fail_step "backup.minio.mirrored" "mc mirror a echoue"
fi
OBJ_COUNT=$(find "$STAGING_DIR/minio/" -type f 2>/dev/null | wc -l | tr -d ' ')
BUCKET_SIZE=$(du -sb "$STAGING_DIR/minio/" | cut -f1)
log_info "backup.minio.mirrored" objectCount "$OBJ_COUNT" sizeBytes "$BUCKET_SIZE" durationMs "$(( $(date +%s%3N) - T0 ))"

# --- 3. Capture config ---
[ -f .env.production ] && cp .env.production "$STAGING_DIR/env.production"
[ -f Caddyfile ]        && cp Caddyfile        "$STAGING_DIR/Caddyfile"
log_info "backup.config.captured"

# --- 4. Metadonnees ---
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
HOSTNAME="$(hostname)"
jq -n \
  --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg gitSha "$GIT_SHA" \
  --arg hostname "$HOSTNAME" \
  --argjson dbSizeBytes "$DB_SIZE" \
  --argjson bucketObjectCount "$OBJ_COUNT" \
  --argjson bucketSizeBytes "$BUCKET_SIZE" \
  '{createdAt: $createdAt, gitSha: $gitSha, hostname: $hostname,
    dbSizeBytes: $dbSizeBytes, bucketObjectCount: $bucketObjectCount,
    bucketSizeBytes: $bucketSizeBytes}' \
  > "$STAGING_DIR/metadata.json"

# --- 5. Empaquetage + chiffrement streaming ---
T0=$(date +%s%3N)
if ! tar -cf - -C "$BACKUP_STAGING_DIR" "$SNAPSHOT_NAME" \
   | zstd -T0 -19 -q \
   | age --recipients-file "$AGE_RECIPIENTS_FILE" \
   > "$ARCHIVE_PATH" 2>>"$BACKUP_LOG_DIR/backup-cron.log"; then
  fail_step "backup.packed" "echec tar|zstd|age"
fi
ARCHIVE_SIZE=$(stat -c '%s' "$ARCHIVE_PATH")
log_info "backup.packed" archiveSizeBytes "$ARCHIVE_SIZE" durationMs "$(( $(date +%s%3N) - T0 ))"

# --- 6. Cleanup staging (le trap EXIT s'en chargera aussi mais on libere l'espace tot) ---
rm -rf "$STAGING_DIR"

# --- 7. Push Hetzner ---
T0=$(date +%s%3N)
if ! rclone --config "$RCLONE_CONFIG" copy "$ARCHIVE_PATH" "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/" 2>>"$BACKUP_LOG_DIR/backup-cron.log"; then
  fail_step "backup.pushed" "rclone copy a echoue"
fi
log_info "backup.pushed" target "$HETZNER_REMOTE_NAME" durationMs "$(( $(date +%s%3N) - T0 ))"

# --- 8. Rotation GFS (uniquement si pas un snapshot pre-restore-) ---
if [ -z "$SNAPSHOT_TAG" ]; then
  bash "$SCRIPT_DIR/rotate-snapshots.sh" --target local
  bash "$SCRIPT_DIR/rotate-snapshots.sh" --target hetzner
else
  log_info "backup.rotated" target "skipped (pre-restore snapshot)"
fi

# --- 9. Ecriture last-status.json ---
LOCAL_COUNT=$(find "$BACKUP_LOCAL_DIR" -maxdepth 1 -type f -name "snapshot-*.tar.zst.age" | wc -l | tr -d ' ')
REMOTE_COUNT=$(rclone --config "$RCLONE_CONFIG" ls "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/" 2>/dev/null | grep -c "snapshot-.*\.tar\.zst\.age" || true)
TOTAL_MS=$(( $(date +%s%3N) - START_TS_MS ))

jq -n \
  --arg lastRunAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson lastRunDurationMs "$TOTAL_MS" \
  --argjson lastRunSuccess true \
  --arg lastSuccessAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg lastSnapshotName "$ARCHIVE_NAME" \
  --argjson lastSnapshotSizeBytes "$ARCHIVE_SIZE" \
  --argjson localSnapshotCount "$LOCAL_COUNT" \
  --argjson remoteSnapshotCount "$REMOTE_COUNT" \
  '{lastRunAt: $lastRunAt, lastRunDurationMs: $lastRunDurationMs,
    lastRunSuccess: $lastRunSuccess, lastSuccessAt: $lastSuccessAt,
    lastFailureAt: null, lastFailureReason: null,
    lastSnapshotName: $lastSnapshotName, lastSnapshotSizeBytes: $lastSnapshotSizeBytes,
    localSnapshotCount: $localSnapshotCount, remoteSnapshotCount: $remoteSnapshotCount}' \
  > "$STATUS_FILE"

log_info "backup.complete" totalDurationMs "$TOTAL_MS" exitCode 0

# --- 10. Email de notification (succes) ---
BODY="Snapshot $ARCHIVE_NAME cree en $(format_duration $TOTAL_MS).
  - BDD : $(format_size $DB_SIZE)
  - Bucket MinIO : $(format_size $BUCKET_SIZE) en $OBJ_COUNT objets
  - Archive chiffree : $(format_size $ARCHIVE_SIZE)
  - Snapshots actifs : $LOCAL_COUNT locaux, $REMOTE_COUNT distants"

send_email "[Badge prod] Backup OK -- $TS ($(format_size $ARCHIVE_SIZE))" "$BODY"
```

- [ ] **Step 8.2: Rendre executable et verifier la syntaxe**

```bash
chmod +x scripts/backup-prod.sh
bash -n scripts/backup-prod.sh
echo "Syntaxe OK"
```

Expected: `Syntaxe OK`.

- [ ] **Step 8.3: Commit (les cibles Makefile et la rotation arrivent Tasks 9-11)**

```bash
git add scripts/backup-prod.sh
git commit -m "feat(v2): scripts/backup-prod.sh orchestrateur du pipeline de backup"
```

---

### Task 9: `rotate-snapshots.sh` -- retention GFS local et distant

**Files:**

- Create: `scripts/rotate-snapshots.sh`

- [ ] **Step 9.1: Creer `scripts/rotate-snapshots.sh`**

```bash
#!/usr/bin/env bash
#
# rotate-snapshots.sh
# Applique la politique GFS sur les snapshots Badge :
#   - Garde les RETENTION_WEEKLY plus recents (hebdo glissant)
#   - Plus, pour chacun des RETENTION_MONTHLY derniers mois hors mois courant,
#     le 1er snapshot pris ce mois-la (mensuel)
#   - Supprime tous les autres
#
# Les snapshots prefixes "pre-restore-" sont TOUJOURS preserves (jamais purges).
#
# Usage : rotate-snapshots.sh --target local|hetzner

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/env.sh
source "$SCRIPT_DIR/_lib/env.sh"
# shellcheck source=_lib/log.sh
source "$SCRIPT_DIR/_lib/log.sh"

require_env BACKUP_LOCAL_DIR RCLONE_CONFIG HETZNER_REMOTE_NAME HETZNER_REMOTE_PATH

WEEKLY="${RETENTION_WEEKLY:-4}"
MONTHLY="${RETENTION_MONTHLY:-6}"
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    *) echo "Usage : $0 --target local|hetzner" >&2; exit 2 ;;
  esac
done

[ -n "$TARGET" ] || { echo "--target requis" >&2; exit 2; }

# list_snapshots TARGET -> stdout : noms triees par date desc
# Format de sortie : un nom de fichier par ligne, sans chemin.
list_snapshots() {
  case "$TARGET" in
    local)
      find "$BACKUP_LOCAL_DIR" -maxdepth 1 -type f -name "snapshot-*.tar.zst.age" -printf '%f\n' \
        | sort -r
      ;;
    hetzner)
      rclone --config "$RCLONE_CONFIG" ls "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/" 2>/dev/null \
        | awk '{ print $2 }' \
        | grep -E '^snapshot-.*\.tar\.zst\.age$' \
        | sort -r
      ;;
    *) echo "TARGET invalide: $TARGET" >&2; exit 2 ;;
  esac
}

# delete_snapshot NAME
delete_snapshot() {
  local name="$1"
  case "$TARGET" in
    local)
      rm -f "$BACKUP_LOCAL_DIR/$name"
      ;;
    hetzner)
      rclone --config "$RCLONE_CONFIG" deletefile "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/$name"
      ;;
  esac
}

# extract_date NAME -> YYYY-MM-DD
extract_date() {
  echo "$1" | sed -nE 's/^snapshot-([0-9]{4}-[0-9]{2}-[0-9]{2})-.*/\1/p'
}

# extract_yearmonth NAME -> YYYY-MM
extract_yearmonth() {
  echo "$1" | sed -nE 's/^snapshot-([0-9]{4}-[0-9]{2})-.*/\1/p'
}

ALL=()
while IFS= read -r line; do
  [ -n "$line" ] && ALL+=("$line")
done < <(list_snapshots)

if [ "${#ALL[@]}" -eq 0 ]; then
  log_info "backup.rotated" target "$TARGET" keptCount 0 removedCount 0
  exit 0
fi

# --- 1. Selection des hebdo : les WEEKLY plus recents ---
declare -A KEEP=()
WEEKLY_KEPT=0
for name in "${ALL[@]}"; do
  if [ "$WEEKLY_KEPT" -lt "$WEEKLY" ]; then
    KEEP["$name"]=1
    WEEKLY_KEPT=$((WEEKLY_KEPT + 1))
  fi
done

# --- 2. Selection des mensuels : pour chacun des MONTHLY derniers mois hors mois courant ---
CURRENT_YM="$(date +%Y-%m)"
declare -A MONTH_FIRST=()  # cle = YYYY-MM, valeur = nom snapshot

# La liste ALL est triee desc, donc pour chaque mois on garde le DERNIER vu
# en parcourant, qui sera le PLUS ANCIEN du mois (puisque desc).
# On veut le PREMIER (plus ancien) snapshot du mois -> on garde le dernier vu en parcourant desc.
for name in "${ALL[@]}"; do
  ym=$(extract_yearmonth "$name")
  [ -z "$ym" ] && continue
  [ "$ym" = "$CURRENT_YM" ] && continue
  MONTH_FIRST["$ym"]="$name"
done

# Trier les YM par ordre desc et garder les MONTHLY premieres
MONTHS_SORTED=$(printf '%s\n' "${!MONTH_FIRST[@]}" | sort -r | head -n "$MONTHLY")
for ym in $MONTHS_SORTED; do
  KEEP["${MONTH_FIRST[$ym]}"]=1
done

# --- 3. Suppression ---
KEPT_COUNT=0
REMOVED_COUNT=0
for name in "${ALL[@]}"; do
  if [ "${KEEP[$name]:-0}" = "1" ]; then
    KEPT_COUNT=$((KEPT_COUNT + 1))
  else
    delete_snapshot "$name"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done

log_info "backup.rotated" target "$TARGET" keptCount "$KEPT_COUNT" removedCount "$REMOVED_COUNT"
```

Rendre executable :

```bash
chmod +x scripts/rotate-snapshots.sh
```

- [ ] **Step 9.2: Test unitaire de la rotation avec snapshots fictifs**

Creer un mini-test inline (a executer manuellement, pas committe) :

```bash
TMPDIR=$(mktemp -d)
# Generer 20 snapshots fictifs sur 8 mois.
for offset in 0 7 14 21 28 35 60 95 125 155 185 215 245 275 305 335 365 395 425 455; do
  d=$(date -d "today -${offset} days" +%Y-%m-%d-%H%M%S 2>/dev/null || \
      date -v-${offset}d +%Y-%m-%d-%H%M%S)
  touch "$TMPDIR/snapshot-${d}.tar.zst.age"
done
echo "Avant rotation : $(ls $TMPDIR | wc -l) snapshots"

BACKUP_LOCAL_DIR="$TMPDIR" RCLONE_CONFIG=/tmp/_x HETZNER_REMOTE_NAME=x HETZNER_REMOTE_PATH=x \
  RETENTION_WEEKLY=4 RETENTION_MONTHLY=6 \
  AGE_RECIPIENTS_FILE=/tmp/_x BACKUP_NOTIFY_EMAIL=x@x \
  bash scripts/rotate-snapshots.sh --target local

echo "Apres rotation : $(ls $TMPDIR | wc -l) snapshots"
ls -1 $TMPDIR
rm -rf $TMPDIR
```

Expected: 20 snapshots avant, ~10 snapshots apres (4 hebdo des dernieres semaines + 6 mensuels des 6 derniers mois). Les snapshots tres anciens (>6 mois) sont supprimes.

> Si le compte n'est pas exactement 10 (8-11 acceptable selon la repartition des dates fictives), c'est OK : la logique reste valide. L'important est qu'aucun snapshot du mois courant ne soit garde au titre mensuel (uniquement au titre hebdo), et que les snapshots > 6 mois soient supprimes.

- [ ] **Step 9.3: Commit**

```bash
git add scripts/rotate-snapshots.sh
git commit -m "feat(v2): rotate-snapshots.sh retention GFS 4 hebdo + 6 mensuels"
```

---

### Task 10: `list-snapshots.sh` -- vue fusionnee local + distant

**Files:**

- Create: `scripts/list-snapshots.sh`

- [ ] **Step 10.1: Creer `scripts/list-snapshots.sh`**

```bash
#!/usr/bin/env bash
#
# list-snapshots.sh
# Affiche les snapshots disponibles, fusionnes local + distant, tries desc.
# Sortie : numero, date, taille, presence ([LOCAL], [HETZNER], [LOCAL+HETZNER]).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/env.sh
source "$SCRIPT_DIR/_lib/env.sh"

require_env BACKUP_LOCAL_DIR RCLONE_CONFIG HETZNER_REMOTE_NAME HETZNER_REMOTE_PATH

# Recuperer les locaux : nom, taille
declare -A LOCAL_SIZE=()
if [ -d "$BACKUP_LOCAL_DIR" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    size=$(stat -c '%s' "$BACKUP_LOCAL_DIR/$f" 2>/dev/null || echo 0)
    LOCAL_SIZE["$f"]="$size"
  done < <(ls "$BACKUP_LOCAL_DIR" 2>/dev/null | grep -E '^(snapshot|pre-restore)-.*\.tar\.zst\.age$' || true)
fi

# Recuperer les distants : nom, taille
declare -A REMOTE_SIZE=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  size="$(echo "$line" | awk '{print $1}')"
  name="$(echo "$line" | awk '{print $2}')"
  case "$name" in
    snapshot-*.tar.zst.age|pre-restore-*.tar.zst.age) REMOTE_SIZE["$name"]="$size" ;;
  esac
done < <(rclone --config "$RCLONE_CONFIG" ls "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/" 2>/dev/null || true)

# Fusionner
declare -A ALL=()
for k in "${!LOCAL_SIZE[@]}"; do ALL["$k"]=1; done
for k in "${!REMOTE_SIZE[@]}"; do ALL["$k"]=1; done

if [ "${#ALL[@]}" -eq 0 ]; then
  echo "Aucun snapshot trouve."
  exit 0
fi

# Tri desc par nom
SORTED=$(printf '%s\n' "${!ALL[@]}" | sort -r)

# Affichage
n=0
printf '  N  Date              Taille      Presence              Nom\n'
printf '  -  ----              ------      --------              ---\n'
while IFS= read -r name; do
  n=$((n + 1))
  date_part=$(echo "$name" | sed -nE 's/^[^-]+-([0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}).*/\1/p')
  size="${LOCAL_SIZE[$name]:-${REMOTE_SIZE[$name]:-0}}"

  loc="${LOCAL_SIZE[$name]:+L}"
  rem="${REMOTE_SIZE[$name]:+R}"
  if [ -n "$loc" ] && [ -n "$rem" ]; then
    tag="[LOCAL+HETZNER]"
  elif [ -n "$loc" ]; then
    tag="[LOCAL]"
  else
    tag="[HETZNER]"
  fi

  # Taille human-readable
  if [ "$size" -ge 1073741824 ]; then
    size_h=$(awk -v b="$size" 'BEGIN { printf "%.1f Go", b / 1073741824 }')
  elif [ "$size" -ge 1048576 ]; then
    size_h=$(awk -v b="$size" 'BEGIN { printf "%.1f Mo", b / 1048576 }')
  else
    size_h="$size B"
  fi

  printf '  %-2d %-17s %-11s %-22s %s\n' "$n" "$date_part" "$size_h" "$tag" "$name"
done <<<"$SORTED"
```

Rendre executable :

```bash
chmod +x scripts/list-snapshots.sh
```

- [ ] **Step 10.2: Verifier la syntaxe**

```bash
bash -n scripts/list-snapshots.sh
echo "Syntaxe OK"
```

- [ ] **Step 10.3: Commit**

```bash
git add scripts/list-snapshots.sh
git commit -m "feat(v2): list-snapshots.sh vue fusionnee local + distant"
```

---

### Task 11: Cibles Makefile pour le palier backup

**Files:**

- Modify: `Makefile`

- [ ] **Step 11.1: Ajouter les cibles backup au Makefile**

Editer `Makefile` :

1. Ajouter au `.PHONY` (premiere ligne) : `backup-prod backup-prod-dry-run backup-list backup-list-local backup-list-remote install-backup-deps`.
2. Ajouter le bloc suivant a la fin du fichier :

```makefile

# ============================================================
#  Backup hebdomadaire
# ============================================================
install-backup-deps:
	@sudo bash scripts/install-backup-deps.sh

backup-prod:
	@bash scripts/backup-prod.sh

backup-prod-dry-run:
	@DRY_RUN=1 bash scripts/backup-prod.sh

backup-list:
	@bash scripts/list-snapshots.sh

backup-list-local:
	@ls -lh /var/backups/badge/snapshots/ 2>/dev/null || echo "Pas de backups locaux."

backup-list-remote:
	@rclone --config /etc/badge/rclone.conf ls hetzner:badge-backups/ 2>/dev/null || echo "Aucun acces distant."

backup-status:
	@cat /var/backups/badge/last-status.json 2>/dev/null | jq . || echo "Aucun statut enregistre."
```

- [ ] **Step 11.2: Verifier que les cibles ne cassent pas le parsing du Makefile**

```bash
make -n backup-prod 2>&1 | head -3
```

Expected: la commande prevue est affichee sans erreur "No rule to make target".

- [ ] **Step 11.3: Commit**

```bash
git add Makefile
git commit -m "feat(v2): cibles Makefile pour le pipeline de backup"
```

---

### Task 12: Test bout-en-bout du palier backup en dev

**Files:** aucun. Validation manuelle.

> Cette task valide que le pipeline backup tourne reellement contre le MinIO de dev. On ne pousse pas vers Hetzner (pas de credentials en dev), mais on verifie que les etapes 1-6 fonctionnent et qu'un artefact chiffre est produit.

- [ ] **Step 12.1: Pre-requis dev : installer les binaires sur l'hote**

Sur la machine de dev (macOS ou Linux), installer manuellement les binaires (sans sudo, equivalent local de `install-backup-deps.sh`) :

```bash
# Verifier la presence
for bin in mc rclone age zstd jq; do
  command -v $bin >/dev/null && echo "[ok] $bin" || echo "[MISSING] $bin"
done
```

Si certains binaires manquent (en dev) :

```bash
# macOS
brew install minio-mc rclone age zstd jq

# Debian/Ubuntu
sudo apt-get install -y rclone zstd jq
# mc : cf install-backup-deps.sh
# age : cf install-backup-deps.sh
```

- [ ] **Step 12.2: Generer une paire de cles age locale pour le test**

```bash
mkdir -p /tmp/badge-backup-test
age-keygen -o /tmp/badge-backup-test/dev-identity.txt 2>/tmp/badge-backup-test/dev-pub.txt
# Le fichier dev-pub.txt contient la cle publique sur la ligne "Public key:"
grep -oE 'age1[a-z0-9]+' /tmp/badge-backup-test/dev-pub.txt > /tmp/badge-backup-test/recipients.txt
# Une deuxieme cle factice pour respecter le minimum de 2 recipients
age-keygen 2>/dev/null | grep -oE 'age1[a-z0-9]+' >> /tmp/badge-backup-test/recipients.txt
wc -l /tmp/badge-backup-test/recipients.txt
```

Expected: `2 ...recipients.txt`.

- [ ] **Step 12.3: Preparer un faux `.env.production` pour le test**

```bash
cat > /tmp/badge-backup-test/.env.production <<EOF
MYSQL_ROOT_PASSWORD=password
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=badge-dev
S3_ACCESS_KEY=badge-app-dev
S3_SECRET_KEY=badge-app-dev-secret-change-me
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

BACKUP_LOCAL_DIR=/tmp/badge-backup-test/snapshots
BACKUP_STAGING_DIR=/tmp/badge-backup-test/staging
BACKUP_LOG_DIR=/tmp/badge-backup-test/log
AGE_RECIPIENTS_FILE=/tmp/badge-backup-test/recipients.txt
RCLONE_CONFIG=/tmp/badge-backup-test/rclone.conf
HETZNER_REMOTE_NAME=dev-fake
HETZNER_REMOTE_PATH=fake
RETENTION_WEEKLY=4
RETENTION_MONTHLY=6
BACKUP_NOTIFY_EMAIL=dev@example.tld

PLATFORM_SMTP_HOST=localhost
PLATFORM_SMTP_PORT=1025
PLATFORM_SMTP_FROM=dev@example.tld
PLATFORM_SMTP_USER=
PLATFORM_SMTP_PASSWORD=
PLATFORM_SMTP_SECURE=false
EOF

# rclone config bidon pour que la commande ne plante pas (echec attendu sur le push, c'est OK)
cat > /tmp/badge-backup-test/rclone.conf <<EOF
[dev-fake]
type = local
EOF
```

- [ ] **Step 12.4: Tester le dry-run**

```bash
cd /tmp/badge-backup-test
ln -sfn $(pwd)/.env.production .env.production
PATH="$PATH" bash $(pwd | sed 's|/tmp/badge-backup-test|'"$(pwd)"'|')/../../scripts/backup-prod.sh </dev/null && echo OK
# Note: ajuster le chemin du script selon le cwd
```

Plus simple : depuis la racine du projet badge :

```bash
cd /tmp/badge-backup-test && bash <(grep -v 'docker compose exec' "$OLDPWD/scripts/backup-prod.sh" | sed 's|--config "$RCLONE_CONFIG" copy.*|exit 0|') 2>&1 | head -50; cd "$OLDPWD"
```

> Le test bout-en-bout reel n'est pas trivial en dev car le script suppose `docker compose exec -T mysql` dans le cwd projet et un rclone vers Hetzner. Le test pratique est :
>
> 1. Valider la syntaxe de tous les scripts (`bash -n` sur chaque).
> 2. Lancer manuellement les sous-etapes une par une dans le conteneur dev :
>    - `mysqldump` via `docker compose exec mysql ...`
>    - `mc mirror` depuis l'hote vers MinIO de dev
>    - `tar | zstd | age` sur un dossier de test
>    - verifier que l'archive est lisible apres `age -d -i dev-identity.txt`
>
> Le vrai test bout-en-bout se fera en prod (Task 24 de la verification finale) ou via un environnement plus prepare.

Etapes minimales realistes :

```bash
# A. mc mirror du bucket dev
mkdir -p /tmp/badge-backup-test/staging-minio
mc alias set test-dev http://localhost:9000 minioadmin minioadmin
mc mirror test-dev/badge-dev /tmp/badge-backup-test/staging-minio/
ls /tmp/badge-backup-test/staging-minio/ && echo "mirror OK"

# B. Chiffrement age streaming
echo "Hello backup" > /tmp/badge-backup-test/staging-minio/test.txt
tar -cf - -C /tmp/badge-backup-test staging-minio \
  | zstd -T0 -19 -q \
  | age --recipients-file /tmp/badge-backup-test/recipients.txt \
  > /tmp/badge-backup-test/test.tar.zst.age
ls -lh /tmp/badge-backup-test/test.tar.zst.age

# C. Verifier qu'on ne peut PAS lire sans cle
tar -tzf /tmp/badge-backup-test/test.tar.zst.age 2>&1 | head -3
# Expected : erreur tar (le fichier n'est pas un tar valide -> age est en premier)

# D. Dechiffrement avec la cle privee dev
age -d -i /tmp/badge-backup-test/dev-identity.txt < /tmp/badge-backup-test/test.tar.zst.age \
  | unzstd | tar -xv -C /tmp/badge-backup-test/restored/
ls /tmp/badge-backup-test/restored/staging-minio/
```

Expected etape D : la sortie liste `test.txt` (et le contenu du bucket dev s'il y en a).

- [ ] **Step 12.5: Nettoyer**

```bash
rm -rf /tmp/badge-backup-test
mc alias rm test-dev 2>/dev/null || true
```

- [ ] **Step 12.6: Documenter le resultat dans le tracker `## Progression`**

Mettre a jour la ligne Task 12 du tracker en tete du plan :

```
| 12 | [x] | YYYY-MM-DD | Pipeline backup valide : mc mirror OK, age chiffrement+dechiffrement OK |
```

- [ ] **Step 12.7: Pas de commit (validation pure)**

---

## Palier 4 -- Restore et audit

> Objectif : `make restore-from-backup` permet de restaurer interactivement depuis un snapshot (local ou distant), avec double confirmation, snapshot de precaution automatique, validation d'integrite, et audit dans `ActivityLog`.

### Task 13: Ajouter `ActivityType.BACKUP_RESTORE` au schema Prisma

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 13.1: Lire l'enum actuel**

```bash
grep -A 30 "^enum ActivityType" prisma/schema.prisma | head -30
```

- [ ] **Step 13.2: Ajouter la valeur `BACKUP_RESTORE`**

Editer `prisma/schema.prisma`. Localiser le bloc `enum ActivityType {` (vers la ligne 126), et ajouter la valeur `BACKUP_RESTORE` a la fin du bloc, juste avant l'accolade fermante.

Avant :

```prisma
enum ActivityType {
  REGISTRATION_CREATED
  ...
  EDIT_LINK_SENT
}
```

Apres :

```prisma
enum ActivityType {
  REGISTRATION_CREATED
  ...
  EDIT_LINK_SENT
  BACKUP_RESTORE
}
```

- [ ] **Step 13.3: Pousser le schema en dev**

```bash
make db-push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 13.4: Generer le client Prisma**

```bash
make db-generate
```

- [ ] **Step 13.5: Verifier que typecheck passe**

```bash
make typecheck
```

Expected: 0 erreur (l'enum ne casse aucun usage existant car c'est purement additif).

- [ ] **Step 13.6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(v2): ajouter ActivityType.BACKUP_RESTORE au schema Prisma"
```

---

### Task 14: `scripts/restore-from-backup.sh` -- restore interactif

**Files:**

- Create: `scripts/restore-from-backup.sh`

- [ ] **Step 14.1: Creer `scripts/restore-from-backup.sh`**

```bash
#!/usr/bin/env bash
#
# restore-from-backup.sh
# Restore interactif depuis un snapshot Badge.
#
# Variables d'execution :
#   SNAPSHOT=<date-ou-fichier>  cible un snapshot precis (sinon : prompt interactif)
#   CONFIRM=I-UNDERSTAND-THIS-IS-DESTRUCTIVE  skip le prompt de niveau 1
#   DRY_RUN=1                                 dechiffre + valide, n'ecrase rien
#   IDENTITY_FILE=<path>                      par defaut ~/.config/age/identity.txt
#
# Pre-requis : identite age privee accessible (sinon erreur claire a l'etape 4).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/env.sh
source "$SCRIPT_DIR/_lib/env.sh"
# shellcheck source=_lib/log.sh
source "$SCRIPT_DIR/_lib/log.sh"
# shellcheck source=_lib/email.sh
source "$SCRIPT_DIR/_lib/email.sh"

require_env \
  MYSQL_ROOT_PASSWORD \
  S3_ENDPOINT S3_BUCKET MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
  BACKUP_LOCAL_DIR RCLONE_CONFIG HETZNER_REMOTE_NAME HETZNER_REMOTE_PATH \
  BACKUP_NOTIFY_EMAIL DATABASE_URL

DRY_RUN="${DRY_RUN:-0}"
SNAPSHOT="${SNAPSHOT:-}"
CONFIRM="${CONFIRM:-}"
IDENTITY_FILE="${IDENTITY_FILE:-$HOME/.config/age/identity.txt}"

RESTORE_STAGING="${BACKUP_STAGING_DIR%/staging}/restore-staging"
mkdir -p "$RESTORE_STAGING"

# --- 1. Lister les snapshots ---
log_info "restore.list.start"
ALL_NAMES=()

# Locaux
while IFS= read -r f; do
  [ -z "$f" ] && continue
  ALL_NAMES+=("LOCAL|$f")
done < <(ls "$BACKUP_LOCAL_DIR" 2>/dev/null | grep -E '^(snapshot|pre-restore)-.*\.tar\.zst\.age$' || true)

# Distants
while IFS= read -r line; do
  [ -z "$line" ] && continue
  name="$(echo "$line" | awk '{print $2}')"
  case "$name" in
    snapshot-*.tar.zst.age|pre-restore-*.tar.zst.age) ALL_NAMES+=("HETZNER|$name") ;;
  esac
done < <(rclone --config "$RCLONE_CONFIG" ls "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/" 2>/dev/null || true)

# Fusionner : un nom -> sources (L, R, ou les deux)
declare -A SOURCES=()
declare -A NAMES=()
for entry in "${ALL_NAMES[@]}"; do
  src="${entry%%|*}"
  name="${entry#*|}"
  NAMES["$name"]=1
  if [ -n "${SOURCES[$name]:-}" ]; then
    SOURCES["$name"]="LOCAL+HETZNER"
  else
    SOURCES["$name"]="$src"
  fi
done

# Tri desc
SORTED=$(printf '%s\n' "${!NAMES[@]}" | sort -r)

if [ -z "$SORTED" ]; then
  echo "Aucun snapshot trouve (ni local ni distant)." >&2
  exit 1
fi

# --- 2. Selection ---
if [ -z "$SNAPSHOT" ]; then
  i=0
  declare -A INDEX_TO_NAME=()
  echo
  echo "Snapshots disponibles :"
  echo
  while IFS= read -r name; do
    i=$((i + 1))
    INDEX_TO_NAME["$i"]="$name"
    printf '  [%d] %s  %s\n' "$i" "${SOURCES[$name]}" "$name"
  done <<<"$SORTED"
  echo
  read -r -p "Quel snapshot restaurer ? [1-$i, q pour quitter] : " choice
  case "$choice" in
    q|Q|"") echo "Annule."; exit 0 ;;
  esac
  if [ -z "${INDEX_TO_NAME[$choice]:-}" ]; then
    echo "Selection invalide." >&2; exit 2
  fi
  SNAPSHOT_NAME="${INDEX_TO_NAME[$choice]}"
else
  # Resolution : si SNAPSHOT est juste une date "2026-05-24-030012", chercher la correspondance
  if [[ "$SNAPSHOT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}$ ]]; then
    SNAPSHOT_NAME=$(printf '%s\n' "${!NAMES[@]}" | grep "$SNAPSHOT" | head -1 || true)
  elif [[ "$SNAPSHOT" == *.tar.zst.age ]]; then
    SNAPSHOT_NAME=$(basename "$SNAPSHOT")
  else
    echo "SNAPSHOT doit etre une date YYYY-MM-DD-HHMMSS ou un nom complet" >&2; exit 2
  fi
  [ -z "$SNAPSHOT_NAME" ] && { echo "Snapshot $SNAPSHOT introuvable" >&2; exit 2; }
fi

log_info "restore.selected" snapshot "$SNAPSHOT_NAME"

# --- 3. Si distant uniquement : telecharger ---
LOCAL_PATH="$BACKUP_LOCAL_DIR/$SNAPSHOT_NAME"
if [ ! -f "$LOCAL_PATH" ]; then
  echo "Telechargement depuis $HETZNER_REMOTE_NAME..."
  rclone --config "$RCLONE_CONFIG" copy "$HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/$SNAPSHOT_NAME" "$RESTORE_STAGING/"
  LOCAL_PATH="$RESTORE_STAGING/$SNAPSHOT_NAME"
fi

# --- 4. Dechiffrer + extraire ---
if [ ! -f "$IDENTITY_FILE" ]; then
  echo "Cle privee age introuvable : $IDENTITY_FILE" >&2
  echo "Deployer temporairement la cle puis relancer." >&2
  exit 3
fi

EXTRACT_DIR="$RESTORE_STAGING/${SNAPSHOT_NAME%.tar.zst.age}"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

echo "Dechiffrement + extraction..."
if ! age -d -i "$IDENTITY_FILE" < "$LOCAL_PATH" | unzstd | tar -x -C "$RESTORE_STAGING/"; then
  echo "Echec dechiffrement/extraction" >&2
  exit 4
fi

EXTRACTED_SUBDIR="$RESTORE_STAGING/${SNAPSHOT_NAME%.tar.zst.age}"
[ -d "$EXTRACTED_SUBDIR" ] || { echo "Arborescence extraite introuvable" >&2; exit 4; }

# --- 5. Validation integrite ---
for f in db.sql.gz minio metadata.json; do
  [ -e "$EXTRACTED_SUBDIR/$f" ] || { echo "Element manquant dans le snapshot : $f" >&2; exit 5; }
done

if ! gunzip -t "$EXTRACTED_SUBDIR/db.sql.gz" 2>/dev/null; then
  echo "db.sql.gz est corrompu" >&2; exit 5
fi

META_OBJ_COUNT=$(jq -r '.bucketObjectCount' "$EXTRACTED_SUBDIR/metadata.json")
ACTUAL_OBJ_COUNT=$(find "$EXTRACTED_SUBDIR/minio/" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$META_OBJ_COUNT" != "$ACTUAL_OBJ_COUNT" ]; then
  echo "Incoherence : metadata dit $META_OBJ_COUNT objets, archive en contient $ACTUAL_OBJ_COUNT" >&2
  exit 5
fi
echo "Integrite validee."

# --- DRY-RUN s'arrete ici ---
if [ "$DRY_RUN" = "1" ]; then
  log_info "restore.dryrun" snapshot "$SNAPSHOT_NAME" status "valid"
  echo "DRY_RUN=1, aucune modification appliquee."
  exit 0
fi

# --- 6. Confirmation niveau 1 ---
CREATED_AT=$(jq -r '.createdAt' "$EXTRACTED_SUBDIR/metadata.json")
GIT_SHA=$(jq -r '.gitSha' "$EXTRACTED_SUBDIR/metadata.json")
META_DB_SIZE=$(jq -r '.dbSizeBytes' "$EXTRACTED_SUBDIR/metadata.json")
META_BUCKET_SIZE=$(jq -r '.bucketSizeBytes' "$EXTRACTED_SUBDIR/metadata.json")

cat <<EOF

==========================================================================
  RESTORE -- ATTENTION : OPERATION DESTRUCTIVE
==========================================================================
  Snapshot       : $SNAPSHOT_NAME
  Date d'origine : $CREATED_AT
  Git SHA        : $GIT_SHA
  BDD            : $(format_size $META_DB_SIZE)
  Bucket         : $(format_size $META_BUCKET_SIZE) en $META_OBJ_COUNT objets

  Cette operation va ECRASER completement la BDD et le bucket de production.
  Un snapshot de precaution sera cree automatiquement avant.
==========================================================================

EOF

if [ "$CONFIRM" != "I-UNDERSTAND-THIS-IS-DESTRUCTIVE" ]; then
  read -r -p "Tapez 'RESTORE-PROD-CONFIRM' pour continuer : " c1
  [ "$c1" = "RESTORE-PROD-CONFIRM" ] || { echo "Annule."; exit 0; }
fi

# --- 7. Snapshot de precaution AUTOMATIQUE ---
echo "Creation du snapshot de precaution..."
SNAPSHOT_TAG="pre-restore-" bash "$SCRIPT_DIR/backup-prod.sh"
PRE_NAME=$(ls -t "$BACKUP_LOCAL_DIR" | grep '^pre-restore-' | head -1)
echo "Snapshot de precaution cree : $PRE_NAME"

# --- 8. Confirmation niveau 2 ---
if [ "$CONFIRM" != "I-UNDERSTAND-THIS-IS-DESTRUCTIVE" ]; then
  read -r -p "Tapez 'GO' pour lancer le restore irreversible : " c2
  [ "$c2" = "GO" ] || { echo "Annule (snapshot de precaution conserve)."; exit 0; }
fi

# --- 9a. Restore BDD ---
echo "Restore BDD..."
docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"
gunzip -c "$EXTRACTED_SUBDIR/db.sql.gz" \
  | docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge
log_info "restore.db.restored"

# --- 9b. Restore bucket MinIO ---
echo "Restore bucket MinIO..."
mc alias set badge-restore "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null
mc rm --recursive --force "badge-restore/$S3_BUCKET" > /dev/null 2>&1 || true
mc mirror --quiet --overwrite "$EXTRACTED_SUBDIR/minio/" "badge-restore/$S3_BUCKET" > /dev/null
RESTORED_COUNT=$(mc ls --recursive "badge-restore/$S3_BUCKET" | wc -l | tr -d ' ')
if [ "$RESTORED_COUNT" != "$META_OBJ_COUNT" ]; then
  echo "AVERTISSEMENT : objets restaures $RESTORED_COUNT != attendus $META_OBJ_COUNT" >&2
fi
log_info "restore.bucket.restored" objectCount "$RESTORED_COUNT"

# --- 9c. Config -- NON automatique ---
echo
echo "Fichiers config presents dans le snapshot (NON appliques automatiquement) :"
[ -f "$EXTRACTED_SUBDIR/env.production" ] && cp "$EXTRACTED_SUBDIR/env.production" .env.production.restored && echo "  .env.production.restored"
[ -f "$EXTRACTED_SUBDIR/Caddyfile"       ] && cp "$EXTRACTED_SUBDIR/Caddyfile"       Caddyfile.restored       && echo "  Caddyfile.restored"
echo
echo "Pour appliquer la config historique : diff puis mv manuel."
diff -u .env.production .env.production.restored 2>/dev/null | head -30 || true

# --- 10. Cleanup staging ---
rm -rf "$EXTRACTED_SUBDIR"

# --- 11. Smoke tests ---
echo "Lancement des smoke tests..."
if make smoke-tests > /tmp/restore-smoke.log 2>&1; then
  echo "Smoke tests OK"
else
  echo "Smoke tests EN ECHEC : voir /tmp/restore-smoke.log"
  echo "Rollback possible via le snapshot de precaution : $PRE_NAME"
fi

# --- 12. Audit ActivityLog ---
OPERATOR="${SUDO_USER:-${USER:-unknown}}"
docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge <<SQL
INSERT INTO ActivityLog (id, type, details, createdAt)
VALUES (
  UUID(),
  'BACKUP_RESTORE',
  JSON_OBJECT('snapshot', '$SNAPSHOT_NAME', 'preRestore', '$PRE_NAME', 'operator', '$OPERATOR'),
  NOW()
);
SQL

# --- 13. Email final ---
send_email "[Badge prod] Restore EFFECTUE depuis $SNAPSHOT_NAME" \
"Restore termine.
  - Snapshot source     : $SNAPSHOT_NAME
  - Snapshot precaution : $PRE_NAME
  - Operateur           : $OPERATOR
  - Objets restaures    : $RESTORED_COUNT
  - Smoke tests         : voir /tmp/restore-smoke.log

Le snapshot de precaution est conserve indefiniment (preserve par la rotation GFS).
Le supprimer manuellement (local + Hetzner) une fois la prod stable confirmee :
  rm $BACKUP_LOCAL_DIR/$PRE_NAME
  rclone --config $RCLONE_CONFIG deletefile $HETZNER_REMOTE_NAME:$HETZNER_REMOTE_PATH/$PRE_NAME"

log_info "restore.complete" snapshot "$SNAPSHOT_NAME" preRestore "$PRE_NAME"
echo "Restore termine."
```

Rendre executable :

```bash
chmod +x scripts/restore-from-backup.sh
```

- [ ] **Step 14.2: Verifier la syntaxe**

```bash
bash -n scripts/restore-from-backup.sh
echo "Syntaxe OK"
```

- [ ] **Step 14.3: Ajouter la cible `restore-from-backup` au Makefile**

Ajouter au `.PHONY` (premiere ligne) : `restore-from-backup`.

Ajouter le bloc suivant a la fin du Makefile :

```makefile

# ============================================================
#  Restore
# ============================================================
restore-from-backup:
	@bash scripts/restore-from-backup.sh
```

- [ ] **Step 14.4: Commit**

```bash
git add scripts/restore-from-backup.sh Makefile
git commit -m "feat(v2): restore-from-backup interactif avec double confirmation et snapshot precaution"
```

---

### Task 15: `docker-compose.restore-test.yml` + `scripts/test-restore.sh`

**Files:**

- Create: `docker-compose.restore-test.yml`
- Create: `scripts/test-restore.sh`

> Environnement isole pour tester un restore sans toucher a la prod. Utilise des ports differents et des volumes ephemeres.

- [ ] **Step 15.1: Creer `docker-compose.restore-test.yml`**

```yaml
# Environnement isole pour scripts/test-restore.sh.
# Demarre un mysql + un minio sur des ports differents, volumes anonymes (effaces au down).
services:
  mysql-test:
    image: mysql:8
    container_name: badge-mysql-test
    environment:
      MYSQL_ROOT_PASSWORD: test-restore-pw
      MYSQL_DATABASE: badge
    ports:
      - "33307:3306"
    tmpfs:
      - /var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio-test:
    image: minio/minio:latest
    container_name: badge-minio-test
    command: server /data --console-address ":9101"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9100:9000"
      - "9101:9001"
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
```

- [ ] **Step 15.2: Creer `scripts/test-restore.sh`**

```bash
#!/usr/bin/env bash
#
# test-restore.sh
# Test trimestriel manuel : restaure le dernier snapshot dans un env isole
# (docker-compose.restore-test.yml), execute les smoke tests, detruit l'env.
#
# Pre-requis :
#   - Au moins un snapshot dans /var/backups/badge/snapshots/
#   - Cle privee age accessible

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib/env.sh
source "$SCRIPT_DIR/_lib/env.sh"

IDENTITY_FILE="${IDENTITY_FILE:-$HOME/.config/age/identity.txt}"
COMPOSE="docker-compose.restore-test.yml"

[ -f "$IDENTITY_FILE" ] || { echo "Cle age privee absente : $IDENTITY_FILE" >&2; exit 1; }

LAST_SNAPSHOT=$(ls "$BACKUP_LOCAL_DIR" | grep -E '^snapshot-.*\.tar\.zst\.age$' | sort -r | head -1)
[ -n "$LAST_SNAPSHOT" ] || { echo "Aucun snapshot a tester" >&2; exit 1; }

echo "Snapshot a tester : $LAST_SNAPSHOT"

# --- 1. Demarrer l'env isole ---
docker compose -f "$COMPOSE" up -d
sleep 10

# --- 2. Extraire le snapshot ---
WORK=$(mktemp -d)
trap 'docker compose -f "$COMPOSE" down -v; rm -rf "$WORK"' EXIT

age -d -i "$IDENTITY_FILE" < "$BACKUP_LOCAL_DIR/$LAST_SNAPSHOT" \
  | unzstd | tar -x -C "$WORK/"

SUB=$(ls "$WORK")
EXTRACTED="$WORK/$SUB"

# --- 3. Restore BDD dans mysql-test ---
gunzip -c "$EXTRACTED/db.sql.gz" \
  | docker exec -i badge-mysql-test mysql -u root -ptest-restore-pw badge

# --- 4. Restore bucket dans minio-test ---
mc alias set test-restore-mc http://localhost:9100 minioadmin minioadmin > /dev/null
mc mb test-restore-mc/badge-restore 2>/dev/null || true
mc mirror --quiet --overwrite "$EXTRACTED/minio/" test-restore-mc/badge-restore

# --- 5. Smoke tests : assertions minimales ---
echo
echo "=== Smoke tests sur l'env restore-test ==="

# 5a. BDD : tables clefs presentes
TABLES=$(docker exec badge-mysql-test mysql -u root -ptest-restore-pw -N -e "SHOW TABLES IN badge;" | wc -l | tr -d ' ')
echo "  Tables BDD restaurees : $TABLES"
[ "$TABLES" -ge 1 ] || { echo "  ECHEC : aucune table"; exit 2; }

# 5b. PlatformSettings present
PS=$(docker exec badge-mysql-test mysql -u root -ptest-restore-pw -N -e "SELECT COUNT(*) FROM badge.PlatformSettings;" || echo 0)
echo "  PlatformSettings rows : $PS"

# 5c. Bucket : objets presents
OBJS=$(mc ls --recursive test-restore-mc/badge-restore | wc -l | tr -d ' ')
META_OBJS=$(jq -r '.bucketObjectCount' "$EXTRACTED/metadata.json")
echo "  Objets bucket : $OBJS (attendu $META_OBJS)"
[ "$OBJS" = "$META_OBJS" ] || { echo "  ECHEC : nombre d'objets incoherent"; exit 2; }

echo
echo "=== Test restore OK ==="
echo "Snapshot $LAST_SNAPSHOT validable."
```

Rendre executable :

```bash
chmod +x scripts/test-restore.sh
```

- [ ] **Step 15.3: Verifier la syntaxe**

```bash
bash -n scripts/test-restore.sh
echo "Syntaxe OK"
```

- [ ] **Step 15.4: Commit**

```bash
git add docker-compose.restore-test.yml scripts/test-restore.sh
git commit -m "feat(v2): compose et script test-restore (env isole trimestriel)"
```

---

### Task 16: `scripts/audit-permissions.sh`

**Files:**

- Create: `scripts/audit-permissions.sh`

- [ ] **Step 16.1: Creer `scripts/audit-permissions.sh`**

```bash
#!/usr/bin/env bash
#
# audit-permissions.sh
# Verifie que les permissions filesystem correspondent au tableau de la spec v2-08.
# Sortie : code 0 si tout est conforme, > 0 sinon, avec liste des ecarts.

set -uo pipefail

# Tableau : "PATH MODE OWNER GROUP"
EXPECTED=(
  "/etc/badge                          755 root root"
  "/etc/badge/age-recipients.txt       644 root root"
  "/etc/badge/rclone.conf              600 root root"
  "/var/backups/badge                  700 root root"
  "/var/backups/badge/snapshots        700 root root"
  "/var/backups/badge/staging          700 root root"
  "/var/log/badge                      750 root adm"
)

issues=0

check() {
  local path="$1" exp_mode="$2" exp_owner="$3" exp_group="$4"
  if [ ! -e "$path" ]; then
    echo "[MISSING] $path"
    issues=$((issues + 1))
    return
  fi
  local mode owner group
  mode=$(stat -c '%a' "$path")
  owner=$(stat -c '%U' "$path")
  group=$(stat -c '%G' "$path")
  if [ "$mode" != "$exp_mode" ] || [ "$owner" != "$exp_owner" ] || [ "$group" != "$exp_group" ]; then
    echo "[MISMATCH] $path : $mode $owner:$group (attendu $exp_mode $exp_owner:$exp_group)"
    issues=$((issues + 1))
  else
    echo "[OK] $path"
  fi
}

for line in "${EXPECTED[@]}"; do
  # shellcheck disable=SC2086
  set -- $line
  check "$1" "$2" "$3" "$4"
done

# .env.production : si present, doit etre 600 root:root
if [ -f /root/badge/.env.production ]; then
  check "/root/badge/.env.production" 600 root root
fi

# Detecter une identite age privee residuelle (avertissement)
if compgen -G "/root/.config/age/*identity*" > /dev/null; then
  echo "[WARN] Identite age privee detectee dans /root/.config/age/"
fi

if [ "$issues" -gt 0 ]; then
  echo
  echo "$issues ecart(s) detecte(s)."
  exit 1
fi

echo
echo "Toutes les permissions sont conformes."
```

Rendre executable :

```bash
chmod +x scripts/audit-permissions.sh
```

- [ ] **Step 16.2: Verifier la syntaxe**

```bash
bash -n scripts/audit-permissions.sh
echo "Syntaxe OK"
```

- [ ] **Step 16.3: Commit**

```bash
git add scripts/audit-permissions.sh
git commit -m "feat(v2): audit-permissions.sh verifie les permissions filesystem"
```

---

### Task 17: Validation manuelle du palier 4 (lint + typecheck + tests + smoke restore)

**Files:** aucun. Validation.

- [ ] **Step 17.1: Lint + typecheck + tests Vitest**

```bash
make lint && make typecheck && make test
```

Expected: tout passe.

- [ ] **Step 17.2: Syntaxe de tous les scripts shell**

```bash
for f in scripts/*.sh scripts/_lib/*.sh; do
  bash -n "$f" && echo "[ok] $f" || echo "[FAIL] $f"
done
```

Expected: tous OK.

- [ ] **Step 17.3: Tester `make restore-from-backup` sans aucun snapshot**

```bash
BACKUP_LOCAL_DIR=/tmp/empty-backups RCLONE_CONFIG=/tmp/_no.conf \
HETZNER_REMOTE_NAME=x HETZNER_REMOTE_PATH=x \
MYSQL_ROOT_PASSWORD=x S3_ENDPOINT=x S3_BUCKET=x \
MINIO_ROOT_USER=x MINIO_ROOT_PASSWORD=x \
BACKUP_NOTIFY_EMAIL=x@x DATABASE_URL=x \
bash scripts/restore-from-backup.sh 2>&1 | head -5
```

Expected: message d'erreur clair (`Aucun snapshot trouve ...`), exit code != 0.

- [ ] **Step 17.4: Pas de commit (validation)**

---

## Palier 5 -- Documentation

> Objectif : documentation fonctionnelle (features), runbooks operationnels, mise a jour de l'index et de l'architecture v2 pour refleter MinIO et le pipeline backup.

### Task 18: `docs/v2/features/stockage-fichiers-s3.md`

**Files:**

- Create: `docs/v2/features/stockage-fichiers-s3.md`

- [ ] **Step 18.1: Creer le fichier avec le contenu suivant**

````markdown
# Stockage de fichiers (S3 / MinIO) -- v2

## Description fonctionnelle

La v2 stocke tous les fichiers utilisateurs (logos d'organisation et d'evenement, photos de profil, justificatifs PDF, badges generes) dans un service S3-compatible. En production, ce service est **MinIO self-hosted** dans le meme Docker host que l'application. Cote code, l'acces se fait via `@aws-sdk/client-s3`, ce qui rend le code agnostique du provider : une migration vers AWS S3, Scaleway ou Cloudflare R2 ne demande qu'un changement d'endpoint et de credentials.

## Organisation des objets (multi-tenant)

Un seul bucket par environnement : `badge-dev` en dev, `badge-prod` en prod.

Structure des cles :

```
orgs/{orgId}/
  logo.{ext}
  events/{eventId}/
    settings/
      logo.{ext}
      header.{ext}
    registrations/{regId}/
      passport.pdf
      photo.{ext}
    badges/
      {regId}.pdf
```

Toute lecture/ecriture passe par un prefixe contenant `orgId` : cela permet une defense en profondeur cote `storage.ts` (le code peut verifier que la cle commence bien par `orgs/{orgId}/` avant l'operation), et simplifie l'archivage d'une organisation (`deletePrefix("orgs/{orgId}/")`).

## API `src/lib/storage.ts`

```typescript
uploadFile(key: string, body: Buffer, contentType: string): Promise<string>
getFile(key: string): Promise<{ body: Buffer; contentType: string }>
deleteFile(key: string): Promise<void>
deletePrefix(prefix: string): Promise<number>   // retourne le nombre d'objets supprimes
```

Toutes les operations sont **asynchrones**. Les exceptions remontent telles que renvoyees par `@aws-sdk/client-s3`.

## Variables d'environnement

| Variable | Description | Exemple dev |
|---|---|---|
| `S3_ENDPOINT` | URL du service S3 | `http://minio:9000` |
| `S3_REGION` | Region SDK (MinIO l'ignore) | `us-east-1` |
| `S3_ACCESS_KEY` | Cle applicative scopee sur le bucket | `badge-app-dev` |
| `S3_SECRET_KEY` | Secret de la cle applicative | (CHANGE_ME en prod) |
| `S3_BUCKET` | Nom du bucket cible | `badge-dev` |
| `MINIO_ROOT_USER` | Root MinIO (admin only) | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Root MinIO (admin only) | (long random en prod) |

## Bootstrap

`make minio-init` (dev) ou `make minio-init-prod` (prod) :

1. Cree le bucket s'il n'existe pas.
2. Cree la cle applicative scopee.
3. Attache une policy IAM limitant la cle applicative a `s3:GetObject|PutObject|DeleteObject|ListBucket` sur le bucket cible uniquement (pas de droit de creer/supprimer le bucket ni d'acceder a d'autres buckets).

Idempotent : peut etre relance N fois sans erreur.

## Securite

- **Pas d'exposition publique** : en prod, MinIO n'expose aucun port sur Internet. La communication app -> MinIO passe par le reseau Docker interne (`http://minio:9000`).
- **Cle applicative scopee** : la cle utilisee par le code applicatif (`S3_ACCESS_KEY`) n'a aucun droit administratif sur MinIO. Une compromission du conteneur `app` n'expose que le bucket `badge-prod`.
- **Console MinIO** : `:9001` est expose en dev sur `localhost:9001` pour introspection. En prod, accessible uniquement via tunnel SSH (`ssh -L 9001:minio:9001 root@serveur`).

## Voir aussi

- Spec design : [`docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md`](../specs/2026-05-31-v2-08-stockage-s3-et-backups.md)
- Pipeline backup : [`docs/v2/features/backups-hebdomadaires.md`](backups-hebdomadaires.md)
- Procedure restore : [`docs/v2/operations/restore.md`](../operations/restore.md)
````

- [ ] **Step 18.2: Commit**

```bash
git add docs/v2/features/stockage-fichiers-s3.md
git commit -m "docs(v2): feature stockage S3 (MinIO) -- doc fonctionnelle"
```

---

### Task 19: `docs/v2/features/backups-hebdomadaires.md`

**Files:**

- Create: `docs/v2/features/backups-hebdomadaires.md`

- [ ] **Step 19.1: Creer le fichier avec le contenu suivant**

````markdown
# Backups hebdomadaires -- v2

## Description fonctionnelle

Chaque dimanche a 03h00, un cron de l'hote execute `make backup-prod` qui produit un snapshot complet chiffre, contenant la BDD, le bucket MinIO et la configuration sensible. Le snapshot est conserve localement sur le serveur **et** pousse vers une cible distante (Hetzner Storage Box BX11). La retention est `4 hebdo + 6 mensuels`. Un email recapitulatif est envoye a chaque execution (succes comme echec) ; un log JSON structure est ecrit en plus pour ingestion future par un agregateur (spec v2-09).

## Contenu d'un snapshot

Un snapshot est **un seul fichier autonome** :

```
snapshot-YYYY-MM-DD-HHMMSS.tar.zst.age
```

Apres dechiffrement et extraction :

```
snapshot-YYYY-MM-DD-HHMMSS/
|-- db.sql.gz         # dump MySQL --single-transaction --routines --triggers --events, gzip
|-- minio/            # miroir mc du bucket
|-- env.production    # secrets applicatifs
|-- Caddyfile         # reverse proxy config
`-- metadata.json     # createdAt, gitSha, dbSize, bucketObjectCount, bucketSize, hostname
```

## Pipeline (10 etapes)

1. Preparation (dependances, repertoire staging horodate)
2. Capture BDD : `mysqldump ... | gzip > db.sql.gz`
3. Miroir MinIO : `mc mirror --quiet --overwrite badge-prod minio/`
4. Capture config : `.env.production` + `Caddyfile`
5. Metadonnees : `metadata.json`
6. Empaquetage streaming : `tar | zstd -19 | age --recipients-file ...` -> `snapshot-X.tar.zst.age`
7. Cleanup staging
8. Push distant : `rclone copy snapshot-X.tar.zst.age hetzner:badge-backups/`
9. Rotation GFS (local + distant)
10. Email + log JSON + `last-status.json`

Le pipeline est **fail-fast** (`set -euo pipefail`) : toute etape echouee envoie un email d'echec et stoppe.

## Cibles `Makefile`

| Cible | Effet |
|---|---|
| `make backup-prod` | Lance un backup complet |
| `make backup-prod-dry-run` | Simule (n'ecrit rien, ne pousse rien) |
| `make backup-list` | Liste fusionnee local + distant |
| `make backup-list-local` | Liste locale brute |
| `make backup-list-remote` | Liste distante brute (rclone) |
| `make backup-status` | Affiche `last-status.json` |
| `make install-backup-deps` | Installe mc, rclone, age, zstd, jq, msmtp + cron + logrotate |
| `make minio-init-prod` | Bootstrap bucket et cle applicative en prod |
| `make restore-from-backup` | Restore interactif (cf. [`operations/restore.md`](../operations/restore.md)) |

## Retention GFS

Politique : `RETENTION_WEEKLY=4 + RETENTION_MONTHLY=6` (configurable dans `.env.production`).

Algorithme :

- Garde les 4 snapshots les plus recents (hebdo glissant).
- Plus, pour chacun des 6 derniers mois calendaires (hors mois courant), le 1er snapshot pris ce mois-la (mensuel).
- Supprime tous les autres.

A l'etat stable : ~10 snapshots actifs. Volume distant ~10 x taille_snapshot.

Les snapshots prefixes `pre-restore-` sont **toujours preserves** (jamais purges par la rotation). Leur suppression est exclusivement manuelle.

## Chiffrement et destinataires age

Tout snapshot est chiffre avec [age](https://github.com/FiloSottile/age) avant de toucher le disque ou de partir vers Hetzner.

Le serveur ne dispose que des **cles publiques** (`/etc/badge/age-recipients.txt`). Les cles privees vivent dans des coffres-forts externes (1Password, Bitwarden) et ne sont jamais deployees sur le serveur sauf le temps d'un restore.

Au moins 2 destinataires sont requis : si l'on perd la cle privee principale, la cle de secours permet quand meme de dechiffrer.

Voir [`operations/age-keys.md`](../operations/age-keys.md) pour la gestion complete.

## Cible distante : Hetzner Storage Box BX11

- 1 To stockage, prix fixe ~3,20 EUR/mois.
- Acces SFTP (port 23), credentials dans `/etc/badge/rclone.conf` (root:root 0600).
- Datacenters DE/FI (residence EU).
- Push via `rclone copy` (idempotent, resumable).

## Monitoring

- **Email** envoye a `BACKUP_NOTIFY_EMAIL` a chaque execution. Le silence absolu = alerte humaine (pas d'email pendant > 8 jours => le cron ne tourne plus).
- **Log JSON Lines** : `/var/log/badge/backup.log`, format directement consommable par Loki/Graylog/Vector quand la spec v2-09 sera implementee.
- **Etat actuel** : `/var/backups/badge/last-status.json` (lisible par `make backup-status`).
- **Log brut cron** : `/var/log/badge/backup-cron.log` (stdout/stderr du `make`, utile si le script crash avant d'ecrire son propre log).

## Variables d'environnement

| Variable | Description |
|---|---|
| `BACKUP_LOCAL_DIR` | Repertoire des snapshots locaux (defaut `/var/backups/badge/snapshots`) |
| `BACKUP_STAGING_DIR` | Repertoire staging temporaire |
| `BACKUP_LOG_DIR` | Repertoire des logs |
| `AGE_RECIPIENTS_FILE` | Fichier des cles publiques age |
| `RCLONE_CONFIG` | Chemin du fichier rclone.conf |
| `HETZNER_REMOTE_NAME` | Nom du remote rclone (par convention `hetzner`) |
| `HETZNER_REMOTE_PATH` | Chemin distant (par convention `badge-backups`) |
| `RETENTION_WEEKLY` | Nombre de snapshots hebdo a garder (defaut 4) |
| `RETENTION_MONTHLY` | Nombre de mois mensuels a garder (defaut 6) |
| `BACKUP_NOTIFY_EMAIL` | Destinataire des emails de monitoring |
| `PLATFORM_SMTP_*` | Credentials SMTP utilises par msmtp |

## Voir aussi

- Spec design : [`docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md`](../specs/2026-05-31-v2-08-stockage-s3-et-backups.md)
- Stockage S3 : [`docs/v2/features/stockage-fichiers-s3.md`](stockage-fichiers-s3.md)
- Restore : [`docs/v2/operations/restore.md`](../operations/restore.md)
- Cles age : [`docs/v2/operations/age-keys.md`](../operations/age-keys.md)
````

- [ ] **Step 19.2: Commit**

```bash
git add docs/v2/features/backups-hebdomadaires.md
git commit -m "docs(v2): feature backups hebdomadaires -- doc fonctionnelle"
```

---

### Task 20: Runbooks operations -- `README`, `restore`, `age-keys`

**Files:**

- Create: `docs/v2/operations/README.md`
- Create: `docs/v2/operations/restore.md`
- Create: `docs/v2/operations/age-keys.md`

- [ ] **Step 20.1: Creer `docs/v2/operations/README.md`**

```bash
mkdir -p docs/v2/operations
```

Contenu :

```markdown
# Runbooks operations -- Badge v2

Documents operationnels (procedures pas-a-pas pour les humains) lies a la maintenance et a la securite de la plateforme.

## Index

| Runbook | Quand l'utiliser |
|---|---|
| [Restore depuis un snapshot](restore.md) | Corruption BDD, perte de fichiers, retour arriere post-incident, audit historique |
| [Gestion des cles age](age-keys.md) | Creation, depot en coffre, rotation, restore |

## Conventions

- Tous les runbooks decrivent les commandes a executer en root sur le serveur de prod, sauf indication contraire.
- Toute commande destructive demande une confirmation explicite (le runbook l'indique).
- En cas de doute en cours de procedure : **arreter et demander confirmation** avant de continuer.

## Voir aussi

- [Spec v2-08 stockage S3 et backups](../specs/2026-05-31-v2-08-stockage-s3-et-backups.md)
- [Feature backups hebdomadaires](../features/backups-hebdomadaires.md)
```

- [ ] **Step 20.2: Creer `docs/v2/operations/restore.md`**

Contenu :

````markdown
# Runbook -- Restore depuis un snapshot

> Document operationnel, pas une spec. Procedure pas-a-pas pour restaurer la BDD et le bucket MinIO depuis un snapshot Badge v2.

## Quand restaurer

- Corruption BDD (incident logique : suppression massive accidentelle, donnees alterees par bug).
- Perte d'un fichier specifique dans le bucket MinIO.
- Retour arriere apres un deploiement defaillant.
- Audit RGPD : produire un etat historique de la BDD a une date donnee (utiliser DRY_RUN).

## Pre-requis

- Acces root au serveur de prod.
- Identite age privee accessible (depuis votre coffre 1Password / Bitwarden).
- `BACKUP_NOTIFY_EMAIL` configure dans `.env.production`.
- Snapshot cible disponible (local ou distant -- verifiable par `make backup-list`).

## Procedure standard

1. Se connecter au serveur : `ssh root@<serveur>` puis `cd /root/badge`.
2. Lister les snapshots : `make backup-list`.
3. Deployer **temporairement** l'identite age privee :
   - Copier le fichier `*-identity.txt` depuis votre coffre vers le serveur :
     `scp identity.txt root@<serveur>:/root/.config/age/identity.txt`
   - Permissions : `chmod 600 /root/.config/age/identity.txt`
4. Lancer le restore interactif : `make restore-from-backup`.
5. Selectionner le snapshot voulu par numero.
6. Lire le resume affiche, confirmer en tapant `RESTORE-PROD-CONFIRM`.
7. Attendre la creation automatique du snapshot de precaution (~8 min).
8. Confirmer une seconde fois en tapant `GO`.
9. Attendre la fin du restore + smoke tests.
10. Si la config doit aussi etre restauree : examiner `.env.production.restored` et `Caddyfile.restored`, decider a la main de les mover (`mv .env.production.restored .env.production`) puis `make prod-build`.
11. **Detruire** l'identite age privee : `shred -u /root/.config/age/identity.txt`.

## Procedure d'urgence (serveur prod completement perdu)

1. Reprovisionner un serveur vide avec Docker et Make.
2. Cloner le repo : `git clone <repo> /root/badge`.
3. Installer les dependances : `cd /root/badge && sudo make install-backup-deps`.
4. Copier les credentials Hetzner depuis votre coffre vers `/etc/badge/rclone.conf` (600 root:root).
5. Copier les cles publiques age vers `/etc/badge/age-recipients.txt` (a partir du template).
6. Copier votre identite age privee temporairement (`/root/.config/age/identity.txt`).
7. Creer un `.env.production` minimal (les vraies valeurs viendront du snapshot via `.restored`).
8. `make prod-build` puis `make minio-init-prod`.
9. `make restore-from-backup SNAPSHOT=<date-du-dernier-snapshot>`.
10. Apres restore : mover `env.production.restored` et `Caddyfile.restored`, `make prod-build`.
11. Detruire l'identite age privee.

## Rollback d'un restore

Si le restore a produit un etat inattendu, le snapshot de precaution `pre-restore-YYYY-MM-DD-HHMMSS.tar.zst.age` permet de revenir en arriere :

```bash
make restore-from-backup SNAPSHOT=pre-restore-YYYY-MM-DD-HHMMSS
```

Les snapshots `pre-restore-*` ne sont jamais purges par la rotation GFS. Une fois le restore valide pour de bon (jour J+N), le supprimer manuellement :

```bash
rm /var/backups/badge/snapshots/pre-restore-YYYY-MM-DD-HHMMSS.tar.zst.age
rclone --config /etc/badge/rclone.conf deletefile hetzner:badge-backups/pre-restore-YYYY-MM-DD-HHMMSS.tar.zst.age
```

## Tester un restore en safe mode

Pour valider qu'un snapshot est restaurable sans toucher a la prod :

```bash
make restore-from-backup DRY_RUN=1 SNAPSHOT=<date>
```

Le script telecharge si necessaire, dechiffre, extrait, valide l'integrite, mais n'ecrit rien en prod. Exit 0 si valide, > 0 sinon avec diagnostic.

Pour un test plus pousse (restore dans un env isole avec smoke tests) :

```bash
bash scripts/test-restore.sh
```

A executer une fois par trimestre.

## Si la cle age privee est perdue

**Les backups sont irrecuperables.**

D'ou l'importance d'avoir au moins 2 destinataires `age` configures (admin principal + secours, dans 2 coffres distincts). Si vous lisez ceci apres une perte de cle, contacter le second porteur de cle pour deployer son identite.

Si les deux cles sont perdues simultanement, les backups sont definitivement illisibles. Aucune procedure ne peut y remedier (c'est le design voulu : `age` est asymetrique, sans recours).

## Voir aussi

- [Feature backups hebdomadaires](../features/backups-hebdomadaires.md)
- [Gestion des cles age](age-keys.md)
````

- [ ] **Step 20.3: Creer `docs/v2/operations/age-keys.md`**

Contenu :

````markdown
# Runbook -- Gestion des cles age

> Document operationnel. Comment creer, conserver, faire tourner les cles `age` utilisees pour chiffrer les backups Badge v2.

## Principe

Le pipeline de backup utilise `age` (chiffrement asymetrique) :

- **Cles publiques** (`age-recipients.txt`) : deposees sur le serveur de prod. Permettent de **chiffrer**.
- **Cles privees** (`*-identity.txt`) : conservees dans des coffres-forts externes (1Password, Bitwarden). Permettent de **dechiffrer**.

Le serveur ne peut donc **jamais** lire les backups (passes ou futurs), meme s'il est entierement compromis. Seul un porteur de cle privee peut restaurer.

## Creation initiale (au demarrage du projet)

1. Sur votre poste admin (jamais sur le serveur), generer une paire :

   ```bash
   age-keygen -o admin-identity.txt
   # Le fichier indique la cle publique correspondante sur la 1ere ligne :
   # "# public key: age1xxxxxxxxxxxxxxxxxxxxxx..."
   ```

2. Conserver `admin-identity.txt` dans **votre coffre principal** (1Password Personal par exemple). Ne jamais le mettre dans le repo, ne jamais l'envoyer par email.

3. Demander a un second admin de faire de meme et conserver `backup-identity.txt` dans **son coffre** (Bitwarden equipe par exemple). C'est la cle de secours.

4. Recuperer les 2 cles publiques (`age1xxx...` et `age1yyy...`) et les deposer sur le serveur :

   ```bash
   sudo bash -c 'cat > /etc/badge/age-recipients.txt <<EOF
# Cles publiques age autorisees a dechiffrer les backups Badge.
age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Admin principal (1Password personnel)
age1yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy  # Admin secours (Bitwarden equipe)
EOF'
   sudo chown root:root /etc/badge/age-recipients.txt
   sudo chmod 644 /etc/badge/age-recipients.txt
   ```

5. Verifier que le script de backup voit bien les 2 destinataires :

   ```bash
   grep -cE '^age1' /etc/badge/age-recipients.txt
   ```

   Expected: `2` (le script de backup refusera de demarrer si < 2).

## Lors d'un restore

1. Copier votre identite privee depuis le coffre vers le serveur **temporairement** :

   ```bash
   scp ~/Documents/admin-identity.txt root@<serveur>:/root/.config/age/identity.txt
   ssh root@<serveur> chmod 600 /root/.config/age/identity.txt
   ```

2. Executer le restore : `make restore-from-backup`.

3. Detruire l'identite immediatement apres :

   ```bash
   ssh root@<serveur> shred -u /root/.config/age/identity.txt
   ```

> Alternative : dechiffrer le snapshot localement sur votre poste (jamais sur le serveur), puis pousser le contenu vers le serveur via les outils habituels (`mysqldump < ...`, `mc mirror ...`). Plus lourd mais elimine entierement le risque de laisser l'identite sur la prod.

## Rotation annuelle

Une fois par an (a planifier dans un ticket de maintenance) :

1. Generer une nouvelle paire admin sur votre poste : `age-keygen -o admin-2027-identity.txt`.
2. La conserver dans le coffre (en plus de l'ancienne, pas a la place).
3. Ajouter la nouvelle cle publique a `/etc/badge/age-recipients.txt` (cumulee avec les anciennes). Le fichier contient maintenant 3 destinataires.
4. **Attendre 1 mois** : laisser passer un cycle complet de GFS pour que tous les snapshots actifs soient chiffres avec la nouvelle cle.
5. Retirer l'ancienne cle publique du fichier `recipients`. L'ancienne cle privee reste conservee **definitivement** dans le coffre, pour pouvoir dechiffrer les snapshots historiques en cas d'audit.

## Que faire si une cle privee fuite

Toute fuite suspecte d'une cle privee :

1. Generer immediatement une nouvelle paire et l'ajouter aux recipients.
2. Retirer la cle publique correspondant a la cle compromise du fichier `recipients`.
3. **Re-generer tous les snapshots actifs** en relancant `make backup-prod` une fois par snapshot a remplacer (ou en attendant un cycle complet).
4. Notifier l'autre admin et reviser la liste des personnes ayant eu acces au coffre concerne.

> Note : la cle compromise reste valable pour dechiffrer les snapshots historiques. C'est inevitable -- d'ou l'importance de la rapidite de detection.

## Que faire si toutes les cles privees sont perdues

Aucune procedure. Les backups sont definitivement illisibles. C'est le compromis voulu de la securite par chiffrement asymetrique.

Mesures de prevention :
- 2 cles privees minimum, dans 2 coffres distincts geographiquement (1Password US-region + Bitwarden EU-region par ex).
- Conservation des fichiers `*-identity.txt` dans des "secure notes" du coffre, pas dans des fichiers attaches susceptibles d'etre supprimes par erreur.
- Backup du coffre lui-meme (1Password exporte un fichier `.1pux` regulierement, par exemple).

## Voir aussi

- [Runbook restore](restore.md)
- [Feature backups hebdomadaires](../features/backups-hebdomadaires.md)
````

- [ ] **Step 20.4: Commit**

```bash
git add docs/v2/operations/
git commit -m "docs(v2): runbooks operations (restore, age-keys, README)"
```

---

### Task 21: Mise a jour `docs/v2/features/deploiement-initial.md`

**Files:**

- Modify: `docs/v2/features/deploiement-initial.md`

> Cette feature mentionnait deja `make backup-prod` comme placeholder. On la met a jour pour renvoyer vers les nouvelles features.

- [ ] **Step 21.1: Lire le fichier actuel**

```bash
cat docs/v2/features/deploiement-initial.md
```

- [ ] **Step 21.2: Mettre a jour la section "Procedure de deploiement" (etape [2] Backup de precaution)**

Localiser le bloc :

```
[2] Backup de precaution (au cas ou, meme si on reset volontairement)
    $ make backup-prod                    # mysqldump + uploads.tar.gz
```

Le remplacer par :

```
[2] Backup de precaution (au cas ou, meme si on reset volontairement)
    $ make backup-prod                    # snapshot complet chiffre (BDD + bucket + config)
                                          # cf docs/v2/features/backups-hebdomadaires.md
```

- [ ] **Step 21.3: Mettre a jour la section "Plan de rollback"**

Localiser :

```
[2] Restore backup
    $ docker exec badge-db mysql ...
    $ tar -xzf uploads-pre-v2.tar.gz ...
```

Le remplacer par :

```
[2] Restore backup
    $ make restore-from-backup
    # cf docs/v2/operations/restore.md
```

- [ ] **Step 21.4: Ajouter en fin de fichier une section "Dependances"**

Ajouter (ou completer si une section Dependances existe) :

```
- Spec v2-08 (Stockage S3 + backups) : `make backup-prod`, `make restore-from-backup`,
  `make minio-init-prod` proviennent de cette spec. Le service `minio` doit etre
  ajoute a `docker-compose.yml` avant le premier deploiement.
```

- [ ] **Step 21.5: Commit**

```bash
git add docs/v2/features/deploiement-initial.md
git commit -m "docs(v2): renvoyer deploiement-initial vers backups et restore v2-08"
```

---

### Task 22: Mise a jour `docs/v2/README.md` -- entree 8 dans les tableaux

**Files:**

- Modify: `docs/v2/README.md`

- [ ] **Step 22.1: Ajouter la ligne dans le tableau "Sous-specifications fonctionnelles"**

Editer `docs/v2/README.md`. Localiser le tableau "Sous-specifications fonctionnelles" et ajouter une ligne :

```
| 8 | [Stockage S3 + backups hebdomadaires](features/stockage-fichiers-s3.md) | MinIO multi-tenant, pipeline backup chiffre vers Hetzner, restore interactif. Voir aussi [backups-hebdomadaires](features/backups-hebdomadaires.md) et [operations/](operations/) |
```

- [ ] **Step 22.2: Ajouter la ligne dans le tableau "Plans d'implementation"**

Localiser le tableau "Plans d'implementation" et ajouter :

```
| 8 | [Stockage S3 + backups hebdomadaires](plans/2026-05-31-v2-08-stockage-s3-et-backups.md) | -- | 24 |
```

> Les colonnes Lignes/Tasks seront a jour quand le plan sera execute.

- [ ] **Step 22.3: Mettre a jour la section "Etat d'avancement"**

Si la section liste les plans rediges, incrementer "Plans d'implementation (7/7)" -> "Plans d'implementation (8/8)".

- [ ] **Step 22.4: Commit**

```bash
git add docs/v2/README.md
git commit -m "docs(v2): ajouter v2-08 dans l'index sous-specs et plans"
```

---

### Task 23: Mise a jour `docs/v2/architecture.md`

**Files:**

- Modify: `docs/v2/architecture.md`

- [ ] **Step 23.1: Lire le fichier**

```bash
cat docs/v2/architecture.md
```

- [ ] **Step 23.2: Ajouter une section "Stockage de fichiers"**

Reperer la section sur le stockage (si elle existe : remplacer ; sinon : ajouter apres la section "Modele de donnees" ou "Stack technique"). Contenu a inclure :

```markdown
## Stockage de fichiers

Les fichiers (logos, justificatifs PDF, photos, badges generes) sont stockes
dans **MinIO** (S3-compatible), service Docker dedie sur le meme hote que
l'application. Un seul bucket par environnement (`badge-prod`, `badge-dev`)
avec structure de cles `orgs/{orgId}/events/{eventId}/...`.

L'acces se fait via `src/lib/storage.ts` (API : `uploadFile`, `getFile`,
`deleteFile`, `deletePrefix`) qui utilise `@aws-sdk/client-s3`. Le code est
agnostique du provider : MinIO peut etre remplace par AWS S3 / Scaleway / R2
en changeant uniquement l'endpoint.

Voir [`docs/v2/features/stockage-fichiers-s3.md`](features/stockage-fichiers-s3.md).
```

- [ ] **Step 23.3: Ajouter une section "Sauvegardes"**

Ajouter (apres la section Stockage) :

```markdown
## Sauvegardes

Pipeline hebdomadaire (cron dimanche 03h00) qui produit un snapshot chiffre
`age` contenant BDD + bucket MinIO + config. Le snapshot est stocke en
double : localement sur le serveur (restore rapide) **et** pousse vers
Hetzner Storage Box BX11 (disaster recovery). Retention GFS : 4 hebdo +
6 mensuels.

Restore via `make restore-from-backup` interactif, avec double confirmation
et snapshot de precaution automatique.

Voir [`docs/v2/features/backups-hebdomadaires.md`](features/backups-hebdomadaires.md)
et [`docs/v2/operations/restore.md`](operations/restore.md).
```

- [ ] **Step 23.4: Commit**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): architecture mentionne MinIO et pipeline backups"
```

---

## Verification finale

### Task 24: Tests complets, lint, typecheck, etat git, audit critere par critere

**Files:** aucun. Validation globale.

- [ ] **Step 24.1: Lint + typecheck + tests Vitest**

```bash
make lint && make typecheck && make test
```

Expected: tout passe.

- [ ] **Step 24.2: Syntaxe de tous les scripts shell**

```bash
for f in scripts/*.sh scripts/_lib/*.sh; do
  bash -n "$f" && echo "[ok] $f" || (echo "[FAIL] $f"; exit 1)
done
```

Expected: tous OK.

- [ ] **Step 24.3: Verifier que tous les fichiers livrables existent**

```bash
ls -1 \
  docs/v2/specs/2026-05-31-v2-08-stockage-s3-et-backups.md \
  docs/v2/plans/2026-05-31-v2-08-stockage-s3-et-backups.md \
  docs/v2/features/stockage-fichiers-s3.md \
  docs/v2/features/backups-hebdomadaires.md \
  docs/v2/operations/README.md \
  docs/v2/operations/restore.md \
  docs/v2/operations/age-keys.md \
  src/lib/storage.ts \
  src/lib/__tests__/storage.test.ts \
  scripts/backup-prod.sh \
  scripts/restore-from-backup.sh \
  scripts/rotate-snapshots.sh \
  scripts/list-snapshots.sh \
  scripts/minio-init.sh \
  scripts/install-backup-deps.sh \
  scripts/audit-permissions.sh \
  scripts/test-restore.sh \
  scripts/_lib/log.sh \
  scripts/_lib/email.sh \
  scripts/_lib/env.sh \
  ops/cron/badge-backup \
  ops/logrotate/badge-backup \
  ops/rclone/rclone.conf.example \
  ops/age/age-recipients.txt.example \
  docker-compose.restore-test.yml
```

Expected: tous les chemins existent (commande sortie code 0).

- [ ] **Step 24.4: Verifier que les cibles Makefile sont presentes**

```bash
for tgt in minio-init minio-init-prod backup-prod backup-prod-dry-run backup-list backup-list-local backup-list-remote backup-status install-backup-deps restore-from-backup; do
  grep -qE "^${tgt}:" Makefile && echo "[ok] $tgt" || echo "[MISSING] $tgt"
done
```

Expected: 10 cibles `[ok]`.

- [ ] **Step 24.5: Verifier l'ajout de `BACKUP_RESTORE` au schema Prisma**

```bash
grep -q "BACKUP_RESTORE" prisma/schema.prisma && echo "OK"
```

Expected: `OK`.

- [ ] **Step 24.6: Verifier que `.gitignore` exclut les secrets**

```bash
grep -E '^(ops/rclone/rclone.conf|ops/age/age-recipients.txt)$' .gitignore
```

Expected: 2 lignes.

- [ ] **Step 24.7: Verifier que rien de sensible n'est traque**

```bash
git ls-files | grep -E '(rclone\.conf|age-recipients\.txt|identity\.txt)$' | grep -v '\.example$' || echo "Aucun secret traque -- OK"
```

Expected: `Aucun secret traque -- OK`.

- [ ] **Step 24.8: Etat git propre**

```bash
git status
git log --oneline -25
```

Expected: working tree clean ; ~23 commits ajoutes par ce plan (un par task techniquement non-validation).

- [ ] **Step 24.9: Mise a jour finale du tracker `## Progression`**

Editer ce fichier (le plan lui-meme) pour passer toutes les lignes Task `[ ]` -> `[x]` avec la date d'execution. Renseigner "Derniere session" et "Prochaine etape : aucune (plan complet)".

- [ ] **Step 24.10: Commit final du tracker**

```bash
git add docs/v2/plans/2026-05-31-v2-08-stockage-s3-et-backups.md
git commit -m "docs(v2): plan v2-08 complete -- tracker mis a jour"
```

- [ ] **Step 24.11: Note finale**

A ce stade :

- Le code applicatif (`storage.ts`) utilise MinIO via `@aws-sdk/client-s3`.
- Le service `minio` est present dans `docker-compose.yml` (prod) et `docker-compose.dev.yml`.
- Le pipeline `make backup-prod` est pret a tourner sur le serveur de prod, sous reserve d'avoir execute `make install-backup-deps`, configure `/etc/badge/rclone.conf` et `/etc/badge/age-recipients.txt`, et complete les variables d'environnement dans `.env.production`.
- Le restore est outille via `make restore-from-backup` avec garde-fous.
- La documentation (features + runbooks + spec) est complete.

**Le deploiement effectif en prod** (premier lancement du pipeline backup) est une activite manuelle distincte, qui doit etre effectuee une fois la spec v2-07 (deploiement initial) executee et la prod basculee en v2.

---

## Notes finales

- **Pas de migration v1 -> v2 :** ce plan suppose que la spec v2-07 (deploiement initial avec reset) sera executee avant. Aucune donnee v1 ne survit dans le bucket MinIO ou la BDD apres bascule.
- **TDD strict** sur `storage.ts` (Task 3). Les scripts shell sont valides par `bash -n` + tests bout-en-bout manuels (Task 12, 17, 24) car il n'existe pas de framework de test bash deploye sur ce projet.
- **Frequence des commits** : un commit par task technique (~22 commits au total), aucune task de validation ne commit.
- **Dependances entre paliers** :
  - Palier 1 (MinIO) est independant.
  - Palier 2 (code) depend de Palier 1 (besoin de MinIO en dev pour les tests d'integration).
  - Palier 3 (backup scripts) est independant du code applicatif mais beneficie de Palier 1 pour les tests bout-en-bout.
  - Palier 4 (restore) depend de Palier 3 (besoin de snapshots a restaurer pour valider).
  - Palier 5 (docs) peut etre fait en parallele de chaque palier technique.
- **Choix simples documentes :**
  - Pas de presigner S3 dans `storage.ts` (option ecartee en brainstorming).
  - Pas de test automatique mensuel du restore (declenchement manuel trimestriel via `scripts/test-restore.sh`).
  - Pas de provider distant secondaire en plus de Hetzner (3-2-1 simplifie : local + 1 distant).
  - Pas de chiffrement applicatif des objets MinIO individuellement (le chiffrement est au niveau snapshot via `age`).
- **Risques residuels acceptes** (voir spec section Securite) : perte des 2 cles age privees = backups irrecuperables (par design).

