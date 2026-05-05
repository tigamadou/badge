# Badge PDF — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer un badge PDF fidèle au modèle `badge.jpeg`, prévisualisable et téléchargeable, pour les inscriptions validées.

**Architecture:** Application Next.js (App Router) avec `@react-pdf/renderer` pour le rendu PDF côté client. Le badge est un composant React pur qui reçoit les données en props. Les utilitaires (génération d'ID, QR code) sont des modules isolés et testés indépendamment.

**Tech Stack:** Next.js, TypeScript, `@react-pdf/renderer`, `qrcode`, Vitest, Docker

---

## Structure des fichiers

| Fichier | Responsabilité |
|---------|---------------|
| `Dockerfile` | Image de production (multi-stage build) |
| `Dockerfile.dev` | Image de développement (hot reload) |
| `docker-compose.yml` | Configuration de production |
| `docker-compose.dev.yml` | Configuration de développement (volumes, hot reload) |
| `.dockerignore` | Fichiers exclus du build Docker |
| `src/types/index.ts` | Interfaces `EventInfo`, `Team`, `Registration`, `BadgeProps` |
| `src/lib/generate-id.ts` | Génération d'identifiant hybride (préfixe structuré + suffixe aléatoire) |
| `src/lib/qrcode.ts` | Génération de QR code en data URL base64 |
| `src/components/badge/BadgeDocument.tsx` | Composant `@react-pdf/renderer` — le badge complet |
| `src/components/badge/BadgePreview.tsx` | Wrapper `<PDFViewer>` pour la prévisualisation |
| `src/components/badge/BadgeDownload.tsx` | Wrapper `<PDFDownloadLink>` pour le téléchargement |
| `src/app/badge/[id]/page.tsx` | Page Next.js affichant preview + download pour une inscription validée |
| `src/lib/__tests__/generate-id.test.ts` | Tests unitaires pour `generate-id` |
| `src/lib/__tests__/qrcode.test.ts` | Tests unitaires pour `qrcode` |

---

### Task 1 : Initialisation du projet Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Créer le projet Next.js**

```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir --no-tailwind --no-import-alias
```

Répondre "No" à Turbopack si demandé. Le `.` installe dans le répertoire courant.

- [ ] **Step 2: Installer les dépendances**

```bash
npm install @react-pdf/renderer qrcode
npm install -D @types/qrcode vitest @vitejs/plugin-react
```

- [ ] **Step 3: Configurer Vitest**

Créer `vitest.config.ts` à la racine :

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
});
```

Ajouter le script dans `package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Vérifier que le projet démarre**

```bash
npm run dev
```

Expected: le serveur Next.js démarre sans erreur sur `http://localhost:3000`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts src/ public/ .gitignore eslint.config.mjs
git commit -m "chore: init Next.js project with @react-pdf/renderer and vitest"
```

---

### Task 2 : Configuration Docker (dev + prod)

**Files:**
- Create: `Dockerfile`
- Create: `Dockerfile.dev`
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Créer le `.dockerignore`**

```
node_modules
.next
.git
*.md
badge.jpeg
specs/
```

- [ ] **Step 2: Créer le `Dockerfile.dev` (développement avec hot reload)**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

- [ ] **Step 3: Créer le `Dockerfile` (production multi-stage)**

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 4: Créer `docker-compose.dev.yml`**

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
    environment:
      - NODE_ENV=development
```

- [ ] **Step 5: Créer `docker-compose.yml`**

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

- [ ] **Step 6: Ajouter `output: "standalone"` dans `next.config.ts`**

Modifier `next.config.ts` pour activer le mode standalone requis par le Dockerfile de production :

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 7: Tester le build dev**

```bash
docker compose -f docker-compose.dev.yml up --build
```

Expected: l'app démarre sur `http://localhost:3000` avec hot reload fonctionnel.

- [ ] **Step 8: Tester le build prod**

```bash
docker compose up --build
```

Expected: l'app démarre sur `http://localhost:3000` en mode production.

- [ ] **Step 9: Commit**

```bash
git add Dockerfile Dockerfile.dev docker-compose.yml docker-compose.dev.yml .dockerignore next.config.ts
git commit -m "feat: add Docker setup with separate dev and prod configurations"
```

---

### Task 3 : Définition des types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Créer le fichier de types**

```typescript
// src/types/index.ts

export interface EventInfo {
  id: string;
  logo: string;
  title: string;
  location: string;
  date: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
}

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface Registration {
  id: string;
  photo: string;
  fullName: string;
  structure: string;
  teamId: string;
  status: RegistrationStatus;
}

export interface BadgeProps {
  registration: Registration;
  team: Team;
  event: EventInfo;
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core type definitions (EventInfo, Team, Registration, BadgeProps)"
```

---

### Task 4 : Génération d'identifiant unique — Tests

**Files:**
- Create: `src/lib/__tests__/generate-id.test.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/lib/__tests__/generate-id.test.ts
import { describe, it, expect } from "vitest";
import { generateId } from "../generate-id";

describe("generateId", () => {
  it("returns a string of 13 characters", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id).toHaveLength(13);
  });

  it("starts with the event type digit", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id[0]).toBe("1");
  });

  it("contains the date encoded as YYMMDD after the event type", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    expect(id.substring(1, 7)).toBe("260524");
  });

  it("has a 6-character alphanumeric suffix", () => {
    const id = generateId({ eventType: 1, date: "2026-05-24" });
    const suffix = id.substring(7);
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(
      Array.from({ length: 100 }, () =>
        generateId({ eventType: 1, date: "2026-05-24" })
      )
    );
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/lib/__tests__/generate-id.test.ts
```

Expected: FAIL — `Cannot find module '../generate-id'`

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/generate-id.test.ts
git commit -m "test: add failing tests for generateId"
```

---

### Task 5 : Génération d'identifiant unique — Implémentation

**Files:**
- Create: `src/lib/generate-id.ts`

- [ ] **Step 1: Implémenter generateId**

```typescript
// src/lib/generate-id.ts
import { randomBytes } from "crypto";

interface GenerateIdOptions {
  eventType: number;
  date: string; // format ISO "YYYY-MM-DD"
}

export function generateId({ eventType, date }: GenerateIdOptions): string {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const prefix = `${eventType}${yy}${mm}${dd}`;

  const bytes = randomBytes(4);
  const suffix = bytes
    .toString("hex")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");

  return `${prefix}${suffix}`;
}
```

- [ ] **Step 2: Lancer les tests**

```bash
npx vitest run src/lib/__tests__/generate-id.test.ts
```

Expected: tous les 5 tests passent.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generate-id.ts
git commit -m "feat: implement generateId with structured prefix and random suffix"
```

---

### Task 6 : Génération de QR code — Tests

**Files:**
- Create: `src/lib/__tests__/qrcode.test.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/lib/__tests__/qrcode.test.ts
import { describe, it, expect } from "vitest";
import { generateQRCodeDataURL } from "../qrcode";

describe("generateQRCodeDataURL", () => {
  it("returns a base64 PNG data URL", async () => {
    const dataUrl = await generateQRCodeDataURL("1260524A7F3B2");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns a non-empty image", async () => {
    const dataUrl = await generateQRCodeDataURL("1260524A7F3B2");
    const base64Part = dataUrl.split(",")[1];
    expect(base64Part.length).toBeGreaterThan(100);
  });

  it("produces different images for different inputs", async () => {
    const a = await generateQRCodeDataURL("AAA");
    const b = await generateQRCodeDataURL("BBB");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/lib/__tests__/qrcode.test.ts
```

Expected: FAIL — `Cannot find module '../qrcode'`

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/qrcode.test.ts
git commit -m "test: add failing tests for QR code generation"
```

---

### Task 7 : Génération de QR code — Implémentation

**Files:**
- Create: `src/lib/qrcode.ts`

- [ ] **Step 1: Implémenter generateQRCodeDataURL**

```typescript
// src/lib/qrcode.ts
import QRCode from "qrcode";

export async function generateQRCodeDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
```

- [ ] **Step 2: Lancer les tests**

```bash
npx vitest run src/lib/__tests__/qrcode.test.ts
```

Expected: tous les 3 tests passent.

- [ ] **Step 3: Commit**

```bash
git add src/lib/qrcode.ts
git commit -m "feat: implement QR code generation as base64 data URL"
```

---

### Task 8 : Composant BadgeDocument (le badge PDF complet)

**Files:**
- Create: `src/components/badge/BadgeDocument.tsx`

Le fichier `badge.jpeg` à la racine sert de référence visuelle. Le badge fait 100 × 140 mm.

- [ ] **Step 1: Créer le composant BadgeDocument**

```tsx
// src/components/badge/BadgeDocument.tsx
"use client";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { BadgeProps } from "@/types";

// Dimensions en points (1mm = 2.835pt)
const BADGE_WIDTH = 100 * 2.835; // ~283.5pt
const BADGE_HEIGHT = 140 * 2.835; // ~396.9pt

const styles = StyleSheet.create({
  page: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  qrCode: {
    width: 70,
    height: 70,
  },
  logo: {
    width: 70,
    height: 70,
    objectFit: "contain",
  },
  eventInfo: {
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.3,
  },
  eventDate: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
  },
  centralZone: {
    flexDirection: "row",
    marginTop: 10,
    flexGrow: 1,
  },
  idVertical: {
    width: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  idText: {
    fontSize: 7,
    transform: "rotate(-90deg)",
    width: 120,
    textAlign: "center",
    color: "#FFFFFF",
  },
  photoContainer: {
    width: 90,
    height: 100,
    backgroundColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: 90,
    height: 100,
    objectFit: "cover",
  },
  personInfo: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 10,
    paddingRight: 10,
  },
  fullName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  separator: {
    width: 40,
    height: 1,
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
  },
  structure: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  teamBanner: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  teamName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

interface BadgeDocumentProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgeDocument({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDocumentProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        {/* En-tête : QR code + Logo */}
        <View style={styles.header}>
          <Image src={qrCodeDataUrl} style={styles.qrCode} />
          {event.logo && <Image src={event.logo} style={styles.logo} />}
        </View>

        {/* Informations de l'événement */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>
            {event.location}, le {event.date}
          </Text>
        </View>

        {/* Zone centrale avec bandeau coloré */}
        <View style={[styles.centralZone, { backgroundColor: team.color }]}>
          {/* ID vertical */}
          <View style={styles.idVertical}>
            <Text style={styles.idText}>{registration.id}</Text>
          </View>

          {/* Photo */}
          <View style={styles.photoContainer}>
            {registration.photo ? (
              <Image src={registration.photo} style={styles.photo} />
            ) : (
              <Text style={{ fontSize: 8, color: "#666" }}>PHOTO</Text>
            )}
          </View>

          {/* Nom + Structure */}
          <View style={styles.personInfo}>
            <Text style={styles.fullName}>{registration.fullName}</Text>
            <View style={styles.separator} />
            <Text style={styles.structure}>{registration.structure}</Text>
          </View>
        </View>

        {/* Bandeau équipe */}
        <View style={[styles.teamBanner, { backgroundColor: team.color }]}>
          <Text style={styles.teamName}>{team.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/badge/BadgeDocument.tsx
git commit -m "feat: implement BadgeDocument PDF component matching badge.jpeg layout"
```

---

### Task 9 : Composants BadgePreview et BadgeDownload

**Files:**
- Create: `src/components/badge/BadgePreview.tsx`
- Create: `src/components/badge/BadgeDownload.tsx`

- [ ] **Step 1: Créer BadgePreview**

```tsx
// src/components/badge/BadgePreview.tsx
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgePreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgePreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgePreviewProps) {
  return (
    <PDFViewer width="100%" height={600} showToolbar={false}>
      <BadgeDocument
        registration={registration}
        team={team}
        event={event}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    </PDFViewer>
  );
}
```

- [ ] **Step 2: Créer BadgeDownload**

```tsx
// src/components/badge/BadgeDownload.tsx
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgeDownloadProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgeDownload({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDownloadProps) {
  const fileName = `badge-${registration.fullName.replace(/\s+/g, "-")}-${registration.id}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <BadgeDocument
          registration={registration}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      }
      fileName={fileName}
    >
      {({ loading }) =>
        loading ? "Génération du PDF..." : "Télécharger le badge PDF"
      }
    </PDFDownloadLink>
  );
}
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/badge/BadgePreview.tsx src/components/badge/BadgeDownload.tsx
git commit -m "feat: add BadgePreview (PDFViewer) and BadgeDownload (PDFDownloadLink) wrappers"
```

---

### Task 10 : Page de prévisualisation du badge

**Files:**
- Create: `src/app/badge/[id]/page.tsx`

Cette page utilise des données mock pour le moment (pas de backend). Elle sert à valider le rendu visuel du badge.

- [ ] **Step 1: Créer la page avec données mock**

```tsx
// src/app/badge/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { BadgePreview } from "@/components/badge/BadgePreview";
import { BadgeDownload } from "@/components/badge/BadgeDownload";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import type { EventInfo, Team, Registration } from "@/types";

// Données mock — à remplacer par les vraies données
const mockEvent: EventInfo = {
  id: "evt-001",
  logo: "",
  title: "Cérémonie d'investiture du Président de la République",
  location: "Porto-Novo",
  date: "24 mai 2026",
};

const mockTeam: Team = {
  id: "team-001",
  name: "PROTOCOLE",
  color: "#1a3a7c",
};

const mockRegistration: Registration = {
  id: "1260524A7F3B2",
  photo: "",
  fullName: "T. S. Gabin KAKPO",
  structure: "DGPEC",
  teamId: "team-001",
  status: "approved",
};

export default function BadgePage({ params }: { params: { id: string } }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    generateQRCodeDataURL(mockRegistration.id).then(setQrCodeDataUrl);
  }, []);

  if (!qrCodeDataUrl) {
    return <p>Chargement...</p>;
  }

  if (mockRegistration.status !== "approved") {
    return <p>Cette inscription n&apos;est pas encore validée.</p>;
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 18, marginBottom: 20 }}>Aperçu du badge</h1>

      <BadgePreview
        registration={mockRegistration}
        team={mockTeam}
        event={mockEvent}
        qrCodeDataUrl={qrCodeDataUrl}
      />

      <div style={{ marginTop: 20 }}>
        <BadgeDownload
          registration={mockRegistration}
          team={mockTeam}
          event={mockEvent}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lancer le dev server et vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/badge/test` et vérifier :
- Le badge s'affiche dans le viewer PDF
- Le layout correspond au `badge.jpeg` de référence
- Le lien de téléchargement génère un PDF valide
- Le QR code est visible et scannable

- [ ] **Step 3: Ajuster les styles si nécessaire**

Comparer visuellement avec `badge.jpeg`. Ajuster les marges, tailles de police, et proportions dans `BadgeDocument.tsx` jusqu'à correspondance fidèle.

- [ ] **Step 4: Commit**

```bash
git add src/app/badge/[id]/page.tsx
git commit -m "feat: add badge preview page with mock data"
```

---

### Task 11 : Lancer tous les tests et validation finale

- [ ] **Step 1: Lancer tous les tests**

```bash
npx vitest run
```

Expected: tous les tests passent (5 pour `generate-id`, 3 pour `qrcode`).

- [ ] **Step 2: Vérifier la compilation complète**

```bash
npx tsc --noEmit
```

Expected: aucune erreur TypeScript.

- [ ] **Step 3: Build de production**

```bash
npm run build
```

Expected: le build Next.js réussit sans erreur.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: verify all tests pass and production build succeeds"
```
