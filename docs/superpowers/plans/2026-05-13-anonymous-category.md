# Catégorie Anonyme — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre la création de catégories "anonymes" dont les badges n'affichent aucune information personnelle — uniquement l'entête événement, catégorie, numéro et QR code centré.

**Architecture:** Ajout d'un champ `anonymous` sur le modèle `Team`. Les catégories anonymes sont invisibles sur le formulaire public. L'API de création d'inscription détecte les catégories anonymes pour rendre les champs personnels optionnels, créer directement en APPROVED, et ne pas envoyer d'email. Un nouveau composant `BadgeDocumentAnonymous` avec un layout centré autour du QR code est utilisé pour le rendu PDF.

**Tech Stack:** Prisma (MySQL), Next.js 16 App Router, React 19, @react-pdf/renderer, TypeScript

---

### Task 1: Migration Prisma — Ajouter le champ `anonymous` sur Team

**Files:**
- Modify: `prisma/schema.prisma:37-44`

- [ ] **Step 1: Ajouter le champ au schéma Prisma**

Dans `prisma/schema.prisma`, ajouter le champ `anonymous` au modèle `Team` :

```prisma
model Team {
  id            String         @id @default(cuid())
  name          String
  color         String
  number        Int            @unique
  neutralBadge  Boolean        @default(false)
  anonymous     Boolean        @default(false)
  registrations Registration[]
}
```

- [ ] **Step 2: Générer et appliquer la migration**

```bash
npx prisma migrate dev --name add_team_anonymous
```

Expected: Migration créée avec succès, un fichier SQL ajoutant la colonne `anonymous` avec `DEFAULT false`.

- [ ] **Step 3: Vérifier le client Prisma généré**

```bash
npx prisma generate
```

Expected: Client généré sans erreur.

---

### Task 2: API Teams — Supporter le champ `anonymous`

**Files:**
- Modify: `src/app/api/teams/route.ts:31-36`
- Modify: `src/app/api/teams/[id]/route.ts:16-19`

- [ ] **Step 1: Modifier POST /api/teams pour accepter `anonymous`**

Dans `src/app/api/teams/route.ts`, modifier la route POST pour extraire et persister le champ `anonymous` :

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { name, color, number, neutralBadge, anonymous } = await req.json();
  if (!name || !color || number === undefined) {
    return NextResponse.json({ error: "Nom, couleur et numéro requis" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: { name, color, number, neutralBadge: neutralBadge ?? false, anonymous: anonymous ?? false },
  });

  await logActivity({
    type: "CATEGORY_CREATED",
    userId: session.user.id,
    targetId: team.id,
    details: { categoryName: name, color, number, anonymous: anonymous ?? false },
  });

  return NextResponse.json(team, { status: 201 });
}
```

- [ ] **Step 2: Modifier PATCH /api/teams/[id] pour accepter `anonymous`**

Dans `src/app/api/teams/[id]/route.ts`, modifier la route PATCH :

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const team = await prisma.team.update({
    where: { id },
    data: {
      name: data.name,
      color: data.color,
      ...(data.neutralBadge !== undefined && { neutralBadge: data.neutralBadge }),
      ...(data.anonymous !== undefined && { anonymous: data.anonymous }),
    },
  });

  await logActivity({
    type: "CATEGORY_UPDATED",
    userId: session.user.id,
    targetId: id,
    details: { categoryName: team.name },
  });

  return NextResponse.json(team);
}
```

- [ ] **Step 3: Vérifier que GET /api/teams retourne `anonymous`**

Le GET existant utilise `prisma.team.findMany()` qui retourne tous les champs. Le champ `anonymous` sera automatiquement inclus. Aucune modification nécessaire.

---

### Task 3: Formulaire admin catégorie — Ajouter la checkbox `anonymous`

**Files:**
- Modify: `src/components/admin/TeamForm.tsx`
- Modify: `src/app/admin/categories/page.tsx`

- [ ] **Step 1: Modifier TeamForm pour inclure le champ `anonymous`**

Dans `src/components/admin/TeamForm.tsx` :

```typescript
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TeamFormProps {
  initialData?: { id: string; name: string; color: string; number?: number; neutralBadge?: boolean; anonymous?: boolean };
  onSubmit: (data: { name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function TeamForm({ initialData, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || "#1a3a7c");
  const [number, setNumber] = useState(initialData?.number ?? 1);
  const [neutralBadge, setNeutralBadge] = useState(initialData?.neutralBadge ?? false);
  const [anonymous, setAnonymous] = useState(initialData?.anonymous ?? false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, color, number, neutralBadge, anonymous });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom de la catégorie" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Numéro (1-9)</label>
        <input
          type="number"
          min={1}
          max={9}
          value={number}
          onChange={(e) => setNumber(parseInt(e.target.value) || 1)}
          className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Couleur</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" />
      </div>
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={neutralBadge}
          onChange={(e) => setNeutralBadge(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-slate-700">Badge neutre (fond blanc, couleur sur le texte)</span>
      </label>
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-slate-700">Catégorie anonyme (badge sans informations personnelles, invisible sur le formulaire public)</span>
      </label>
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

- [ ] **Step 2: Modifier la page catégories pour passer `anonymous` dans les données**

Dans `src/app/admin/categories/page.tsx`, mettre à jour l'interface `Team` locale et ajouter un indicateur visuel :

Ajouter `anonymous?: boolean` à l'interface `Team` (ligne 9-15) :

```typescript
interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
  anonymous?: boolean;
  _count: { registrations: number };
}
```

Ajouter un badge visuel dans la colonne "Nom" de la table desktop (dans le `teams.map`, colonne nom) :

```tsx
<td className="px-4 py-3 font-medium">
  {team.name}
  {team.anonymous && (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
      Anonyme
    </span>
  )}
</td>
```

Et le même badge dans les cards mobiles :

```tsx
<span className="font-medium text-slate-700">
  {team.name}
  {team.anonymous && (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
      Anonyme
    </span>
  )}
</span>
```

---

### Task 4: Formulaire d'inscription — Filtrer les catégories anonymes

**Files:**
- Modify: `src/components/admin/RegistrationForm.tsx:71-74`
- Modify: `src/app/api/teams/route.ts:7-22` (GET)

- [ ] **Step 1: Modifier GET /api/teams pour supporter le filtre `excludeAnonymous`**

Dans `src/app/api/teams/route.ts`, ajouter un paramètre de query `excludeAnonymous` :

```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const excludeAnonymous = searchParams.get("excludeAnonymous") === "true";

  const where: Record<string, unknown> = {};
  if (excludeAnonymous) {
    where.anonymous = false;
  }

  const [total, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { registrations: true } } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data: teams, total, page, totalPages: Math.ceil(total / limit) });
}
```

- [ ] **Step 2: Modifier RegistrationForm pour recevoir une prop `excludeAnonymous`**

Dans `src/components/admin/RegistrationForm.tsx`, modifier l'interface et le fetch des teams :

Ajouter la prop `excludeAnonymousTeams` à `RegistrationFormProps` :

```typescript
interface RegistrationFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
  showCaptcha?: boolean;
  captchaWidget?: React.ReactNode;
  defaultValues?: RegistrationDefaultValues;
  excludeAnonymousTeams?: boolean;
}
```

Modifier la signature du composant et le useEffect (ligne 56-75) :

```typescript
export function RegistrationForm({
  onSubmit,
  submitLabel = "Soumettre",
  captchaWidget,
  defaultValues,
  excludeAnonymousTeams = false,
}: RegistrationFormProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [idDocFileName, setIdDocFileName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idDocInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (excludeAnonymousTeams) params.set("excludeAnonymous", "true");
    fetch(`/api/teams?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setTeams(data.data || data));
  }, [excludeAnonymousTeams]);
```

- [ ] **Step 3: Passer `excludeAnonymousTeams` dans la page publique**

Dans `src/app/page.tsx`, ligne 166, ajouter la prop :

```tsx
<RegistrationForm
  onSubmit={handleSubmit}
  submitLabel="S'inscrire"
  excludeAnonymousTeams={true}
  captchaWidget={...}
/>
```

---

### Task 5: API Registrations — Supporter les inscriptions anonymes

**Files:**
- Modify: `src/app/api/registrations/route.ts:48-149`

- [ ] **Step 1: Modifier POST /api/registrations pour les catégories anonymes**

Remplacer la fonction POST dans `src/app/api/registrations/route.ts` :

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, lastName, firstName, structure, teamId, photo, idDocumentType, idDocumentNumber, idDocument, captchaToken } = body;

  if (!teamId) {
    return NextResponse.json({ error: "Catégorie requise" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  // Les catégories anonymes ne sont accessibles qu'aux utilisateurs authentifiés
  if (team.anonymous) {
    if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  // Pour les catégories NON anonymes, tous les champs sont requis
  if (!team.anonymous) {
    if (!email || !lastName || !firstName || !structure || !idDocumentType || !idDocumentNumber || !photo || !idDocument) {
      return NextResponse.json({ error: "Champs requis manquants (photo et pièce d'identité incluses)" }, { status: 400 });
    }

    // Vérifier si l'email est bloqué
    if (email) {
      const blocked = await prisma.blockedEmail.findUnique({ where: { email } });
      if (blocked) {
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 400 });
      }
    }

    // Vérifier si une inscription existe déjà pour cet email
    const existing = await prisma.registration.findFirst({ where: { email } });
    if (existing) {
      if (existing.status === "PENDING") {
        return NextResponse.json({ error: "Une inscription est déjà en cours de traitement pour cette adresse email." }, { status: 409 });
      }
      if (existing.status === "APPROVED") {
        return NextResponse.json({ error: "Une inscription validée existe déjà pour cette adresse email." }, { status: 409 });
      }
      if (existing.status === "REJECTED") {
        return NextResponse.json({ error: "Votre inscription a été rejetée. Vous pouvez demander un lien pour la modifier.", canResend: true, email }, { status: 409 });
      }
    }
  }

  // Vérifier CAPTCHA pour les appels publics (pas de session)
  if (!session?.user) {
    const settings = await prisma.settings.findFirst();
    if (settings?.recaptchaEnabled) {
      if (!captchaToken) {
        return NextResponse.json({ error: "CAPTCHA requis" }, { status: 400 });
      }
      const captchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${settings.recaptchaSecretKey}&response=${captchaToken}`,
      });
      const captchaData = await captchaRes.json();
      if (!captchaData.success) {
        return NextResponse.json({ error: "CAPTCHA invalide" }, { status: 400 });
      }
    }
  }

  const event = await prisma.event.findFirst();

  const registrationCount = await prisma.registration.count({ where: { teamId } });
  const id = generateId({
    categoryNumber: team.number,
    date: event?.date ? event.date.toISOString() : new Date().toISOString(),
    sequentialNumber: registrationCount + 1,
  });

  const registration = await prisma.registration.create({
    data: {
      id,
      email: email || "",
      lastName: lastName || "",
      firstName: firstName || "",
      structure: structure || "",
      teamId,
      photo: photo || null,
      idDocumentType: idDocumentType || "",
      idDocumentNumber: idDocumentNumber || "",
      idDocument: idDocument || null,
      ...(team.anonymous && { status: "APPROVED" }),
    },
    include: { team: true },
  });

  // Créer un snapshot de la soumission initiale
  await prisma.submissionSnapshot.create({
    data: {
      registrationId: registration.id,
      lastName: lastName || "",
      firstName: firstName || "",
      email: email || "",
      structure: structure || "",
      teamId,
      idDocumentType: idDocumentType || "",
      idDocumentNumber: idDocumentNumber || "",
      photo: photo || null,
      idDocument: idDocument || null,
    },
  });

  // Ne pas envoyer d'email pour les catégories anonymes
  if (!team.anonymous && email) {
    try {
      await sendRegistrationConfirmation(email, `${firstName} ${lastName}`);
    } catch (e) {
      console.error("Failed to send confirmation email:", e);
    }
  }

  await logActivity({
    type: "REGISTRATION_CREATED",
    userId: session?.user?.id,
    targetId: registration.id,
    details: {
      registrationName: team.anonymous ? "(anonyme)" : `${firstName} ${lastName}`,
      structure: structure || "",
      teamName: team.name,
      source: session?.user ? "admin" : "public",
      anonymous: team.anonymous,
    },
  });

  return NextResponse.json(registration, { status: 201 });
}
```

---

### Task 6: Type TypeScript — Ajouter `anonymous` au type Team

**Files:**
- Modify: `src/types/index.ts:9-15`

- [ ] **Step 1: Ajouter `anonymous` à l'interface Team**

Dans `src/types/index.ts` :

```typescript
export interface Team {
  id: string;
  name: string;
  color: string;
  number: number;
  neutralBadge: boolean;
  anonymous: boolean;
}
```

---

### Task 7: Créer le composant BadgeDocumentAnonymous

**Files:**
- Create: `src/components/badge/BadgeDocumentAnonymous.tsx`

- [ ] **Step 1: Créer le composant BadgeDocumentAnonymous**

Créer `src/components/badge/BadgeDocumentAnonymous.tsx` :

```typescript
// src/components/badge/BadgeDocumentAnonymous.tsx
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
import type { EventInfo, Team } from "@/types";

Font.register({
  family: "Montserrat",
  fonts: [
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf", fontWeight: 700 },
  ],
});

const BADGE_WIDTH = 100 * 2.835;
const BADGE_HEIGHT = 140 * 2.835;

const styles = StyleSheet.create({
  page: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Montserrat",
    position: "relative",
  },
  container: {
    flexDirection: "column",
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 14,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: "contain",
    marginRight: 20,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: "column",
  },
  eventTitle: {
    fontSize: 10,
    fontFamily: "Montserrat",
    lineHeight: 1.3,
    color: "#1a3a7c",
    fontWeight: "600",
    paddingRight: 10,
  },
  eventDate: {
    fontSize: 10,
    marginTop: 8,
    color: "#4a6fa5",
  },
  separatorLine: {
    height: 1,
    backgroundColor: "#1a3a7c",
    marginHorizontal: 30,
    marginBottom: 15,
  },
  contentArea: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  qrCode: {
    width: 120,
    height: 120,
  },
  idText: {
    fontSize: 16,
    fontFamily: "Montserrat",
    fontWeight: "600",
    color: "#000000",
    marginTop: 12,
    textAlign: "center",
  },
  categoryBanner: {
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 26,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
});

interface BadgeDocumentAnonymousProps {
  registrationId: string;
  team: Team;
  event: EventInfo;
  qrCodeDataUrl: string;
}

export function BadgeDocumentAnonymous({
  registrationId,
  team,
  event,
  qrCodeDataUrl,
}: BadgeDocumentAnonymousProps) {
  return (
    <Document>
      <Page size={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }} style={styles.page}>
        <View style={styles.container}>
          {/* En-tete : logo + titre + date */}
          <View style={styles.headerContainer}>
            {event.logo && <Image src={event.logo} style={styles.logo} />}
            <View style={styles.headerTextContainer}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>
                {event.location}, le {event.date}
              </Text>
            </View>
          </View>

          {/* Ligne de separation */}
          <View style={styles.separatorLine} />

          {/* Zone contenu centree : QR code + numero */}
          <View style={styles.contentArea}>
            <Image src={qrCodeDataUrl} style={styles.qrCode} />
            <Text style={styles.idText}>{registrationId}</Text>
          </View>

          {/* Bande categorie en bas */}
          <View style={[styles.categoryBanner, {
            backgroundColor: team.neutralBadge ? "#FFFFFF" : team.color,
            height: 120,
            ...(team.neutralBadge ? { borderTopWidth: 1, borderTopColor: "#E2E8F0" } : {}),
          }]}>
            <Text style={[styles.categoryName, team.neutralBadge ? { color: team.color } : {}]}>{team.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

---

### Task 8: Modifier BadgePreview, BadgeDownload et BadgeBatchExport

**Files:**
- Modify: `src/components/badge/BadgePreview.tsx`
- Modify: `src/components/badge/BadgeDownload.tsx`
- Modify: `src/components/badge/BadgeBatchExport.tsx`

- [ ] **Step 1: Modifier BadgePreview pour supporter les badges anonymes**

Dans `src/components/badge/BadgePreview.tsx` :

```typescript
// src/components/badge/BadgePreview.tsx
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import { BadgeDocumentAnonymous } from "./BadgeDocumentAnonymous";
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
      {team.anonymous ? (
        <BadgeDocumentAnonymous
          registrationId={registration.id}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ) : (
        <BadgeDocument
          registration={registration}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
          allAccessGranted={allAccessGranted}
        />
      )}
    </PDFViewer>
  );
}
```

- [ ] **Step 2: Modifier BadgeDownload pour supporter les badges anonymes**

Dans `src/components/badge/BadgeDownload.tsx` :

```typescript
// src/components/badge/BadgeDownload.tsx
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { BadgeDocument } from "./BadgeDocument";
import { BadgeDocumentAnonymous } from "./BadgeDocumentAnonymous";
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
  const fileName = team.anonymous
    ? `badge-${registration.id}.pdf`
    : `badge-${registration.lastName}-${registration.firstName}-${registration.id}.pdf`.replace(/\s+/g, "-");

  const document = team.anonymous ? (
    <BadgeDocumentAnonymous
      registrationId={registration.id}
      team={team}
      event={event}
      qrCodeDataUrl={qrCodeDataUrl}
    />
  ) : (
    <BadgeDocument
      registration={registration}
      team={team}
      event={event}
      qrCodeDataUrl={qrCodeDataUrl}
      allAccessGranted={allAccessGranted}
    />
  );

  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading }) =>
        loading ? "Génération du PDF..." : "Télécharger le badge PDF"
      }
    </PDFDownloadLink>
  );
}
```

- [ ] **Step 3: Modifier BadgeBatchExport pour supporter les badges anonymes**

Dans `src/components/badge/BadgeBatchExport.tsx`, ajouter l'import de `BadgeDocumentAnonymous` et modifier la boucle d'export :

Ajouter l'import en haut du fichier :

```typescript
import { BadgeDocumentAnonymous } from "./BadgeDocumentAnonymous";
```

Ajouter `anonymous` à l'interface `RegistrationData.team` (ligne 24) :

```typescript
team: { id: string; name: string; color: string; number: number; neutralBadge: boolean; anonymous: boolean };
```

Modifier la génération du blob dans la boucle `for` (lignes 83-91) :

```typescript
        const badgeComponent = reg.team.anonymous ? (
          <BadgeDocumentAnonymous
            registrationId={reg.id}
            team={reg.team}
            event={badgeEvent}
            qrCodeDataUrl={qrCodeDataUrl}
          />
        ) : (
          <BadgeDocument
            registration={badgeRegistration}
            team={reg.team}
            event={badgeEvent}
            qrCodeDataUrl={qrCodeDataUrl}
            allAccessGranted={reg.allAccessGranted}
          />
        );

        const blob = await pdf(badgeComponent).toBlob();
```

Modifier le nom de fichier dans le zip (ligne 93) :

```typescript
        const fileName = reg.team.anonymous
          ? `badge-${reg.id}.pdf`
          : `badge-${reg.lastName}-${reg.firstName}-${reg.id}.pdf`.replace(/\s+/g, "-");
```

---

### Task 9: Formulaire admin d'inscription — Adapter pour les catégories anonymes

**Files:**
- Modify: `src/components/admin/RegistrationForm.tsx`
- Modify: `src/app/admin/registrations/new/page.tsx`

- [ ] **Step 1: Modifier RegistrationForm pour rendre les champs optionnels si catégorie anonyme**

Dans `src/components/admin/RegistrationForm.tsx`, ajouter la gestion des catégories anonymes. L'interface Team locale doit inclure `anonymous` :

```typescript
interface Team {
  id: string;
  name: string;
  anonymous?: boolean;
}
```

Ajouter un état pour suivre si la catégorie sélectionnée est anonyme. Après le state `idDocInputRef` (ligne 69) :

```typescript
const [selectedTeamAnonymous, setSelectedTeamAnonymous] = useState(false);
```

Ajouter une fonction pour gérer le changement de catégorie, après le useEffect des teams :

```typescript
function handleTeamChange(teamId: string) {
  const team = teams.find((t) => t.id === teamId);
  setSelectedTeamAnonymous(team?.anonymous ?? false);
}
```

Modifier le `handleSubmit` pour ne pas valider photo/idDoc si anonyme (lignes 86-93) :

```typescript
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhotoError(null);
    setIdDocError(null);

    const formData = new FormData(e.currentTarget);

    if (!selectedTeamAnonymous) {
      const idDocFile = formData.get("idDocument") as File | null;
      const photoFile = formData.get("photo") as File | null;

      if (!idDocFile || idDocFile.size === 0) {
        setIdDocError("Le document d'identité est obligatoire.");
        return;
      }

      if (!photoFile || photoFile.size === 0) {
        setPhotoError("La photo d'identité est obligatoire.");
        return;
      }

      if (photoFile.size > 0) {
        const valid = await validatePhotoRatio(photoFile);
        if (!valid) {
          setPhotoError("La photo doit avoir un ratio 35:45 (ex. 350×450px, 700×900px).");
          return;
        }
      }
    }

    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  }
```

Modifier le Select de catégorie pour appeler `handleTeamChange` :

```tsx
<Select
  label="Catégorie"
  name="teamId"
  options={teams.map((t) => ({ value: t.id, label: t.name }))}
  required
  defaultValue={defaultValues?.teamId}
  onChange={(e) => handleTeamChange(e.target.value)}
/>
```

Rendre les champs conditionnellement optionnels quand la catégorie est anonyme. Les inputs `required` doivent être conditionnels :

```tsx
<Input label="Nom (tel que sur le document d'identité)" name="lastName" required={!selectedTeamAnonymous} defaultValue={defaultValues?.lastName} />
<Input label="Prénom(s) (tel que sur le document d'identité)" name="firstName" required={!selectedTeamAnonymous} defaultValue={defaultValues?.firstName} />
<Input label="Email" name="email" type="email" required={!selectedTeamAnonymous} defaultValue={defaultValues?.email} />
<Input label="Structure / Organisation" name="structure" required={!selectedTeamAnonymous} defaultValue={defaultValues?.structure} />
```

Et les sélects :

```tsx
<Select
  label="Type de document d'identité"
  name="idDocumentType"
  options={ID_DOCUMENT_TYPES}
  required={!selectedTeamAnonymous}
  defaultValue={defaultValues?.idDocumentType}
/>
<Input label="Numéro du document d'identité" name="idDocumentNumber" required={!selectedTeamAnonymous} defaultValue={defaultValues?.idDocumentNumber} />
```

- [ ] **Step 2: Vérifier que la page admin new registration fonctionne**

Dans `src/app/admin/registrations/new/page.tsx`, le `RegistrationForm` ne passe pas `excludeAnonymousTeams`, donc toutes les catégories (y compris anonymes) seront visibles — c'est le comportement voulu pour l'admin. Aucune modification nécessaire.

---
