# Installation et deploiement

## Prerequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose
- Ou bien : Node.js 22+, Yarn (via `corepack enable`), MySQL 8

## Variables d'environnement

Creer un fichier `.env` a la racine du projet :

```env
# Base de donnees
DATABASE_URL=mysql://root:<MOT_DE_PASSE>@mysql:3306/badge

# Authentification
NEXTAUTH_SECRET=<CLE_SECRETE>       # Generer avec: openssl rand -base64 32
NEXTAUTH_URL=https://<VOTRE_DOMAINE>
BASE_URL=https://<VOTRE_DOMAINE>    # Fallback de NEXTAUTH_URL utilise dans les liens emails

# reCAPTCHA v3 (optionnel : valeurs par defaut surchargees par les Settings BDD)
RECAPTCHA_SITE_KEY=<CLE_SITE>
RECAPTCHA_SECRET_KEY=<CLE_SECRETE>

# SMTP (optionnel : surcharge par les Settings BDD)
SMTP_HOST=<HOTE_SMTP>
SMTP_PORT=<PORT_SMTP>               # Defaut 587
SMTP_FROM=<EMAIL_EXPEDITEUR>        # Defaut noreply@badge.local
SMTP_USER=<UTILISATEUR_SMTP>        # Authentification SMTP (optionnel)
SMTP_PASSWORD=<MOT_DE_PASSE_SMTP>   # Authentification SMTP (optionnel)

# Compte administrateur initial (seed)
SEED_ADMIN_EMAIL=<EMAIL_ADMIN>
SEED_ADMIN_PASSWORD=<MOT_DE_PASSE_ADMIN>
```

Ne reutilisez jamais les valeurs par defaut en production.

### Precedence des configurations

Pour SMTP et reCAPTCHA, les valeurs stockees dans la table `Settings` (configurables depuis `/admin/settings`) prennent precedence sur les variables d'environnement. Les variables d'environnement servent de valeurs initiales au premier demarrage et de filet de secours si la BDD est vide.

### Dependance reseau : Google Fonts (Montserrat)

La generation des PDF de badge (`@react-pdf/renderer`) charge la police Montserrat depuis Google Fonts (`https://fonts.googleapis.com/`). Le serveur applicatif doit disposer d'un acces sortant vers ce domaine pour produire les PDF. En cas d'environnement hors-ligne, prevoir une mise en cache locale ou un fournisseur de police alternatif.

## Deploiement Docker (production)

```bash
docker compose up -d --build
```

Services demarres :

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Application Next.js |
| mysql | 3306 | Base de donnees MySQL 8 |
| caddy | 80, 443 | Reverse proxy HTTPS |
| phpmyadmin | -- | Interface admin BDD (via Caddy) |

L'application attend que MySQL soit operationnel (healthcheck) avant de demarrer. Le script `docker-entrypoint.sh` execute `prisma db push` puis lance le serveur Node.

### Configuration Caddy

Le fichier `Caddyfile` a la racine configure le reverse proxy. Par defaut, il est configure pour le domaine `badge.bj`.

## Deploiement Docker (developpement)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Next.js avec hot reload |
| mysql | 3306 | Base de donnees MySQL |
| phpmyadmin | 8080 | Interface admin BDD |
| mailpit | 8025 | Interface de capture d'emails |

Le code source est monte en volume pour le hot reload. Mailpit intercepte tous les emails envoyes sur le port 1025.

## Deploiement sans Docker

### Installation

```bash
# Activer Corepack (pour Yarn)
corepack enable

# Installer les dependances
yarn install

# Copier la configuration
cp .env .env.local
# Editer .env.local avec vos valeurs (adapter DATABASE_URL au host reel)
```

### Build et lancement

```bash
# Generer le client Prisma
yarn prisma generate

# Appliquer les migrations
yarn prisma migrate deploy

# (Optionnel) Initialiser les donnees
yarn prisma db seed

# Construire l'application
yarn build

# Lancer en production
yarn start
```

L'application ecoute sur le port 3000. Utiliser un reverse proxy (Nginx, Caddy) pour exposer en HTTPS.

### Exemple de configuration Nginx

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Commandes Makefile

### Developpement

| Commande | Description |
|----------|-------------|
| `make dev` | Demarrer l'environnement de dev |
| `make dev-build` | Reconstruire les conteneurs dev |
| `make dev-down` | Arreter l'environnement de dev |
| `make logs` | Voir les logs des conteneurs dev |
| `make db-push` | Appliquer le schema Prisma |
| `make db-seed` | Initialiser les donnees |
| `make db-studio` | Lancer Prisma Studio |
| `make db-reset` | Reinitialiser la base |
| `make test` | Lancer les tests |
| `make lint` | Lancer le linter |
| `make typecheck` | Verifier les types TypeScript |

### Production

| Commande | Description |
|----------|-------------|
| `make prod` | Demarrer en production |
| `make prod-build` | Reconstruire les conteneurs prod |
| `make prod-down` | Arreter la production |
| `make prod-logs` | Voir les logs prod |
| `make prod-seed` | Lancer le seed en production |
| `make deploy` | Deployer sur le serveur (rsync + rebuild) |
