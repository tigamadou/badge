# Spec : Admin, Inscriptions & Configuration -- Investiture

**Date** : 5 mai 2026
**Statut** : Approuve

---

## 1. Objectif

Ajouter les modules manquants a l'application de generation de badges : authentification multi-roles, gestion des inscriptions (publique et admin), configuration de l'evenement, gestion des equipes et des utilisateurs, stockage des fichiers (photos, logo) et notifications par email.

## 2. Stack technique (ajouts)

| Composant | Technologie |
|-----------|------------|
| Base de donnees | MySQL 8 |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials, JWT) |
| Hash mots de passe | bcryptjs |
| Stockage fichiers | MinIO (S3-compatible) via @aws-sdk/client-s3 |
| CSS | Tailwind CSS |
| CAPTCHA | react-google-recaptcha |
| Email | nodemailer |
| Email dev | Mailpit (SMTP port 1025, web port 8025) |
| Admin DB | phpMyAdmin (port 8080) |

## 3. Services Docker (ajouts au docker-compose)

| Service | Image | Ports | Description |
|---------|-------|-------|-------------|
| mysql | mysql:8 | 3306 | Base de donnees, volume persistant |
| phpmyadmin | phpmyadmin | 8080 | Interface admin DB |
| minio | minio/minio | 9000 (API), 9001 (console) | Stockage S3, volume persistant |
| minio-init | minio/mc | - | Creation automatique du bucket `investiture` |
| mailpit | axllent/mailpit | 1025 (SMTP), 8025 (web) | Interception des mails en dev |

## 4. Variables d'environnement

```
DATABASE_URL=mysql://root:password@mysql:3306/investiture
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=investiture
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000
RECAPTCHA_SITE_KEY=<key>
RECAPTCHA_SECRET_KEY=<secret>
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@investiture.local
```

## 5. Modele de donnees (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(OPERATOR)
  createdAt DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  ADMIN
  OPERATOR
}

model Event {
  id       String  @id @default(cuid())
  title    String
  location String
  date     String
  logo     String?
}

model Team {
  id            String         @id @default(cuid())
  name          String
  color         String
  registrations Registration[]
}

model Registration {
  id        String             @id
  email     String
  fullName  String
  structure String
  photo     String?
  status    RegistrationStatus @default(PENDING)
  teamId    String
  team      Team               @relation(fields: [teamId], references: [id])
  createdAt DateTime           @default(now())
}

enum RegistrationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Le champ `id` de `Registration` est genere par la fonction `generateId()` existante.

Un seed Prisma cree un super-admin par defaut et un evenement initial.

## 6. Authentification & Roles

NextAuth.js avec le provider Credentials (email + mot de passe hash bcrypt). Session JWT avec le role inclus dans le token.

### Permissions par role

| Action | SUPER_ADMIN | ADMIN | OPERATOR |
|--------|:-----------:|:-----:|:--------:|
| Gerer les utilisateurs | oui | non | non |
| Configurer l'evenement | oui | oui | non |
| Gerer les equipes (CRUD) | oui | oui | non |
| Voir les inscriptions | oui | oui | oui |
| Creer une inscription | oui | oui | oui |
| Valider / rejeter | oui | oui | oui |
| Generer / telecharger badge | oui | oui | oui |

Un middleware Next.js protege les routes `/admin/*` et redirige vers `/login` si non authentifie. Une fonction `requireRole(session, minimumRole)` verifie les permissions dans les API Routes.

## 7. Notifications email

| Declencheur | Destinataire | Contenu |
|-------------|-------------|---------|
| Nouvelle inscription | L'inscrit (email) | Confirmation de reception, statut "en attente" |
| Inscription validee | L'inscrit | Confirmation + lien vers le badge PDF |
| Inscription rejetee | L'inscrit | Notification de rejet |

Module `src/lib/mail.ts` utilisant nodemailer avec des templates HTML simples. En dev, Mailpit intercepte tous les mails (interface web sur le port 8025).

## 8. Stockage fichiers (MinIO)

Bucket unique : `investiture`

```
investiture/
  logos/
    event-logo.{ext}
  photos/
    {registration-id}.{ext}
```

Flux d'upload :
1. Le client envoie le fichier via `POST /api/upload` (multipart/form-data) avec `type` (logo/photo) et `registrationId`
2. L'API valide le fichier (type image, taille max 5 MB), l'envoie a MinIO, retourne le chemin
3. Le chemin est stocke en base

Les images sont servies via `/api/files/[...path]` qui fait proxy vers MinIO (MinIO non expose publiquement).

## 9. Routes & Pages

### Pages publiques (sans auth)

| Route | Description |
|-------|-------------|
| `/login` | Formulaire de connexion admin |
| `/register` | Formulaire d'inscription public (nom, email, structure, photo, equipe) + CAPTCHA |
| `/register/success` | Confirmation apres soumission |
| `/verify/[id]` | Verification du badge (scan QR) -- photo, nom, structure, equipe, statut |

### Pages admin (protegees par middleware)

| Route | Role minimum | Description |
|-------|-------------|-------------|
| `/admin` | OPERATOR | Dashboard -- compteurs inscriptions |
| `/admin/registrations` | OPERATOR | Liste des inscriptions, filtres, actions valider/rejeter |
| `/admin/registrations/new` | OPERATOR | Creation manuelle d'inscription |
| `/admin/registrations/[id]` | OPERATOR | Detail + preview badge + telechargement PDF |
| `/admin/teams` | ADMIN | CRUD des equipes (nom + couleur) |
| `/admin/event` | ADMIN | Configuration de l'evenement |
| `/admin/users` | SUPER_ADMIN | CRUD des utilisateurs |

### API Routes

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/auth/[...nextauth]` | * | NextAuth.js |
| `/api/registrations` | GET, POST | GET: liste (auth requise). POST: creer inscription (public avec CAPTCHA ou auth admin/operator) |
| `/api/registrations/[id]` | GET, PATCH, DELETE | Detail / valider-rejeter / supprimer |
| `/api/teams` | GET, POST | Liste / creer equipe |
| `/api/teams/[id]` | PATCH, DELETE | Modifier / supprimer equipe |
| `/api/event` | GET, PUT | Lire / modifier config evenement |
| `/api/users` | GET, POST | Liste / creer utilisateur |
| `/api/users/[id]` | PATCH, DELETE | Modifier / supprimer utilisateur |
| `/api/upload` | POST | Upload fichier vers MinIO |
| `/api/files/[...path]` | GET | Proxy MinIO pour servir les images |
| `/api/verify/[id]` | GET | Donnees de verification du badge (public) |

## 10. Arborescence des fichiers

```
src/
  app/
    layout.tsx
    login/page.tsx
    register/page.tsx
    register/success/page.tsx
    verify/[id]/page.tsx
    admin/
      layout.tsx
      page.tsx
      registrations/page.tsx
      registrations/new/page.tsx
      registrations/[id]/page.tsx
      teams/page.tsx
      event/page.tsx
      users/page.tsx
    api/
      auth/[...nextauth]/route.ts
      registrations/route.ts
      registrations/[id]/route.ts
      teams/route.ts
      teams/[id]/route.ts
      event/route.ts
      users/route.ts
      users/[id]/route.ts
      upload/route.ts
      files/[...path]/route.ts
      verify/[id]/route.ts
    badge/[id]/page.tsx
  components/
    badge/
      BadgeDocument.tsx
      BadgePreview.tsx
      BadgeDownload.tsx
    ui/
      Button.tsx
      Input.tsx
      Select.tsx
      Modal.tsx
      Table.tsx
      StatusBadge.tsx
    admin/
      Sidebar.tsx
      Header.tsx
      RegistrationForm.tsx
      TeamForm.tsx
      EventForm.tsx
      UserForm.tsx
  lib/
    prisma.ts
    auth.ts
    minio.ts
    mail.ts
    generate-id.ts
    qrcode.ts
  types/
    index.ts
prisma/
  schema.prisma
  seed.ts
```

## 11. Contraintes

- Design minimaliste avec Tailwind CSS
- Toutes les commandes s'executent dans les conteneurs Docker
- Les fichiers existants (badge PDF, generate-id, qrcode) sont preserves et integres
- Le type `Registration` existant dans `src/types/index.ts` sera remplace par le modele Prisma genere
- Le formulaire public d'inscription est protege par reCAPTCHA
- Les photos sont validees cote serveur (type image, max 5 MB)
- Le seed Prisma cree un super-admin avec un mot de passe configurable via variable d'env
