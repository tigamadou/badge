# Architecture technique

## Vue d'ensemble

L'application est une application web monolithique construite avec Next.js (App Router). Elle fournit a la fois le front-end (pages React) et le back-end (API Routes) dans un seul deployable. La base de donnees MySQL est accedee via Prisma ORM. L'authentification repose sur NextAuth.js avec sessions JWT.

## Stack technologique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 16.x |
| Runtime | Node.js | 22+ |
| UI | React | 19.x |
| Langage | TypeScript | 5.x |
| CSS | Tailwind CSS | 4.x |
| ORM | Prisma | 6.x |
| Base de donnees | MySQL | 8.x |
| Authentification | NextAuth.js (Credentials, JWT) | 4.x |
| PDF | @react-pdf/renderer | 4.x |
| QR Code | qrcode + html5-qrcode | 1.x / 2.x |
| Email | nodemailer | 6.x |
| Hachage | bcryptjs | 2.x |
| CAPTCHA | react-google-recaptcha (v3) | 3.x |
| Tests | Vitest | 4.x |
| Package manager | Yarn (via Corepack) | -- |

## Structure du projet

```
src/
  app/
    api/                    # Routes API REST
      auth/[...nextauth]/   # Authentification NextAuth
      registrations/        # CRUD inscriptions + batch print
      users/                # CRUD utilisateurs
      teams/                # CRUD categories
      scan/                 # Enregistrement de scans
      activity-logs/        # Journal d'activite
      event/                # Configuration evenement
      settings/             # Parametres SMTP/contact
      upload/               # Upload de fichiers
      files/[...path]/      # Serving de fichiers
      verify/[id]/          # Verification publique de badge
      profile/              # Profil utilisateur
      setup-password/       # Setup mot de passe (invitation)
    admin/                  # Pages du panneau d'administration
      registrations/        # Liste, detail, creation
      badges/               # Liste et detail badges
      users/                # Gestion utilisateurs
      categories/           # Gestion categories
      teams/                # (ancien, redirige vers categories)
      event/                # Configuration evenement
      settings/             # Parametres systeme
      activity-logs/        # Journal d'activite
      profile/              # Profil personnel
    scan/                   # Page scanner QR
    register/               # Page succes inscription
    login/                  # Page de connexion
    verify/[id]/            # Page verification badge
    setup-password/         # Page setup mot de passe
    badge/[id]/             # Page badge (rendu)
    badge-preview/[id]/     # Preview badge
  components/
    ui/                     # Composants generiques (Button, Input, Modal, Table, Select, StatusBadge)
    admin/                  # Composants admin (AdminShell, Sidebar, Header, formulaires)
    badge/                  # Composants badge (BadgeDocument, BadgePreview, BadgeDownload, BadgeWebPreview)
  lib/
    prisma.ts               # Client Prisma (singleton)
    activity-log.ts         # Journalisation des actions
    auth.ts                 # Configuration NextAuth
    mail.ts                 # Envoi d'emails (nodemailer)
    storage.ts              # Stockage fichiers local
    generate-id.ts          # Generation d'identifiants de badge
    qrcode.ts               # Generation de QR codes
    format-date.ts          # Formatage de dates en francais
  types/
    index.ts                # Types TypeScript partages
    next-auth.d.ts          # Extension types NextAuth (role dans session)
prisma/
  schema.prisma             # Schema de base de donnees
  seed.ts                   # Donnees initiales
  migrations/               # Migrations SQL
```

## Flux de donnees principaux

### Inscription publique

```
Visiteur -> Page d'accueil (formulaire)
  -> Upload photo + document (POST /api/upload)
  -> Soumission (POST /api/registrations)
    -> Validation reCAPTCHA
    -> Generation ID unique
    -> Sauvegarde en BDD (status: PENDING)
    -> Envoi email de confirmation
  -> Redirection /register/success
```

### Approbation d'une inscription

```
Admin -> Liste inscriptions (/admin/registrations)
  -> Clic Approuver/Rejeter
  -> PATCH /api/registrations/[id] (status: APPROVED | REJECTED)
    -> Mise a jour BDD
    -> Envoi email de notification au participant
```

### Generation et impression de badge

```
Admin -> Liste badges (/admin/badges)
  -> Clic sur un badge -> Detail (/admin/badges/[id])
    -> Apercu PDF en temps reel (BadgePreview / @react-pdf/renderer)
    -> Toggle ALL ACCESS (optionnel)
    -> Telecharger PDF (BadgeDownload)
    -> Marquer comme imprime
      -> PATCH /api/registrations/[id] (badgePrinted: true)
      -> Envoi email notification avec infos de recuperation
```

### Scan QR aux points de controle

```
Operateur -> Scanner (/scan)
  -> Camera lit QR code du badge
  -> POST /api/scan (registrationId)
    -> Creation ScanLog
    -> Retour infos inscription + team
  -> Affichage resultat (vert = valide, rouge = invalide)
```

## Securite

### Authentification

- Provider: Credentials (email + mot de passe)
- Sessions: JWT (pas de session serveur)
- Mots de passe: haches avec bcrypt (12 rounds)
- Longueur minimale: 6 caracteres

### Controle d'acces (RBAC)

Trois roles hierarchiques :

| Role | Niveau | Acces |
|------|--------|-------|
| OPERATOR | 1 | Inscriptions (lecture), badges, scanner, historique scans |
| ADMIN | 2 | + Categories, evenement, parametres |
| SUPER_ADMIN | 3 | + Gestion des utilisateurs |

Le middleware Next.js (`src/middleware.ts`) protege les routes `/admin/*` et `/scan` en verifiant la presence d'un token JWT valide. Chaque route API verifie en plus le role minimum requis.

### Protection anti-bot

Le formulaire d'inscription publique est protege par Google reCAPTCHA v3. Les inscriptions creees par un administrateur ne necessitent pas de CAPTCHA.

## Stockage de fichiers

Les fichiers (photos, documents d'identite, logos) sont stockes localement dans le repertoire `/uploads` a la racine du projet.

- Taille maximale : 5 Mo
- Types acceptes : JPEG, PNG, WebP, PDF
- Acces : route publique `GET /api/files/[...path]` avec cache HTTP de 1 heure
- Structure : `uploads/logos/`, `uploads/photos/`, `uploads/documents/`

## Infrastructure

### Production

- **Caddy** : reverse proxy HTTPS, gere les certificats TLS automatiquement
- **Node.js** : Next.js en mode standalone (output: "standalone")
- **MySQL 8** : base de donnees avec healthcheck
- **phpMyAdmin** : interface d'administration BDD

Le Dockerfile utilise un build multi-stage (deps -> builder -> runner) pour optimiser la taille de l'image.

### Developpement

- **Next.js** : mode dev avec hot reload (volumes montes)
- **MySQL 8** : port 3306 expose
- **phpMyAdmin** : port 8080
- **Mailpit** : capture d'emails, port 8025 (web) et 1025 (SMTP)
