# Modification d'inscription après rejet — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux inscrits rejetés de modifier et resoumettre leur inscription via un lien unique sécurisé envoyé par email.

**Architecture:** Au rejet, un token UUID + date d'expiration (48h) sont stockés sur le modèle Registration. L'email de rejet contient un lien `/edit-registration/<token>`. L'inscrit accède à un formulaire pré-rempli, modifie ses infos, et resoumet. Le statut repasse à PENDING et le token est supprimé. Si le lien est expiré, un bouton permet de renvoyer un nouveau lien.

**Tech Stack:** Next.js 15 (App Router), Prisma (MySQL), nodemailer, uuid

---

## File Structure

| Action | File | Responsabilité |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Ajouter `editToken` et `editTokenExpiresAt` sur Registration |
| Modify | `prisma/schema.prisma` | Ajouter `REGISTRATION_RESUBMITTED` à ActivityType |
| Create | `src/app/api/edit-registration/[token]/route.ts` | GET (charger inscription) + POST (resoumettre) |
| Create | `src/app/api/edit-registration/[token]/resend/route.ts` | POST (renvoyer le lien) |
| Create | `src/app/edit-registration/[token]/page.tsx` | Page publique de modification |
| Modify | `src/app/api/registrations/[id]/route.ts` | Générer le token au rejet |
| Modify | `src/lib/mail.ts` | Ajouter `sendRejectionWithEditLink`, modifier `sendStatusNotification` |
| Modify | `src/app/admin/registrations/[id]/page.tsx` | Afficher le lien de modification pour les inscriptions rejetées |
| Modify | `src/components/admin/RegistrationForm.tsx` | Ajouter prop `defaultValues` pour le mode édition |

---

### Task 1: Schema Prisma — ajout des champs editToken

**Files:**
- Modify: `prisma/schema.prisma:44-63` (model Registration)
- Modify: `prisma/schema.prisma:87-109` (enum ActivityType)

- [ ] **Step 1: Ajouter les champs au modèle Registration**

Dans `prisma/schema.prisma`, ajouter après `rejectionDetails` :

```prisma
  editToken          String?   @unique
  editTokenExpiresAt DateTime?
```

- [ ] **Step 2: Ajouter REGISTRATION_RESUBMITTED à ActivityType**

Dans `prisma/schema.prisma`, ajouter dans l'enum `ActivityType` :

```prisma
  REGISTRATION_RESUBMITTED
```

- [ ] **Step 3: Générer le client Prisma et appliquer la migration**

Run: `npx prisma migrate dev --name add-edit-token`
Expected: Migration créée et appliquée, client Prisma régénéré.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "schema: add editToken, editTokenExpiresAt, REGISTRATION_RESUBMITTED"
```

---

### Task 2: Générer le token au rejet

**Files:**
- Modify: `src/app/api/registrations/[id]/route.ts:27-103`

- [ ] **Step 1: Ajouter l'import uuid**

En haut de `src/app/api/registrations/[id]/route.ts` :

```typescript
import { randomUUID } from "crypto";
```

- [ ] **Step 2: Générer le token lors du rejet**

Dans la fonction `PATCH`, juste avant `const registration = await prisma.registration.update(...)`, ajouter :

```typescript
  // Générer un token de modification si rejet
  if (data.status === "REJECTED") {
    data.editToken = randomUUID();
    data.editTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }
```

- [ ] **Step 3: Passer le editToken à sendStatusNotification**

Modifier l'appel à `sendStatusNotification` dans le bloc `if (data.status && ...)` pour passer le token :

```typescript
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        data.status,
        data.rejectionReason,
        data.rejectionDetails,
        registration.editToken
      );
    } catch (e) {
      console.error("Failed to send status notification:", e);
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/registrations/[id]/route.ts
git commit -m "registrations: generate editToken on rejection"
```

---

### Task 3: Email de rejet avec lien de modification

**Files:**
- Modify: `src/lib/mail.ts:108-153`

- [ ] **Step 1: Ajouter le paramètre editToken à sendStatusNotification**

Modifier la signature de `sendStatusNotification` :

```typescript
export async function sendStatusNotification(
  to: string,
  fullName: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string,
  rejectionDetails?: string,
  editToken?: string | null
): Promise<void> {
```

- [ ] **Step 2: Ajouter le lien de modification dans l'email de rejet**

Dans le bloc `else` (rejet), après `detailsBlock` et avant la construction de `body`, ajouter :

```typescript
    const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";
    const editBlock = editToken
      ? `<p style="margin:0 0 24px;text-align:center;">
          <a href="${baseUrl}/edit-registration/${editToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Modifier et resoumettre mon inscription</a>
        </p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>`
      : "";
```

Puis modifier `body` pour inclure `editBlock` :

```typescript
    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Nous sommes désolés, votre inscription a été <span style="color:#e11d48;font-weight:600;">rejetée</span>.</p>
      ${reasonBlock}
      ${detailsBlock}
      ${editBlock}
      <p style="margin:0;">Pour plus d'informations, veuillez contacter l'organisation.</p>
    `;
```

- [ ] **Step 3: Ajouter la fonction sendEditLinkEmail pour le renvoi**

Ajouter une nouvelle fonction exportée dans `src/lib/mail.ts` :

```typescript
export async function sendEditLinkEmail(
  to: string,
  fullName: string,
  editToken: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();
  const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Voici un nouveau lien pour modifier et resoumettre votre inscription :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${baseUrl}/edit-registration/${editToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Modifier mon inscription</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Modifier votre inscription — ${title}`,
    html: buildEmail(body, title, logoUrl),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/mail.ts
git commit -m "mail: add edit link in rejection email and sendEditLinkEmail"
```

---

### Task 4: API GET /api/edit-registration/[token] — charger l'inscription

**Files:**
- Create: `src/app/api/edit-registration/[token]/route.ts`

- [ ] **Step 1: Créer la route GET**

Créer `src/app/api/edit-registration/[token]/route.ts` :

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
    include: { team: true },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (!registration.editTokenExpiresAt || registration.editTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", registrationId: registration.id },
      { status: 410 }
    );
  }

  return NextResponse.json({
    id: registration.id,
    lastName: registration.lastName,
    firstName: registration.firstName,
    email: registration.email,
    structure: registration.structure,
    teamId: registration.teamId,
    idDocumentType: registration.idDocumentType,
    idDocumentNumber: registration.idDocumentNumber,
    photo: registration.photo,
    idDocument: registration.idDocument,
    rejectionReason: registration.rejectionReason,
    rejectionDetails: registration.rejectionDetails,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/edit-registration/
git commit -m "api: GET /api/edit-registration/[token]"
```

---

### Task 5: API POST /api/edit-registration/[token] — resoumettre

**Files:**
- Modify: `src/app/api/edit-registration/[token]/route.ts`

- [ ] **Step 1: Ajouter les imports nécessaires**

En haut du fichier, ajouter :

```typescript
import { logActivity } from "@/lib/activity-log";
import { sendRegistrationConfirmation } from "@/lib/mail";
```

- [ ] **Step 2: Ajouter la fonction POST**

Dans le même fichier, ajouter :

```typescript
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (!registration.editTokenExpiresAt || registration.editTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", registrationId: registration.id },
      { status: 410 }
    );
  }

  const data = await req.json();
  const { lastName, firstName, email, structure, teamId, idDocumentType, idDocumentNumber, photo, idDocument } = data;

  if (!lastName || !firstName || !email || !structure || !teamId || !idDocumentType || !idDocumentNumber || !photo || !idDocument) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: {
      lastName,
      firstName,
      email,
      structure,
      teamId,
      idDocumentType,
      idDocumentNumber,
      photo,
      idDocument,
      status: "PENDING",
      editToken: null,
      editTokenExpiresAt: null,
      rejectionReason: null,
      rejectionDetails: null,
    },
    include: { team: true },
  });

  await logActivity({
    type: "REGISTRATION_RESUBMITTED",
    targetId: registration.id,
    details: {
      registrationName: `${firstName} ${lastName}`,
      teamName: updated.team.name,
    },
  });

  try {
    await sendRegistrationConfirmation(email, `${firstName} ${lastName}`);
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }

  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/edit-registration/
git commit -m "api: POST /api/edit-registration/[token] resubmit"
```

---

### Task 6: API POST /api/edit-registration/[token]/resend — renvoyer le lien

**Files:**
- Create: `src/app/api/edit-registration/[token]/resend/route.ts`

- [ ] **Step 1: Créer la route de renvoi**

Créer `src/app/api/edit-registration/[token]/resend/route.ts` :

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEditLinkEmail } from "@/lib/mail";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  const newToken = randomUUID();
  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      editToken: newToken,
      editTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  try {
    await sendEditLinkEmail(
      registration.email,
      `${registration.firstName} ${registration.lastName}`,
      newToken
    );
  } catch (e) {
    console.error("Failed to send edit link email:", e);
    return NextResponse.json({ error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/edit-registration/
git commit -m "api: POST /api/edit-registration/[token]/resend"
```

---

### Task 7: RegistrationForm — support du mode édition

**Files:**
- Modify: `src/components/admin/RegistrationForm.tsx:19-24,45-95`

- [ ] **Step 1: Ajouter l'interface defaultValues et la prop**

Ajouter l'interface et modifier `RegistrationFormProps` :

```typescript
interface RegistrationDefaultValues {
  lastName?: string;
  firstName?: string;
  email?: string;
  structure?: string;
  teamId?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
}

interface RegistrationFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
  showCaptcha?: boolean;
  captchaWidget?: React.ReactNode;
  defaultValues?: RegistrationDefaultValues;
}
```

- [ ] **Step 2: Utiliser defaultValues dans le composant**

Modifier la déstructuration des props :

```typescript
export function RegistrationForm({
  onSubmit,
  submitLabel = "Soumettre",
  captchaWidget,
  defaultValues,
}: RegistrationFormProps) {
```

Modifier chaque `Input` et `Select` pour ajouter `defaultValue` :

```typescript
      <Input label="Nom (tel que sur le document d'identité)" name="lastName" required defaultValue={defaultValues?.lastName} />
      <Input label="Prénom(s) (tel que sur le document d'identité)" name="firstName" required defaultValue={defaultValues?.firstName} />
      <Input label="Email" name="email" type="email" required defaultValue={defaultValues?.email} />
      <Input label="Structure / Organisation" name="structure" required defaultValue={defaultValues?.structure} />
      <Select
        label="Catégorie"
        name="teamId"
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
        required
        defaultValue={defaultValues?.teamId}
      />
      <Select
        label="Type de document d'identité"
        name="idDocumentType"
        options={ID_DOCUMENT_TYPES}
        required
        defaultValue={defaultValues?.idDocumentType}
      />
      <Input label="Numéro du document d'identité" name="idDocumentNumber" required defaultValue={defaultValues?.idDocumentNumber} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/RegistrationForm.tsx
git commit -m "RegistrationForm: add defaultValues prop for edit mode"
```

---

### Task 8: Page publique /edit-registration/[token]

**Files:**
- Create: `src/app/edit-registration/[token]/page.tsx`

- [ ] **Step 1: Créer la page**

Créer `src/app/edit-registration/[token]/page.tsx` :

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RegistrationForm } from "@/components/admin/RegistrationForm";
import { Button } from "@/components/ui/Button";

interface RegistrationData {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  teamId: string;
  idDocumentType: string;
  idDocumentNumber: string;
  photo: string | null;
  idDocument: string | null;
  rejectionReason: string | null;
  rejectionDetails: string | null;
}

export default function EditRegistrationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [expired, setExpired] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/edit-registration/${token}`)
      .then(async (res) => {
        if (res.status === 410) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          setInvalidLink(true);
          return;
        }
        setRegistration(await res.json());
      });
  }, [token]);

  async function handleResend() {
    setResending(true);
    const res = await fetch(`/api/edit-registration/${token}/resend`, { method: "POST" });
    setResending(false);
    if (res.ok) {
      setResent(true);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError("");

    const photoFile = formData.get("photo") as File | null;
    const idDocumentFile = formData.get("idDocument") as File | null;

    const body: Record<string, string | null> = {
      lastName: formData.get("lastName") as string,
      firstName: formData.get("firstName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
      idDocumentType: formData.get("idDocumentType") as string,
      idDocumentNumber: formData.get("idDocumentNumber") as string,
      photo: registration!.photo,
      idDocument: registration!.idDocument,
    };

    // Upload new photo if provided
    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", registration!.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.photo = path;
      }
    }

    // Upload new idDocument if provided
    if (idDocumentFile && idDocumentFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", idDocumentFile);
      uploadData.append("type", "idDocument");
      uploadData.append("registrationId", registration!.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.idDocument = path;
      }
    }

    const res = await fetch(`/api/edit-registration/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erreur lors de la modification");
      return;
    }

    router.push("/register/success");
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Lien invalide</h1>
          <p className="text-gray-600">Ce lien de modification est invalide ou l&apos;inscription a déjà été resoumise.</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Lien expiré</h1>
          <p className="text-gray-600 mb-6">
            Ce lien de modification a expiré. Vous pouvez demander un nouveau lien par email.
          </p>
          {resent ? (
            <p className="text-green-600 text-sm">Un nouveau lien vous a été envoyé par email.</p>
          ) : (
            <Button onClick={handleResend} disabled={resending}>
              {resending ? "Envoi en cours..." : "Renvoyer le lien"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-bold text-center mb-2">Modifier mon inscription</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-amber-700 font-medium mb-1">Votre inscription a été rejetée</p>
          {registration.rejectionReason && (
            <p className="text-sm text-amber-600">Motif : {registration.rejectionReason}</p>
          )}
          {registration.rejectionDetails && (
            <p className="text-sm text-amber-600">{registration.rejectionDetails}</p>
          )}
          <p className="text-sm text-amber-600 mt-2">Veuillez corriger les informations ci-dessous et resoumettre votre inscription.</p>
        </div>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <RegistrationForm
          onSubmit={handleSubmit}
          submitLabel="Resoumettre mon inscription"
          defaultValues={{
            lastName: registration.lastName,
            firstName: registration.firstName,
            email: registration.email,
            structure: registration.structure,
            teamId: registration.teamId,
            idDocumentType: registration.idDocumentType,
            idDocumentNumber: registration.idDocumentNumber,
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/edit-registration/
git commit -m "page: edit-registration with expired/resend/resubmit flow"
```

---

### Task 9: Admin — afficher le lien de modification sur la page de détails

**Files:**
- Modify: `src/app/admin/registrations/[id]/page.tsx:117-125`

- [ ] **Step 1: Ajouter editToken à l'interface Registration**

Dans l'interface `Registration`, ajouter :

```typescript
  editToken: string | null;
  editTokenExpiresAt: string | null;
```

- [ ] **Step 2: Afficher le lien dans la section rejet**

Dans le bloc `{registration.status === "REJECTED" && registration.rejectionReason && (`, après le `rejectionDetails` et avant la fermeture `</div>`, ajouter :

```typescript
              {registration.editToken && (
                <div className="mt-3 pt-3 border-t border-rose-200">
                  <p className="text-sm text-rose-600 mb-2">
                    Lien de modification
                    {registration.editTokenExpiresAt && new Date(registration.editTokenExpiresAt) > new Date()
                      ? ` (expire le ${new Date(registration.editTokenExpiresAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })})`
                      : " (expiré)"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/edit-registration/${registration.editToken}`);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Copier le lien
                  </button>
                </div>
              )}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/registrations/[id]/page.tsx
git commit -m "admin: show edit link on rejected registration detail"
```

---

### Task 10: Vérification finale et commit

- [ ] **Step 1: Vérifier le build**

Run: `npx tsc --noEmit`
Expected: Aucune erreur.

- [ ] **Step 2: Tester le flow complet manuellement**

1. Créer une inscription publique
2. La rejeter depuis l'admin
3. Vérifier que l'email contient le lien de modification
4. Ouvrir le lien → formulaire pré-rempli avec motif du rejet
5. Modifier et resoumettre → statut repasse en PENDING
6. Vérifier le lien expiré → message + bouton "Renvoyer le lien"
7. Cliquer "Renvoyer" → email reçu avec nouveau lien fonctionnel

- [ ] **Step 3: Commit final si ajustements**

```bash
git add -A
git commit -m "edit-registration: final adjustments"
```
