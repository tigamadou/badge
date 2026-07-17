# Badge

Systeme generique de gestion de badges pour evenements. L'application gere l'inscription des participants, l'approbation administrative, la generation de badges PDF avec QR codes, et le controle d'acces par scan.

## Fonctionnalites principales

- **Inscription publique** -- Formulaire en ligne avec reCAPTCHA pour les participants, lien d'edition apres rejet (48h)
- **Gestion des inscriptions** -- Approbation/rejet par les moderateurs, detection de doublons, blocage email/document, notifications email
- **Generation de badges PDF** -- Badges 100x140mm avec QR code, photo, informations evenement (variante anonyme sans details personnels)
- **Scan QR** -- Controle d'acces en temps reel aux points d'entree via camera
- **Gestion des categories** -- Organisation des participants par categorie (securite, protocole, presse, etc.), avec options anonyme et badge neutre
- **Gestion des utilisateurs** -- Systeme de roles a 4 niveaux (Operateur, Moderateur, Administrateur, Super Administrateur)
- **Notifications email** -- Emails transactionnels a chaque etape du cycle de vie
- **Journal d'activite** -- Audit trail complet (inscriptions, badges, scans, utilisateurs, configuration) avec IP et user-agent

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

| Service | Port direct | URL via Caddy (HTTPS) | Description |
|---------|-------------|-----------------------|-------------|
| app | 3785 | https://badge.local | Next.js (hot reload) |
| mysql | 33060 | -- | Base de donnees MySQL |
| phpmyadmin | 8080 | https://pma.badge.local | Interface admin BDD |
| mailpit | 8025 | https://mail.badge.local | Capture d'emails |
| caddy | 80 / 443 | -- | Reverse proxy dev HTTPS (routes les sous-domaines `*.badge.local`, redirige http vers https) |

**Activer les URLs `*.badge.local`** : ajouter une seule ligne au `/etc/hosts` de la machine hote (sudo requis, a faire une seule fois) :

```bash
echo "127.0.0.1 badge.local pma.badge.local mail.badge.local" | sudo tee -a /etc/hosts
```

**Faire confiance a la CA locale de Caddy (HTTPS en dev)** : Caddy sert les
sous-domaines `*.badge.local` en HTTPS via sa CA interne (`tls internal`). Pour
eviter l'avertissement du navigateur, importer et approuver la racine une seule
fois sur la machine hote :

```bash
# Extraire la racine CA du conteneur caddy
docker compose -f docker-compose.dev.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
# macOS : ajouter au trousseau Systeme et marquer "Toujours approuver"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./caddy-root.crt
rm caddy-root.crt
```

Les ports directs (`localhost:3785`, `localhost:8080`, `localhost:8025`) restent exposes en parallele : aucun outil pointant vers `localhost` n'est casse.

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
DATABASE_URL=mysql://root:<MOT_DE_PASSE>@mysql:3306/badge
NEXTAUTH_SECRET=<CLE_SECRETE>           # openssl rand -base64 32
NEXTAUTH_URL=https://<VOTRE_DOMAINE>
BASE_URL=https://<VOTRE_DOMAINE>        # Fallback NEXTAUTH_URL (liens dans emails)
RECAPTCHA_SITE_KEY=<CLE_SITE>           # Optionnel : peut etre configure en BDD
RECAPTCHA_SECRET_KEY=<CLE_SECRETE>      # Optionnel : peut etre configure en BDD
SMTP_HOST=<HOTE_SMTP>                   # Optionnel : fallback si pas en BDD
SMTP_PORT=<PORT_SMTP>                   # Optionnel : defaut 587
SMTP_FROM=<EMAIL_EXPEDITEUR>            # Defaut : noreply@badge.local
SMTP_USER=<UTILISATEUR_SMTP>            # Optionnel : authentification SMTP
SMTP_PASSWORD=<MOT_DE_PASSE_SMTP>       # Optionnel : authentification SMTP
SEED_ADMIN_EMAIL=<EMAIL_ADMIN>
SEED_ADMIN_PASSWORD=<MOT_DE_PASSE_ADMIN>
```

> Les parametres SMTP et reCAPTCHA configurables dans l'interface (`/admin/settings`) prennent precedence sur les variables d'environnement. Ces dernieres servent de valeurs par defaut au premier demarrage.

> Le rendu PDF des badges utilise la police Montserrat via Google Fonts. La generation requiert un acces sortant vers `fonts.googleapis.com`.

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `make dev` | Demarrer en developpement |
| `make prod` | Demarrer en production |
| `make deploy` | Deployer sur le serveur |
| `make db-push` | Appliquer le schema Prisma |
| `make db-seed` | Seed minimal (4 staff + 1 participant historique) |
| `make db-seed-demo` | Seed demonstration (10 orgs, 30 events, 200 participants) -- dev uniquement |
| `make test` | Lancer les tests |
| `make lint` | Lancer le linter |

## Documentation

La documentation est versionnee. Voir l'[index](docs/README.md) pour choisir
votre version.

**Version courante (v4, en construction)** :

- [Plan de refonte globale v4](docs/v4/plans/2026-07-17-v4-refonte-globale.md)
- [Installation (dont HTTPS local)](docs/v4/installation.md)
- [Spec stockage S3/MinIO](docs/v4/specs/2026-05-31-v4-stockage-s3-et-backups.md)
