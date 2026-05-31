# Déploiement Kamal (Phase 1 local) — Implementation Plan

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

**Derniere session** : aucune, plan jamais commence.
**Prochaine etape** : Task 0.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le deploiement Kamal pour Badge v2 (Phase 1 : declenchement depuis le poste du developpeur principal), avec zero-downtime via kamal-proxy, accessoires mysql/minio/phpmyadmin geres par Kamal, et integration propre avec les specs v2-07 (superseded) et v3-01 (patches scripts).

**Architecture:** Le serveur prod (root@173.212.217.54) abandonne docker-compose et Caddy au profit de Kamal. kamal-proxy gere TLS Let's Encrypt + swap atomique. MySQL, MinIO, phpMyAdmin sont des accessoires Kamal avec volumes nommes. L'image applicative est build localement, pushee sur ghcr.io/tigamadou/badge, pullee par Kamal sur le serveur. Le developpeur principal lance `kamal deploy` depuis son poste avec un fichier `.kamal/secrets` local non versionne. Une route Next `/api/health` sert de signal de bascule.

**Tech Stack:** Kamal 2.5+ (gem Ruby), Docker BuildKit, kamal-proxy (Go), Next.js 16 standalone, GHCR (Docker registry), GNU Make, Bash, Vitest 4 pour le test du healthcheck. Pas de framework CI/CD en Phase 1.

**Spec:** [`docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md`](../specs/2026-05-31-v3-02-deploiement-kamal.md)

---

## File Structure

**Files to create:**

- `config/deploy.yml` -- manifeste Kamal complet (service, proxy, registry, env, accessoires, aliases)
- `config/mysql/my.cnf` -- config MySQL (UTF-8, packet size, timezone)
- `.kamal/secrets.example` -- template documente des secrets attendus
- `.gitignore` -- ajout de `.kamal/secrets`
- `src/app/api/health/route.ts` -- endpoint healthcheck pour kamal-proxy
- `src/app/api/health/__tests__/route.test.ts` -- tests Vitest du healthcheck
- `ops/Makefile-ops` -- Makefile minimal destine au workdir serveur `/root/badge-ops/`
- `docs/v2/features/deploiement-kamal.md` -- doc fonctionnelle Kamal Phase 1
- `docs/v2/operations/kamal-day-one.md` -- runbook bascule v1 -> v2 jour J
- `docs/v2/operations/kamal-rollback.md` -- runbook rollback (Kamal native + retour a v1)

**Files to modify:**

- `Dockerfile` -- ajout `ARG APP_VERSION` + `ENV APP_VERSION=$APP_VERSION` + `HEALTHCHECK`
- `Makefile` -- ajout cibles `kamal-*` + `ops-sync`
- `scripts/backup-prod.sh` (v3-01) -- `docker compose exec` -> `docker exec`, suppression refs `.env.production`
- `scripts/restore-from-backup.sh` (v3-01) -- meme adaptation
- `scripts/audit-permissions.sh` (v3-01) -- adaptation chemin `/opt/badge` -> `/root/badge-ops`
- `docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md` -- bandeau SUPERSEDED, tasks `[-]`
- `docs/v2/features/deploiement-initial.md` -- bandeau SUPERSEDED
- `docs/v2/README.md` -- v2-07 marque "Superseded", entree v3-02 ajoutee
- `docs/v2/architecture.md` -- mention Kamal + kamal-proxy + 4 conteneurs prod
- `CLAUDE.md` racine -- stack technique : Caddy -> kamal-proxy ; actions a risque etendues

**Files removed:** aucun cote repo. Sur le serveur prod : `docker-compose.yml` et `Caddyfile` deviennent obsoletes (decision operationnelle, pas modification du repo).

**Tests** :
- `src/app/api/health/__tests__/route.test.ts` est decouvert automatiquement par Vitest (config par defaut, pas de modification de `vitest.config.ts` necessaire).

---

## Pre-flight

### Task 0: Verifier l'etat du depot et les pre-requis

- [ ] **Step 0.1: Confirmer la branche et l'etat git**

Run: `git status && git branch --show-current`

Expected: `On branch feat/v2-sass` (ou main si bascule deja faite), working tree clean (commits v3-01 et spec v3-02 deja en place).

- [ ] **Step 0.2: Verifier la presence de la spec v3-02**

Run: `test -f docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md && echo OK`

Expected: `OK`. Sinon : la spec doit etre commitee avant d'executer ce plan.

- [ ] **Step 0.3: Verifier que la spec v3-01 (stockage + backups) est presente**

Run: `test -f docs/v3/specs/2026-05-31-v3-01-stockage-s3-et-backups.md && test -f docs/v3/plans/2026-05-31-v3-01-stockage-s3-et-backups.md && echo OK`

Expected: `OK`. Les patches Task 8 s'appliquent aux scripts v3-01 (qui peuvent ne pas encore etre crees -- on les patche au moment de leur creation, donc cette task documente les patches a appliquer).

- [ ] **Step 0.4: Verifier la presence du Dockerfile et de docker-entrypoint.sh**

Run: `ls -la Dockerfile docker-entrypoint.sh`

Expected: les 2 fichiers existent. Le Dockerfile est multi-stage (deps -> builder -> runner) et expose 3000.

- [ ] **Step 0.5: Verifier qu'il n'y a pas deja de config Kamal**

Run: `test -f config/deploy.yml && echo "DEJA PRESENT" || echo "absent, OK"`

Expected: `absent, OK`. Si deja present, ne pas ecraser sans concertation -- ce plan part de zero.

- [ ] **Step 0.6: Note de demarrage**

Aucune commande. Cette task est un check d'environnement. Pas de commit.

---

## Task 1: Installation Kamal en local + auth GHCR (runbook one-shot du developpeur principal)

> **Note** : cette task se fait **une seule fois** sur le poste du developpeur principal, hors flux git. Elle prepare le terrain pour les tasks suivantes. Aucun commit n'est produit.

**Files:** aucun (configuration de l'environnement local).

- [ ] **Step 1.1: Installer Ruby si absent**

Sur macOS :

```bash
brew install ruby
# Verifier que /usr/local/opt/ruby/bin (ou /opt/homebrew/opt/ruby/bin sur Apple Silicon) est dans le PATH
ruby --version
```

Expected: Ruby 3.1+ (Kamal 2.5 supporte 3.1, 3.2, 3.3+).

Si tu utilises rbenv ou asdf, ajuster en consequence (`rbenv install 3.3.0 && rbenv local 3.3.0`).

- [ ] **Step 1.2: Installer Kamal**

```bash
gem install kamal -v "~> 2.5"
kamal version
```

Expected: `2.5.x`.

- [ ] **Step 1.3: Creer un PAT GitHub avec scopes packages**

Sur https://github.com/settings/tokens :

1. *Generate new token* > *Generate new token (classic)*.
2. Nom : `kamal-badge-deploy`.
3. Expiration : 1 an.
4. Cocher les scopes :
   - `write:packages`
   - `read:packages`
5. *Generate token*. Copier la valeur (visible une seule fois).

Stocker la valeur dans Bitwarden / 1Password Free sous le nom `badge-ghcr-pat` (cf spec Section 3, "Stockage de reference").

- [ ] **Step 1.4: Authentifier Docker sur GHCR**

```bash
echo "<PAT>" | docker login ghcr.io -u tigamadou --password-stdin
```

Expected: `Login Succeeded`.

Verifier : `cat ~/.docker/config.json | jq '.auths."ghcr.io"'` retourne un objet avec une cle `auth` non vide.

- [ ] **Step 1.5: Verifier l'acces SSH au serveur de prod**

```bash
ssh root@173.212.217.54 "echo ok && docker --version 2>&1 || echo 'Docker absent (sera installe par kamal setup)'"
```

Expected: `ok` + version Docker ou message "absent". Si la commande prompt pour un mot de passe : ta cle SSH n'est pas autorisee, lancer `ssh-copy-id root@173.212.217.54` apres avoir verifie que le serveur accepte l'ajout de cles.

- [ ] **Step 1.6: Pas de commit**

Cette task configure l'environnement local. Pas de commit.

---

## Task 2: Route `/api/health` + tests Vitest (TDD)

**Files:**

- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/__tests__/route.test.ts`

> Implementation en TDD strict (test d'abord, puis code). La route est minimaliste : 200 OK + JSON statique. Kamal Proxy l'interroge pour decider du swap atomique zero-downtime.

- [ ] **Step 2.1: Ecrire le test FAILING**

Creer `src/app/api/health/__tests__/route.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/health", () => {
  it("retourne 200 avec status ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  it("retourne un timestamp ISO valide", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("retourne un uptime numerique positif", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("retourne la version depuis APP_VERSION ou 'unknown'", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2.2: Lancer le test, confirmer l'echec attendu**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/health/__tests__/route.test.ts`

Expected: FAIL avec `Cannot find module '../route'` (la route n'existe pas encore).

- [ ] **Step 2.3: Creer `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from "next/server";

// Empeche Next de pre-rendre / cacher cette reponse au build.
// Le healthcheck doit refleter l'etat runtime, pas l'etat build.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || "unknown",
    },
    { status: 200 }
  );
}
```

- [ ] **Step 2.4: Relancer le test, doit passer**

Run: `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/app/api/health/__tests__/route.test.ts`

Expected: `4 passed`.

- [ ] **Step 2.5: Verifier lint + typecheck**

```bash
make lint && make typecheck
```

Expected: 0 erreur.

- [ ] **Step 2.6: Smoke test HTTP local**

Si `next dev` tourne deja (`make dev` puis `docker compose -f docker-compose.dev.yml exec -d app yarn dev`) :

```bash
curl -s http://localhost:3000/api/health | jq
```

Expected (exemple) :

```json
{
  "status": "ok",
  "timestamp": "2026-05-31T15:42:01.123Z",
  "uptime": 42.5,
  "version": "unknown"
}
```

> Si Next n'est pas demarre : skip ce step (la route est validee par les tests Vitest de toute facon).

- [ ] **Step 2.7: Commit**

```bash
git add src/app/api/health/
git commit -m "feat(v2): route /api/health pour kamal-proxy + tests Vitest"
```

---

## Task 3: Dockerfile patch (ARG APP_VERSION + HEALTHCHECK)

**Files:**

- Modify: `Dockerfile`

> Deux ajouts cibles dans le stage `runner` : un argument de build `APP_VERSION` (injecte par Kamal au build, lu par /api/health), et une directive `HEALTHCHECK` (utile pour `docker ps` et complementaire au healthcheck Kamal Proxy).

- [ ] **Step 3.1: Lire le Dockerfile actuel**

```bash
cat Dockerfile
```

Reperer la fin du stage `runner` (juste avant `ENTRYPOINT`).

- [ ] **Step 3.2: Editer le Dockerfile**

Remplacer le bloc :

```dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl
```

Par :

```dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Version applicative injectee au build (lue par /api/health)
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

RUN apk add --no-cache openssl
```

Et juste avant la ligne `ENTRYPOINT ["./docker-entrypoint.sh"]`, ajouter :

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1
```

- [ ] **Step 3.3: Build local de l'image pour valider la syntaxe**

```bash
docker build -t badge-test:local --build-arg APP_VERSION=test-build .
```

Expected: build reussit (premiere fois : long, ~5-10 min).

- [ ] **Step 3.4: Verifier que APP_VERSION et HEALTHCHECK sont presents dans l'image**

```bash
docker inspect badge-test:local | jq '.[0].Config.Healthcheck'
```

Expected :

```json
{
  "Test": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1"],
  "Interval": 30000000000,
  "Timeout": 3000000000,
  "StartPeriod": 30000000000,
  "Retries": 3
}
```

```bash
docker inspect badge-test:local | jq '.[0].Config.Env[] | select(startswith("APP_VERSION"))'
```

Expected: `"APP_VERSION=test-build"`.

- [ ] **Step 3.5: Test de healthcheck en runtime (optionnel)**

```bash
docker run -d --name badge-hc-test -p 3001:3000 badge-test:local
sleep 40   # laisser le temps au start-period + healthcheck
docker inspect badge-hc-test | jq '.[0].State.Health.Status'
```

Expected: `"healthy"` (si BDD/MinIO ne sont pas la, la route /api/health repond quand meme 200 puisqu'elle n'a pas de dependance).

> **Note** : si l'app crash au boot (DATABASE_URL manquant a cause de l'entrypoint qui essaie `prisma db push`), c'est attendu. Le test passe quand meme parce que `wget` echoue et la sonde retourne `unhealthy` -- mais on n'est pas en train de tester Prisma, on teste que le HEALTHCHECK est cable. Verifier juste que `docker ps` montre une colonne "health".

Cleanup :

```bash
docker stop badge-hc-test && docker rm badge-hc-test
docker rmi badge-test:local
```

- [ ] **Step 3.6: Commit**

```bash
git add Dockerfile
git commit -m "feat(v2): Dockerfile ARG APP_VERSION + HEALTHCHECK pour Kamal"
```

---

## Task 4: Creation de `config/deploy.yml` + `config/mysql/my.cnf`

**Files:**

- Create: `config/deploy.yml`
- Create: `config/mysql/my.cnf`

> Le manifeste Kamal complet (cf spec Section 2). Toutes les valeurs sont concretes, pas de placeholder. Le fichier est versionne (les secrets sont references par nom, pas en clair).

- [ ] **Step 4.1: Creer le dossier `config/` et `config/mysql/`**

```bash
mkdir -p config/mysql
```

- [ ] **Step 4.2: Creer `config/mysql/my.cnf`**

```ini
[mysqld]
character-set-server = utf8mb4
collation-server     = utf8mb4_unicode_ci
max_allowed_packet   = 64M
innodb_buffer_pool_size = 512M
default-time-zone    = '+00:00'

[client]
default-character-set = utf8mb4
```

- [ ] **Step 4.3: Creer `config/deploy.yml`**

```yaml
# Manifeste de deploiement Kamal pour Badge v2.
# Source de verite : ce fichier + .kamal/secrets (jamais commit).
# Deploiement Phase 1 : `kamal deploy` depuis le poste du dev.
# Phase 2 (CI/CD) : cf annexe spec v3-02.

service: badge
image: ghcr.io/tigamadou/badge

servers:
  web:
    hosts:
      - 173.212.217.54
    labels:
      app: badge
      role: web

proxy:
  ssl: true
  host: badge.bj
  app_port: 3000
  healthcheck:
    path: /api/health
    interval: 2
    timeout: 5
  buffering:
    requests: true
    responses: true
    max_request_body: 10485760
    max_response_body: 0
  forward_headers: true

registry:
  server: ghcr.io
  username: tigamadou
  password:
    - KAMAL_REGISTRY_PASSWORD

builder:
  arch: amd64
  context: .
  dockerfile: Dockerfile
  args:
    APP_VERSION: <%= `git rev-parse --short HEAD`.strip %>

ssh:
  user: root
  keys_only: true

env:
  clear:
    NODE_ENV: production
    PORT: 3000
    HOSTNAME: 0.0.0.0
    NEXTAUTH_URL: https://badge.bj
    S3_ENDPOINT: http://badge-minio:9000
    S3_REGION: us-east-1
    S3_BUCKET: badge-prod
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 6Lc-public-site-key-placeholder
  secret:
    - DATABASE_URL
    - NEXTAUTH_SECRET
    - RECAPTCHA_SECRET_KEY
    - PLATFORM_SMTP_HOST
    - PLATFORM_SMTP_PORT
    - PLATFORM_SMTP_SECURE
    - PLATFORM_SMTP_USER
    - PLATFORM_SMTP_PASSWORD
    - PLATFORM_SMTP_FROM
    - S3_ACCESS_KEY
    - S3_SECRET_KEY
    - SEED_SUPER_ADMIN_EMAIL
    - SEED_SUPER_ADMIN_PASSWORD

healthcheck:
  path: /api/health
  port: 3000
  max_attempts: 30
  interval: 2s

boot:
  limit: 1
  wait: 5

logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"

accessories:
  mysql:
    image: mysql:8.4
    host: 173.212.217.54
    port: "127.0.0.1:3306:3306"
    env:
      clear:
        MYSQL_DATABASE: badge
      secret:
        - MYSQL_ROOT_PASSWORD
    files:
      - config/mysql/my.cnf:/etc/mysql/conf.d/badge.cnf
    volumes:
      - badge_mysql_data:/var/lib/mysql
    options:
      memory: 2g
      memory-swap: 2g
      restart: unless-stopped
      health-cmd: "mysqladmin ping -h localhost -uroot -p$$MYSQL_ROOT_PASSWORD"
      health-interval: 10s
      health-timeout: 5s
      health-retries: 10

  minio:
    image: minio/minio:RELEASE.2025-04-08T15-41-24Z
    host: 173.212.217.54
    port: "127.0.0.1:9000:9000"
    env:
      clear:
        MINIO_BROWSER_REDIRECT_URL: https://minio.badge.bj
      secret:
        - MINIO_ROOT_USER
        - MINIO_ROOT_PASSWORD
    volumes:
      - badge_minio_data:/data
    cmd: server /data --console-address ":9001"
    options:
      memory: 1g
      restart: unless-stopped

  phpmyadmin:
    image: phpmyadmin:5
    host: 173.212.217.54
    proxy:
      ssl: true
      host: pma.badge.bj
      app_port: 80
      healthcheck:
        path: /
        interval: 10
        timeout: 5
      basic_auth:
        - PHPMYADMIN_BASIC_AUTH_USER
        - PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH
    env:
      clear:
        PMA_HOST: badge-mysql
        PMA_PORT: 3306
        UPLOAD_LIMIT: 64M
    options:
      memory: 256m
      restart: unless-stopped

aliases:
  console: app exec --interactive --reuse bash
  shell: app exec --interactive --reuse sh
  logs: app logs --follow
  migrate: app exec --reuse "yarn prisma db push"
  seed: app exec --reuse "yarn prisma db seed"
  smoke: app exec --reuse "make smoke-tests"
  db: accessory exec mysql --interactive --reuse "mysql -uroot -p$MYSQL_ROOT_PASSWORD badge"
  db-dump: accessory exec mysql --reuse "mysqldump -uroot -p$MYSQL_ROOT_PASSWORD badge"
  mc: accessory exec minio --interactive --reuse "mc"
  ps: server exec "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"
```

- [ ] **Step 4.4: Verifier la syntaxe YAML**

```bash
ruby -ryaml -e "YAML.load_file('config/deploy.yml')" && echo "YAML OK"
```

Expected: `YAML OK`. Si erreur de parsing : corriger.

- [ ] **Step 4.5: Commit (sans .kamal/secrets, cree en Task 5)**

```bash
git add config/
git commit -m "feat(v2): config/deploy.yml + config/mysql/my.cnf pour Kamal"
```

---

## Task 5: `.kamal/secrets.example` + mise a jour `.gitignore`

**Files:**

- Create: `.kamal/secrets.example`
- Modify: `.gitignore`

> Le fichier reel `.kamal/secrets` est cree manuellement par le dev (Task 7), jamais commit. Le `.example` versionne sert de documentation et de template.

- [ ] **Step 5.1: Creer `.kamal/` et son `.example`**

```bash
mkdir -p .kamal
```

Creer `.kamal/secrets.example` :

```sh
# Fichier source par Kamal au demarrage de chaque commande (kamal deploy, kamal rollback, ...).
# Le vrai .kamal/secrets n'est PAS versionne (cf .gitignore).
# Copier ce fichier en .kamal/secrets et remplir les valeurs avec les vrais secrets.

# Registry GHCR (PAT GitHub scopes write:packages + read:packages)
KAMAL_REGISTRY_PASSWORD=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Base de donnees
MYSQL_ROOT_PASSWORD=CHANGE_ME_long_random
DATABASE_URL=mysql://root:CHANGE_ME_long_random@badge-mysql:3306/badge

# Stockage objet (MinIO accessoire)
MINIO_ROOT_USER=badge-admin
MINIO_ROOT_PASSWORD=CHANGE_ME_long_random
S3_ACCESS_KEY=                                # vide au premier setup, rempli apres make minio-init-prod
S3_SECRET_KEY=

# NextAuth
NEXTAUTH_SECRET=CHANGE_ME_openssl_rand_base64_32

# SMTP plateforme (cascade Event > Org > Platform)
PLATFORM_SMTP_HOST=smtp.example.tld
PLATFORM_SMTP_PORT=587
PLATFORM_SMTP_SECURE=false
PLATFORM_SMTP_USER=noreply@badge.bj
PLATFORM_SMTP_PASSWORD=CHANGE_ME
PLATFORM_SMTP_FROM=Badge <noreply@badge.bj>

# reCAPTCHA v3
RECAPTCHA_SECRET_KEY=CHANGE_ME

# Seed initial (a changer apres le premier login)
SEED_SUPER_ADMIN_EMAIL=admin@badge.bj
SEED_SUPER_ADMIN_PASSWORD=CHANGE_ME_temporary

# phpMyAdmin Basic Auth (couche kamal-proxy devant phpmyadmin)
PHPMYADMIN_BASIC_AUTH_USER=badge-ops
PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH=$2y$05$CHANGE_ME_bcrypt_hash
```

- [ ] **Step 5.2: Mettre a jour `.gitignore`**

```bash
grep -q '^\.kamal/secrets$' .gitignore || echo '.kamal/secrets' >> .gitignore
```

Verification :

```bash
grep -E '^\.kamal/secrets$' .gitignore
```

Expected: `1` ligne `.kamal/secrets`.

- [ ] **Step 5.3: Verifier que `.kamal/secrets` reel n'est pas accidentellement traque**

```bash
git ls-files | grep -E '^\.kamal/' || echo "Aucun fichier .kamal traque (OK si .example absent du repo)"
```

Si .example sera ajoute par cette task : on s'assure que seul .example sera commit.

```bash
git check-ignore .kamal/secrets
```

Expected: `.kamal/secrets`.

- [ ] **Step 5.4: Commit**

```bash
git add .kamal/secrets.example .gitignore
git commit -m "feat(v2): .kamal/secrets.example + gitignore secrets Kamal"
```

---

## Task 6: Cibles Makefile Kamal + Makefile-ops pour le serveur

**Files:**

- Modify: `Makefile`
- Create: `ops/Makefile-ops`

> Cibles wrappers Kamal cote local + un Makefile separe destine au workdir serveur `/root/badge-ops/`. Le Makefile-ops contient les cibles backup/restore/minio-init de la spec v3-01 adaptees Kamal.

- [ ] **Step 6.1: Lire le Makefile actuel**

```bash
cat Makefile
```

Reperer la ligne `.PHONY:` (premiere ligne) et la fin du fichier.

- [ ] **Step 6.2: Mettre a jour la ligne `.PHONY`**

Ajouter les nouvelles cibles :

```
.PHONY: dev dev-down dev-build dev-restart prod prod-down prod-build prod-logs prod-seed prod-db-reset test lint typecheck build logs upload deploy download-uploads download-db kamal-config kamal-setup kamal-deploy kamal-rollback kamal-logs kamal-migrate kamal-seed kamal-smoke kamal-console kamal-ps ops-sync
```

- [ ] **Step 6.3: Ajouter le bloc Kamal a la fin du Makefile**

```makefile

# ============================================================
#  Kamal (Phase 1 : deploiement local)
# ============================================================
kamal-config:
	@kamal config

kamal-setup:
	@kamal setup

kamal-deploy:
	@kamal deploy

kamal-rollback:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make kamal-rollback VERSION=<sha>"; exit 1; fi
	@kamal rollback $(VERSION)

kamal-logs:
	@kamal app logs --follow

kamal-migrate:
	@kamal app exec --reuse "yarn prisma db push"

kamal-seed:
	@kamal app exec --reuse "yarn prisma db seed"

kamal-smoke:
	@kamal app exec --reuse "make smoke-tests"

kamal-console:
	@kamal console

kamal-ps:
	@kamal server exec "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"

# ============================================================
#  Synchronisation scripts ops vers le serveur (Phase 1)
# ============================================================
ops-sync:
	@ssh root@173.212.217.54 "mkdir -p /root/badge-ops/scripts /root/badge-ops/ops /root/badge-ops/config /etc/badge"
	@rsync -avz --delete scripts/ root@173.212.217.54:/root/badge-ops/scripts/
	@rsync -avz --delete ops/ root@173.212.217.54:/root/badge-ops/ops/
	@rsync -avz ops/Makefile-ops root@173.212.217.54:/root/badge-ops/Makefile
	@rsync -avz config/deploy.yml root@173.212.217.54:/root/badge-ops/config/deploy.yml
	@ssh root@173.212.217.54 "chmod 700 /root/badge-ops && find /root/badge-ops/scripts -name '*.sh' -exec chmod 700 {} \;"
	@echo "ops-sync OK"
```

- [ ] **Step 6.4: Creer `ops/Makefile-ops`**

```bash
mkdir -p ops
```

Contenu de `ops/Makefile-ops` :

```makefile
# Makefile destine au workdir /root/badge-ops/ du serveur de prod.
# Synchronise par `make ops-sync` depuis le poste local (Phase 1)
# ou par un step CI post-deploy (Phase 2, cf annexe spec v3-02).
#
# Ce Makefile contient uniquement les cibles ops (backup, restore, minio-init,
# audit) -- aucune cible applicative (lint, test, db-push, etc.) ni cible
# kamal-* (qui se lancent depuis le poste de deploy, pas depuis le serveur).

.PHONY: backup-prod backup-prod-dry-run backup-list backup-list-local backup-list-remote restore-from-backup install-backup-deps install-backup-cron minio-init-prod audit-permissions

# Cf spec v3-01 pour le detail des scripts ci-dessous.
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

restore-from-backup:
	@bash scripts/restore-from-backup.sh

install-backup-deps:
	@bash scripts/install-backup-deps.sh

install-backup-cron:
	@install -m 0644 -o root -g root ops/cron/badge-backup /etc/cron.d/badge-backup
	@install -m 0644 -o root -g root ops/logrotate/badge-backup /etc/logrotate.d/badge-backup
	@echo "Cron et logrotate installes."

minio-init-prod:
	@USE_PROD_ENV=0 DOCKER=0 bash scripts/minio-init.sh

audit-permissions:
	@bash scripts/audit-permissions.sh
```

- [ ] **Step 6.5: Verifier que les nouvelles cibles ne cassent pas le Makefile**

```bash
make -n kamal-config 2>&1 | head -3
make -n ops-sync 2>&1 | head -3
```

Expected: les commandes prevues sont affichees sans erreur "No rule to make target".

- [ ] **Step 6.6: Commit**

```bash
git add Makefile ops/Makefile-ops
git commit -m "feat(v2): cibles Makefile Kamal + ops/Makefile-ops pour serveur"
```

---

## Task 7: Validation locale (kamal config + build image)

**Files:** aucun. Validation manuelle.

> Pre-requis : Task 1 effectuee (Kamal installe, docker login GHCR fait, SSH valide). Si pas encore, faire Task 1 maintenant.

- [ ] **Step 7.1: Creer `.kamal/secrets` reel (local, non versionne)**

```bash
cp .kamal/secrets.example .kamal/secrets
chmod 600 .kamal/secrets
```

Editer `.kamal/secrets` et remplir chaque valeur avec les vrais secrets de prod. Recuperer les valeurs depuis Bitwarden / 1Password si elles existent deja, sinon generer :

```bash
# Pour generer un secret random
openssl rand -base64 32

# Pour generer le hash bcrypt du Basic Auth phpmyadmin
htpasswd -nbB badge-ops 'MotDePasseAuChoix' | cut -d: -f2
```

> Attention : `S3_ACCESS_KEY` et `S3_SECRET_KEY` peuvent rester vides pour ce step (ils seront crees par `make minio-init-prod` apres le premier `kamal setup`). Mais Kamal exige que les variables soient au moins definies (meme vides) pour ne pas planter au parse de `deploy.yml`. Mettre `S3_ACCESS_KEY=tmp` et `S3_SECRET_KEY=tmp` provisoirement.

- [ ] **Step 7.2: Verifier que le fichier est bien ignored**

```bash
git status .kamal/secrets
```

Expected: aucune sortie (le fichier est ignore). Si Git le voit comme untracked : verifier `.gitignore` (cf Task 5).

- [ ] **Step 7.3: Lancer `kamal config`**

```bash
kamal config
```

Expected: affichage du config resolu (image, host, env vars avec les valeurs substituees, accessoires). Aucune erreur de syntaxe ou de variable manquante.

Si erreur "ENV variable X is not set" : la variable n'est pas dans `.kamal/secrets`. La rajouter.

- [ ] **Step 7.4: Build local de l'image (sans push)**

```bash
kamal build dev
```

Expected: build local reussit, image taggee `ghcr.io/tigamadou/badge:<sha>-<arch>` visible dans `docker images`.

> **Note** : `kamal build dev` build sans push, pratique pour iterer. `kamal build push` fait build + push (a utiliser pour le vrai deploy).

- [ ] **Step 7.5: Verifier la presence de la nouvelle image Docker**

```bash
docker images | grep ghcr.io/tigamadou/badge | head -3
```

Expected: au moins 1 ligne avec un tag SHA.

- [ ] **Step 7.6: Cleanup**

```bash
# Supprimer l'image de test pour ne pas accumuler
docker rmi $(docker images -q ghcr.io/tigamadou/badge | head -1) 2>/dev/null || true
```

- [ ] **Step 7.7: Pas de commit (validation pure)**

---

## Task 8: Patches aux scripts v3-01 (backup-prod.sh, restore-from-backup.sh, audit-permissions.sh)

**Files:**

- Modify: `scripts/backup-prod.sh` (cree par plan v3-01)
- Modify: `scripts/restore-from-backup.sh` (cree par plan v3-01)
- Modify: `scripts/audit-permissions.sh` (cree par plan v3-01)

> **Pre-requis** : les scripts de v3-01 doivent exister dans le repo. Si le plan v3-01 n'a pas encore ete execute, sauter Task 8 et appliquer ces patches dans le plan v3-01 directement.

- [ ] **Step 8.1: Verifier que les scripts v3-01 existent**

```bash
test -f scripts/backup-prod.sh && test -f scripts/restore-from-backup.sh && test -f scripts/audit-permissions.sh && echo OK || echo "Plan v3-01 non execute. Sauter Task 8 et noter dans le tracker."
```

Expected: `OK`. Si "Plan v3-01 non execute", marquer Task 8 comme `[-]` dans le tracker en notant "Patches integres au plan v3-01 directement".

- [ ] **Step 8.2: Patch `scripts/backup-prod.sh`**

Localiser le bloc mysqldump (cf plan v3-01 Task 8 Step 8.1) :

```bash
docker compose exec -T mysql \
    mysqldump --single-transaction ...
```

Le remplacer par :

```bash
docker exec -i badge-mysql \
    mysqldump --single-transaction ...
```

Localiser le bloc de capture config :

```bash
[ -f .env.production ] && cp .env.production "$STAGING_DIR/env.production"
[ -f Caddyfile ]        && cp Caddyfile        "$STAGING_DIR/Caddyfile"
```

Le remplacer par :

```bash
# .env.production n'existe plus sur le serveur (Kamal injecte les env).
# On capture la config Kamal de reference :
[ -f /root/badge-ops/config/deploy.yml ] && \
  cp /root/badge-ops/config/deploy.yml "$STAGING_DIR/deploy.yml"
# Pas de Caddyfile : kamal-proxy se configure via deploy.yml.
```

- [ ] **Step 8.3: Patch `scripts/restore-from-backup.sh`**

Localiser les blocs `docker compose exec -T mysql` :

```bash
docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"
```

Remplacer par :

```bash
docker exec -i badge-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"
```

Localiser :

```bash
gunzip -c staging/.../db.sql.gz \
  | docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge
```

Remplacer par :

```bash
gunzip -c staging/.../db.sql.gz \
  | docker exec -i badge-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge
```

- [ ] **Step 8.4: Patch `scripts/audit-permissions.sh`**

Localiser le tableau `EXPECTED` :

```bash
if [ -f /root/badge/.env.production ]; then
  check "/root/badge/.env.production" 600 root root
fi
```

Le remplacer par :

```bash
if [ -f /root/badge-ops/config/deploy.yml ]; then
  check "/root/badge-ops/config/deploy.yml" 644 root root
fi
```

Et adapter eventuellement les autres references `/root/badge/` -> `/root/badge-ops/` si presentes.

- [ ] **Step 8.5: Verifier que les scripts patches passent `bash -n`**

```bash
bash -n scripts/backup-prod.sh
bash -n scripts/restore-from-backup.sh
bash -n scripts/audit-permissions.sh
echo "Syntaxe OK"
```

Expected: `Syntaxe OK`.

- [ ] **Step 8.6: Commit**

```bash
git add scripts/backup-prod.sh scripts/restore-from-backup.sh scripts/audit-permissions.sh
git commit -m "fix(v3-01): adapter les scripts backup/restore/audit au pattern Kamal"
```

---

## Task 9: Amender v2-07 (bandeau SUPERSEDED sur plan + feature)

**Files:**

- Modify: `docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`
- Modify: `docs/v2/features/deploiement-initial.md`

> Le plan v2-07 est conserve pour tracabilite mais marque obsolete. Toutes ses tasks passent en `[-]` (abandoned avec raison) dans le tracker.

- [ ] **Step 9.1: Ajouter le bandeau en tete du plan v2-07**

Editer `docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`. Inserer en tete du fichier (avant `# Reset & deploiement initial -- Implementation Plan`) :

```markdown
> **STATUT : SUPERSEDED par la spec v3-02 (deploiement Kamal)**
> Date de remplacement : 2026-05-31
> Raison : passage du deploiement docker-compose a Kamal. La procedure cible vit desormais dans `docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md` et son plan associe `docs/v3/plans/2026-05-31-v3-02-deploiement-kamal.md`.
> Ce plan est conserve pour tracabilite (cf. regle de conservation des plans CLAUDE.md). Ne pas l'executer.

---

```

- [ ] **Step 9.2: Marquer toutes les tasks du tracker v2-07 en `[-]`**

Localiser le bloc `## Progression` du plan v2-07 et modifier chaque ligne `[ ]` en `[-]` avec date et note :

```
| 0 | [-] | 2026-05-31 | Superseded par v3-02 |
| 1 | [-] | 2026-05-31 | Superseded par v3-02 |
...
| 7 | [-] | 2026-05-31 | Superseded par v3-02 |
```

Mettre a jour la ligne "Derniere session" / "Prochaine etape" :

```
**Derniere session** : aucune execution.
**Prochaine etape** : aucune (plan superseded par v3-02).
```

- [ ] **Step 9.3: Ajouter le bandeau en tete de la feature v2-07**

Editer `docs/v2/features/deploiement-initial.md`. Inserer en tete (avant le titre principal) :

```markdown
> **STATUT : SUPERSEDED par la spec v3-02 (deploiement Kamal)**
> La procedure de deploiement v2 vit desormais dans `docs/v2/features/deploiement-kamal.md`.
> Ce fichier est conserve pour tracabilite. Les commandes decrites ci-dessous (docker-compose, Caddy, make prod-*) ne s'appliquent plus a la v2 deployee via Kamal.

---

```

- [ ] **Step 9.4: Commit**

```bash
git add docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md docs/v2/features/deploiement-initial.md
git commit -m "docs(v2): marquer v2-07 SUPERSEDED par v3-02 (Kamal)"
```

---

## Task 10: Creer `docs/v2/features/deploiement-kamal.md` (doc fonctionnelle)

**Files:**

- Create: `docs/v2/features/deploiement-kamal.md`

> Doc fonctionnelle equivalent v3-01 (`backups-hebdomadaires.md`). Decrit Kamal Phase 1 a un utilisateur qui veut juste savoir comment deployer.

- [ ] **Step 10.1: Creer le fichier**

Contenu de `docs/v2/features/deploiement-kamal.md` :

```markdown
# Deploiement Kamal -- v2

> Doc fonctionnelle de la fonctionnalite "deploiement Kamal" pour Badge v2.
> Spec design (le *pourquoi*) : [`docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md`](../specs/2026-05-31-v3-02-deploiement-kamal.md)
> Runbook bascule jour J : [`docs/v2/operations/kamal-day-one.md`](../operations/kamal-day-one.md)
> Runbook rollback : [`docs/v2/operations/kamal-rollback.md`](../operations/kamal-rollback.md)

## Description fonctionnelle

Le deploiement v2 utilise [Kamal](https://kamal-deploy.org/), un outil de deploiement Docker mono-serveur conçu pour le zero-downtime. Kamal orchestre : build de l'image Docker locale -> push vers GHCR -> pull cote serveur -> swap atomique via `kamal-proxy` (reverse proxy avec TLS Let's Encrypt automatique).

**Phase 1** (cette feature) : `kamal deploy` est lance depuis le poste du developpeur principal.
**Phase 2** (future) : bascule vers GitHub Actions une fois Phase 1 stabilisee.

## Architecture en production

| Conteneur | Role | Acces |
|---|---|---|
| `kamal-proxy` | Reverse proxy + TLS Let's Encrypt + swap zero-downtime | Ports 80, 443 publics |
| `badge-web-<sha>` | Application Next.js | Port 3000 interne (route par kamal-proxy sur badge.bj) |
| `badge-mysql` | Base de donnees | Port 3306 bind sur 127.0.0.1 (tunnel SSH pour outils desktop) |
| `badge-minio` | Stockage S3 (cf spec v3-01) | Port 9000 bind sur 127.0.0.1 (acces app via reseau Docker interne) |
| `badge-phpmyadmin` | Admin BDD | Route par kamal-proxy sur pma.badge.bj (Basic Auth) |

Aucun port autre que 80/443 n'est expose sur Internet.

## Cibles `Makefile` Phase 1

| Cible | Effet |
|---|---|
| `make kamal-config` | Valide la config Kamal (lecture seule) |
| `make kamal-setup` | Bootstrap initial (one-shot, premier deploiement) |
| `make kamal-deploy` | Deploiement zero-downtime (usage standard) |
| `make kamal-rollback VERSION=<sha>` | Rollback vers un SHA precedent |
| `make kamal-logs` | Logs app en direct |
| `make kamal-migrate` | `prisma db push` sur la prod |
| `make kamal-seed` | `prisma db seed` sur la prod |
| `make kamal-smoke` | Smoke tests sur la prod |
| `make kamal-console` | Bash interactif dans le conteneur app |
| `make kamal-ps` | `docker ps` sur le serveur |
| `make ops-sync` | Pousse `scripts/`, `ops/`, `Makefile-ops` vers `/root/badge-ops/` |

## Fichiers cles

- `config/deploy.yml` -- manifeste Kamal (versionne).
- `config/mysql/my.cnf` -- tuning MySQL.
- `.kamal/secrets.example` -- template documente.
- `.kamal/secrets` -- valeurs reelles (LOCAL, non versionne).
- `Dockerfile` -- avec `ARG APP_VERSION` + `HEALTHCHECK`.
- `src/app/api/health/route.ts` -- endpoint healthcheck.

## Variables d'environnement

Cf spec Section 3 pour la liste exhaustive des secrets. Resume :

- 1 secret pour le registry (`KAMAL_REGISTRY_PASSWORD` = PAT GitHub).
- 2 secrets BDD (`MYSQL_ROOT_PASSWORD`, `DATABASE_URL`).
- 2 secrets admin MinIO (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`).
- 2 secrets applicatifs MinIO (`S3_ACCESS_KEY`, `S3_SECRET_KEY`).
- 1 secret NextAuth (`NEXTAUTH_SECRET`).
- 6 secrets SMTP (`PLATFORM_SMTP_*`).
- 1 secret reCAPTCHA (`RECAPTCHA_SECRET_KEY`).
- 2 secrets seed initial (`SEED_SUPER_ADMIN_*`).
- 2 secrets Basic Auth phpmyadmin.

Tous referencer par nom dans `config/deploy.yml`, valeurs reelles dans `.kamal/secrets` local.

## Cycle de vie typique

**Deploiement standard** :

```bash
cd ~/Devs/projects/badge
git pull
make kamal-deploy
```

Duree : ~3-5 min. Zero-downtime garanti par le healthcheck `/api/health`.

**Verifier les logs apres deploy** :

```bash
make kamal-logs
```

**Rollback rapide** :

```bash
kamal app versions    # liste les SHA disponibles
make kamal-rollback VERSION=<sha-precedent>
```

Duree : ~30 s.

**Migration Prisma** :

```bash
make kamal-migrate
```

**Backup d'urgence post-deploy** (cf v3-01) :

```bash
ssh root@173.212.217.54 "cd /root/badge-ops && make backup-prod"
```

## Securite

- Secrets : jamais dans le repo, jamais sur le serveur en clair. `.kamal/secrets` local, conserve aussi en parallele dans Bitwarden / 1Password Free.
- IAM MinIO : cle applicative scopee sur le bucket, distincte du root.
- Console MinIO : non exposee Internet, tunnel SSH si besoin.
- phpMyAdmin : Basic Auth devant l'auth MySQL native.
- SSH serveur : cle personnelle du dev principal, pas de mot de passe.

## Bascule vers Phase 2 (CI/CD)

Quand activer : 2-3 deploys Phase 1 OK + besoin reel (equipe, audit, deploy sans humain). Cf annexe spec v3-02 pour la procedure complete.

## Voir aussi

- Spec design : [`docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md`](../specs/2026-05-31-v3-02-deploiement-kamal.md)
- Stockage S3 (MinIO accessory) : [`docs/v2/features/stockage-fichiers-s3.md`](stockage-fichiers-s3.md)
- Backups hebdomadaires : [`docs/v2/features/backups-hebdomadaires.md`](backups-hebdomadaires.md)
- Runbook bascule jour J : [`docs/v2/operations/kamal-day-one.md`](../operations/kamal-day-one.md)
- Runbook rollback : [`docs/v2/operations/kamal-rollback.md`](../operations/kamal-rollback.md)
```

- [ ] **Step 10.2: Commit**

```bash
git add docs/v2/features/deploiement-kamal.md
git commit -m "docs(v2): feature deploiement-kamal -- doc fonctionnelle Phase 1"
```

---

## Task 11: Creer `docs/v2/operations/kamal-day-one.md` (runbook bascule jour J)

**Files:**

- Create: `docs/v2/operations/kamal-day-one.md`

> Runbook operationnel pas-a-pas pour la bascule v1 (docker-compose + Caddy) -> v2 (Kamal). A executer le jour J en fenetre de maintenance.

- [ ] **Step 11.1: Verifier que `docs/v2/operations/` existe**

```bash
test -d docs/v2/operations && echo OK || mkdir -p docs/v2/operations && echo "Cree"
```

> Le dossier est cree par le plan v3-01 (Task 20). Si v3-01 pas encore execute, on le cree ici.

- [ ] **Step 11.2: Creer `docs/v2/operations/kamal-day-one.md`**

Contenu :

```markdown
# Runbook -- Bascule v1 (docker-compose) -> v2 (Kamal) -- Jour J

> Document operationnel. Procedure pas-a-pas pour basculer la production de docker-compose + Caddy vers Kamal en une fenetre de maintenance.

## Quand executer

Une seule fois, lors de la bascule v1 -> v2. Annoncer la maintenance au moins 24h a l'avance.

**Duree estimee** : 30-45 min.

## Pre-requis (J-1)

Checklist a executer LA VEILLE, hors fenetre de maintenance :

1. Verifier que la branche `main` (ou tag `v2.0.0`) contient :
   - `config/deploy.yml`, `config/mysql/my.cnf`
   - `.kamal/secrets.example`, `.gitignore` patche
   - `Dockerfile` avec `ARG APP_VERSION` + `HEALTHCHECK`
   - `src/app/api/health/route.ts`
   - Cibles Makefile `kamal-*` + `ops-sync`

2. Sur le poste du dev principal :
   - `gem install kamal -v "~> 2.5"` (cf Task 1 du plan v3-02).
   - PAT GitHub cree (scopes `write:packages` + `read:packages`).
   - `docker login ghcr.io -u tigamadou` OK.
   - `.kamal/secrets` rempli avec les vraies valeurs prod.
   - Sauvegarde `.kamal/secrets` dans Bitwarden Secure Note "badge-prod-kamal-secrets".
   - `ssh root@173.212.217.54 "echo ok"` retourne `ok` (cle perso autorisee).
   - `kamal config` passe sans erreur.

3. Verifier DNS : `dig +short badge.bj` et `dig +short pma.badge.bj` retournent `173.212.217.54`.

4. Verifier espace disque serveur : `ssh root@173.212.217.54 "df -h /"` >= 20 % libre.

5. Tester le build local : `kamal build dev` reussit.

## Jour J

### 1. Backup integral v1 (precaution)

```bash
ssh root@173.212.217.54
cd ~/badge
make backup-prod
ls -lh backups/
exit
```

Copier hors-serveur :

```bash
mkdir -p ~/badge-v1-backups-prebascule
scp root@173.212.217.54:~/badge/backups/badge-*.sql ~/badge-v1-backups-prebascule/
scp root@173.212.217.54:~/badge/backups/uploads-*.tar.gz ~/badge-v1-backups-prebascule/
```

### 2. Stop v1

```bash
ssh root@173.212.217.54 "cd ~/badge && docker compose down && docker ps"
```

`docker ps` doit etre vide. **NE PAS supprimer les volumes v1** (garder 7 jours pour rollback).

### 3. Preparer le workdir ops sur le serveur

```bash
ssh root@173.212.217.54 "mkdir -p /root/badge-ops/{scripts,ops,config} /etc/badge"
```

### 4. Deposer la config /etc/badge/

Sur le serveur, creer `/etc/badge/rclone.conf` et `/etc/badge/age-recipients.txt` selon les templates de la spec v3-01 (cf `docs/v2/operations/age-keys.md`).

### 5. Verifier qu'aucun process n'occupe les ports 80/443

```bash
ssh root@173.212.217.54 "lsof -i :80 -i :443 || echo 'OK ports libres'"
```

Expected: `OK ports libres`.

### 6. Lancer `kamal setup` depuis le poste local

```bash
cd ~/Devs/projects/badge
kamal setup
```

Duree : 10-20 min (premier pull + build).

### 7. Verifier que tous les services tournent

```bash
ssh root@173.212.217.54 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

Doivent etre `Up (healthy)` : `kamal-proxy`, `badge-web-<sha>`, `badge-mysql`, `badge-minio`, `badge-phpmyadmin`.

### 8. Synchroniser les scripts ops vers /root/badge-ops/

```bash
make ops-sync
```

### 9. Bootstrap MinIO

```bash
ssh root@173.212.217.54 "cd /root/badge-ops && make minio-init-prod"
```

Recuperer les valeurs `S3_ACCESS_KEY` et `S3_SECRET_KEY` affichees. Les remplir dans `.kamal/secrets` local. Puis :

```bash
kamal deploy
```

### 10. Migrations Prisma + seed

```bash
make kamal-migrate
make kamal-seed
```

### 11. Smoke tests

```bash
make kamal-smoke
```

Attendre 8/8 OK.

### 12. Verifier TLS depuis l'exterieur

```bash
curl -I https://badge.bj/login
curl -I https://pma.badge.bj
```

Expected: `HTTP/2 200` (ou 401 pour pma.badge.bj sans Basic Auth), certificat valide Let's Encrypt.

### 13. Premiere connexion SUPER_ADMIN

- URL : `https://badge.bj/login`
- Credentials : valeurs de `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`.
- **CHANGER IMMEDIATEMENT** le mot de passe via `/profile`.

### 14. Activer le cron de backup

```bash
ssh root@173.212.217.54 "cd /root/badge-ops && make install-backup-cron"
```

### 15. Backup de validation

```bash
ssh root@173.212.217.54 "cd /root/badge-ops && make backup-prod"
```

Verifier qu'un snapshot chiffre est produit et pousse vers Hetzner.

### 16. Annoncer la fin de maintenance

Notification utilisateurs.

## Post-deploiement (J+1 a J+7)

| Echeance | Action |
|---|---|
| H+1 | `make kamal-logs` 15 min |
| H+24 | Verifier `kamal app logs --since 24h \| grep -iE "error\|fatal"` |
| J+1 | Verifier que le cron backup s'est execute (premier dimanche apres bascule) |
| J+3 | Desactiver le cron de backup v1 s'il etait actif |
| J+7 | Supprimer les volumes Docker v1 : `docker volume rm badge_mysql_data badge_uploads_data badge_caddy_data badge_caddy_config`. Supprimer `~/badge` si plus utilise. |

## Voir aussi

- Spec v3-02 : `docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md` (Section 6 pour le detail des risques)
- Runbook rollback : `kamal-rollback.md`
- Feature backups : `docs/v2/features/backups-hebdomadaires.md`
```

- [ ] **Step 11.3: Commit**

```bash
git add docs/v2/operations/kamal-day-one.md
git commit -m "docs(v2): runbook kamal-day-one (bascule v1 -> v2 jour J)"
```

---

## Task 12: Creer `docs/v2/operations/kamal-rollback.md` (runbook rollback)

**Files:**

- Create: `docs/v2/operations/kamal-rollback.md`

- [ ] **Step 12.1: Creer le fichier**

Contenu :

```markdown
# Runbook -- Rollback Kamal

> Document operationnel. Procedures de rollback selon le contexte d'echec.

## Quand utiliser

| Situation | Procedure |
|---|---|
| Echec d'un deploy Kamal recent (mauvaise version applicative) | Niveau 1 : `kamal rollback` |
| Code OK mais BDD corrompue / migration ratee | Niveau 2 : `make restore-from-backup` (v3-01) + eventuellement `kamal rollback` |
| Bascule v1 -> v2 catastrophique (jour J) | Niveau 3 : retour a v1 docker-compose |
| Perte complete du serveur | Cf `docs/v2/operations/restore.md` (v3-01, procedure d'urgence) |

## Niveau 1 : rollback applicatif Kamal

Cas nominal : `kamal-proxy` a refuse de basculer le trafic car le nouveau conteneur n'a pas passe son healthcheck. L'ancienne version continue de tourner. **Aucune action requise**, le service n'a pas ete impacte.

Cas explicite : tu veux revenir a un SHA precis (ex: deploy reussi mais bug fonctionnel decouvert apres) :

```bash
# Depuis le poste local
kamal app versions
```

Liste les SHA disponibles sur GHCR (les N derniers builds, configurable via `keep_releases` dans deploy.yml).

```bash
make kamal-rollback VERSION=<sha-precedent>
# ou directement
kamal rollback <sha-precedent>
```

Duree : ~30 s. Verifier :

```bash
curl -I https://badge.bj/login
curl -s https://badge.bj/api/health | jq .version
```

La version retournee doit etre le SHA cible.

## Niveau 2 : restore BDD (snapshot v3-01)

Si la BDD est corrompue (suppression accidentelle massive, migration ratee qui a casse les contraintes) :

```bash
ssh root@173.212.217.54
cd /root/badge-ops
make restore-from-backup
```

Procedure interactive (cf `docs/v2/operations/restore.md` du plan v3-01). Selectionner le snapshot d'avant la corruption.

Si le code applicatif a aussi besoin de revenir en arriere (parce que le schema cible un code different), enchainer avec un `kamal rollback` Niveau 1.

## Niveau 3 : retour a v1 docker-compose (bascule jour J catastrophique)

Scenario : la bascule v1 -> v2 echoue de facon irremediable dans la fenetre de maintenance. Retour a v1 plutot que prolonger l'indisponibilite.

```bash
ssh root@173.212.217.54

# Stop toute la stack Kamal
for c in $(docker ps -a --filter "name=badge-" --format "{{.Names}}") kamal-proxy; do
  docker stop "$c" 2>/dev/null
  docker rm "$c" 2>/dev/null
done
docker ps    # doit etre vide

# Restaurer v1
cd ~/badge
git checkout <tag-v1-derniere-stable>    # ex: v1.4.2
docker compose up -d
docker compose ps    # tous les services v1 doivent etre Up

# Verifier
curl -I https://badge.bj/login    # doit retourner 200
```

Si les volumes v1 ont ete touches, restaurer depuis le backup pre-bascule :

```bash
cd ~/badge
make rollback-prod SQL=backups/badge-<TS>.sql UPLOADS=backups/uploads-<TS>.tar.gz
```

Annoncer le report de migration, faire un post-mortem avant de retenter.

## Voir aussi

- Runbook bascule jour J : `kamal-day-one.md`
- Restore BDD (v3-01) : `restore.md`
- Spec v3-02 : `docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md` (Section 6.D)
```

- [ ] **Step 12.2: Commit**

```bash
git add docs/v2/operations/kamal-rollback.md
git commit -m "docs(v2): runbook kamal-rollback (3 niveaux)"
```

---

## Task 13: Mise a jour `docs/v2/README.md`

**Files:**

- Modify: `docs/v2/README.md`

> Marquer v2-07 "Superseded", ajouter v3-02 dans les tableaux sous-specs et plans.

- [ ] **Step 13.1: Modifier le tableau "Sous-specifications fonctionnelles"**

Localiser la ligne 7 (`| 7 | [Reset & deploiement initial]... | Reset prod, seed staff, smoke tests, rollback |`).

La remplacer par :

```
| 7 | [Reset & deploiement initial](features/deploiement-initial.md) | **SUPERSEDED par v3-02** -- historique uniquement |
```

Ajouter, juste apres la ligne 8 (stockage S3 + backups, si elle existe), la ligne 9 :

```
| 9 | [Deploiement Kamal](features/deploiement-kamal.md) | Kamal 2.x, kamal-proxy zero-downtime, accessoires mysql/minio/phpmyadmin, deploy depuis poste local (Phase 1) |
```

- [ ] **Step 13.2: Modifier le tableau "Plans d'implementation"**

Localiser la ligne `| 7 | [Reset & deploiement initial](plans/2026-05-28-v2-07-deploiement-initial.md) | 1 194 | 7 |`.

La remplacer par :

```
| 7 | [Reset & deploiement initial](plans/2026-05-28-v2-07-deploiement-initial.md) | -- | -- (Superseded) |
```

Ajouter, apres la ligne 8 (si elle existe) :

```
| 9 | [Deploiement Kamal Phase 1](plans/2026-05-31-v3-02-deploiement-kamal.md) | -- | 18 |
```

- [ ] **Step 13.3: Mettre a jour la section "Etat d'avancement"**

Si la section liste "Plans d'implementation (N/M rediges)", incrementer pour refleter le plan v3-02.

- [ ] **Step 13.4: Commit**

```bash
git add docs/v2/README.md
git commit -m "docs(v2): README index -- v2-07 superseded, v3-02 ajoute"
```

---

## Task 14: Mise a jour `docs/v2/architecture.md`

**Files:**

- Modify: `docs/v2/architecture.md`

> Mentionner Kamal, kamal-proxy, et lister les conteneurs prod cibles.

- [ ] **Step 14.1: Lire le fichier**

```bash
cat docs/v2/architecture.md
```

- [ ] **Step 14.2: Ajouter ou modifier la section "Deploiement"**

Si la section existe deja avec une mention Caddy, la remplacer. Sinon, l'ajouter (apres la section "Stockage" et avant "Sauvegardes" si v3-01 l'a deja ajoutee).

Contenu :

```markdown
## Deploiement

La v2 est deployee via [Kamal 2.x](https://kamal-deploy.org/), outil Docker
mono-serveur conçu pour le zero-downtime. Kamal remplace l'ancien
`docker-compose` + Caddy.

Cote serveur : 5 conteneurs orchestres par Kamal :

| Conteneur | Role |
|---|---|
| `kamal-proxy` | Reverse proxy + TLS Let's Encrypt automatique + swap zero-downtime |
| `badge-web` | Application Next.js (image `ghcr.io/tigamadou/badge:<sha>`) |
| `badge-mysql` | Base de donnees MySQL 8 (accessory Kamal, volume `badge_mysql_data`) |
| `badge-minio` | Stockage S3-compatible (accessory Kamal, volume `badge_minio_data`) |
| `badge-phpmyadmin` | Admin BDD (accessory Kamal, expose via kamal-proxy sur `pma.badge.bj` + Basic Auth) |

Cote dev : le developpeur principal lance `kamal deploy` depuis son poste local
(Phase 1). Une bascule vers GitHub Actions (Phase 2) est prevue en annexe de la
spec v3-02 quand l'equipe ou les besoins d'audit le justifient.

Le healthcheck `/api/health` (route Next basique) est interroge par kamal-proxy
pour decider du swap atomique. Aucun deploiement ne coupe le service : si le
nouveau conteneur ne passe pas le healthcheck, l'ancien continue de servir.

Cf [`docs/v2/features/deploiement-kamal.md`](features/deploiement-kamal.md).
```

- [ ] **Step 14.3: Commit**

```bash
git add docs/v2/architecture.md
git commit -m "docs(v2): architecture mentionne Kamal et les 5 conteneurs prod"
```

---

## Task 15: Mise a jour `CLAUDE.md` racine

**Files:**

- Modify: `CLAUDE.md`

> Section "Stack technique" : remplacer Caddy par kamal-proxy. Section "Actions a risque" : ajouter les commandes Kamal destructives.

- [ ] **Step 15.1: Lire le CLAUDE.md actuel**

```bash
cat CLAUDE.md
```

- [ ] **Step 15.2: Modifier la section "Stack technique"**

Localiser la ligne :

```
| Conteneurs | Docker (dev + prod), reverse proxy Caddy |
```

La remplacer par :

```
| Conteneurs | Docker (dev + prod), reverse proxy `kamal-proxy` en prod (cf v3-02), `docker-compose` en dev uniquement |
| Deploiement prod | Kamal 2.x (cf `docs/v2/features/deploiement-kamal.md`) |
```

- [ ] **Step 15.3: Modifier la section "Actions a risque"**

Localiser la section. Ajouter les lignes suivantes a la liste :

```markdown
- `kamal app remove`, `kamal accessory remove` (destruction complete d'un service/accessory)
- `kamal rollback` sur prod (changement de version en quelques secondes, impact immediat)
- `kamal setup` sur un serveur existant (idempotent mais peut perturber)
- `make ops-sync` (ecrase `/root/badge-ops/` sur le serveur de prod)
```

- [ ] **Step 15.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md mentionne Kamal (stack + actions a risque)"
```

---

## Task 16: Runbook bascule jour J (validation humaine, pas de code)

**Files:** aucun (la procedure est documentee dans `docs/v2/operations/kamal-day-one.md` cree en Task 11).

> Cette task n'est pas executable par un agent IA : c'est une checklist humaine pour le jour de la bascule prod. L'inclure ici garantit qu'elle figure dans le plan, et que son "execution" finale (qui est manuelle) est tracee dans le tracker.

### Pre-deploiement (J-1)

- [ ] **Step 16.1: Verifier que toutes les Tasks 2-15 sont validees**

Tracker en tete du plan : Tasks 2 a 15 toutes `[x]`. Sinon, ne pas bascule.

- [ ] **Step 16.2: Suivre la checklist J-1 du runbook**

Reference : `docs/v2/operations/kamal-day-one.md` section "Pre-requis (J-1)".

### Jour J

- [ ] **Step 16.3: Annoncer la maintenance aux utilisateurs**

- [ ] **Step 16.4: Suivre la procedure jour J du runbook**

Reference : `docs/v2/operations/kamal-day-one.md` sections 1 a 16.

- [ ] **Step 16.5: Annoter la procedure reelle**

Apres execution, mettre a jour `docs/v2/operations/kamal-day-one.md` avec :

- Duree reelle de chaque etape.
- Imprevus rencontres et leur resolution.
- Date de bascule (cree section "Historique des bascules").

### Post-deploiement

- [ ] **Step 16.6: Suivre la checklist post-deploiement (H+1, H+24, J+1, J+3, J+7)**

Reference : `docs/v2/operations/kamal-day-one.md` section "Post-deploiement".

- [ ] **Step 16.7: Commit des annotations**

```bash
git add docs/v2/operations/kamal-day-one.md
git commit -m "docs(v2): kamal-day-one annote apres bascule reelle YYYY-MM-DD"
```

---

## Task 17: Verification finale (tests + lint + typecheck + etat git)

**Files:** aucun. Validation globale.

- [ ] **Step 17.1: Lint complet**

```bash
make lint
```

Expected: 0 erreur.

- [ ] **Step 17.2: Typecheck complet**

```bash
make typecheck
```

Expected: 0 erreur.

- [ ] **Step 17.3: Tests Vitest (inclut le nouveau test /api/health)**

```bash
make test
```

Expected: tous les tests passent (incluant `src/app/api/health/__tests__/route.test.ts` 4 tests).

- [ ] **Step 17.4: Verifier que tous les fichiers livrables existent**

```bash
ls -1 \
  docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md \
  docs/v3/plans/2026-05-31-v3-02-deploiement-kamal.md \
  docs/v2/features/deploiement-kamal.md \
  docs/v2/operations/kamal-day-one.md \
  docs/v2/operations/kamal-rollback.md \
  config/deploy.yml \
  config/mysql/my.cnf \
  .kamal/secrets.example \
  ops/Makefile-ops \
  src/app/api/health/route.ts \
  src/app/api/health/__tests__/route.test.ts
```

Expected: tous les chemins existent (commande sortie code 0).

- [ ] **Step 17.5: Verifier les cibles Makefile Kamal**

```bash
for tgt in kamal-config kamal-setup kamal-deploy kamal-rollback kamal-logs kamal-migrate kamal-seed kamal-smoke kamal-console kamal-ps ops-sync; do
  grep -qE "^${tgt}:" Makefile && echo "[ok] $tgt" || echo "[MISSING] $tgt"
done
```

Expected: 11 cibles `[ok]`.

- [ ] **Step 17.6: Verifier le Dockerfile**

```bash
grep -q "ARG APP_VERSION" Dockerfile && grep -q "HEALTHCHECK" Dockerfile && echo "Dockerfile OK"
```

Expected: `Dockerfile OK`.

- [ ] **Step 17.7: Verifier .gitignore**

```bash
grep -qE '^\.kamal/secrets$' .gitignore && git check-ignore .kamal/secrets >/dev/null && echo "gitignore OK"
```

Expected: `gitignore OK`.

- [ ] **Step 17.8: Verifier qu'aucun secret n'est traque**

```bash
git ls-files | grep -E '\.kamal/secrets$' | grep -v '\.example$' || echo "Aucun secret traque -- OK"
```

Expected: `Aucun secret traque -- OK`.

- [ ] **Step 17.9: Valider la config Kamal (si `.kamal/secrets` rempli localement)**

```bash
kamal config 2>&1 | head -20
```

Expected: affichage du config resolu sans erreur. Si "ENV variable X is not set" : `.kamal/secrets` incomplet, completer.

> Si Kamal n'est pas installe sur la machine d'execution du plan (ex: subagent ephemeree sans Ruby), skip ce step et noter dans le tracker.

- [ ] **Step 17.10: Verifier le statut des plans v2-07 et v3-01**

```bash
grep -q "SUPERSEDED" docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md && echo "v2-07 OK (superseded)"
grep -q "SUPERSEDED" docs/v2/features/deploiement-initial.md && echo "feature v2-07 OK (superseded)"
```

Expected: 2 lignes "OK (superseded)".

- [ ] **Step 17.11: Etat git propre**

```bash
git status
git log --oneline -15
```

Expected: working tree clean, ~12 commits ajoutes par ce plan (un par task non-validation).

- [ ] **Step 17.12: Mise a jour finale du tracker `## Progression`**

Editer ce fichier (le plan lui-meme) pour passer toutes les lignes `[ ]` -> `[x]` avec la date d'execution. Renseigner "Derniere session" et "Prochaine etape : Phase 2 (CI/CD) optionnelle, cf annexe spec v3-02".

- [ ] **Step 17.13: Commit final du tracker**

```bash
git add docs/v3/plans/2026-05-31-v3-02-deploiement-kamal.md
git commit -m "docs(v2): plan v3-02 complete -- tracker mis a jour"
```

- [ ] **Step 17.14: Note finale**

A ce stade :

- Le code applicatif a une route `/api/health` testee.
- Le `Dockerfile` est pret pour Kamal (ARG APP_VERSION + HEALTHCHECK).
- `config/deploy.yml`, `config/mysql/my.cnf`, `.kamal/secrets.example`, `ops/Makefile-ops` sont en place.
- Le `Makefile` expose 11 cibles `kamal-*` + `ops-sync`.
- Les scripts v3-01 sont patches pour `docker exec badge-*`.
- v2-07 est marque SUPERSEDED.
- La doc (feature, runbooks day-one + rollback, README, architecture, CLAUDE.md) est complete.

**La bascule effective en prod** (Task 16) reste une activite humaine, a planifier en fenetre de maintenance. Le runbook `docs/v2/operations/kamal-day-one.md` la guide pas-a-pas.

---

## Notes finales

- **TDD strict** sur `/api/health` (Task 2). Les autres tasks sont essentiellement de la configuration et de la documentation, validees par `bash -n`, `make lint`, `make typecheck`, `make test` et `kamal config`.
- **Frequence des commits** : un commit par task technique (~12 commits au total + commits annotations Task 16). Aucune task de validation ne commit.
- **Dependances entre tasks** :
  - Task 1 est un pre-requis runbook (poste local). Bloquante pour Task 7 et Task 16.
  - Tasks 2, 3 (code) sont independantes.
  - Tasks 4, 5, 6 (config + Makefile) sont independantes mais dependent en pratique de Task 2-3 pour que `kamal config` puisse valider une stack coherente.
  - Task 7 (validation locale) depend de Tasks 1-6.
  - Task 8 (patches v3-01) depend de l'existence des scripts v3-01. Si v3-01 pas execute, integrer ces patches dans le plan v3-01.
  - Tasks 9-15 (docs) peuvent etre faites en parallele.
  - Task 16 (bascule jour J) depend de TOUTES les autres + validation humaine.
- **Hors-scope (Phase 2 differee)** :
  - Workflows `.github/workflows/{deploy,rollback,setup}.yml` -- cf annexe spec v3-02 pour le contenu.
  - Sync ops scripts via CI -- en Phase 1 c'est `make ops-sync` manuel.
  - 22 GitHub Secrets a provisionner -- cf annexe spec v3-02 pour la liste.
- **Choix simples documentes** :
  - Pas d'environnement de staging (le rate-limit Let's Encrypt n'est pas un risque tant qu'on ne fait pas de boucle de `kamal setup`).
  - Pas de retrait de phpMyAdmin (decision conservatrice ; option alternative documentee dans la spec si on change d'avis).
  - Pas de configuration `keep_releases` explicite dans `deploy.yml` (Kamal utilise sa valeur par defaut, suffisant pour Phase 1).
- **Risques residuels** : cf spec v3-02 Section 6.F.

