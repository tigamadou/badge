# Badge Evolutions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre à jour le style du badge, la génération d'ID, renommer Équipes→Catégories dans le front, et ajouter le toggle ALL_ACCESS_GRANTED.

**Architecture:** Modifications Prisma (2 champs), réécriture de generate-id, refonte du BadgeDocument avec @react-pdf/renderer, renommage des labels/routes front, ajout du toggle ALL ACCESS dans la page détail inscription.

**Tech Stack:** Next.js 14, Prisma (MySQL), @react-pdf/renderer, TypeScript, Vitest

---

## File Structure

### Fichiers modifiés
- `prisma/schema.prisma` — ajout `number` sur Team, `allAccessGranted` sur Registration
- `src/lib/generate-id.ts` — réécriture complète de la logique
- `src/lib/__tests__/generate-id.test.ts` — nouveaux tests
- `src/types/index.ts` — ajout `allAccessGranted` au type Registration
- `src/app/api/teams/route.ts` — accepter `number` dans POST
- `src/app/api/teams/[id]/route.ts` — accepter `number` dans PATCH
- `src/app/api/registrations/route.ts` — nouvelle logique generateId avec team.number + count
- `src/app/api/verify/[id]/route.ts` — inclure `allAccessGranted` dans la réponse
- `src/components/admin/TeamForm.tsx` — ajout champ numéro
- `src/components/admin/Sidebar.tsx` — renommer label + route
- `src/components/admin/RegistrationForm.tsx` — renommer label Équipe → Catégorie
- `src/components/badge/BadgeDocument.tsx` — refonte complète du layout
- `src/components/badge/BadgeWebPreview.tsx` — refonte pour matcher le nouveau style
- `src/components/badge/BadgePreview.tsx` — passer `allAccessGranted`
- `src/components/badge/BadgeDownload.tsx` — passer `allAccessGranted`
- `src/app/admin/registrations/page.tsx` — renommer "Équipe" → "Catégorie" dans le header + filtre
- `src/app/admin/registrations/[id]/page.tsx` — ajout toggle ALL ACCESS + renommage labels
- `src/app/badge/[id]/page.tsx` — passer `allAccessGranted`
- `src/app/badge-preview/[id]/page.tsx` — passer `allAccessGranted`

### Fichiers déplacés
- `src/app/admin/teams/page.tsx` → `src/app/admin/categories/page.tsx` (renommage labels)

---

### Task 1: Migration Prisma — ajout champs

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Ajouter les champs au schéma Prisma**

Dans `prisma/schema.prisma`, modifier le modèle `Team` :

```prisma
model Team {
  id            String         @id @default(cuid())
  name          String
  color         String
  number        Int            @unique
  registrations Registration[]
}
```

Et modifier le modèle `Registration` :

```prisma
model Registration {
  id               String             @id
  email            String
  lastName         String
  firstName        String
  structure        String
  photo            String?
  idDocumentType   String
  idDocumentNumber String
  idDocument       String?
  status           RegistrationStatus @default(PENDING)
  badgePrinted     Boolean            @default(false)
  badgePrintedAt   DateTime?
  allAccessGranted Boolean            @default(false)
  teamId           String
  team             Team               @relation(fields: [teamId], references: [id])
  createdAt        DateTime           @default(now())
}
```

- [ ] **Step 2: Générer et appliquer la migration**

Run: `cd /Users/amadou/Devs/projects/investiture && npx prisma migrate dev --name add-team-number-and-all-access`

Expected: Migration créée et appliquée. Si des données existent, il faudra peut-être fournir une valeur par défaut pour `number` — utiliser `0` temporairement si demandé par Prisma, puis mettre à jour manuellement.

- [ ] **Step 3: Régénérer le client Prisma**

Run: `npx prisma generate`

Expected: Prisma Client generated successfully

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add team.number and registration.allAccessGranted fields"
```

---

### Task 2: Réécriture de generate-id avec TDD

**Files:**
- Modify: `src/lib/generate-id.ts`
- Modify: `src/lib/__tests__/generate-id.test.ts`

- [ ] **Step 1: Écrire les nouveaux tests**

Remplacer le contenu de `src/lib/__tests__/generate-id.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { generateId } from "../generate-id";

describe("generateId", () => {
  const baseOptions = {
    categoryNumber: 1,
    date: "2026-05-24",
    sequentialNumber: 100,
  };

  it("starts with the category number", () => {
    const id = generateId(baseOptions);
    expect(id[0]).toBe("1");
  });

  it("contains the date encoded as YYMMDD at positions 1-6", () => {
    const id = generateId(baseOptions);
    expect(id.substring(1, 7)).toBe("260524");
  });

  it("has 2 random digits at positions 7-8", () => {
    const id = generateId(baseOptions);
    const spacer = id.substring(7, 9);
    expect(spacer).toMatch(/^\d{2}$/);
  });

  it("repeats the category number at position 9", () => {
    const id = generateId(baseOptions);
    expect(id[9]).toBe("1");
  });

  it("ends with the sequential number formatted as 3 digits", () => {
    const id = generateId(baseOptions);
    expect(id.substring(10)).toBe("100");
  });

  it("returns a string of 13 characters", () => {
    const id = generateId(baseOptions);
    expect(id).toHaveLength(13);
  });

  it("pads sequential number to 3 digits", () => {
    const id = generateId({ ...baseOptions, sequentialNumber: 1 });
    expect(id.substring(10)).toBe("001");
  });

  it("works with different category numbers", () => {
    const id = generateId({ ...baseOptions, categoryNumber: 5 });
    expect(id[0]).toBe("5");
    expect(id[9]).toBe("5");
  });

  it("has different random spacers on successive calls", () => {
    const spacers = new Set(
      Array.from({ length: 20 }, () => {
        const id = generateId(baseOptions);
        return id.substring(7, 9);
      })
    );
    // With 20 calls and 100 possible values, very likely to have at least 2 different
    expect(spacers.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/__tests__/generate-id.test.ts`

Expected: FAIL — la signature de `generateId` ne correspond plus

- [ ] **Step 3: Réécrire l'implémentation**

Remplacer le contenu de `src/lib/generate-id.ts` :

```typescript
// src/lib/generate-id.ts

interface GenerateIdOptions {
  categoryNumber: number; // chiffre unique 1-9
  date: string;           // format ISO "YYYY-MM-DD"
  sequentialNumber: number; // compteur auto-incrémenté par catégorie
}

export function generateId({ categoryNumber, date, sequentialNumber }: GenerateIdOptions): string {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const datePart = `${yy}${mm}${dd}`;
  const spacer = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  const seq = String(sequentialNumber).padStart(3, "0");

  return `${categoryNumber}${datePart}${spacer}${categoryNumber}${seq}`;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/__tests__/generate-id.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/generate-id.ts src/lib/__tests__/generate-id.test.ts
git commit -m "feat: rewrite generateId with category number and sequential counter"
```

---

### Task 3: Mise à jour de l'API registrations pour la nouvelle génération d'ID

**Files:**
- Modify: `src/app/api/registrations/route.ts`

- [ ] **Step 1: Modifier la route POST**

Dans `src/app/api/registrations/route.ts`, remplacer la section de génération d'ID. L'import change :

Remplacer :
```typescript
import { generateId } from "@/lib/generate-id";
```
par :
```typescript
import { generateId } from "@/lib/generate-id";
```
(même import, mais l'appel change)

Remplacer le bloc de génération d'ID (lignes 46-50) :
```typescript
  const event = await prisma.event.findFirst();
  const id = generateId({
    eventType: 1,
    date: event?.date || new Date().toISOString(),
  });
```

Par :
```typescript
  const event = await prisma.event.findFirst();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 400 });
  }

  const registrationCount = await prisma.registration.count({ where: { teamId } });
  const id = generateId({
    categoryNumber: team.number,
    date: event?.date || new Date().toISOString(),
    sequentialNumber: registrationCount + 1,
  });
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur de type

- [ ] **Step 3: Commit**

```bash
git add src/app/api/registrations/route.ts
git commit -m "feat: use category number and sequential counter in registration ID generation"
```

---

### Task 4: Mise à jour des types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Ajouter `allAccessGranted` au type Registration et `number` au type Team**

Dans `src/types/index.ts`, modifier :

```typescript
export interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
}
```

Et ajouter `allAccessGranted` à `Registration` :

```typescript
export interface Registration {
  id: string;
  email: string;
  photo: string;
  lastName: string;
  firstName: string;
  structure: string;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string;
  teamId: string;
  status: RegistrationStatus;
  allAccessGranted: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add allAccessGranted to Registration type and number to Team type"
```

---

### Task 5: API teams — accepter le champ `number`

**Files:**
- Modify: `src/app/api/teams/route.ts`
- Modify: `src/components/admin/TeamForm.tsx`

- [ ] **Step 1: Modifier la route POST teams**

Dans `src/app/api/teams/route.ts`, modifier la fonction POST :

Remplacer :
```typescript
  const { name, color } = await req.json();
  if (!name || !color) {
    return NextResponse.json({ error: "Nom et couleur requis" }, { status: 400 });
  }

  const team = await prisma.team.create({ data: { name, color } });
```

Par :
```typescript
  const { name, color, number } = await req.json();
  if (!name || !color || number === undefined) {
    return NextResponse.json({ error: "Nom, couleur et numéro requis" }, { status: 400 });
  }

  const team = await prisma.team.create({ data: { name, color, number } });
```

- [ ] **Step 2: Modifier le TeamForm pour ajouter le champ numéro**

Remplacer le contenu de `src/components/admin/TeamForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TeamFormProps {
  initialData?: { id: string; name: string; color: string; number?: number };
  onSubmit: (data: { name: string; color: string; number: number }) => Promise<void>;
  onCancel: () => void;
}

export function TeamForm({ initialData, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || "#1a3a7c");
  const [number, setNumber] = useState(initialData?.number ?? 1);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, color, number });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom de la catégorie" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Numéro (1-9)</label>
        <input
          type="number"
          min={1}
          max={9}
          value={number}
          onChange={(e) => setNumber(parseInt(e.target.value) || 1)}
          className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>
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

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur

- [ ] **Step 4: Commit**

```bash
git add src/app/api/teams/route.ts src/components/admin/TeamForm.tsx
git commit -m "feat: add category number field to team API and form"
```

---

### Task 6: Renommage Équipes → Catégories dans le front

**Files:**
- Move: `src/app/admin/teams/page.tsx` → `src/app/admin/categories/page.tsx`
- Modify: `src/components/admin/Sidebar.tsx`
- Modify: `src/components/admin/RegistrationForm.tsx`
- Modify: `src/app/admin/registrations/page.tsx`
- Modify: `src/app/admin/registrations/[id]/page.tsx`

- [ ] **Step 1: Déplacer et renommer la page teams → categories**

Run: `mv /Users/amadou/Devs/projects/investiture/src/app/admin/teams /Users/amadou/Devs/projects/investiture/src/app/admin/categories`

- [ ] **Step 2: Renommer les labels dans la page categories**

Dans `src/app/admin/categories/page.tsx`, effectuer les remplacements suivants :

- `<h1 className="text-2xl font-bold">Équipes</h1>` → `<h1 className="text-2xl font-bold">Catégories</h1>`
- `<Button onClick={() => setShowForm(true)}>Nouvelle équipe</Button>` → `<Button onClick={() => setShowForm(true)}>Nouvelle catégorie</Button>`
- `title="Supprimer l'équipe ?"` → `title="Supprimer la catégorie ?"`

Aussi, mettre à jour l'interface Team locale et les handlers pour inclure `number` :

```typescript
interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
  _count: { registrations: number };
}
```

Et les fonctions `handleCreate` et `handleEdit` :
```typescript
async function handleCreate(data: { name: string; color: string; number: number }) {
```
```typescript
async function handleEdit(data: { name: string; color: string; number: number }) {
```

Ajouter une colonne "Numéro" dans le tableau :
```typescript
<th className="text-left px-4 py-3">Numéro</th>
```
Et dans le tbody :
```typescript
<td className="px-4 py-3 font-mono">{team.number}</td>
```

- [ ] **Step 3: Renommer dans la Sidebar**

Dans `src/components/admin/Sidebar.tsx`, remplacer :
```typescript
{ href: "/admin/teams", label: "Équipes", minRole: "ADMIN" },
```
Par :
```typescript
{ href: "/admin/categories", label: "Catégories", minRole: "ADMIN" },
```

- [ ] **Step 4: Renommer dans RegistrationForm**

Dans `src/components/admin/RegistrationForm.tsx`, remplacer :
```typescript
label="Équipe"
```
Par :
```typescript
label="Catégorie"
```

- [ ] **Step 5: Renommer dans la page liste des inscriptions**

Dans `src/app/admin/registrations/page.tsx`, remplacer :
```typescript
<th className="text-left px-4 py-3">Équipe</th>
```
Par :
```typescript
<th className="text-left px-4 py-3">Catégorie</th>
```

Et remplacer :
```typescript
<option value="">Toutes les équipes</option>
```
Par :
```typescript
<option value="">Toutes les catégories</option>
```

- [ ] **Step 6: Renommer dans la page détail inscription**

Dans `src/app/admin/registrations/[id]/page.tsx`, le label équipe est affiché via `registration.team.name` dans le profil. Pas de label "Équipe" explicite à changer dans cette page (le nom de la team est affiché directement).

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rename Équipes to Catégories in front-end routes and labels"
```

---

### Task 7: Refonte du BadgeDocument (nouveau style)

**Files:**
- Modify: `src/components/badge/BadgeDocument.tsx`
- Modify: `src/types/index.ts` (déjà fait en Task 4)

- [ ] **Step 1: Réécrire BadgeDocument**

Remplacer le contenu complet de `src/components/badge/BadgeDocument.tsx` :

```typescript
// src/components/badge/BadgeDocument.tsx
"use client";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
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
  // En-tête blanc
  headerContainer: {
    height: BADGE_HEIGHT * 0.38,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: "contain",
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.3,
    color: "#1a3a7c",
  },
  eventDate: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
    color: "#4a6fa5",
  },
  // Zone centrale colorée
  centralZone: {
    flexGrow: 1,
    flexDirection: "column",
  },
  categoryBanner: {
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  contentRow: {
    flexDirection: "row",
    flexGrow: 1,
    paddingBottom: 8,
  },
  idVertical: {
    width: 22,
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
    height: 105,
    backgroundColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: 90,
    height: 105,
    objectFit: "cover",
  },
  personInfo: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  fullName: {
    fontSize: 13,
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
  qrCodeContainer: {
    alignItems: "flex-end",
    paddingRight: 10,
    paddingBottom: 10,
  },
  qrCode: {
    width: 55,
    height: 55,
  },
  // Bande ALL ACCESS
  allAccessBanner: {
    height: 45,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
  },
  allAccessText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
});

interface BadgeDocumentProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeDocument({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeDocumentProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        {/* En-tête blanc : Logo + Titre + Date */}
        <View style={styles.headerContainer}>
          {event.logo && <Image src={event.logo} style={styles.logo} />}
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>
            {event.location}, le {event.date}
          </Text>
        </View>

        {/* Zone centrale colorée */}
        <View style={[styles.centralZone, { backgroundColor: team.color }]}>
          {/* Nom de la catégorie */}
          <View style={styles.categoryBanner}>
            <Text style={styles.categoryName}>{team.name}</Text>
          </View>

          {/* Contenu : ID + Photo + Infos */}
          <View style={styles.contentRow}>
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
              <Text style={styles.fullName}>
                {registration.firstName[0]}. {registration.lastName}
              </Text>
              <View style={styles.separator} />
              <Text style={styles.structure}>{registration.structure}</Text>
            </View>
          </View>

          {/* QR Code en bas à droite */}
          <View style={styles.qrCodeContainer}>
            <Image src={qrCodeDataUrl} style={styles.qrCode} />
          </View>
        </View>

        {/* Bande ALL ACCESS (conditionnelle) */}
        {allAccessGranted && (
          <View style={styles.allAccessBanner}>
            <Text style={styles.allAccessText}>ALL ACCESS</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add src/components/badge/BadgeDocument.tsx
git commit -m "feat: redesign BadgeDocument layout with category banner and ALL ACCESS support"
```

---

### Task 8: Refonte du BadgeWebPreview

**Files:**
- Modify: `src/components/badge/BadgeWebPreview.tsx`

- [ ] **Step 1: Réécrire BadgeWebPreview pour matcher le nouveau style**

Remplacer le contenu de `src/components/badge/BadgeWebPreview.tsx` :

```typescript
// src/components/badge/BadgeWebPreview.tsx
"use client";

import type { BadgeProps } from "@/types";

interface BadgeWebPreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeWebPreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeWebPreviewProps) {
  return (
    <div
      className="relative bg-white font-sans overflow-hidden"
      style={{ width: "283px", height: "397px" }}
    >
      {/* En-tête blanc : Logo + Titre + Date */}
      <div
        className="flex flex-col items-center justify-center px-4"
        style={{ height: allAccessGranted ? "35%" : "38%" }}
      >
        {event.logo && (
          <img
            src={event.logo}
            alt="Logo"
            className="object-contain mb-1"
            style={{ width: 80, height: 80 }}
          />
        )}
        <p className="text-[10px] font-bold text-center leading-tight" style={{ color: "#1a3a7c" }}>
          {event.title}
        </p>
        <p className="text-[9px] mt-1 text-center" style={{ color: "#4a6fa5" }}>
          {event.location}, le {event.date}
        </p>
      </div>

      {/* Zone centrale colorée */}
      <div
        className="flex flex-col"
        style={{
          backgroundColor: team.color,
          height: allAccessGranted ? "53%" : "62%",
        }}
      >
        {/* Nom de la catégorie */}
        <div className="py-3 flex items-center justify-center">
          <span className="text-[26px] font-bold text-white uppercase tracking-widest">
            {team.name}
          </span>
        </div>

        {/* Contenu : ID + Photo + Infos */}
        <div className="flex flex-1">
          {/* ID vertical */}
          <div className="flex items-center justify-center" style={{ width: 22 }}>
            <span
              className="text-[7px] text-white text-center"
              style={{
                transform: "rotate(-90deg)",
                width: 120,
                display: "block",
              }}
            >
              {registration.id}
            </span>
          </div>

          {/* Photo */}
          <div
            className="bg-gray-300 flex items-center justify-center"
            style={{ width: 90, height: 105 }}
          >
            {registration.photo ? (
              <img
                src={registration.photo}
                alt="Photo"
                className="object-cover"
                style={{ width: 90, height: 105 }}
              />
            ) : (
              <span className="text-[8px] text-gray-500">PHOTO</span>
            )}
          </div>

          {/* Nom + Structure */}
          <div className="flex-1 flex flex-col justify-center px-3">
            <p className="text-[13px] font-bold text-white">
              {registration.firstName[0]}. {registration.lastName}
            </p>
            <div className="w-10 h-px bg-white my-1.5" />
            <p className="text-[10px] text-white">{registration.structure}</p>
          </div>
        </div>

        {/* QR Code en bas à droite */}
        <div className="flex justify-end pr-2 pb-2">
          <img
            src={qrCodeDataUrl}
            alt="QR Code"
            style={{ width: 55, height: 55 }}
          />
        </div>
      </div>

      {/* Bande ALL ACCESS */}
      {allAccessGranted && (
        <div
          className="flex items-center justify-center"
          style={{ height: "12%", backgroundColor: "#DC2626" }}
        >
          <span className="text-[24px] font-bold text-white tracking-widest">
            ALL ACCESS
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/badge/BadgeWebPreview.tsx
git commit -m "feat: redesign BadgeWebPreview to match new badge layout"
```

---

### Task 9: Propager `allAccessGranted` dans les composants badge

**Files:**
- Modify: `src/components/badge/BadgePreview.tsx`
- Modify: `src/components/badge/BadgeDownload.tsx`
- Modify: `src/app/badge/[id]/page.tsx`
- Modify: `src/app/badge-preview/[id]/page.tsx`
- Modify: `src/app/admin/registrations/[id]/page.tsx`
- Modify: `src/app/api/verify/[id]/route.ts`

- [ ] **Step 1: Modifier BadgePreview pour accepter `allAccessGranted`**

Dans `src/components/badge/BadgePreview.tsx`, modifier l'interface et le composant :

```typescript
// src/components/badge/BadgePreview.tsx
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgePreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgePreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgePreviewProps) {
  return (
    <PDFViewer width="100%" height={600} showToolbar={false}>
      <BadgeDocument
        registration={registration}
        team={team}
        event={event}
        qrCodeDataUrl={qrCodeDataUrl}
        allAccessGranted={allAccessGranted}
      />
    </PDFViewer>
  );
}
```

- [ ] **Step 2: Modifier BadgeDownload pour accepter `allAccessGranted`**

Dans `src/components/badge/BadgeDownload.tsx` :

```typescript
// src/components/badge/BadgeDownload.tsx
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import type { BadgeProps } from "@/types";

interface BadgeDownloadProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeDownload({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeDownloadProps) {
  const fileName = `badge-${registration.lastName}-${registration.firstName}-${registration.id}.pdf`.replace(/\s+/g, "-");

  return (
    <PDFDownloadLink
      document={
        <BadgeDocument
          registration={registration}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
          allAccessGranted={allAccessGranted}
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

- [ ] **Step 3: Modifier l'API verify pour inclure `allAccessGranted`**

Dans `src/app/api/verify/[id]/route.ts`, ajouter `allAccessGranted` dans la réponse :

Remplacer :
```typescript
    registration: {
      id: registration.id,
      lastName: registration.lastName,
      firstName: registration.firstName,
      structure: registration.structure,
      photo: registration.photo,
      status: registration.status,
      team: {
        name: registration.team.name,
        color: registration.team.color,
      },
    },
```

Par :
```typescript
    registration: {
      id: registration.id,
      lastName: registration.lastName,
      firstName: registration.firstName,
      structure: registration.structure,
      photo: registration.photo,
      status: registration.status,
      allAccessGranted: registration.allAccessGranted,
      team: {
        name: registration.team.name,
        color: registration.team.color,
      },
    },
```

- [ ] **Step 4: Modifier la page badge public**

Dans `src/app/badge/[id]/page.tsx`, ajouter `allAccessGranted` au cast du type `reg` :

Ajouter à l'interface du cast (après `team`) :
```typescript
    allAccessGranted: boolean;
```

Et passer la prop aux composants BadgePreview et BadgeDownload :
```typescript
  <BadgePreview registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} allAccessGranted={reg.allAccessGranted} />
```
```typescript
  <BadgeDownload registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} allAccessGranted={reg.allAccessGranted} />
```

- [ ] **Step 5: Modifier la page badge-preview**

Dans `src/app/badge-preview/[id]/page.tsx`, même pattern : ajouter `allAccessGranted` au cast et le passer à BadgeWebPreview :

Ajouter à l'interface du cast :
```typescript
    allAccessGranted: boolean;
```

Et passer la prop :
```typescript
  <BadgeWebPreview
    registration={registration}
    team={team}
    event={event}
    qrCodeDataUrl={qrCodeDataUrl}
    allAccessGranted={reg.allAccessGranted}
  />
```

- [ ] **Step 6: Modifier la page détail inscription admin**

Dans `src/app/admin/registrations/[id]/page.tsx`, ajouter `allAccessGranted` à l'interface Registration locale :

```typescript
  allAccessGranted: boolean;
```

Et passer la prop aux composants badge :
```typescript
  <BadgePreview
    registration={badgeRegistration}
    team={registration.team}
    event={badgeEvent}
    qrCodeDataUrl={qrCodeDataUrl}
    allAccessGranted={registration.allAccessGranted}
  />
```
```typescript
  <BadgeDownload
    registration={badgeRegistration}
    team={registration.team}
    event={badgeEvent}
    qrCodeDataUrl={qrCodeDataUrl}
    allAccessGranted={registration.allAccessGranted}
  />
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur

- [ ] **Step 8: Commit**

```bash
git add src/components/badge/ src/app/badge/ src/app/badge-preview/ src/app/api/verify/ src/app/admin/registrations/
git commit -m "feat: propagate allAccessGranted through all badge components"
```

---

### Task 10: Toggle ALL ACCESS dans la page détail inscription

**Files:**
- Modify: `src/app/admin/registrations/[id]/page.tsx`

- [ ] **Step 1: Ajouter le bouton toggle ALL ACCESS**

Dans `src/app/admin/registrations/[id]/page.tsx`, ajouter une fonction `toggleAllAccess` après `markAsPrinted` :

```typescript
  async function toggleAllAccess() {
    await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allAccessGranted: !registration!.allAccessGranted }),
    });
    const res = await fetch(`/api/registrations/${id}`);
    setRegistration(await res.json());
  }
```

- [ ] **Step 2: Ajouter le bouton dans le JSX**

Dans la section des actions (le `div` avec `className="border-t px-6 py-4 flex flex-col items-center gap-3"`), ajouter après le bloc de validation/rejet et avant le bloc `markAsPrinted` :

```typescript
            {registration.status === "APPROVED" && !registration.badgePrinted && (
              <Button
                variant={registration.allAccessGranted ? "danger" : "secondary"}
                onClick={toggleAllAccess}
              >
                {registration.allAccessGranted ? "Désactiver ALL ACCESS" : "Activer ALL ACCESS"}
              </Button>
            )}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`

Expected: Pas d'erreur

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/registrations/[id]/page.tsx
git commit -m "feat: add ALL ACCESS toggle in registration detail page"
```

---

### Task 11: Vérification finale

- [ ] **Step 1: Lancer tous les tests**

Run: `npx vitest run`

Expected: Tous les tests passent

- [ ] **Step 2: Lancer le build**

Run: `npx next build`

Expected: Build réussi sans erreur

- [ ] **Step 3: Commit final si nécessaire**

Si des corrections ont été faites :
```bash
git add -A
git commit -m "fix: address build issues from badge evolutions"
```
