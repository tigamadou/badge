# Spec v3-02 — Déploiement Kamal (zero-downtime)

> **Statut** : conception validée — 2026-05-31
> **Type** : refonte structurelle du déploiement (remplace docker-compose + Caddy par Kamal + kamal-proxy)
> **Périmètre** : v3 uniquement (extension v2)
> **Spec maîtresse** : [`docs/v2/specs/2026-05-28-v2-master-design.md`](../../v2/specs/2026-05-28-v2-master-design.md)
> **Specs liées** :
> - [v2-07 (déploiement initial)](../../v2/plans/2026-05-28-v2-07-deploiement-initial.md) — **superseded** par la présente spec
> - [v3-01 (stockage S3 + backups)](2026-05-31-v3-01-stockage-s3-et-backups.md) — patches d'intégration décrits ici
> **Phases** :
> - **Phase 1** (cette spec) : déploiement déclenché depuis le poste du développeur principal. Plus simple, plus rapide à itérer, idéal pour valider Kamal en conditions réelles.
> - **Phase 2** (annexe) : bascule vers GitHub Actions une fois Phase 1 stabilisée. Documentée en annexe pour le jour où l'audit centralisé / multi-deployers devient nécessaire.

## Contexte et objectifs

Le déploiement v1 actuel (`make prod-build && make prod`) provoque un downtime de 30-60s sur chaque release : `docker compose down && up --build` arrête le conteneur app avant de relancer le nouveau. Pour un SaaS multi-tenant qui démarre, ce trou de service est gênant mais pas critique — sauf que chaque déploiement devient un événement à risque qui décourage les itérations fréquentes.

[Kamal](https://kamal-deploy.org/) (Basecamp, ex-MRSK) résout exactement ce problème. Il est conçu pour le pattern "Docker mono-serveur" : pas d'orchestrateur k8s, pas de cluster, juste une commande qui orchestre build → push registry → pull serveur → swap atomique via reverse proxy intégré. Le swap atomique repose sur un healthcheck : tant que la nouvelle image ne répond pas `200 OK` sur `/api/health`, le trafic continue d'être servi par l'ancien conteneur. Aucun 502.

Cette spec définit :

1. La migration de la stack actuelle (docker-compose + Caddy + 5 services) vers Kamal en gardant le même serveur.
2. Le passage de `make deploy` (rsync + downtime) vers `kamal deploy` (zero-downtime).
3. La cohabitation avec MinIO (accessoire Kamal aligné sur la spec v3-01) et avec le pipeline backup hôte v3-01.
4. Une procédure de déploiement réalisable depuis le poste du dev principal **dès le jour 1**, puis une voie d'évolution vers CI/CD GitHub Actions en Phase 2.

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Mode déploiement Phase 1 | Depuis le poste du développeur principal | Simplicité : `gem install kamal` + clé SSH existante + fichier `.kamal/secrets` local. Itération rapide pour valider Kamal en conditions réelles avant d'ajouter la couche CI. |
| Proxy | `kamal-proxy` seul (TLS Let's Encrypt auto) | Remplace Caddy. Une seule pièce mobile, swap atomique zero-downtime natif, TLS automatique. |
| Accessoires | mysql, minio, phpmyadmin tous en accessoires Kamal | Cohérent : un seul outil pour toute la stack prod. Volumes Docker nommés persistants. |
| Registry image | GHCR (`ghcr.io/tigamadou/badge`) | Gratuit pour repos privés, lié au repo GitHub, idéal pour la future migration CI. |
| Secrets Phase 1 | Fichier `.kamal/secrets` local non-versionné | Le plus simple en solo. `.kamal/secrets.example` versionné pour la doc. À sync à la main entre admins (si besoin) — pas un sujet en solo dev. |
| Trigger Phase 1 | `kamal deploy` lancé manuellement depuis le terminal | Pas de workflow CI à débugger. Un seul humain dans la boucle. |
| Healthcheck | route Next `/api/health` basique (200 + JSON), pas de check DB/MinIO | Simple, fiable, suffisant pour le swap atomique. Évolution future possible (`/api/health/deep` pour monitoring externe). |
| Workdir ops sur serveur | `/root/badge-ops/` (séparé du code applicatif qui vit dans l'image) | Le serveur n'a plus de repo cloné. Les scripts backup v3-01 vivent dans un workdir minimal sync'é à la main (Phase 1) ou par CI (Phase 2). |
| v2-07 (déploiement initial v1) | Marqué **superseded** par v3-02 | Procédure réécrite ici. Plan v2-07 conservé pour traçabilité. |
| v3-01 (backups) | Patches mineurs aux scripts (`docker compose exec` → `docker exec`) | Documentés ici. Pas de réécriture de la spec. |
| Phase 2 (CI/CD) | Annexe documentée, à activer plus tard | Quand : 2-3 deploys Phase 1 OK + besoin réel (équipe, audit, deploy sans humain). |

---

## Section 1 — Architecture cible

### Schéma fonctionnel

```
[Internet]
    │ 80, 443
    ▼
[ Serveur prod root@173.212.217.54 ]
    │
    ├─ kamal-proxy (Go binary, container)
    │     · TLS Let's Encrypt auto pour badge.bj, pma.badge.bj
    │     · Swap atomique zero-downtime entre versions de `app`
    │     · Health check sur /api/health avant bascule
    │
    ├─ badge-web (Next.js, container)   ← image ghcr.io/tigamadou/badge:<sha>
    │     · Standalone build
    │     · Lit env via Kamal (env.clear publiques + env.secret depuis .kamal/secrets)
    │     · Healthcheck /api/health (Docker + Kamal Proxy)
    │
    ├─ badge-mysql (accessory Kamal)    ← image mysql:8
    │     · Volume nommé `badge_mysql_data`
    │     · Reachable depuis app via `badge-mysql:3306`
    │
    ├─ badge-minio (accessory Kamal)    ← image minio/minio:RELEASE.xxx
    │     · Volume nommé `badge_minio_data`
    │     · Reachable depuis app via `badge-minio:9000`
    │
    ├─ badge-phpmyadmin (accessory)     ← image phpmyadmin:5
    │     · Routé par kamal-proxy sur pma.badge.bj (Basic Auth)
    │
    └─ /root/badge-ops/                 ← workdir minimal pour cron backup v3-01
          ├─ Makefile (cibles backup-*, restore-*)
          ├─ scripts/
          ├─ ops/
          └─ docker-compose.yml supprimé (Kamal le remplace)

[Poste développeur principal]
    │
    ├─ ~/Devs/projects/badge (clone du repo)
    │   ├─ config/deploy.yml (versionné)
    │   ├─ .kamal/secrets (non versionné, gitignored)
    │   └─ Dockerfile (avec HEALTHCHECK)
    │
    └─ Commandes : kamal setup, kamal deploy, kamal rollback, kamal app logs
        Auth GHCR : docker login ghcr.io (PAT GitHub)
        SSH       : ~/.ssh/id_* (clé personnelle, déjà autorisée sur le serveur)
```

### Pièces clés

| Composant | Rôle | Origine |
|---|---|---|
| `config/deploy.yml` | Source de vérité Kamal : image, accessoires, proxy, secrets attendus, hosts | Nouveau |
| `.kamal/secrets` | Fichier shell sourcé par Kamal, contient les valeurs secrètes | Nouveau (gitignored) |
| `kamal-proxy` | Reverse proxy + TLS + zero-downtime | Géré par Kamal, lancé via `kamal setup` |
| `badge-web` container | Next.js prod | Image build par `kamal build`, push GHCR, pull serveur |
| `badge-mysql` accessory | Base de données | Déclarée dans deploy.yml, volume Docker nommé |
| `badge-minio` accessory | Stockage S3 (spec v3-01) | Déclarée dans deploy.yml |
| `badge-phpmyadmin` accessory | Admin BDD | Déclarée dans deploy.yml, exposée via kamal-proxy avec Basic Auth |
| `/root/badge-ops/` | Workdir minimal pour les scripts backup v3-01 | Sync'é à la main en Phase 1 (rsync), automatisé en Phase 2 |

### Conséquences sur l'existant

| Fichier | Statut après cette spec |
|---|---|
| `docker-compose.yml` (prod) | **Supprimé** du serveur. Conservé dans le repo pour le dev local référence. |
| `docker-compose.dev.yml` | **Inchangé** (dev local continue avec compose, Kamal seulement en prod). |
| `Caddyfile` | **Supprimé**. Fonction reprise par `kamal-proxy` configuré dans `deploy.yml`. |
| `Makefile` cibles `prod`, `prod-build`, `prod-down`, `prod-logs`, `upload`, `deploy`, `rollback-prod` | **Remplacées** par des wrappers `kamal-*`. |
| `Makefile` cibles `dev*`, `test`, `lint`, `typecheck`, `db-*` | **Inchangées**. |
| `Dockerfile` | **Patché** : ajout `ARG APP_VERSION` + `HEALTHCHECK` (cf Section 4). |
| `docker-entrypoint.sh` | **Inchangé** (mêmes commandes au boot). |
| `.env.production` | **Disparaît du serveur**. Variables injectées par Kamal depuis `.kamal/secrets` local + `env.clear` de `deploy.yml`. |
| `Plan v2-07` | **Superseded** : bandeau en tête, tasks marquées `[-]`. Conservé pour traçabilité. |
| `Plan v3-01` | **Amendé** : adaptation des scripts pour `docker exec badge-*` (cf Section 5). |

---

## Section 2 — Configuration Kamal (`config/deploy.yml`)

### Vue d'ensemble

Le fichier `config/deploy.yml` est le manifeste unique qui décrit à Kamal tout ce qui tourne en production : l'app Next.js, son proxy TLS, son registry, ses variables d'environnement, et ses accessoires (MySQL, MinIO, phpMyAdmin). Il vit à la racine du repo, est commité, et constitue la source de vérité du déploiement. Tous les secrets sont référencés par nom et résolus à l'exécution depuis `.kamal/secrets` (jamais commité).

### Fichier `config/deploy.yml` complet

```yaml
# Manifeste de deploiement Kamal pour Badge v2.
# Source de verite : ce fichier + .kamal/secrets (jamais commit).
# Deploiement : `kamal deploy` depuis le poste du dev (Phase 1) ou via GitHub Actions (Phase 2, cf annexe).

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
    max_request_body: 10485760    # 10 Mo (au-dessus des 5 Mo applicatif)
    max_response_body: 0          # pas de cap (rendu PDF)
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

### Fichier auxiliaire `config/mysql/my.cnf`

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

### Notes / choix techniques

- **`builder.arch: amd64`** : le serveur Contabo est x86_64. Pas de multi-arch (gain nul, coût doublé en temps de build).
- **`builder.args.APP_VERSION`** : ERB Ruby qui injecte le SHA git court au build. Lu par `/api/health` pour exposer la version applicative actuelle.
- **Healthcheck `interval: 2s` / `max_attempts: 30`** : fenêtre de 60s pour absorber le boot Next standalone + `prisma db push` du `docker-entrypoint.sh`. Conservateur ; à réduire après quelques deploys mesurés.
- **Port MySQL bindé sur `127.0.0.1:3306`** : la prod actuelle expose 3306 sur `0.0.0.0`, on resserre. Tunnel SSH possible pour les outils desktop.
- **Port MinIO bindé sur `127.0.0.1:9000`** : l'app y accède via le réseau Docker interne (`badge-minio:9000`). Pas d'exposition publique. Console (9001) non publiée.
- **Nom interne `badge-mysql`, `badge-minio`** : Kamal préfixe les accessoires par `<service>-`. `DATABASE_URL` doit donc être `mysql://root:<pwd>@badge-mysql:3306/badge`.
- **MinIO pin `RELEASE.2025-04-08T15-41-24Z`** : reproductibilité, on évite `latest`. À bumper manuellement dans une PR dédiée.
- **`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en `env.clear`** : techniquement publique (inlinée dans le bundle client). La valeur réelle doit être renseignée avant le premier déploiement.
- **`phpmyadmin.proxy.basic_auth`** : couche supplémentaire devant l'auth MySQL native. Hash bcrypt généré par `htpasswd -nbB user 'pwd' | cut -d: -f2`.
- **`logging` plafonné à 50 Mo × 5 fichiers** : évite le remplissage disque silencieux.

---

## Section 3 — Secrets et déploiement depuis le poste local (Phase 1)

### Vue d'ensemble Phase 1

Le déploiement Phase 1 se fait **depuis le poste du développeur principal** (typiquement le Mac de dev). Le développeur a :

- Le repo cloné en local.
- Sa clé SSH déjà autorisée sur le serveur de prod (existante pour le `make deploy` actuel).
- `docker login ghcr.io` configuré avec un PAT GitHub personnel.
- Un fichier `.kamal/secrets` local, non versionné, contenant les valeurs en clair.

Aucune infrastructure additionnelle nécessaire. Pas de runner, pas de workflow, pas de SSH key dédiée. C'est le mode "minimum viable" pour valider Kamal en conditions réelles avant d'ajouter la complexité CI/CD (cf annexe Phase 2).

### Pré-requis poste local

```bash
# Ruby (Kamal est une gem). Sur macOS via homebrew :
brew install ruby
# Ou via rbenv/asdf si tu en utilises un.

# Kamal lui-même
gem install kamal -v "~> 2.5"

# Vérifier l'installation
kamal version    # → 2.5.x

# Docker (déjà présent si tu utilises docker-compose dev)
docker --version

# Authentification GHCR (PAT GitHub avec scopes write:packages + read:packages)
# Créer le PAT sur https://github.com/settings/tokens (classic)
echo "<PAT>" | docker login ghcr.io -u tigamadou --password-stdin
```

### Liste exhaustive des secrets

| Secret | Description | Source | Vers `.kamal/secrets` | Vers l'app (`env.secret`) |
|---|---|---|---|---|
| `KAMAL_REGISTRY_PASSWORD` | PAT GitHub (scopes `write:packages` + `read:packages`) pour push/pull GHCR | github.com/settings/tokens | Oui | Non |
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL | `openssl rand -base64 32 \| tr -d '=+/' \| head -c 40` | Oui | Oui |
| `DATABASE_URL` | URL Prisma : `mysql://root:<MYSQL_ROOT_PASSWORD>@badge-mysql:3306/badge` | Composé à partir du précédent | Oui | Oui |
| `MINIO_ROOT_USER` | Login admin MinIO | Choisi (ex: `badge-admin`) | Oui | Non |
| `MINIO_ROOT_PASSWORD` | Mot de passe admin MinIO | `openssl rand -base64 32` | Oui | Non |
| `S3_ACCESS_KEY` | Clé applicative MinIO scopée sur le bucket | Créée par `make minio-init-prod` après le 1er setup | Oui | Oui |
| `S3_SECRET_KEY` | Secret associé | Idem | Oui | Oui |
| `NEXTAUTH_SECRET` | Clé HMAC NextAuth (signature JWT) | `openssl rand -base64 32` | Oui | Oui |
| `PLATFORM_SMTP_HOST` | Hôte SMTP plateforme | Provider (Brevo, Mailgun, OVH…) | Oui | Oui |
| `PLATFORM_SMTP_PORT` | Port SMTP (`587` STARTTLS / `465` SMTPS) | Provider | Oui | Oui |
| `PLATFORM_SMTP_SECURE` | `true` ou `false` | Décision techno | Oui | Oui |
| `PLATFORM_SMTP_USER` | Login SMTP | Provider | Oui | Oui |
| `PLATFORM_SMTP_PASSWORD` | Mot de passe SMTP | Provider | Oui | Oui |
| `PLATFORM_SMTP_FROM` | Adresse `From:` par défaut | Constante (ex: `Badge <noreply@badge.bj>`) | Oui | Oui |
| `RECAPTCHA_SECRET_KEY` | Clé secrète reCAPTCHA v3 (vérification serveur) | google.com/recaptcha/admin | Oui | Oui |
| `SEED_SUPER_ADMIN_EMAIL` | Email du premier STAFF_ADMIN à seeder | Choisi | Oui | Oui |
| `SEED_SUPER_ADMIN_PASSWORD` | Mot de passe initial (à changer dès le 1er login) | Choisi | Oui | Oui |
| `PHPMYADMIN_BASIC_AUTH_USER` | Login Basic Auth devant phpmyadmin | Choisi (ex: `badge-ops`) | Oui | Non (consommé par kamal-proxy) |
| `PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH` | Hash bcrypt du mot de passe Basic Auth | `htpasswd -nbB <user> '<pwd>' \| cut -d: -f2` | Oui | Non |

**Hors périmètre Kamal** (rappel, géré par v3-01 sur le serveur) : `rclone.conf` (Hetzner), `age-recipients.txt` (clés publiques backup). Ces fichiers vivent dans `/etc/badge/` sur le serveur, jamais dans Kamal.

### Fichier `.kamal/secrets.example` (versionné)

Sert de documentation et de template pour générer `.kamal/secrets` :

```sh
# Fichier sources par Kamal au demarrage de chaque commande (kamal deploy, kamal rollback, ...).
# Le vrai .kamal/secrets n'est PAS versionne (cf .gitignore). Copier ce fichier en .kamal/secrets
# et remplir les valeurs avec les vrais secrets.

# Registry GHCR
KAMAL_REGISTRY_PASSWORD=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Base de donnees
MYSQL_ROOT_PASSWORD=CHANGE_ME_long_random
DATABASE_URL=mysql://root:CHANGE_ME_long_random@badge-mysql:3306/badge

# Stockage objet (MinIO accessoire)
MINIO_ROOT_USER=badge-admin
MINIO_ROOT_PASSWORD=CHANGE_ME_long_random
S3_ACCESS_KEY=                                # rempli apres make minio-init-prod
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

# phpMyAdmin Basic Auth (couche kamal-proxy)
PHPMYADMIN_BASIC_AUTH_USER=badge-ops
PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH=$2y$05$CHANGE_ME_bcrypt_hash
```

### Fichier `.kamal/secrets` (local, non versionné)

Procédure de création :

```bash
# Depuis la racine du repo, sur le poste local
mkdir -p .kamal
cp .kamal/secrets.example .kamal/secrets
chmod 600 .kamal/secrets
# Editer .kamal/secrets et remplir chaque valeur
$EDITOR .kamal/secrets
```

### `.gitignore` : ajout

```
.kamal/secrets
```

Vérification :

```bash
git check-ignore .kamal/secrets       # doit retourner ".kamal/secrets"
```

### Stockage de référence des secrets (recommandation)

Pour ne pas perdre les valeurs (et pouvoir reconstruire `.kamal/secrets` depuis un autre poste si besoin), **conserver une copie chiffrée** dans un coffre personnel :

- **Bitwarden Free** (illimité, gratuit) : créer une "Secure Note" intitulée `badge-prod-kamal-secrets`, coller le contenu de `.kamal/secrets`.
- **Ou** `age` (cohérent avec v3-01) : `age --recipients-file ~/.config/age/recipients.txt < .kamal/secrets > .kamal/secrets.age`, et garder le fichier `.age` dans un repo dotfiles privé.

C'est manuel mais simple. La bascule vers GitHub Secrets (Phase 2) supprimera ce besoin.

### Premier déploiement : commandes

Une fois tout en place (`.kamal/secrets` rempli, `docker login ghcr.io` fait, serveur prêt avec ta clé SSH déjà autorisée), le premier déploiement se résume à :

```bash
# Depuis la racine du repo
cd ~/Devs/projects/badge

# Valider la config (n'envoie rien sur le serveur)
kamal config

# Setup initial : installe Docker sur le serveur si absent, démarre kamal-proxy,
# démarre les accessoires (mysql, minio, phpmyadmin), build l'image, push GHCR,
# pull serveur, lance l'app, attend le healthcheck OK.
kamal setup

# La commande peut prendre 10-20 minutes (premier pull d'images, build Next, etc.).
```

Déploiements ultérieurs (après modification du code) :

```bash
kamal deploy
```

Rollback (revenir à un SHA précédent) :

```bash
kamal app versions                    # liste les images disponibles
kamal rollback <sha-précédent>        # bascule en ~30s
```

Exécuter une commande dans le conteneur app (migrations, seed, smoke tests) :

```bash
kamal app exec --reuse "yarn prisma db push"
kamal app exec --reuse "yarn prisma db seed"
kamal app exec --reuse "make smoke-tests"
```

Logs en direct :

```bash
kamal app logs --follow
```

### Cibles `Makefile` Phase 1

Ajouts au `Makefile` du repo (wrappers de cohérence) :

```makefile
# === Kamal (Phase 1 : déploiement local) ===
kamal-config:           ## Valide la config Kamal (lecture seule)
	@kamal config

kamal-setup:            ## Bootstrap initial : install Docker + accessoires + app
	@kamal setup

kamal-deploy:           ## Déploiement zero-downtime (utilisation standard)
	@kamal deploy

kamal-rollback:         ## Rollback vers un SHA précédent (usage: make kamal-rollback VERSION=<sha>)
	@kamal rollback $(VERSION)

kamal-logs:             ## Logs app en direct
	@kamal app logs --follow

kamal-migrate:          ## prisma db push sur la prod
	@kamal app exec --reuse "yarn prisma db push"

kamal-seed:             ## prisma db seed sur la prod
	@kamal app exec --reuse "yarn prisma db seed"

kamal-smoke:            ## smoke tests sur la prod
	@kamal app exec --reuse "make smoke-tests"

kamal-console:          ## bash interactif dans le conteneur app
	@kamal console

kamal-ps:               ## docker ps sur le serveur
	@kamal server exec "docker ps"
```

### Pourquoi Phase 1 (local) plutôt que Phase 2 (CI) tout de suite

1. **Valider Kamal lui-même** avant la couche CI. Si `kamal setup` plante (problème de réseau, conflit de ports, image qui ne build pas), on débogue avec l'output complet sous les yeux. Pas via les logs GitHub Actions.
2. **Itérations en 5 secondes**. Modifier `deploy.yml`, relancer `kamal config`, voir le résultat. En CI : ~3 min par run.
3. **Setup minimal** : zéro infra additionnelle, pas de SSH key dédiée, pas de workflow YAML à débugger.
4. **Apprentissage** : on apprend comment Kamal fonctionne en le voyant tourner.
5. **Migration CI triviale** : le `deploy.yml` reste le même en Phase 2. Le workflow GitHub Actions reproduit ce qu'on faisait à la main. Pas de refonte.

Quand basculer vers Phase 2 (cf annexe) : équipe (2+ deployers), besoin d'audit centralisé, ou simplement après 2-3 deploys Phase 1 réussis pour gagner du temps.

---

## Section 4 — Healthcheck Next et ajustements Dockerfile

### Vue d'ensemble

Le healthcheck est le signal de basculement que `kamal-proxy` interroge pour décider si un nouveau conteneur peut prendre le trafic. C'est le cœur du zero-downtime :

- Kamal lance le nouveau conteneur **à côté** de l'ancien.
- `kamal-proxy` interroge `GET /api/health` sur le nouveau conteneur en boucle.
- Tant que la réponse n'est pas `200 OK`, l'ancien conteneur continue de servir tout le trafic.
- Dès la première réponse `200 OK`, swap atomique vers le nouveau, puis arrêt de l'ancien.
- Si le healthcheck n'a jamais répondu `200 OK` dans la fenêtre `max_attempts × interval`, déploiement marqué en échec et l'ancien conteneur reste en place. Pas de fenêtre 502.

**Décision tranchée** : healthcheck minimal (200 + JSON), pas de check BDD/MinIO. Justification : un check trop strict peut faire échouer un deploy légitime à cause d'un hoquet ponctuel des dépendances. Le boot Next prouve déjà que les variables d'env critiques sont valides.

### Route `src/app/api/health/route.ts`

```typescript
import { NextResponse } from "next/server";

// Empêche Next de pré-rendre / cacher cette réponse au build.
// Le healthcheck doit refléter l'état runtime, pas l'état build.
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

Notes :

- Pas d'import `@/lib/prisma` : on évite que le bundle de la route déclenche l'init du client Prisma au cold start.
- Pas d'`await` : latence négligeable (<1 ms).
- Pas de `logActivity` : un healthcheck toutes les 2 s polluerait la table d'audit.

### Test unitaire

Fichier `src/app/api/health/__tests__/route.test.ts` :

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

  it("retourne un uptime numérique positif", async () => {
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

### Configuration Kamal `proxy.healthcheck`

Valeurs déjà inscrites dans `config/deploy.yml` (Section 2) :

```yaml
proxy:
  healthcheck:
    path: /api/health
    interval: 2
    timeout: 5

healthcheck:
  path: /api/health
  port: 3000
  max_attempts: 30
  interval: 2s
```

Justification : fenêtre totale = 30 × 2s = **60 secondes** pour couvrir boot Next standalone (~3-5s) + `prisma db push` du `docker-entrypoint.sh` (~2-10s) + warm-up premier rendu. Marge confortable.

### Ajustements Dockerfile

Deux ajouts ciblés (pas de refonte) :

1. `ARG APP_VERSION` + `ENV APP_VERSION=$APP_VERSION` (lu par `/api/health`).
2. Directive `HEALTHCHECK` (utile pour `docker ps`, indépendant de Kamal).

Diff cible :

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install || yarn install

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn prisma generate --schema=./prisma/schema.prisma
RUN yarn build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Version applicative injectée au build (lue par /api/health)
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

RUN apk add --no-cache openssl

RUN npm install -g prisma@6.19.3

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
```

Vérifications :

- **Route `/api/health` embarquée ?** Oui automatiquement (build standalone Next inclut toutes les routes de `src/app/api/`).
- **`wget` dispo ?** Oui, builtin BusyBox dans `node:22-alpine`.
- **Impact taille image ?** Zéro (ARG + HEALTHCHECK sont métadonnées).

### Notes techniques

- **Évolution possible** : ajouter `/api/health/deep` plus tard pour un monitoring externe (Uptime Kuma, Better Stack) qui interroge BDD + MinIO, **sans** brancher cet endpoint sur Kamal.
- **`dynamic = "force-dynamic"`** : empêche Next de cacher la réponse au build avec un timestamp figé.
- **Comportement pendant boot** : pendant que `prisma db push` puis Next démarrent, Kamal Proxy reçoit `connection refused`. Chaque échec consomme une tentative. Dès que le port 3000 répond, swap atomique.
- **Coût opérationnel** : ~31 requêtes/min sur `/api/health` (Kamal toutes les 2s + Docker toutes les 30s). <1 ms CPU chacune, zéro I/O. Négligeable.

---

## Section 5 — Intégration avec v2-07 (déploiement initial) et v3-01 (stockage + backups)

### A. Impact sur v2-07

#### Statut du plan v2-07

**Décision : marquer v2-07 obsolète, procédure réécrite dans v3-02.**

Justifications :

- Surface de changement énorme (Makefile, scripts, env, doc) : patcher en place produirait un diff illisible.
- Plan v2-07 jamais entré en exécution (`Derniere session : aucune`). Pas de travail en cours à préserver.
- Cohérence avec la règle CLAUDE.md de conservation : marquer obsolète préserve l'historique du *pourquoi*.

#### Amendements à appliquer dans v2-07

1. **`docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`** : ajouter en tête :

```markdown
> **STATUT : SUPERSEDED par la spec v3-02 (déploiement Kamal)**
> Date de remplacement : 2026-05-31
> Raison : passage du déploiement docker-compose à Kamal. La procédure cible vit désormais dans `docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md` et son plan associé.
> Ce plan est conservé pour traçabilité (cf. règle de conservation des plans CLAUDE.md). Ne pas l'exécuter.
```

   Marquer toutes les tasks du tracker en `[-]` avec note `Superseded by v3-02`.

2. **`docs/v2/features/deploiement-initial.md`** : ajouter le même bandeau en tête. Garder le contenu comme référence historique pour comprendre la procédure v1.

3. **`docs/v2/README.md`** : dans le tableau des sous-spécifications, marquer v2-07 "Superseded par v3-02" et ajouter une ligne v3-02.

#### Tableau de correspondance des commandes

| Étape v2-07 (obsolète) | Commande v2-07 | Remplacement Kamal (v3-02) |
|---|---|---|
| [2] Backup précaution | `make backup-prod` | `make backup-prod` (cible v3-01, scripts patchés cf B) |
| [3] Stop v1 | `make prod-down` | `kamal app stop` |
| [4a] Reset BDD | `docker exec badge-db mysql ... DROP DATABASE` | `kamal accessory exec mysql --interactive --reuse "mysql -u root -p\$MYSQL_ROOT_PASSWORD -e 'DROP DATABASE badge; CREATE DATABASE badge;'"` |
| [4b] Reset uploads | `docker exec badge-app rm -rf /app/uploads/*` | **disparaît** (uploads dans MinIO via v3-01) |
| [5a] Pull code | `git pull origin main` | **disparaît côté serveur** (Kamal pull l'image depuis GHCR) |
| [5b] Build prod | `make prod-build` | `kamal build push` (depuis le poste local) |
| [6] Schéma Prisma | `docker compose run app yarn prisma db push` | `kamal app exec --reuse "yarn prisma db push"` |
| [7] Seed initial | `docker compose run app yarn prisma db seed` | `kamal app exec --reuse "yarn prisma db seed"` |
| [8] Démarrer | `make prod` | `kamal deploy` |
| [9] Smoke tests | `make smoke-tests` | `kamal app exec --reuse "make smoke-tests"` |
| [10] 1ère connexion | inchangé | inchangé |
| Rollback | `make rollback-prod SQL=... UPLOADS=...` | `kamal rollback <sha>` (code) + `make restore-from-backup SNAPSHOT=...` (BDD, v3-01) |

### B. Impact sur v3-01

#### Conteneurs Kamal (nouveaux noms)

| Service | Nom de conteneur Kamal | Équivalent compose v1 |
|---|---|---|
| App Next.js | `badge-web` | `badge-app` |
| MySQL accessory | `badge-mysql` | `badge-mysql` |
| MinIO accessory | `badge-minio` | `badge-minio` |
| phpMyAdmin accessory | `badge-phpmyadmin` | `badge-phpmyadmin` |

#### Patches à appliquer aux scripts v3-01

**`scripts/backup-prod.sh`** :

```diff
- docker compose -f docker-compose.yml exec -T mysql \
+ docker exec -i badge-mysql \
      mysqldump --single-transaction --routines --triggers --events \
                -u root -p"$MYSQL_ROOT_PASSWORD" badge \
      | gzip > staging/.../db.sql.gz
```

```diff
  # mc tourne côté hôte, pointe vers 127.0.0.1:9000 (port mappé par accessory Kamal)
  mc mirror --quiet --overwrite minio-local/badge-prod staging/.../minio/
```

```diff
- cp /opt/badge/.env.production staging/.../env.production
- cp /opt/badge/Caddyfile        staging/.../Caddyfile
+ # .env.production n'existe plus sur le serveur (Kamal injecte tout).
+ # On capture la config Kamal de reference :
+ [ -f /root/badge-ops/config/deploy.yml ] && \
+   cp /root/badge-ops/config/deploy.yml staging/.../deploy.yml
+ # Pas de Caddyfile : kamal-proxy se configure via deploy.yml.
```

**`scripts/restore-from-backup.sh`** :

```diff
- docker exec -i badge-db mysql ... < db.sql.gz
+ gunzip -c db.sql.gz | docker exec -i badge-mysql \
+     mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge
```

```diff
  # mc côté hôte (identique au backup)
  mc rm --recursive --force minio-local/badge-prod
  mc mirror --overwrite staging/.../minio/ minio-local/badge-prod
```

**`scripts/minio-init.sh`** (v3-01) : ne change pas dans sa logique (utilise déjà `mc` côté hôte). L'endpoint cible reste `http://127.0.0.1:9000` (port mappé par l'accessory Kamal).

**`scripts/audit-permissions.sh`** : adapter le tableau pour remplacer `/opt/badge/.env.production` (n'existe plus) par `/root/badge-ops/config/deploy.yml`.

#### Chemins filesystem mis à jour

| Chemin v3-01 actuel | Nouveau chemin Kamal | Contenu |
|---|---|---|
| `/opt/badge/` | `/root/badge-ops/` | Scripts backup + Makefile-ops + ops/ + config/ |
| `/opt/badge/.env.production` | **n'existe plus** | (Kamal injecte les env dans le conteneur) |
| `/opt/badge/Caddyfile` | **n'existe plus** | (kamal-proxy se configure via deploy.yml) |
| `/etc/badge/age-recipients.txt` | identique | Clés publiques age |
| `/etc/badge/rclone.conf` | identique | Credentials Hetzner SFTP |
| `/var/backups/badge/` | identique | Snapshots et staging |
| `/var/log/badge/` | identique | Logs JSON du backup |

Nouveau cron `/etc/cron.d/badge-backup` :

```
PATH=/usr/local/bin:/usr/bin:/bin

# Backup hebdomadaire, dimanche 03h00
0 3 * * 0 root cd /root/badge-ops && /usr/bin/make backup-prod >> /var/log/badge/backup-cron.log 2>&1
```

Seul le `cd /opt/badge` devient `cd /root/badge-ops`. Le reste est identique.

#### Synchronisation des scripts ops vers `/root/badge-ops/`

Les scripts shell de v3-01 (`backup-prod.sh`, `restore-from-backup.sh`, etc.) vivent dans le repo et doivent s'exécuter **côté hôte** (en root, hors conteneur). Ils ne sont pas dans l'image Docker.

**Phase 1 : rsync manuel depuis le poste local** (la voie la plus simple) :

Ajouter une cible Makefile :

```makefile
# === Sync ops scripts vers le serveur ===
ops-sync:               ## Pousse scripts/, ops/, Makefile-ops vers /root/badge-ops/
	@ssh root@173.212.217.54 "mkdir -p /root/badge-ops/{scripts,ops,config}"
	@rsync -avz --delete scripts/ root@173.212.217.54:/root/badge-ops/scripts/
	@rsync -avz --delete ops/ root@173.212.217.54:/root/badge-ops/ops/
	@rsync -avz ops/Makefile-ops root@173.212.217.54:/root/badge-ops/Makefile
	@rsync -avz config/deploy.yml root@173.212.217.54:/root/badge-ops/config/deploy.yml
	@ssh root@173.212.217.54 "chmod 700 /root/badge-ops && chmod 700 /root/badge-ops/scripts/*.sh"
```

À lancer manuellement après chaque modification des scripts ops :

```bash
make ops-sync
```

**Phase 2** : automatisé via step GitHub Actions post-deploy (cf annexe).

#### Cibles Makefile : ce qui change

**Cibles conservées dans le Makefile applicatif** (du repo, exécutées via `kamal app exec`) :

`smoke-tests`, `lint`, `typecheck`, `test`, `db-push`, `db-seed`, `db-studio`

**Cibles dev local seulement** : `dev`, `dev-down`, `logs`, `db-reset`

**Cibles déplacées dans `ops/Makefile-ops`** (workdir `/root/badge-ops/` du serveur) :

`backup-prod`, `backup-prod-dry-run`, `backup-list`, `backup-list-local`, `backup-list-remote`, `restore-from-backup`, `install-backup-deps`, `install-backup-cron`, `minio-init-prod`, `audit-permissions`

**Cibles supprimées** : `prod`, `prod-build`, `prod-down`, `prod-up`, `prod-logs`, `rollback-prod`, `upload`, `deploy` (remplacées par `kamal-*`).

### C. Impact sur le master design v2

Modifications légères à `docs/v2/specs/2026-05-28-v2-master-design.md` :

**C.1 Ajout dans "Conventions transverses"** :

```markdown
- **Déploiement** : géré par Kamal 2.x (cf spec v3-02). Kamal Proxy remplace Caddy comme frontal HTTPS. MySQL, MinIO et phpMyAdmin sont des accessoires Kamal. Pas de `.env.production` ni de `docker-compose.yml` sur le serveur de prod — toute la configuration vit dans `config/deploy.yml` (versionné) + `.kamal/secrets` (local, non versionné).
```

**C.2 Nouvelle ligne dans le tableau des sous-spécifications** :

```
| 7 | [Reset & déploiement initial](features/deploiement-initial.md) | **Superseded par v3-02** — historique uniquement |
| 8 | [Stockage S3 & backups](features/stockage-fichiers-s3.md) | MinIO multi-tenant, pipeline backup chiffré, restore interactif |
| 9 | [Déploiement Kamal](features/deploiement-kamal.md) | Kamal 2.x, accessoires (mysql/minio/phpmyadmin), kamal-proxy, zero-downtime |
```

**C.3 Ordre d'implémentation** : amender pour insérer v3-02 dans la séquence des fondations :

```
Lot A (fondations)          : Spec 1 (multi-tenancy + RBAC)
                              ↓
Lot B (infra & déploiement) : Spec 9 (Kamal) → Spec 8 (stockage + backups)
                              ↓
Lot C (auth & staff)        : Spec 2 (espace staff)
                              ↓
...
```

### D. Cohabitation Kamal accessory MinIO + scripts v3-01

`scripts/minio-init.sh` de v3-01 attend que MinIO réponde sur un endpoint joignable. Avec Kamal, MinIO tourne dans le conteneur `badge-minio`, accessible :

1. Depuis l'app Next.js : `http://badge-minio:9000` (réseau Docker interne, valeur de `S3_ENDPOINT`).
2. Depuis l'hôte de prod : `http://127.0.0.1:9000` (port mappé par l'accessory).
3. Depuis Internet : **jamais**.

Procédure pour relancer `minio-init` après `kamal setup` :

```bash
ssh root@173.212.217.54
cd /root/badge-ops
make minio-init-prod
```

Le script tourne côté hôte (pas via `docker exec`), configure `mc` pour pointer sur `http://127.0.0.1:9000`, crée le bucket `badge-prod` + la clé applicative scopée. Idempotent.

**Point d'attention** : le port 9000 est bindé sur `127.0.0.1:9000:9000` dans `deploy.yml` (cf Section 2), donc invisible depuis Internet. Si Kamal ne supporte pas cette syntaxe à l'avenir, fallback = règle UFW (`ufw deny in on eth0 to any port 9000`).

### E. Cohabitation Kamal Proxy + cron backup

Aucun conflit direct. Le cron backup tourne en root sur l'hôte, hors conteneur. Les seules interactions avec Kamal sont les `docker exec badge-mysql ...` et `mc` côté hôte. kamal-proxy ne voit jamais passer le trafic backup.

Points à acter pour la spec v3-03 (observabilité, future) :

- Les logs `/var/log/badge/backup.log` vivent sur l'hôte, pas dans un conteneur. Non captés par `kamal app logs`. Future ingestion vers Loki devra watcher ces fichiers via tail agent côté hôte (`vector`/`promtail` en service systemd, pas en conteneur Kamal).
- L'état `/var/backups/badge/last-status.json` est lisible côté hôte uniquement.
- Le cron survit à n'importe quel `kamal deploy` ou `kamal rollback` (cron de l'hôte indépendant des conteneurs).

---

## Section 6 — Migration depuis l'état actuel et plan de rollback

### A. Stratégie : big bang en fenêtre de maintenance

La bascule v1 → v2 est réalisée en un seul créneau de maintenance planifié. Justifications :

- La v2 prévoit un reset complet de la prod (`docs/v2/features/deploiement-initial.md`) — aucune donnée v1 à conserver.
- Mono-serveur, mono-client : blue/green entre v1 docker-compose et v2 Kamal sur le même serveur multiplierait la complexité (ports alternatifs, double TLS) pour zéro bénéfice.
- Fenêtre courte (~30-45 min), annoncée à l'avance, acceptable pour le profil événementiel.
- Rollback v1 reste possible en gardant les volumes Docker v1 intacts pendant 7 jours.

**Durée estimée : 30-45 min** (10 min stop v1 + backup, 15-20 min `kamal setup`, 5-10 min smoke + premier login).

### B. Pré-déploiement (J-1)

Checklist humaine à exécuter la veille (toutes ces étapes se font depuis le poste local) :

1. **Annoncer la maintenance** aux utilisateurs (24 h avant).

2. **Vérifier que la branche `feat/v2-sass` (ou `main` après merge) contient** :
   - `config/deploy.yml`
   - `config/mysql/my.cnf`
   - `Dockerfile` patché (ARG APP_VERSION + HEALTHCHECK)
   - `src/app/api/health/route.ts` + tests
   - `.kamal/secrets.example`
   - `.gitignore` exclut `.kamal/secrets`
   - Cibles Makefile `kamal-*` et `ops-sync`

3. **Installer Kamal sur le poste local** :

   ```bash
   gem install kamal -v "~> 2.5"
   kamal version    # → 2.5.x
   ```

4. **Créer le PAT GitHub** (scopes `write:packages` + `read:packages`) sur https://github.com/settings/tokens. Le sauvegarder dans Bitwarden / 1Password Free.

5. **Authentifier docker sur GHCR** :

   ```bash
   echo "<PAT>" | docker login ghcr.io -u tigamadou --password-stdin
   # Vérifier : ~/.docker/config.json contient une entrée pour ghcr.io
   ```

6. **Préparer `.kamal/secrets`** :

   ```bash
   cd ~/Devs/projects/badge
   mkdir -p .kamal
   cp .kamal/secrets.example .kamal/secrets
   chmod 600 .kamal/secrets
   # Editer chaque valeur (cf liste exhaustive Section 3)
   $EDITOR .kamal/secrets

   # Sauvegarder une copie chiffrée dans Bitwarden Secure Note "badge-prod-kamal-secrets"
   ```

7. **Vérifier l'accès SSH au serveur** avec ta clé personnelle :

   ```bash
   ssh root@173.212.217.54 "echo ok && docker --version || echo 'Docker à installer'"
   ```

   Si la clé n'est pas autorisée : `ssh-copy-id root@173.212.217.54`.

8. **Tester le build de l'image Docker localement** :

   ```bash
   docker build -t badge-test:local --build-arg APP_VERSION=test .
   docker run --rm badge-test:local node --version    # v22.x
   docker inspect badge-test:local | grep -A 5 Healthcheck    # doit montrer le HEALTHCHECK
   ```

9. **Vérifier la config Kamal** :

   ```bash
   kamal config
   ```

   Doit afficher la config résolue sans erreur. Si erreur de syntaxe YAML ou variable manquante : corriger.

10. **Vérifier le DNS** :

    ```bash
    dig +short badge.bj     # → 173.212.217.54
    dig +short pma.badge.bj # → 173.212.217.54
    ```

11. **Vérifier l'espace disque sur le serveur** : `ssh root@173.212.217.54 "df -h /"`. Doit avoir au moins 20 % libre (Kamal va coexister temporairement avec v1).

### C. Jour J — Bascule v1 → v2 via Kamal (depuis le poste local)

**Étapes ordonnées. Ne pas paralléliser.**

1. **Backup intégral v1 (précaution)** sur le serveur :

   ```bash
   ssh root@173.212.217.54
   cd ~/badge
   make backup-prod
   ls -lh backups/
   exit
   ```

   Copier hors-serveur :

   ```bash
   # Depuis le poste local
   mkdir -p ~/badge-v1-backups-prebascule
   scp root@173.212.217.54:~/badge/backups/badge-*.sql ~/badge-v1-backups-prebascule/
   scp root@173.212.217.54:~/badge/backups/uploads-*.tar.gz ~/badge-v1-backups-prebascule/
   ```

2. **Stop v1** sur le serveur :

   ```bash
   ssh root@173.212.217.54 "cd ~/badge && docker compose down && docker ps"
   ```

   `docker ps` doit être vide. **Ne PAS supprimer les volumes v1** (`badge_mysql_data`, `badge_uploads_data`, `badge_caddy_data`) — les garder 7 jours pour rollback rapide.

3. **Préparer le workdir ops sur le serveur** :

   ```bash
   ssh root@173.212.217.54 "mkdir -p /root/badge-ops/{scripts,ops,config} /etc/badge"
   ```

4. **Déposer `/etc/badge/age-recipients.txt` et `/etc/badge/rclone.conf`** sur le serveur (cf spec v3-01, doc `docs/v2/operations/age-keys.md`).

5. **Vérifier qu'aucun process n'occupe 80/443** sur le serveur :

   ```bash
   ssh root@173.212.217.54 "lsof -i :80 -i :443"
   ```

   Doit être vide.

6. **Lancer `kamal setup`** depuis le poste local :

   ```bash
   cd ~/Devs/projects/badge
   kamal setup
   ```

   Cette commande :
   - Installe Docker sur le serveur si absent.
   - Se connecte à GHCR avec le PAT.
   - Pull les images (kamal-proxy, mysql, minio, phpmyadmin) + build l'image app.
   - Push l'image app vers GHCR (`ghcr.io/tigamadou/badge:<sha>`).
   - Lance kamal-proxy (récupère le certificat Let's Encrypt pour `badge.bj` et `pma.badge.bj`).
   - Lance les accessoires (mysql, minio, phpmyadmin) avec leurs volumes.
   - Lance le conteneur app (`badge-web`).
   - Attend le healthcheck `/api/health` OK avant de basculer le trafic.

   **Durée : 10-20 min** (premier pull et build).

7. **Vérifier que tous les services tournent** :

   ```bash
   ssh root@173.212.217.54 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
   ```

   On doit voir :

   | Conteneur | Statut attendu |
   |---|---|
   | `kamal-proxy` | `Up (healthy)` |
   | `badge-web-<sha>` | `Up (healthy)` |
   | `badge-mysql` | `Up (healthy)` |
   | `badge-minio` | `Up (healthy)` |
   | `badge-phpmyadmin` | `Up (healthy)` |

8. **Synchroniser les scripts ops vers `/root/badge-ops/`** :

   ```bash
   make ops-sync
   ```

9. **Bootstrap MinIO** sur le serveur :

   ```bash
   ssh root@173.212.217.54 "cd /root/badge-ops && make minio-init-prod"
   ```

   Cette commande crée le bucket `badge-prod` + la clé applicative scopée. Récupérer les valeurs `S3_ACCESS_KEY` et `S3_SECRET_KEY` affichées, les remplir dans `.kamal/secrets` côté poste local, et relancer un `kamal deploy` pour propager :

   ```bash
   # Sur le poste local
   $EDITOR .kamal/secrets    # remplir S3_ACCESS_KEY et S3_SECRET_KEY
   kamal deploy              # propage les nouveaux env vers le conteneur app
   ```

10. **Appliquer le schéma Prisma + seed** :

    ```bash
    kamal app exec --reuse "yarn prisma db push"
    kamal app exec --reuse "yarn prisma db seed"
    ```

    Le seed crée le STAFF_ADMIN initial depuis `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`.

11. **Smoke tests** :

    ```bash
    kamal app exec --reuse "make smoke-tests"
    ```

    Attendre 8/8 OK.

12. **Vérifier TLS depuis l'extérieur** :

    ```bash
    curl -I https://badge.bj/login
    curl -I https://pma.badge.bj
    ```

    Attendu : `HTTP/2 200`, certificat valide Let's Encrypt.

13. **Première connexion SUPER_ADMIN** dans un navigateur :
    - URL : `https://badge.bj/login`
    - Email : valeur de `SEED_SUPER_ADMIN_EMAIL`
    - Password : valeur de `SEED_SUPER_ADMIN_PASSWORD`
    - **Changer immédiatement le mot de passe** via `/profile`.

14. **Activer le cron de backup** sur le serveur :

    ```bash
    ssh root@173.212.217.54 "cd /root/badge-ops && make install-backup-cron"
    ```

15. **Backup de validation** (manuel, avant de laisser le cron prendre la suite) :

    ```bash
    ssh root@173.212.217.54 "cd /root/badge-ops && make backup-prod"
    ```

    Vérifier qu'un snapshot chiffré est produit et poussé vers Hetzner.

16. **Annoncer la fin de maintenance** aux utilisateurs.

### D. Plan de rollback (en cas d'échec)

**Niveau 1 — Échec d'un déploiement Kamal ultérieur (post-setup)**.

Cas nominal : Kamal gère seul. Si le healthcheck du nouveau conteneur ne passe pas, kamal-proxy garde l'ancien actif. Aucune action requise.

Cas explicite (rollback vers un SHA précédent) :

```bash
# Sur le poste local
kamal app versions    # liste les images disponibles
make kamal-rollback VERSION=<sha-précédent>
# ou directement : kamal rollback <sha-précédent>

# Vérifier
curl -I https://badge.bj/login
```

Si la BDD doit aussi être restaurée (corruption, schéma incompatible) :

```bash
ssh root@173.212.217.54 "cd /root/badge-ops && make restore-from-backup SNAPSHOT=<date>"
```

**Niveau 2 — Bascule v1 → v2 catastrophique (jour J)**.

Procédure de retour à v1 dans la même fenêtre de maintenance :

```bash
# Sur le serveur (via ssh)
ssh root@173.212.217.54
for c in $(docker ps -a --filter "name=badge-" --format "{{.Names}}") kamal-proxy; do
  docker stop "$c" 2>/dev/null
  docker rm "$c" 2>/dev/null
done
docker ps    # doit être vide

# Restaurer v1
cd ~/badge
git checkout <tag-v1-dernière-stable>    # ex: v1.4.2
docker compose up -d
docker compose ps    # tous les services v1 doivent être Up

# Vérifier
curl -I https://badge.bj/login    # doit retourner 200
```

Si les volumes v1 ont été touchés, restaurer depuis le backup pré-bascule :

```bash
cd ~/badge
make rollback-prod SQL=backups/badge-<TS>.sql UPLOADS=backups/uploads-<TS>.tar.gz
```

Annoncer le report de migration, faire un post-mortem avant de retenter.

### E. Post-déploiement (J+1 à J+7)

| Échéance | Action |
|---|---|
| H+1 | `kamal app logs --follow` 15 min — chercher 500, timeouts, exceptions Prisma. |
| H+24 | `kamal app logs --since 24h \| grep -iE "error\|fatal"`. |
| J+1 | Vérifier que le cron backup s'est exécuté (`ls -lh /var/backups/badge/snapshots/`, email de monitoring reçu). |
| J+3 | Désactiver le cron de backup v1 s'il était actif (`/etc/cron.d/badge-v1-backup`). |
| J+7 | Si v2 stable, **supprimer les volumes Docker v1** : `docker volume rm badge_mysql_data badge_uploads_data badge_caddy_data badge_caddy_config`. Supprimer aussi `~/badge` si plus utilisé. |
| J+7 | Documenter la procédure réelle dans `docs/v2/operations/kamal-day-one.md` (annotations sur la procédure §C, imprévus, durées réelles). |

### F. Risques identifiés et mitigations

| Risque | Mitigation | Statut |
|---|---|---|
| Let's Encrypt rate-limit (5 certs / domaine / semaine) | Tester en pré-prod avec staging Let's Encrypt si possible. Limiter les `kamal setup` répétés sur le même domaine. | Accepté |
| Clé SSH du poste local non autorisée sur le serveur | Tester `ssh root@<serveur> "echo ok"` avant le jour J. Si KO : `ssh-copy-id`. | Couvert par §B step 7 |
| Healthcheck flaky pendant le boot (Prisma client + Next start lents) | `max_attempts: 30` × `interval: 2s` = 60s. Ajuster après mesure. | Couvert |
| Volume MinIO accessory créé vide au setup | Attendu (v2 part vide). Bootstrap via `make minio-init-prod` étape 9. | Couvert |
| Conflit sur ports 80/443 si v1 mal stoppée | Vérification explicite §C step 5 (`lsof -i :80 -i :443`). | Couvert |
| Image GHCR pas accessible (PAT expiré, scope manquant) | Test §B step 5 + §B step 8 (build local). | Couvert |
| DNS qui ne pointe plus sur le bon serveur | Vérification §B step 10. | Couvert |
| Espace disque insuffisant pendant la coexistence v1 + v2 | Vérification §B step 11. | Couvert |
| Seed STAFF_ADMIN échoue silencieusement | Vérifier après §C step 10 via `kamal db` ou phpMyAdmin (`SELECT COUNT(*) FROM User WHERE isStaff=1`). | Couvert par smoke tests |
| Mot de passe SUPER_ADMIN initial laissé inchangé | Rappel humain §C step 13. À renforcer plus tard via flag `mustChangePassword` en BDD (hors scope). | Accepté |
| Perte du `.kamal/secrets` local du dev | Conservation systématique en parallèle dans Bitwarden Secure Note (§B step 6). | Mitigé |

---

## Section 7 — Critères d'acceptation (Phase 1)

Critères vérifiables, regroupés par sous-système. Un PR n'est mergeable que si tous les critères `[bloquant]` sont verts. Phase 2 (CI/CD) ajoute ses propres critères en annexe.

### A. Configuration Kamal

1. `[bloquant]` `config/deploy.yml` est commité à la racine du repo. `kamal config` (avec `.kamal/secrets` rempli) passe sans erreur.
2. `[bloquant]` Le fichier déclare `service: badge`, `image: ghcr.io/tigamadou/badge`, `registry.server: ghcr.io`, `builder.arch: amd64`.
3. `[bloquant]` Les variables non sensibles sont en `env.clear`. Aucune valeur sensible n'y figure (`grep -E '(PASSWORD|SECRET|KEY)' config/deploy.yml` ne retourne aucune valeur en clair).
4. `[bloquant]` Les variables sensibles sont en `env.secret` et résolues depuis `.kamal/secrets`.
5. `[bloquant]` Trois accessoires : `mysql`, `minio`, `phpmyadmin`. Chacun a un volume nommé persistant (`badge_mysql_data`, `badge_minio_data` ; pas de volume pour phpmyadmin).
6. `[bloquant]` `phpmyadmin` est exposé via kamal-proxy sur `pma.badge.bj` avec TLS Let's Encrypt et Basic Auth (champ `proxy.basic_auth`). `curl -I https://pma.badge.bj` → 401 ; `curl -u user:pwd -I https://pma.badge.bj` → 200.
7. `[bloquant]` `proxy.host: badge.bj` et `proxy.ssl: true`. Aucune référence à Caddy ne subsiste dans le repo (`grep -ri caddy --include="*.yml" --include=Caddyfile .` retourne uniquement des références dans `docs/v1/` ou docs archivées).

### B. Secrets et déploiement Phase 1

8. `[bloquant]` `.kamal/secrets.example` est commité, complet (toutes les variables de la Section 3 listées).
9. `[bloquant]` `.kamal/secrets` est dans `.gitignore`. `git check-ignore .kamal/secrets` retourne `.kamal/secrets`.
10. `[bloquant]` `kamal version` retourne `2.5.x` sur le poste de déploiement.
11. `[bloquant]` `docker login ghcr.io` fonctionne sur le poste de déploiement avec le PAT.
12. `[bloquant]` `ssh root@173.212.217.54 "echo ok"` fonctionne sans prompt (clé personnelle autorisée).
13. `[bloquant]` `make ops-sync` synchronise sans erreur les scripts ops vers `/root/badge-ops/`.

### C. Healthcheck Next

14. `[bloquant]` `src/app/api/health/route.ts` existe, retourne 200 + `{status:'ok', timestamp, uptime, version}`. Aucune dépendance BDD/MinIO dans le handler.
15. `[bloquant]` `src/app/api/health/__tests__/route.test.ts` passe avec `make test` (4 tests).
16. `[bloquant]` `Dockerfile` contient la directive `HEALTHCHECK` (vérifiable via `docker inspect ghcr.io/tigamadou/badge:<sha> | jq '.[0].Config.Healthcheck'`).
17. `[bloquant]` `Dockerfile` contient `ARG APP_VERSION` + `ENV APP_VERSION=$APP_VERSION`. `kamal build` injecte le SHA git court automatiquement.
18. `[bloquant]` `config/deploy.yml` déclare `proxy.healthcheck.path: /api/health`, `interval: 2`, `timeout: 5`, et `healthcheck.max_attempts: 30`.
19. `curl https://badge.bj/api/health` retourne 200 + `{status:'ok'}` en <200 ms en régime stable.

### D. Stockage et accessoires

20. `[bloquant]` Après `kamal setup`, le bucket MinIO `badge-prod` est créé par `make minio-init-prod` (idempotent : 2 lancements consécutifs → 0 erreur).
21. `[bloquant]` Migrations Prisma : `kamal app exec --reuse "yarn prisma db push"` réussit. Seed : `kamal app exec --reuse "yarn prisma db seed"` crée le STAFF_ADMIN.
22. `[bloquant]` La BDD survit à `kamal redeploy` : créer une org test, `kamal redeploy`, l'org existe toujours (`kamal db` puis `SELECT COUNT(*) FROM Organization`).
23. `[bloquant]` Le bucket MinIO survit à `kamal redeploy` : uploader un fichier, `kamal redeploy`, le fichier est toujours téléchargeable.
24. `[bloquant]` Les volumes `badge_mysql_data` et `badge_minio_data` existent (`docker volume ls | grep badge_`) et ne sont jamais supprimés par `kamal deploy` ni `kamal app remove`.
25. `kamal accessory logs mysql --lines 50` et `kamal accessory logs minio --lines 50` retournent des logs propres (pas de boucle d'erreur).
26. phpMyAdmin (`https://pma.badge.bj`) permet de se connecter à MySQL et d'exécuter `SELECT 1`.

### E. Zero-downtime effectif

27. `[bloquant]` Test boucle HTTP : `while true; do curl -s -o /dev/null -w "%{http_code}\n" https://badge.bj/login; sleep 0.2; done` en parallèle d'un `kamal deploy`. **Aucun 502/503/504** pendant la bascule. Tolérance : 0 erreur sur ≥500 requêtes.
28. `[bloquant]` Test image cassée : déployer une image qui échoue son healthcheck (ex: `NEXTAUTH_SECRET` vide). `kamal deploy` échoue **sans couper** la version précédente. `curl https://badge.bj/api/health` continue de répondre 200 pendant et après.
29. `[bloquant]` `kamal rollback <previous-version>` ramène l'app en <30s (`time kamal rollback`).
30. Pendant un `kamal deploy`, deux conteneurs `badge-web` cohabitent transitoirement (`docker ps | grep badge-web` montre 2 lignes pendant ~30s).
31. Un déploiement complet (`kamal deploy` depuis le poste local) prend <5 minutes en conditions nominales.

### F. Intégration avec v2-07 et v3-01

32. `[bloquant]` `docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md` porte en tête un bandeau `> **STATUT : SUPERSEDED par la spec v3-02**`. Toutes les tasks marquées `[-]`.
33. `[bloquant]` `docs/v2/features/deploiement-initial.md` porte le même bandeau.
34. `[bloquant]` Scripts shell v3-01 (`scripts/backup-prod.sh`, `scripts/restore-from-backup.sh`) patchés : `grep -n 'docker compose exec' scripts/` ne retourne plus rien. À la place : `docker exec -i badge-mysql`, `docker exec -i badge-minio`.
35. `[bloquant]` Workdir cron `/root/badge-ops/` contient `Makefile`, `scripts/`, `ops/`, `config/deploy.yml`. Peuplé par `make ops-sync`.
36. `[bloquant]` Cron `/etc/cron.d/badge-backup` pointe vers `/root/badge-ops/Makefile` (et non plus `/opt/badge/`).
37. `[bloquant]` Première exécution `make backup-prod` (v3-01 patché) post-Kamal-setup réussit : snapshot chiffré produit, poussé vers Hetzner, email reçu.

### G. Sécurité

38. `[bloquant]` Aucun secret n'est commité : `grep -rE '(NEXTAUTH_SECRET=|S3_SECRET_KEY=|MYSQL_ROOT_PASSWORD=)' --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" .` ne retourne aucune valeur (uniquement des références `${...}` ou exemples).
39. `[bloquant]` `.kamal/secrets` n'est pas dans `git ls-files`. Permissions `0600`.
40. `[bloquant]` Ports MinIO 9000 et 9001 NON exposés sur Internet. `curl -m 5 https://badge.bj:9000` et `curl -m 5 https://badge.bj:9001` timeout ou refusent. Le bloc `accessories.minio` n'a pas de `proxy:` ni de `host:` exposé.
41. `[bloquant]` Port MySQL 3306 NON exposé sur Internet (`accessories.mysql.port: "127.0.0.1:3306:3306"`).
42. `[bloquant]` phpMyAdmin protégé par Basic Auth via `proxy.basic_auth` dans `deploy.yml`. Test : `curl -I https://pma.badge.bj` → 401.
43. Le serveur de prod n'accepte plus de connexion SSH par mot de passe root (`PasswordAuthentication no` dans `/etc/ssh/sshd_config`). (À documenter / mettre en œuvre dans le runbook si pas déjà fait.)
44. `.kamal/secrets` du poste local sauvegardé dans un coffre externe (Bitwarden Secure Note ou équivalent).

### H. Documentation

45. `[bloquant]` Cette spec (`docs/v3/specs/2026-05-31-v3-02-deploiement-kamal.md`) commitée.
46. `[bloquant]` `docs/v2/features/deploiement-kamal.md` créée (doc fonctionnelle), référencée depuis `docs/v2/README.md`.
47. `[bloquant]` `docs/v2/operations/kamal-day-one.md` créée (runbook bascule jour J).
48. `[bloquant]` `docs/v2/operations/kamal-rollback.md` créée.
49. `[bloquant]` `docs/v2/README.md` à jour : v2-07 marqué "Superseded", v3-02 ajouté au tableau des sous-specs et plans.
50. `[bloquant]` `docs/v2/architecture.md` mentionne Kamal, kamal-proxy, et les 4 conteneurs prod.
51. `CLAUDE.md` racine : section "Stack technique" remplace "Caddy" par "kamal-proxy", section "Actions à risque" ajoute `kamal app remove`, `kamal accessory remove`, `kamal rollback` sur prod.

### I. Phase 2 (CI/CD GitHub Actions) — critères différés

Les critères Phase 2 sont documentés en annexe. **Ils ne sont pas bloquants pour la Phase 1**. Phase 1 est validable et exploitable en production sans aucun workflow GitHub Actions.

---

## Annexe — Phase 2 : bascule vers GitHub Actions (CI/CD)

**Quand l'activer** : quand 2-3 deploys Phase 1 ont validé que Kamal tourne correctement en prod, **et** qu'au moins un des besoins suivants émerge :

- Équipe : 2+ deployers, pas envie de mettre `.kamal/secrets` sur plusieurs postes.
- Audit centralisé : trace de qui a déployé quoi, quand.
- Deploy possible sans le dev principal (vacances, etc.).

**Ce qui change** : le `config/deploy.yml` reste identique. La construction de `.kamal/secrets` change : au lieu d'un fichier local, il est généré à la volée par un step CI à partir de GitHub Secrets. Les commandes `kamal deploy`, `kamal rollback` sont exécutées dans un runner Ubuntu plutôt que sur le poste du dev.

**Ce qui ne change pas** : le serveur de prod n'a aucune modification à recevoir. La même image Docker est buildée, le même `kamal deploy` est lancé.

### A.1 Pré-requis Phase 2

1. **Générer une clé SSH dédiée au runner CI** (ne pas réutiliser une clé personnelle) :

   ```bash
   ssh-keygen -t ed25519 -f deploy_ci_key -N "" -C "kamal-ci@badge.bj"
   ```

2. **Copier la clé publique sur le serveur** :

   ```bash
   cat deploy_ci_key.pub | ssh root@173.212.217.54 "cat >> ~/.ssh/authorized_keys"
   ```

3. **Récupérer `SSH_KNOWN_HOSTS`** :

   ```bash
   ssh-keyscan -H 173.212.217.54 > known_hosts
   ```

4. **Provisionner les GitHub Secrets** dans `Settings → Secrets and variables → Actions` du repo `tigamadou/investiture` :

| Secret | Description |
|---|---|
| `KAMAL_REGISTRY_PASSWORD` | PAT GitHub (scopes `write:packages` + `read:packages`) |
| `SSH_PRIVATE_KEY` | Contenu complet du fichier `deploy_ci_key` (privée, dédiée CI) |
| `SSH_KNOWN_HOSTS` | Sortie de `ssh-keyscan` ci-dessus |
| `MYSQL_ROOT_PASSWORD` | Reprise de la valeur du `.kamal/secrets` local |
| `DATABASE_URL` | `mysql://root:<MYSQL_ROOT_PASSWORD>@badge-mysql:3306/badge` |
| `MINIO_ROOT_USER` | Idem reprise |
| `MINIO_ROOT_PASSWORD` | Idem |
| `S3_ACCESS_KEY` | Idem (créée par `make minio-init-prod`) |
| `S3_SECRET_KEY` | Idem |
| `NEXTAUTH_SECRET` | Idem |
| `PLATFORM_SMTP_HOST` | Idem |
| `PLATFORM_SMTP_PORT` | Idem |
| `PLATFORM_SMTP_SECURE` | Idem |
| `PLATFORM_SMTP_USER` | Idem |
| `PLATFORM_SMTP_PASSWORD` | Idem |
| `PLATFORM_SMTP_FROM` | Idem |
| `RECAPTCHA_SECRET_KEY` | Idem |
| `SEED_SUPER_ADMIN_EMAIL` | Idem |
| `SEED_SUPER_ADMIN_PASSWORD` | Idem |
| `PHPMYADMIN_BASIC_AUTH_USER` | Idem |
| `PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH` | Idem |

5. **Shred la clé privée locale** après l'avoir mise dans GitHub Secrets :

   ```bash
   shred -u deploy_ci_key
   ```

### A.2 Workflow `.github/workflows/deploy.yml`

```yaml
name: deploy

on:
  workflow_dispatch:
    inputs:
      commit_sha:
        description: "SHA du commit a deployer (vide = HEAD)"
        required: false
        default: ""

concurrency:
  group: kamal-deploy-prod
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

jobs:
  deploy:
    runs-on: ubuntu-24.04
    timeout-minutes: 30

    env:
      KAMAL_REGISTRY_PASSWORD: ${{ secrets.KAMAL_REGISTRY_PASSWORD }}
      MYSQL_ROOT_PASSWORD: ${{ secrets.MYSQL_ROOT_PASSWORD }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      MINIO_ROOT_USER: ${{ secrets.MINIO_ROOT_USER }}
      MINIO_ROOT_PASSWORD: ${{ secrets.MINIO_ROOT_PASSWORD }}
      S3_ACCESS_KEY: ${{ secrets.S3_ACCESS_KEY }}
      S3_SECRET_KEY: ${{ secrets.S3_SECRET_KEY }}
      NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
      PLATFORM_SMTP_HOST: ${{ secrets.PLATFORM_SMTP_HOST }}
      PLATFORM_SMTP_PORT: ${{ secrets.PLATFORM_SMTP_PORT }}
      PLATFORM_SMTP_SECURE: ${{ secrets.PLATFORM_SMTP_SECURE }}
      PLATFORM_SMTP_USER: ${{ secrets.PLATFORM_SMTP_USER }}
      PLATFORM_SMTP_PASSWORD: ${{ secrets.PLATFORM_SMTP_PASSWORD }}
      PLATFORM_SMTP_FROM: ${{ secrets.PLATFORM_SMTP_FROM }}
      RECAPTCHA_SECRET_KEY: ${{ secrets.RECAPTCHA_SECRET_KEY }}
      SEED_SUPER_ADMIN_EMAIL: ${{ secrets.SEED_SUPER_ADMIN_EMAIL }}
      SEED_SUPER_ADMIN_PASSWORD: ${{ secrets.SEED_SUPER_ADMIN_PASSWORD }}
      PHPMYADMIN_BASIC_AUTH_USER: ${{ secrets.PHPMYADMIN_BASIC_AUTH_USER }}
      PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH: ${{ secrets.PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH }}

    steps:
      - name: Resolve commit ref
        id: ref
        run: |
          if [ -n "${{ inputs.commit_sha }}" ]; then
            echo "ref=${{ inputs.commit_sha }}" >> "$GITHUB_OUTPUT"
          else
            echo "ref=${{ github.sha }}" >> "$GITHUB_OUTPUT"
          fi

      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ steps.ref.outputs.ref }}
          fetch-depth: 0

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: "3.3"

      - name: Install Kamal
        run: gem install kamal -v "~> 2.5"

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Configure SSH known_hosts
        run: |
          mkdir -p ~/.ssh && chmod 700 ~/.ssh
          printf '%s\n' "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Write .kamal/secrets
        run: |
          mkdir -p .kamal
          umask 077
          cat > .kamal/secrets <<'EOF'
          KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
          MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
          DATABASE_URL=$DATABASE_URL
          MINIO_ROOT_USER=$MINIO_ROOT_USER
          MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
          S3_ACCESS_KEY=$S3_ACCESS_KEY
          S3_SECRET_KEY=$S3_SECRET_KEY
          NEXTAUTH_SECRET=$NEXTAUTH_SECRET
          PLATFORM_SMTP_HOST=$PLATFORM_SMTP_HOST
          PLATFORM_SMTP_PORT=$PLATFORM_SMTP_PORT
          PLATFORM_SMTP_SECURE=$PLATFORM_SMTP_SECURE
          PLATFORM_SMTP_USER=$PLATFORM_SMTP_USER
          PLATFORM_SMTP_PASSWORD=$PLATFORM_SMTP_PASSWORD
          PLATFORM_SMTP_FROM=$PLATFORM_SMTP_FROM
          RECAPTCHA_SECRET_KEY=$RECAPTCHA_SECRET_KEY
          SEED_SUPER_ADMIN_EMAIL=$SEED_SUPER_ADMIN_EMAIL
          SEED_SUPER_ADMIN_PASSWORD=$SEED_SUPER_ADMIN_PASSWORD
          PHPMYADMIN_BASIC_AUTH_USER=$PHPMYADMIN_BASIC_AUTH_USER
          PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH=$PHPMYADMIN_BASIC_AUTH_PASSWORD_HASH
          EOF

      - name: Kamal deploy
        id: deploy
        run: kamal deploy --version "${{ steps.ref.outputs.ref }}"

      - name: Sync ops scripts to server
        if: success()
        run: |
          ssh root@173.212.217.54 "mkdir -p /root/badge-ops/{scripts,ops,config}"
          rsync -avz --delete scripts/ root@173.212.217.54:/root/badge-ops/scripts/
          rsync -avz --delete ops/ root@173.212.217.54:/root/badge-ops/ops/
          rsync -avz ops/Makefile-ops root@173.212.217.54:/root/badge-ops/Makefile
          rsync -avz config/deploy.yml root@173.212.217.54:/root/badge-ops/config/deploy.yml
          ssh root@173.212.217.54 "chmod 700 /root/badge-ops && chmod 700 /root/badge-ops/scripts/*.sh"

      - name: Tail Kamal logs on failure
        if: failure() && steps.deploy.conclusion == 'failure'
        run: |
          echo "::group::Kamal app logs"
          kamal app logs --lines 200 || true
          echo "::endgroup::"

      - name: Cleanup secrets
        if: always()
        run: shred -u .kamal/secrets || rm -f .kamal/secrets
```

### A.3 Workflow `.github/workflows/rollback.yml`

```yaml
name: rollback

on:
  workflow_dispatch:
    inputs:
      target_version:
        description: "Version a restaurer (SHA git ou tag deja sur GHCR)"
        required: true

concurrency:
  group: kamal-deploy-prod
  cancel-in-progress: false

permissions:
  contents: read
  packages: read

jobs:
  rollback:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    env:
      # ...mêmes env: que deploy.yml...

    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with: { ruby-version: "3.3" }
      - name: Install Kamal
        run: gem install kamal -v "~> 2.5"
      - name: Login to GHCR
        uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - name: Setup SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with: { ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }} }
      - name: Configure SSH known_hosts
        run: |
          mkdir -p ~/.ssh && chmod 700 ~/.ssh
          printf '%s\n' "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
      - name: Write .kamal/secrets
        run: |
          # ...même bloc que deploy.yml...
      - name: Verify image exists on GHCR
        run: docker manifest inspect ghcr.io/tigamadou/badge:${{ inputs.target_version }} > /dev/null
      - name: Kamal rollback
        run: kamal rollback "${{ inputs.target_version }}"
      - name: Cleanup secrets
        if: always()
        run: shred -u .kamal/secrets || rm -f .kamal/secrets
```

### A.4 Workflow `.github/workflows/setup.yml` (one-shot bootstrap)

À utiliser **une seule fois** (premier déploiement) ou après reprovisionnement complet du serveur. Garde-fou : input `confirm` à taper littéralement.

```yaml
name: setup

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "Tapez 'I-UNDERSTAND-THIS-IS-FIRST-DEPLOY' pour confirmer"
        required: true

# ...mêmes concurrency, permissions, env, steps que deploy.yml...
# Différence : la commande exécutée est `kamal setup` au lieu de `kamal deploy`.

    steps:
      - name: Guard
        run: |
          if [ "${{ inputs.confirm }}" != "I-UNDERSTAND-THIS-IS-FIRST-DEPLOY" ]; then
            echo "Confirmation incorrecte." && exit 1
          fi
      # ...checkout, ruby, kamal, ghcr login, ssh, secrets...
      - name: Kamal setup
        run: kamal setup --version "${{ github.sha }}"
```

### A.5 Critères d'acceptation Phase 2

| # | Critère | Bloquant |
|---|---|---|
| P2.1 | 3 workflows existent : `deploy.yml`, `setup.yml`, `rollback.yml` | oui |
| P2.2 | Chaque workflow déclare `on: workflow_dispatch:` uniquement (pas de push, pas de schedule) | oui |
| P2.3 | `concurrency.group: kamal-deploy-prod` partagé entre les 3 workflows | oui |
| P2.4 | En cas d'échec, step `if: failure()` qui dump `kamal app logs --lines 200` | oui |
| P2.5 | 22 GitHub Secrets de la liste A.1 présents | oui |
| P2.6 | Clé SSH CI dédiée (distincte des clés personnelles), commentaire `kamal-ci@badge.bj` dans `authorized_keys` | oui |
| P2.7 | `Cleanup secrets` step `if: always()` qui shred `.kamal/secrets` | oui |
| P2.8 | Step `Sync ops scripts to server` ajouté à `deploy.yml` (remplace `make ops-sync` manuel) | oui |
| P2.9 | Workflow `setup.yml` exige `confirm: I-UNDERSTAND-THIS-IS-FIRST-DEPLOY` | oui |
| P2.10 | `rollback.yml` vérifie l'existence de l'image avant `kamal rollback` (`docker manifest inspect`) | oui |
| P2.11 | Badge de statut `deploy.yml` ajouté au `README.md` | non |
| P2.12 | Documentation mise à jour : `docs/v2/operations/kamal-cicd.md` créée, runbook équipe (qui peut déclencher quoi) | oui |

### A.6 Migration Phase 1 → Phase 2

1. Garder Phase 1 active (le dev principal peut toujours `kamal deploy` depuis son poste).
2. Provisionner les GitHub Secrets (cf A.1).
3. Committer les 3 workflows.
4. Lancer manuellement `deploy.yml` depuis l'onglet Actions, comparer le résultat avec un `kamal deploy` local fait avant.
5. Si OK pendant 2-3 itérations : annoncer à l'équipe que les déploiements passent désormais par GitHub Actions, retirer `.kamal/secrets` des postes personnels (les conserver chiffrés dans le coffre comme backup).
6. Documenter dans `docs/v2/operations/kamal-cicd.md` qui a le droit de lancer quel workflow.

---

## Décisions hors-scope (renvois)

| Sujet | Renvoyé à |
|---|---|
| Logs centralisés (Loki, Graylog, Better Stack) | Spec future v3-03 |
| Queue de jobs asynchrones (envoi mail, génération PDF) | Spec future v2-11 |
| Healthcheck profond (`/api/health/deep` qui check DB + MinIO) | Évolution v3-02 lite ; à activer si on observe des cas de "Next 200 / BDD down" en prod |
| Multi-host (Kamal supporte nativement, ajout simple à `servers.web.hosts`) | Non planifié (mono-serveur suffit). Bascule triviale le jour venu. |
| Migration vers Kubernetes managé | Non planifié. Justifié uniquement à partir de 100+ orgs ou multi-zone obligatoire. |
| Custom domain par organisation | Non planifié (déjà hors-scope dans le master design). |
| Console MinIO exposée publiquement (sous-domaine Caddy/Kamal-Proxy IP-restreint) | Non planifié. Tunnel SSH suffisant. |
| Utilisateur SSH `deploy` avec sudo limité (au lieu de `root` direct) | Reporté. Changement transverse à v2-07 et v3-01. |

## Dépendances

- **Spec v2-01** (Multi-tenancy & RBAC) : aucune dépendance directe, mais l'app multi-tenant repose dessus.
- **Spec v2-06** (Notifications email) : les variables `PLATFORM_SMTP_*` injectées via Kamal sont définies ici.
- **Spec v2-07** (Déploiement initial) : **superseded** par v3-02. Plan conservé pour traçabilité, marqué obsolète.
- **Spec v3-01** (Stockage S3 + backups) : patches mineurs aux scripts shell décrits Section 5.B. La spec v3-01 reste valide ; seules les commandes `docker compose exec` deviennent `docker exec badge-*` et le workdir passe de `/opt/badge` à `/root/badge-ops`.

## Suivi

- Brainstorming : 2026-05-31
- Spec rédigée (multi-agent) : 2026-05-31
- Self-review : à venir
- Validation utilisateur : à venir
- Plan d'implémentation (writing-plans) : à venir
- Phase 1 mise en prod : à planifier
- Phase 2 (CI/CD) : à activer après stabilisation Phase 1



