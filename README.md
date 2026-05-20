# Investiture

Systeme de gestion de badges pour la ceremonie d'investiture du President de la Republique du Benin. L'application gere l'inscription des participants, l'approbation administrative, la generation de badges PDF avec QR codes, et le controle d'acces par scan.

## Fonctionnalites principales

- **Inscription publique** -- Formulaire en ligne avec reCAPTCHA pour les participants
- **Gestion des inscriptions** -- Approbation/rejet par les administrateurs avec notifications email
- **Generation de badges PDF** -- Badges 100x140mm avec QR code, photo, informations evenement
- **Scan QR** -- Controle d'acces en temps reel aux points d'entree via camera
- **Gestion des categories** -- Organisation des participants par categorie (securite, protocole, presse, etc.)
- **Gestion des utilisateurs** -- Systeme de roles (Operateur, Administrateur, Super Administrateur)
- **Notifications email** -- Emails transactionnels a chaque etape du cycle de vie

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Langage | TypeScript |
| ORM | Prisma 6 |
| Base de donnees | MySQL 8 |
| Authentification | NextAuth.js (JWT) |
| PDF | @react-pdf/renderer |
| QR Code | qrcode, html5-qrcode |
| Email | nodemailer |

## Demarrage rapide

### Prerequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose

### Lancer en developpement

```bash
# Cloner le projet et configurer l'environnement
cp .env .env.local   # Editer avec vos valeurs

# Demarrer les services
make dev
```

Services disponibles :

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Next.js (hot reload) |
| mysql | 3306 | Base de donnees MySQL |
| phpmyadmin | 8080 | Interface admin BDD |
| mailpit | 8025 | Capture d'emails |

### Lancer en production

```bash
docker compose up -d --build
```

### Sans Docker

```bash
corepack enable
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn prisma db seed    # Optionnel : donnees initiales
yarn build
yarn start
```

## Variables d'environnement

```env
DATABASE_URL=mysql://root:<MOT_DE_PASSE>@mysql:3306/investiture
NEXTAUTH_SECRET=<CLE_SECRETE>           # openssl rand -base64 32
NEXTAUTH_URL=https://<VOTRE_DOMAINE>
RECAPTCHA_SITE_KEY=<CLE_SITE>
RECAPTCHA_SECRET_KEY=<CLE_SECRETE>
SMTP_HOST=<HOTE_SMTP>
SMTP_PORT=<PORT_SMTP>
SMTP_FROM=<EMAIL_EXPEDITEUR>
SEED_ADMIN_EMAIL=<EMAIL_ADMIN>
SEED_ADMIN_PASSWORD=<MOT_DE_PASSE_ADMIN>
```

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `make dev` | Demarrer en developpement |
| `make prod` | Demarrer en production |
| `make deploy` | Deployer sur le serveur |
| `make db-push` | Appliquer le schema Prisma |
| `make db-seed` | Initialiser les donnees |
| `make test` | Lancer les tests |
| `make lint` | Lancer le linter |

## Documentation

La documentation complete est disponible dans le dossier [`docs/`](docs/README.md) :

- [Architecture technique](docs/architecture.md)
- [Installation et deploiement](docs/installation.md)
- [Base de donnees](docs/base-de-donnees.md)
- [Reference API](docs/api/README.md)
- [Specifications par feature](docs/features/)
- [Guide utilisateur](docs/guide-utilisateur/README.md)
