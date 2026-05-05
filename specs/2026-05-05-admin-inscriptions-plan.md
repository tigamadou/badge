# Admin, Inscriptions & Configuration — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'authentification multi-rôles, la gestion des inscriptions (publique + admin), la configuration de l'événement, le stockage MinIO, et les notifications email à l'application de badges PDF existante.

**Architecture:** Application Next.js (App Router) avec API Routes pour le backend. Prisma ORM vers MySQL pour la persistance. MinIO (S3-compatible) pour le stockage des photos/logos. NextAuth.js (Credentials + JWT) pour l'authentification. Nodemailer + Mailpit pour les emails. UI minimaliste avec Tailwind CSS.

**Tech Stack:** Next.js, TypeScript, Prisma, MySQL, NextAuth.js, MinIO (@aws-sdk/client-s3), nodemailer, Tailwind CSS, react-google-recaptcha, bcryptjs, Vitest

---

## Structure des fichiers

| Fichier | Responsabilité |
|---------|---------------|
| `docker-compose.dev.yml` | Modifier : ajouter services mysql, phpmyadmin, minio, minio-init, mailpit |
| `docker-compose.yml` | Modifier : ajouter services mysql, minio pour la prod |
| `.env` | Variables d'environnement |
| `prisma/schema.prisma` | Schéma de la base de données |
| `prisma/seed.ts` | Seed super-admin + événement initial |
| `src/lib/prisma.ts` | Instance Prisma singleton |
| `src/lib/auth.ts` | Config NextAuth + helper requireRole |
| `src/lib/minio.ts` | Client MinIO (upload, getFileUrl) |
| `src/lib/mail.ts` | Envoi d'emails via nodemailer |
| `src/middleware.ts` | Protection des routes /admin/* |
| `src/components/ui/Button.tsx` | Bouton réutilisable Tailwind |
| `src/components/ui/Input.tsx` | Champ de saisie réutilisable |
| `src/components/ui/Select.tsx` | Select réutilisable |
| `src/components/ui/Modal.tsx` | Modal de confirmation |
| `src/components/ui/Table.tsx` | Tableau réutilisable |
| `src/components/ui/StatusBadge.tsx` | Pastille statut (pending/approved/rejected) |
| `src/components/admin/Sidebar.tsx` | Navigation latérale admin |
| `src/components/admin/Header.tsx` | Header admin (user + logout) |
| `src/components/admin/RegistrationForm.tsx` | Formulaire inscription (partagé) |
| `src/components/admin/TeamForm.tsx` | Formulaire équipe |
| `src/components/admin/EventForm.tsx` | Formulaire événement |
| `src/components/admin/UserForm.tsx` | Formulaire utilisateur |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `src/app/api/registrations/route.ts` | GET, POST inscriptions |
| `src/app/api/registrations/[id]/route.ts` | GET, PATCH, DELETE inscription |
| `src/app/api/teams/route.ts` | GET, POST équipes |
| `src/app/api/teams/[id]/route.ts` | PATCH, DELETE équipe |
| `src/app/api/event/route.ts` | GET, PUT événement |
| `src/app/api/users/route.ts` | GET, POST utilisateurs |
| `src/app/api/users/[id]/route.ts` | PATCH, DELETE utilisateur |
| `src/app/api/upload/route.ts` | POST upload vers MinIO |
| `src/app/api/files/[...path]/route.ts` | GET proxy MinIO |
| `src/app/api/verify/[id]/route.ts` | GET vérification badge (public) |
| `src/app/layout.tsx` | Modifier : ajouter Tailwind |
| `src/app/login/page.tsx` | Page de connexion |
| `src/app/register/page.tsx` | Formulaire inscription public |
| `src/app/register/success/page.tsx` | Confirmation inscription |
| `src/app/verify/[id]/page.tsx` | Page vérification badge |
| `src/app/admin/layout.tsx` | Layout admin (sidebar + header) |
| `src/app/admin/page.tsx` | Dashboard |
| `src/app/admin/registrations/page.tsx` | Liste inscriptions |
| `src/app/admin/registrations/new/page.tsx` | Création manuelle |
| `src/app/admin/registrations/[id]/page.tsx` | Détail + badge |
| `src/app/admin/teams/page.tsx` | CRUD équipes |
| `src/app/admin/event/page.tsx` | Config événement |
| `src/app/admin/users/page.tsx` | CRUD utilisateurs |
| `src/lib/__tests__/generate-id.test.ts` | Modifier : adapter si nécessaire |
| `src/lib/__tests__/mail.test.ts` | Tests envoi email |
| `src/lib/__tests__/auth.test.ts` | Tests requireRole |

---

### Task 1 : Docker — Ajouter les services MySQL, phpMyAdmin, MinIO, Mailpit

**Files:**
- Modify: `docker-compose.dev.yml`
- Modify: `docker-compose.yml`
- Create: `.env`
- Modify: `Makefile`

- [ ] **Step 1: Créer le fichier `.env`**

```env
DATABASE_URL=mysql://root:password@mysql:3306/investiture
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=investiture
NEXTAUTH_SECRET=super-secret-key-change-me-in-production
NEXTAUTH_URL=http://localhost:3000
RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@investiture.local
SEED_ADMIN_EMAIL=admin@investiture.local
SEED_ADMIN_PASSWORD=admin123
```

Note : les clés reCAPTCHA ci-dessus sont les clés de test Google (toujours valides en dev).

- [ ] **Step 2: Modifier `docker-compose.dev.yml`**

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
      - .env
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
      MYSQL_DATABASE: investiture
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

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  minio-init:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3;
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/investiture;
      exit 0;
      "

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  mysql_data:
  minio_data:
```

- [ ] **Step 3: Modifier `docker-compose.yml` (production)**

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_started
    restart: unless-stopped

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: investiture
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  minio:
    image: minio/minio
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    restart: unless-stopped

  minio-init:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3;
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/investiture;
      exit 0;
      "

volumes:
  mysql_data:
  minio_data:
```

- [ ] **Step 4: Ajouter les commandes Docker au Makefile**

Ajouter à la fin du Makefile existant :

```makefile
# Base de données
db-push:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push

db-seed:
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

db-studio:
	docker compose -f docker-compose.dev.yml exec app npx prisma studio

db-generate:
	docker compose -f docker-compose.dev.yml exec app npx prisma generate

db-reset:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push --force-reset
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed
```

- [ ] **Step 5: Ajouter `.env` au `.gitignore`**

Vérifier que `.env` est dans `.gitignore`. Si non, l'ajouter.

- [ ] **Step 6: Tester le lancement**

```bash
docker compose -f docker-compose.dev.yml up --build
```

Expected: tous les services démarrent. MySQL healthy, MinIO accessible sur :9001, phpMyAdmin sur :8080, Mailpit sur :8025, app sur :3000.

- [ ] **Step 7: Commit**

```bash
git add .env docker-compose.dev.yml docker-compose.yml Makefile .gitignore
git commit -m "feat: add MySQL, phpMyAdmin, MinIO, Mailpit Docker services"
```

---

### Task 2 : Installer les dépendances

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installer les dépendances de production**

```bash
npm install prisma @prisma/client next-auth @auth/prisma-adapter bcryptjs @aws-sdk/client-s3 @aws-sdk/s3-request-presigner nodemailer react-google-recaptcha
```

- [ ] **Step 2: Installer les dépendances de développement**

```bash
npm install -D @types/bcryptjs @types/nodemailer @types/react-google-recaptcha tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 3: Configurer Tailwind CSS**

Créer `postcss.config.mjs` :

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 4: Remplacer le contenu de `src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Vérifier que l'app compile**

```bash
npm run dev
```

Expected: l'app démarre sans erreur.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs src/app/globals.css
git commit -m "feat: add Prisma, NextAuth, MinIO, nodemailer, Tailwind CSS dependencies"
```

---

### Task 3 : Prisma — Schéma et seed

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Modify: `package.json` (ajouter prisma seed config)

- [ ] **Step 1: Créer `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 2: Créer `prisma/seed.ts`**

```typescript
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@investiture.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: "Super Admin",
        role: Role.SUPER_ADMIN,
      },
    });
    console.log(`Super admin created: ${email}`);
  }

  const existingEvent = await prisma.event.findFirst();
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        title: "Cérémonie d'investiture du Président de la République",
        location: "Porto-Novo",
        date: "24 mai 2026",
      },
    });
    console.log("Default event created");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Ajouter la config seed dans `package.json`**

Ajouter au top-level de `package.json` :

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

Et ajouter `tsx` en devDependency :

```bash
npm install -D tsx
```

- [ ] **Step 4: Générer le client Prisma et pousser le schéma**

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

Expected: tables créées dans MySQL, super-admin et événement insérés.

- [ ] **Step 5: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add Prisma schema with User, Event, Team, Registration models and seed"
```

---

### Task 4 : Lib — Prisma singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Créer `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add Prisma singleton client"
```

---

### Task 5 : Lib — Client MinIO

**Files:**
- Create: `src/lib/minio.ts`

- [ ] **Step 1: Créer `src/lib/minio.ts`**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.MINIO_BUCKET!;

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getFile(key: string): Promise<{ body: ReadableStream; contentType: string }> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  return {
    body: response.Body!.transformToWebStream(),
    contentType: response.ContentType || "application/octet-stream",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/minio.ts
git commit -m "feat: add MinIO S3 client for file upload and retrieval"
```

---

### Task 6 : Lib — Service email — Tests

**Files:**
- Create: `src/lib/__tests__/mail.test.ts`
- Create: `src/lib/mail.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/lib/__tests__/mail.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
    })),
  },
}));

// Set env before importing
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.SMTP_FROM = "test@test.com";

import { sendRegistrationConfirmation, sendStatusNotification } from "../mail";

describe("mail", () => {
  it("sendRegistrationConfirmation sends an email", async () => {
    await expect(
      sendRegistrationConfirmation("user@test.com", "Jean Dupont")
    ).resolves.not.toThrow();
  });

  it("sendStatusNotification sends approval email with badge link", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "APPROVED", "abc123")
    ).resolves.not.toThrow();
  });

  it("sendStatusNotification sends rejection email", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "REJECTED", "abc123")
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/lib/__tests__/mail.test.ts
```

Expected: FAIL — `Cannot find module '../mail'`

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/mail.test.ts
git commit -m "test: add failing tests for mail service"
```

---

### Task 7 : Lib — Service email — Implémentation

**Files:**
- Create: `src/lib/mail.ts`

- [ ] **Step 1: Créer `src/lib/mail.ts`**

```typescript
import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
  });
}

const FROM = process.env.SMTP_FROM || "noreply@investiture.local";

export async function sendRegistrationConfirmation(
  to: string,
  fullName: string
): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Confirmation d'inscription — Cérémonie d'investiture",
    html: `
      <h2>Confirmation d'inscription</h2>
      <p>Bonjour ${fullName},</p>
      <p>Votre inscription a bien été reçue. Elle est en attente de validation.</p>
      <p>Vous recevrez un email dès que votre inscription sera traitée.</p>
    `,
  });
}

export async function sendStatusNotification(
  to: string,
  fullName: string,
  status: "APPROVED" | "REJECTED",
  registrationId: string
): Promise<void> {
  const transporter = getTransporter();

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (status === "APPROVED") {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Inscription validée — Cérémonie d'investiture",
      html: `
        <h2>Inscription validée</h2>
        <p>Bonjour ${fullName},</p>
        <p>Votre inscription a été <strong>validée</strong>.</p>
        <p>Vous pouvez consulter et télécharger votre badge ici :</p>
        <p><a href="${baseUrl}/badge/${registrationId}">Voir mon badge</a></p>
      `,
    });
  } else {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Inscription rejetée — Cérémonie d'investiture",
      html: `
        <h2>Inscription rejetée</h2>
        <p>Bonjour ${fullName},</p>
        <p>Nous sommes désolés, votre inscription a été <strong>rejetée</strong>.</p>
        <p>Pour plus d'informations, veuillez contacter l'organisation.</p>
      `,
    });
  }
}
```

- [ ] **Step 2: Lancer les tests**

```bash
npx vitest run src/lib/__tests__/mail.test.ts
```

Expected: 3 tests passent.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mail.ts
git commit -m "feat: implement email service with registration confirmation and status notification"
```

---

### Task 8 : Auth — NextAuth config + helper requireRole — Tests

**Files:**
- Create: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Écrire les tests pour requireRole**

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect } from "vitest";
import { checkRole } from "../auth";

describe("checkRole", () => {
  it("SUPER_ADMIN has access to all roles", () => {
    expect(checkRole("SUPER_ADMIN", "OPERATOR")).toBe(true);
    expect(checkRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(checkRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("ADMIN has access to ADMIN and OPERATOR", () => {
    expect(checkRole("ADMIN", "OPERATOR")).toBe(true);
    expect(checkRole("ADMIN", "ADMIN")).toBe(true);
    expect(checkRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("OPERATOR only has access to OPERATOR", () => {
    expect(checkRole("OPERATOR", "OPERATOR")).toBe(true);
    expect(checkRole("OPERATOR", "ADMIN")).toBe(false);
    expect(checkRole("OPERATOR", "SUPER_ADMIN")).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: FAIL — `Cannot find module '../auth'`

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/auth.test.ts
git commit -m "test: add failing tests for role checking"
```

---

### Task 9 : Auth — NextAuth config + helper requireRole — Implémentation

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Créer `src/lib/auth.ts`**

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function checkRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string; id: string }).role = token.role as string;
        (session.user as { role: string; id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
```

- [ ] **Step 2: Créer `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 3: Créer les types NextAuth dans `src/types/next-auth.d.ts`**

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: 3 tests passent.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/types/next-auth.d.ts
git commit -m "feat: implement NextAuth with credentials provider and role-based access"
```

---

### Task 10 : Middleware — Protection des routes admin

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Créer `src/middleware.ts`**

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware protecting /admin routes"
```

---

### Task 11 : Composants UI — Tailwind

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Table.tsx`
- Create: `src/components/ui/StatusBadge.tsx`

- [ ] **Step 1: Créer `src/components/ui/Button.tsx`**

```tsx
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded text-sm font-medium disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Créer `src/components/ui/Input.tsx`**

```tsx
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, ...props }, ref) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        ref={ref}
        className={`w-full px-3 py-2 border rounded text-sm ${
          error ? "border-red-500" : "border-gray-300"
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";
```

- [ ] **Step 3: Créer `src/components/ui/Select.tsx`**

```tsx
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, ...props }, ref) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        ref={ref}
        className={`w-full px-3 py-2 border rounded text-sm ${
          error ? "border-red-500" : "border-gray-300"
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        {...props}
      >
        <option value="">Sélectionner...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
);

Select.displayName = "Select";
```

- [ ] **Step 4: Créer `src/components/ui/Modal.tsx`**

```tsx
"use client";

import { ReactNode } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
}

export function Modal({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  confirmVariant = "primary",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="mb-6">{children}</div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Créer `src/components/ui/Table.tsx`**

```tsx
import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
}

export function Table<T>({ columns, data, keyExtractor }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 font-medium text-gray-600">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="border-b hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Créer `src/components/ui/StatusBadge.tsx`**

```tsx
type Status = "PENDING" | "APPROVED" | "REJECTED";

const statusConfig: Record<Status, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  APPROVED: { label: "Validé", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejeté", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add reusable UI components (Button, Input, Select, Modal, Table, StatusBadge)"
```

---

### Task 12 : Layout admin — Sidebar + Header

**Files:**
- Create: `src/components/admin/Sidebar.tsx`
- Create: `src/components/admin/Header.tsx`
- Create: `src/app/admin/layout.tsx`

- [ ] **Step 1: Créer `src/components/admin/Sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  minRole: string;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", minRole: "OPERATOR" },
  { href: "/admin/registrations", label: "Inscriptions", minRole: "OPERATOR" },
  { href: "/admin/teams", label: "Équipes", minRole: "ADMIN" },
  { href: "/admin/event", label: "Événement", minRole: "ADMIN" },
  { href: "/admin/users", label: "Utilisateurs", minRole: "SUPER_ADMIN" },
];

const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[item.minRole] || 0)
  );

  return (
    <aside className="w-56 bg-gray-900 text-white min-h-screen p-4">
      <h2 className="text-lg font-bold mb-6 px-2">Investiture</h2>
      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                isActive ? "bg-gray-700 font-medium" : "hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Créer `src/components/admin/Header.tsx`**

```tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  userName: string;
  userRole: string;
}

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b px-6 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {userName} <span className="text-xs text-gray-400">({userRole})</span>
        </span>
        <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Créer `src/app/admin/layout.tsx`**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={session.user.role} />
      <div className="flex-1 flex flex-col">
        <Header userName={session.user.name || ""} userRole={session.user.role} />
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/Sidebar.tsx src/components/admin/Header.tsx src/app/admin/layout.tsx
git commit -m "feat: add admin layout with sidebar navigation and header"
```

---

### Task 13 : API — Équipes (CRUD)

**Files:**
- Create: `src/app/api/teams/route.ts`
- Create: `src/app/api/teams/[id]/route.ts`

- [ ] **Step 1: Créer `src/app/api/teams/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { registrations: true } } },
  });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { name, color } = await req.json();
  if (!name || !color) {
    return NextResponse.json({ error: "Nom et couleur requis" }, { status: 400 });
  }

  const team = await prisma.team.create({ data: { name, color } });
  return NextResponse.json(team, { status: 201 });
}
```

- [ ] **Step 2: Créer `src/app/api/teams/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const team = await prisma.team.update({
    where: { id },
    data: { name: data.name, color: data.color },
  });
  return NextResponse.json(team);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/teams/
git commit -m "feat: add teams API routes (CRUD)"
```

---

### Task 14 : API — Événement

**Files:**
- Create: `src/app/api/event/route.ts`

- [ ] **Step 1: Créer `src/app/api/event/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const event = await prisma.event.findFirst();
  return NextResponse.json(event);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { title, location, date, logo } = await req.json();

  const existing = await prisma.event.findFirst();
  if (!existing) {
    const event = await prisma.event.create({ data: { title, location, date, logo } });
    return NextResponse.json(event);
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { title, location, date, logo },
  });
  return NextResponse.json(event);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/event/
git commit -m "feat: add event API routes (GET, PUT)"
```

---

### Task 15 : API — Utilisateurs (CRUD)

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`

- [ ] **Step 1: Créer `src/app/api/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { email, password, name, role } = await req.json();
  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await hash(password, 12),
      name,
      role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
```

- [ ] **Step 2: Créer `src/app/api/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.password) updateData.password = await hash(data.password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/
git commit -m "feat: add users API routes (CRUD, SUPER_ADMIN only)"
```

---

### Task 16 : API — Upload + Files proxy

**Files:**
- Create: `src/app/api/upload/route.ts`
- Create: `src/app/api/files/[...path]/route.ts`

- [ ] **Step 1: Créer `src/app/api/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/minio";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string; // "logo" | "photo"
  const registrationId = formData.get("registrationId") as string | null;

  if (!file || !type) {
    return NextResponse.json({ error: "Fichier et type requis" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non autorisé (JPEG, PNG, WebP)" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  let key: string;

  if (type === "logo") {
    key = `logos/event-logo.${ext}`;
  } else if (type === "photo" && registrationId) {
    key = `photos/${registrationId}.${ext}`;
  } else {
    return NextResponse.json({ error: "Type invalide ou registrationId manquant" }, { status: 400 });
  }

  // Pour les photos publiques (formulaire inscription), pas besoin d'auth
  // Pour le logo, vérifier l'auth admin
  if (type === "logo") {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = await uploadFile(key, buffer, file.type);
  return NextResponse.json({ path });
}
```

- [ ] **Step 2: Créer `src/app/api/files/[...path]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/minio";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");

  try {
    const { body, contentType } = await getFile(key);
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/ src/app/api/files/
git commit -m "feat: add file upload and proxy routes for MinIO"
```

---

### Task 17 : API — Inscriptions (CRUD + notifications email)

**Files:**
- Create: `src/app/api/registrations/route.ts`
- Create: `src/app/api/registrations/[id]/route.ts`

- [ ] **Step 1: Créer `src/app/api/registrations/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/generate-id";
import { sendRegistrationConfirmation } from "@/lib/mail";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    include: { team: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(registrations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, fullName, structure, teamId, photo, captchaToken } = body;

  if (!email || !fullName || !structure || !teamId) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Vérifier si c'est un appel public (pas de session) => vérifier CAPTCHA
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (!captchaToken) {
      return NextResponse.json({ error: "CAPTCHA requis" }, { status: 400 });
    }
    const captchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
    });
    const captchaData = await captchaRes.json();
    if (!captchaData.success) {
      return NextResponse.json({ error: "CAPTCHA invalide" }, { status: 400 });
    }
  }

  const event = await prisma.event.findFirst();
  const id = generateId({
    eventType: 1,
    date: event?.date || new Date().toISOString(),
  });

  const registration = await prisma.registration.create({
    data: { id, email, fullName, structure, teamId, photo },
    include: { team: true },
  });

  try {
    await sendRegistrationConfirmation(email, fullName);
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }

  return NextResponse.json(registration, { status: 201 });
}
```

- [ ] **Step 2: Créer `src/app/api/registrations/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStatusNotification } from "@/lib/mail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!registration) {
    return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
  }

  return NextResponse.json(registration);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const registration = await prisma.registration.update({
    where: { id },
    data,
    include: { team: true },
  });

  // Envoyer un email si le statut a changé
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        registration.fullName,
        data.status,
        registration.id
      );
    } catch (e) {
      console.error("Failed to send status notification:", e);
    }
  }

  return NextResponse.json(registration);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.registration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/registrations/
git commit -m "feat: add registrations API with email notifications on create and status change"
```

---

### Task 18 : API — Vérification badge (public)

**Files:**
- Create: `src/app/api/verify/[id]/route.ts`

- [ ] **Step 1: Créer `src/app/api/verify/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!registration) {
    return NextResponse.json({ valid: false, error: "Badge inconnu" }, { status: 404 });
  }

  const event = await prisma.event.findFirst();

  return NextResponse.json({
    valid: registration.status === "APPROVED",
    registration: {
      id: registration.id,
      fullName: registration.fullName,
      structure: registration.structure,
      photo: registration.photo,
      status: registration.status,
      team: {
        name: registration.team.name,
        color: registration.team.color,
      },
    },
    event: event
      ? { title: event.title, location: event.location, date: event.date }
      : null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/verify/
git commit -m "feat: add public badge verification API"
```

---

### Task 19 : Page — Login

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Créer `src/app/login/page.tsx`**

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-bold text-center mb-6">Connexion</h1>
        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page"
```

---

### Task 20 : Page — Dashboard admin

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Créer `src/app/admin/page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.count({ where: { status: "APPROVED" } }),
    prisma.registration.count({ where: { status: "REJECTED" } }),
  ]);

  const stats = [
    { label: "Total", value: total, color: "bg-blue-100 text-blue-800" },
    { label: "En attente", value: pending, color: "bg-yellow-100 text-yellow-800" },
    { label: "Validées", value: approved, color: "bg-green-100 text-green-800" },
    { label: "Rejetées", value: rejected, color: "bg-red-100 text-red-800" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add admin dashboard with registration counters"
```

---

### Task 21 : Page — Gestion des équipes

**Files:**
- Create: `src/components/admin/TeamForm.tsx`
- Create: `src/app/admin/teams/page.tsx`

- [ ] **Step 1: Créer `src/components/admin/TeamForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TeamFormProps {
  initialData?: { id: string; name: string; color: string };
  onSubmit: (data: { name: string; color: string }) => Promise<void>;
  onCancel: () => void;
}

export function TeamForm({ initialData, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || "#1a3a7c");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, color });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom de l'équipe" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : initialData ? "Modifier" : "Créer"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Créer `src/app/admin/teams/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TeamForm } from "@/components/admin/TeamForm";

interface Team {
  id: string;
  name: string;
  color: string;
  _count: { registrations: number };
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    setTeams(await res.json());
  }

  useEffect(() => { fetchTeams(); }, []);

  async function handleCreate(data: { name: string; color: string }) {
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchTeams();
  }

  async function handleEdit(data: { name: string; color: string }) {
    if (!editingTeam) return;
    await fetch(`/api/teams/${editingTeam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingTeam(null);
    fetchTeams();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/teams/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchTeams();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Équipes</h1>
        <Button onClick={() => setShowForm(true)}>Nouvelle équipe</Button>
      </div>

      {(showForm || editingTeam) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <TeamForm
            initialData={editingTeam || undefined}
            onSubmit={editingTeam ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditingTeam(null); }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3">Couleur</th>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Inscriptions</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: team.color }} />
                </td>
                <td className="px-4 py-3 font-medium">{team.name}</td>
                <td className="px-4 py-3">{team._count.registrations}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button variant="secondary" onClick={() => setEditingTeam(team)}>Modifier</Button>
                  <Button variant="danger" onClick={() => setDeleteId(team.id)}>Supprimer</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!deleteId}
        title="Supprimer l'équipe ?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Supprimer"
        confirmVariant="danger"
      >
        <p>Cette action est irréversible.</p>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TeamForm.tsx src/app/admin/teams/
git commit -m "feat: add teams management page with CRUD"
```

---

### Task 22 : Page — Configuration événement

**Files:**
- Create: `src/components/admin/EventForm.tsx`
- Create: `src/app/admin/event/page.tsx`

- [ ] **Step 1: Créer `src/components/admin/EventForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

interface EventFormProps {
  initialData: EventData;
  onSubmit: (data: EventData) => Promise<void>;
}

export function EventForm({ initialData, onSubmit }: EventFormProps) {
  const [title, setTitle] = useState(initialData.title);
  const [location, setLocation] = useState(initialData.location);
  const [date, setDate] = useState(initialData.date);
  const [logo, setLogo] = useState(initialData.logo);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const { path } = await res.json();
    setLogo(path);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ title, location, date, logo });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input label="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} required />
      <Input label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
        {logo && (
          <img src={`/api/files/${logo}`} alt="Logo" className="h-16 mb-2 object-contain" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          className="text-sm"
        />
        {uploading && <p className="text-sm text-gray-500 mt-1">Upload en cours...</p>}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Créer `src/app/admin/event/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/EventForm";

interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

export default function EventPage() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then(setEvent);
  }, []);

  async function handleSubmit(data: EventData) {
    await fetch("/api/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!event) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuration de l'événement</h1>
      {saved && (
        <p className="text-sm text-green-600 mb-4">Modifications enregistrées.</p>
      )}
      <div className="bg-white rounded-lg shadow p-6">
        <EventForm initialData={event} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/EventForm.tsx src/app/admin/event/
git commit -m "feat: add event configuration page with logo upload"
```

---

### Task 23 : Page — Gestion des utilisateurs

**Files:**
- Create: `src/components/admin/UserForm.tsx`
- Create: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Créer `src/components/admin/UserForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface UserFormProps {
  initialData?: { id: string; email: string; name: string; role: string };
  onSubmit: (data: { email: string; name: string; role: string; password?: string }) => Promise<void>;
  onCancel: () => void;
}

const roleOptions = [
  { value: "OPERATOR", label: "Opérateur" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const [email, setEmail] = useState(initialData?.email || "");
  const [name, setName] = useState(initialData?.name || "");
  const [role, setRole] = useState(initialData?.role || "OPERATOR");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data: { email: string; name: string; role: string; password?: string } = { email, name, role };
    if (password) data.password = password;
    await onSubmit(data);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input
        label={initialData ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required={!initialData}
      />
      <Select label="Rôle" options={roleOptions} value={role} onChange={(e) => setRole(e.target.value)} />
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : initialData ? "Modifier" : "Créer"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Créer `src/app/admin/users/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "@/components/admin/UserForm";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(data: { email: string; name: string; role: string; password?: string }) {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchUsers();
  }

  async function handleEdit(data: { email: string; name: string; role: string; password?: string }) {
    if (!editingUser) return;
    await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingUser(null);
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchUsers();
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    OPERATOR: "Opérateur",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button onClick={() => setShowForm(true)}>Nouvel utilisateur</Button>
      </div>

      {(showForm || editingUser) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <UserForm
            initialData={editingUser || undefined}
            onSubmit={editingUser ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditingUser(null); }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{roleLabels[user.role] || user.role}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button variant="secondary" onClick={() => setEditingUser(user)}>Modifier</Button>
                  <Button variant="danger" onClick={() => setDeleteId(user.id)}>Supprimer</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!deleteId}
        title="Supprimer l'utilisateur ?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Supprimer"
        confirmVariant="danger"
      >
        <p>Cette action est irréversible.</p>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/UserForm.tsx src/app/admin/users/
git commit -m "feat: add users management page (SUPER_ADMIN only)"
```

---

### Task 24 : Formulaire d'inscription partagé

**Files:**
- Create: `src/components/admin/RegistrationForm.tsx`

- [ ] **Step 1: Créer `src/components/admin/RegistrationForm.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Team {
  id: string;
  name: string;
}

interface RegistrationFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
  showCaptcha?: boolean;
  captchaWidget?: React.ReactNode;
}

export function RegistrationForm({
  onSubmit,
  submitLabel = "Soumettre",
  captchaWidget,
}: RegistrationFormProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    await onSubmit(formData);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom complet" name="fullName" required />
      <Input label="Email" name="email" type="email" required />
      <Input label="Structure / Organisation" name="structure" required />
      <Select
        label="Équipe"
        name="teamId"
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
        required
      />
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Photo d'identité</label>
        <input type="file" name="photo" accept="image/*" className="text-sm" />
      </div>
      {captchaWidget}
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi en cours..." : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/RegistrationForm.tsx
git commit -m "feat: add shared registration form component"
```

---

### Task 25 : Page — Liste des inscriptions admin

**Files:**
- Create: `src/app/admin/registrations/page.tsx`

- [ ] **Step 1: Créer `src/app/admin/registrations/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Registration {
  id: string;
  fullName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  team: { name: string; color: string };
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");

  async function fetchRegistrations() {
    const res = await fetch("/api/registrations");
    setRegistrations(await res.json());
  }

  useEffect(() => { fetchRegistrations(); }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchRegistrations();
  }

  const filtered = registrations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (teamFilter && r.team.name !== teamFilter) return false;
    return true;
  });

  const teamNames = [...new Set(registrations.map((r) => r.team.name))];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inscriptions</h1>
        <Link href="/admin/registrations/new">
          <Button>Nouvelle inscription</Button>
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <select
          className="px-3 py-2 border rounded text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Validé</option>
          <option value="REJECTED">Rejeté</option>
        </select>
        <select
          className="px-3 py-2 border rounded text-sm"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">Toutes les équipes</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Structure</th>
              <th className="text-left px-4 py-3">Équipe</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((reg) => (
              <tr key={reg.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/registrations/${reg.id}`} className="text-blue-600 hover:underline font-medium">
                    {reg.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3">{reg.structure}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: reg.team.color }} />
                    {reg.team.name}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={reg.status} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  {reg.status === "PENDING" && (
                    <>
                      <Button variant="primary" onClick={() => updateStatus(reg.id, "APPROVED")}>Valider</Button>
                      <Button variant="danger" onClick={() => updateStatus(reg.id, "REJECTED")}>Rejeter</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-gray-500">Aucune inscription trouvée.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/registrations/page.tsx
git commit -m "feat: add registrations list page with filters and status actions"
```

---

### Task 26 : Page — Création manuelle d'inscription

**Files:**
- Create: `src/app/admin/registrations/new/page.tsx`

- [ ] **Step 1: Créer `src/app/admin/registrations/new/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { RegistrationForm } from "@/components/admin/RegistrationForm";

export default function NewRegistrationPage() {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const photoFile = formData.get("photo") as File | null;
    let photoPath: string | undefined;

    // Upload photo si fournie
    if (photoFile && photoFile.size > 0) {
      // On crée d'abord l'inscription sans photo, puis on upload
      // Mais on a besoin de l'ID pour le chemin MinIO
      // Solution : on crée l'inscription d'abord, puis on met à jour
    }

    const body: Record<string, string> = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const registration = await res.json();

    // Upload photo avec l'ID de l'inscription
    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", registration.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      const { path } = await uploadRes.json();

      await fetch(`/api/registrations/${registration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: path }),
      });
    }

    router.push("/admin/registrations");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nouvelle inscription</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <RegistrationForm onSubmit={handleSubmit} submitLabel="Créer l'inscription" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/registrations/new/
git commit -m "feat: add manual registration creation page"
```

---

### Task 27 : Page — Détail inscription + badge

**Files:**
- Create: `src/app/admin/registrations/[id]/page.tsx`
- Modify: `src/app/badge/[id]/page.tsx` (utiliser données Prisma)

- [ ] **Step 1: Créer `src/app/admin/registrations/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { generateQRCodeDataURL } from "@/lib/qrcode";

const BadgePreview = dynamic(
  () => import("@/components/badge/BadgePreview").then((m) => m.BadgePreview),
  { ssr: false }
);
const BadgeDownload = dynamic(
  () => import("@/components/badge/BadgeDownload").then((m) => m.BadgeDownload),
  { ssr: false }
);

interface Registration {
  id: string;
  fullName: string;
  email: string;
  structure: string;
  photo: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  team: { id: string; name: string; color: string };
}

export default function RegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<{ id: string; title: string; location: string; date: string; logo: string | null } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then(setRegistration);
    fetch("/api/event").then((r) => r.json()).then(setEvent);
  }, [id]);

  useEffect(() => {
    if (registration) {
      generateQRCodeDataURL(registration.id).then(setQrCodeDataUrl);
    }
  }, [registration]);

  async function updateStatus(status: string) {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
  }

  if (!registration || !event) return <p>Chargement...</p>;

  const badgeEvent = {
    id: event.id,
    title: event.title,
    location: event.location,
    date: event.date,
    logo: event.logo ? `/api/files/${event.logo}` : "",
  };

  const badgeRegistration = {
    id: registration.id,
    fullName: registration.fullName,
    structure: registration.structure,
    photo: registration.photo ? `/api/files/${registration.photo}` : "",
    email: registration.email,
    teamId: registration.team.id,
    status: registration.status,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Détail de l'inscription</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500">Nom</dt><dd className="font-medium">{registration.fullName}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd>{registration.email}</dd></div>
            <div><dt className="text-gray-500">Structure</dt><dd>{registration.structure}</dd></div>
            <div><dt className="text-gray-500">Équipe</dt><dd className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: registration.team.color }} />
              {registration.team.name}
            </dd></div>
            <div><dt className="text-gray-500">Statut</dt><dd><StatusBadge status={registration.status} /></dd></div>
            <div><dt className="text-gray-500">ID</dt><dd className="font-mono text-xs">{registration.id}</dd></div>
          </dl>

          {registration.photo && (
            <img src={`/api/files/${registration.photo}`} alt="Photo" className="mt-4 w-32 h-40 object-cover rounded" />
          )}

          <div className="mt-6 flex gap-3">
            {registration.status !== "APPROVED" && (
              <Button onClick={() => updateStatus("APPROVED")}>Valider</Button>
            )}
            {registration.status !== "REJECTED" && (
              <Button variant="danger" onClick={() => updateStatus("REJECTED")}>Rejeter</Button>
            )}
          </div>
        </div>

        {registration.status === "APPROVED" && qrCodeDataUrl && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Badge</h2>
            <BadgePreview
              registration={badgeRegistration}
              team={registration.team}
              event={badgeEvent}
              qrCodeDataUrl={qrCodeDataUrl}
            />
            <div className="mt-4">
              <BadgeDownload
                registration={badgeRegistration}
                team={registration.team}
                event={badgeEvent}
                qrCodeDataUrl={qrCodeDataUrl}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modifier `src/app/badge/[id]/page.tsx` pour utiliser les données Prisma**

Remplacer tout le contenu par :

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { generateQRCodeDataURL } from "@/lib/qrcode";

const BadgePreview = dynamic(
  () => import("@/components/badge/BadgePreview").then((m) => m.BadgePreview),
  { ssr: false }
);
const BadgeDownload = dynamic(
  () => import("@/components/badge/BadgeDownload").then((m) => m.BadgeDownload),
  { ssr: false }
);

export default function BadgePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ registration: Record<string, string>; event: Record<string, string>; valid: boolean } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  useEffect(() => {
    if (data?.registration) {
      generateQRCodeDataURL(data.registration.id).then(setQrCodeDataUrl);
    }
  }, [data]);

  if (!data) return <p className="text-center mt-20">Chargement...</p>;
  if (!data.valid) return <p className="text-center mt-20 text-red-500">Badge non valide ou inscription non approuvée.</p>;

  const reg = data.registration;
  const evt = data.event;

  const registration = {
    id: reg.id,
    fullName: reg.fullName,
    structure: reg.structure,
    photo: reg.photo ? `/api/files/${reg.photo}` : "",
    email: "",
    teamId: "",
    status: reg.status as "approved",
  };

  const team = { id: "", name: reg.team.name, color: reg.team.color };
  const event = { id: "", title: evt.title, location: evt.location, date: evt.date, logo: "" };

  if (!qrCodeDataUrl) return <p className="text-center mt-20">Génération du badge...</p>;

  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <h1 className="text-xl font-bold mb-6">Votre badge</h1>
      <BadgePreview registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} />
      <div className="mt-4">
        <BadgeDownload registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/registrations/[id]/ src/app/badge/[id]/page.tsx
git commit -m "feat: add registration detail page with badge preview and update badge page to use API"
```

---

### Task 28 : Page — Formulaire d'inscription public + CAPTCHA

**Files:**
- Create: `src/app/register/page.tsx`
- Create: `src/app/register/success/page.tsx`

- [ ] **Step 1: Créer `src/app/register/page.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import { RegistrationForm } from "@/components/admin/RegistrationForm";

export default function PublicRegisterPage() {
  const router = useRouter();
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    if (!captchaToken) {
      setError("Veuillez compléter le CAPTCHA");
      return;
    }
    setError("");

    const photoFile = formData.get("photo") as File | null;

    const body: Record<string, string> = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
      captchaToken,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erreur lors de l'inscription");
      captchaRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    const registration = await res.json();

    // Upload photo
    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", registration.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        await fetch(`/api/registrations/${registration.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: path }),
        });
      }
    }

    router.push("/register/success");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-bold text-center mb-2">Inscription</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Cérémonie d'investiture du Président de la République
        </p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <RegistrationForm
          onSubmit={handleSubmit}
          submitLabel="S'inscrire"
          captchaWidget={
            <div className="mb-4">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                onChange={(token) => setCaptchaToken(token)}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/register/success/page.tsx`**

```tsx
import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Inscription envoyée</h1>
        <p className="text-gray-600 mb-6">
          Votre inscription a bien été reçue. Vous recevrez un email de confirmation
          lorsqu'elle sera validée.
        </p>
        <Link href="/register" className="text-blue-600 hover:underline text-sm">
          Faire une autre inscription
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` au `.env`**

Ajouter dans `.env` :

```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

- [ ] **Step 4: Commit**

```bash
git add src/app/register/ .env
git commit -m "feat: add public registration page with reCAPTCHA"
```

---

### Task 29 : Page — Vérification badge (scan QR)

**Files:**
- Create: `src/app/verify/[id]/page.tsx`

- [ ] **Step 1: Créer `src/app/verify/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface VerifyData {
  valid: boolean;
  error?: string;
  registration?: {
    id: string;
    fullName: string;
    structure: string;
    photo: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    team: { name: string; color: string };
  };
  event?: { title: string; location: string; date: string } | null;
}

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VerifyData | null>(null);

  useEffect(() => {
    fetch(`/api/verify/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  if (!data) return <p className="text-center mt-20">Vérification en cours...</p>;

  if (!data.registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-6xl mb-4">&#10060;</div>
          <h1 className="text-2xl font-bold text-red-700">Badge invalide</h1>
          <p className="text-gray-600 mt-2">Ce badge n'existe pas dans le système.</p>
        </div>
      </div>
    );
  }

  const reg = data.registration;
  const bgColor = data.valid ? "bg-green-50" : "bg-red-50";

  return (
    <div className={`min-h-screen flex items-center justify-center ${bgColor}`}>
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{data.valid ? "\u2705" : "\u274C"}</div>
        <h1 className={`text-xl font-bold mb-4 ${data.valid ? "text-green-700" : "text-red-700"}`}>
          {data.valid ? "Badge valide" : "Badge non valide"}
        </h1>

        {reg.photo && (
          <img
            src={`/api/files/${reg.photo}`}
            alt="Photo"
            className="w-24 h-32 object-cover rounded mx-auto mb-4"
          />
        )}

        <p className="text-lg font-semibold">{reg.fullName}</p>
        <p className="text-gray-600">{reg.structure}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: reg.team.color }} />
          <span className="font-medium">{reg.team.name}</span>
        </div>
        <div className="mt-3">
          <StatusBadge status={reg.status} />
        </div>

        {data.event && (
          <p className="text-xs text-gray-400 mt-4">
            {data.event.title} — {data.event.location}, {data.event.date}
          </p>
        )}

        <p className="text-xs text-gray-300 mt-2 font-mono">{reg.id}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/verify/
git commit -m "feat: add badge verification page for QR code scanning"
```

---

### Task 30 : Mise à jour types + nettoyage

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Mettre à jour `src/types/index.ts`**

Remplacer le contenu pour utiliser les types Prisma générés tout en gardant `BadgeProps` :

```typescript
import type { Registration as PrismaRegistration, Team, Event } from "@prisma/client";

export type { Team, Event as EventInfo } from "@prisma/client";
export type { Registration } from "@prisma/client";
export type RegistrationStatus = PrismaRegistration["status"];

export interface BadgeProps {
  registration: {
    id: string;
    fullName: string;
    structure: string;
    photo: string;
  };
  team: {
    id: string;
    name: string;
    color: string;
  };
  event: {
    id: string;
    title: string;
    location: string;
    date: string;
    logo: string;
  };
}
```

- [ ] **Step 2: Mettre à jour `BadgeDocument.tsx` pour utiliser `BadgeProps` simplifié**

Vérifier que `BadgeDocument.tsx` importe bien `BadgeProps` depuis `@/types` et que les champs correspondent. Les champs `registration.photo`, `event.logo` sont maintenant des URLs (passant par `/api/files/...`).

- [ ] **Step 3: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "refactor: update types to use Prisma-generated models"
```

---

### Task 31 : Validation finale

- [ ] **Step 1: Lancer tous les tests**

```bash
npx vitest run
```

Expected: tous les tests passent (generate-id: 5, qrcode: 3, mail: 3, auth: 3 = 14 tests).

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Tester le build de production**

```bash
npm run build
```

Expected: le build réussit.

- [ ] **Step 4: Test fonctionnel**

Lancer `docker compose -f docker-compose.dev.yml up --build` et vérifier :
- `/login` — connexion avec admin@investiture.local / admin123
- `/admin` — dashboard avec compteurs
- `/admin/teams` — créer une équipe
- `/admin/event` — modifier la config événement
- `/admin/registrations/new` — créer une inscription
- `/admin/registrations` — liste, valider une inscription
- `/admin/registrations/[id]` — voir le badge d'une inscription validée
- `/register` — formulaire public avec CAPTCHA
- `/verify/[id]` — vérification d'un badge
- `/badge/[id]` — preview et téléchargement PDF
- Vérifier que les emails arrivent dans Mailpit (http://localhost:8025)

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: verify all tests pass and production build succeeds"
```
