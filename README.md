# investiture

## Déploiement

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/install/) installés sur le serveur

### Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
DATABASE_URL=mysql://root:<MOT_DE_PASSE>@mysql:3306/investiture
NEXTAUTH_SECRET=<CLÉ_SECRÈTE>
NEXTAUTH_URL=https://<VOTRE_DOMAINE>
RECAPTCHA_SITE_KEY=<CLÉ_SITE_RECAPTCHA>
RECAPTCHA_SECRET_KEY=<CLÉ_SECRÈTE_RECAPTCHA>
SMTP_HOST=<HÔTE_SMTP>
SMTP_PORT=<PORT_SMTP>
SMTP_FROM=<EMAIL_EXPÉDITEUR>
SEED_ADMIN_EMAIL=<EMAIL_ADMIN>
SEED_ADMIN_PASSWORD=<MOT_DE_PASSE_ADMIN>
```

> **Important :** Ne réutilisez jamais les valeurs par défaut en production. Générez un `NEXTAUTH_SECRET` aléatoire (ex : `openssl rand -base64 32`).

### Déploiement en production

```bash
docker compose up -d --build
```

Cela démarre deux services :

- **app** — L'application Next.js sur le port `3000`
- **mysql** — Base de données MySQL 8

L'application attend que MySQL soit opérationnel (healthcheck) avant de démarrer.

### Déploiement en développement

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Services supplémentaires disponibles en développement :

| Service      | Port  | Description                    |
|--------------|-------|--------------------------------|
| app          | 3000  | Next.js (hot reload)           |
| mysql        | 3306  | Base de données MySQL          |
| phpmyadmin   | 8080  | Interface d'administration BDD |
| mailpit      | 8025  | Interface de capture d'emails  |

### Déploiement sans Docker

#### Prérequis

- [Node.js](https://nodejs.org/) 22+
- [Yarn](https://yarnpkg.com/) (via corepack : `corepack enable`)
- Une base de données MySQL 8 accessible
- Un serveur SMTP pour l'envoi d'emails

#### Installation

```bash
# Installer les dépendances
yarn install

# Configurer les variables d'environnement
cp .env .env.local
```

Éditez `.env.local` avec vos valeurs de production (voir la section [Variables d'environnement](#variables-denvironnement)). Adaptez `DATABASE_URL` pour pointer vers votre serveur MySQL (remplacez `mysql` par le host réel).

#### Build et lancement

```bash
# Générer le client Prisma
yarn prisma generate

# Appliquer les migrations
yarn prisma migrate deploy

# (Optionnel) Initialiser les données
yarn prisma db seed

# Construire l'application
yarn build

# Lancer en production
yarn start
```

L'application écoute par défaut sur le port `3000`. Utilisez un reverse proxy (Nginx, Caddy, etc.) pour exposer l'application en HTTPS.

#### Exemple de configuration Nginx

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

### Commandes utiles

```bash
# Voir les logs
docker compose logs -f

# Arrêter les services
docker compose down

# Reconstruire après modification
docker compose up -d --build

# Accéder au conteneur de l'application
docker compose exec app sh

# Exécuter les migrations Prisma
docker compose exec app yarn prisma migrate deploy

# Initialiser les données (seed)
docker compose exec app yarn prisma db seed
```
