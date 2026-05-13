# Modification d'inscription validée — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre a un admin d'envoyer un lien de modification a un inscrit APPROVED, avec retour en PENDING apres modification et reinitialisation du badge.

**Architecture:** Reutiliser le mecanisme d'edit token existant. Etendre les routes GET/POST/resend de `/api/edit-registration/[token]` pour accepter le statut APPROVED en plus de REJECTED. Ajouter une action `send-edit-link` dans PATCH `/api/registrations/[id]`. Adapter l'UI admin et la page d'edition.

**Tech Stack:** Next.js 14 (App Router), Prisma, TypeScript, React

---

### Task 1: API — Accepter APPROVED dans les routes edit-registration

**Files:**
- Modify: `src/app/api/edit-registration/[token]/route.ts:14` (GET status check)
- Modify: `src/app/api/edit-registration/[token]/route.ts:48` (POST status check)
- Modify: `src/app/api/edit-registration/[token]/route.ts:72-89` (POST update data)
- Modify: `src/app/api/edit-registration/[token]/resend/route.ts:21` (resend status check)

- [ ] **Step 1: Modifier la condition de statut dans GET**

Dans `src/app/api/edit-registration/[token]/route.ts`, ligne 14, remplacer :

```typescript
if (!registration || registration.status !== "REJECTED") {
```

par :

```typescript
if (!registration || (registration.status !== "REJECTED" && registration.status !== "APPROVED")) {
```

- [ ] **Step 2: Modifier la condition de statut dans POST**

Dans le meme fichier, ligne 48, remplacer :

```typescript
if (!registration || registration.status !== "REJECTED") {
```

par :

```typescript
if (!registration || (registration.status !== "REJECTED" && registration.status !== "APPROVED")) {
```

- [ ] **Step 3: Ajouter la reinitialisation du badge dans POST**

Dans le meme fichier, dans le `prisma.registration.update` (ligne 72-89), ajouter `badgePrinted` et `badgePrintedAt` au data :

```typescript
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
      badgePrinted: false,
      badgePrintedAt: null,
    },
    include: { team: true },
  });
```

- [ ] **Step 4: Modifier la condition de statut dans resend**

Dans `src/app/api/edit-registration/[token]/resend/route.ts`, ligne 21, remplacer :

```typescript
if (!registration || registration.status !== "REJECTED") {
```

par :

```typescript
if (!registration || (registration.status !== "REJECTED" && registration.status !== "APPROVED")) {
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/edit-registration/
git commit -m "api: accepter statut APPROVED dans les routes edit-registration"
```

---

### Task 2: API — Action send-edit-link dans PATCH /api/registrations/[id]

**Files:**
- Modify: `src/app/api/registrations/[id]/route.ts:37-72`

- [ ] **Step 1: Ajouter l'import de sendEditLinkEmail**

Dans `src/app/api/registrations/[id]/route.ts`, ligne 5, ajouter `sendEditLinkEmail` a l'import existant :

```typescript
import { sendStatusNotification, sendBadgePrintedNotification, sendEditLinkEmail, getContactInfo, areContactsConfigured } from "@/lib/mail";
```

- [ ] **Step 2: Ajouter le traitement de l'action send-edit-link**

Dans le handler PATCH, juste apres la lecture de `data` (ligne 37) et avant le bloc SUPER_ADMIN (ligne 40), ajouter :

```typescript
  // Action: envoyer un lien de modification pour une inscription validée
  if (data.action === "send-edit-link") {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration || registration.status !== "APPROVED") {
      return NextResponse.json({ error: "Action non autorisée" }, { status: 400 });
    }

    const contacts = await getContactInfo();
    if (!areContactsConfigured(contacts)) {
      return NextResponse.json(
        { error: "Veuillez configurer les informations de contact (email, téléphone) dans les paramètres." },
        { status: 400 }
      );
    }

    const editToken = randomUUID();
    const editTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const updated = await prisma.registration.update({
      where: { id },
      data: { editToken, editTokenExpiresAt },
      include: { team: true },
    });

    try {
      await sendEditLinkEmail(
        updated.email,
        `${updated.firstName} ${updated.lastName}`,
        editToken
      );
    } catch (e) {
      console.error("Failed to send edit link email:", e);
      return NextResponse.json({ error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
    }

    await logActivity({
      type: "EDIT_LINK_SENT",
      userId: session.user.id,
      targetId: id,
      details: { registrationName: `${updated.firstName} ${updated.lastName}` },
    });

    return NextResponse.json(updated);
  }
```

- [ ] **Step 3: Corriger le message d'erreur contacts (retrait mention site web)**

Ligne 57, remplacer :

```typescript
{ error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
```

par :

```typescript
{ error: "Veuillez configurer les informations de contact (email, téléphone) dans les paramètres." },
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/registrations/[id]/route.ts
git commit -m "api: ajouter action send-edit-link pour inscriptions validees"
```

---

### Task 3: UI Admin — Bouton envoi lien de modification

**Files:**
- Modify: `src/app/admin/registrations/[id]/page.tsx:281-287`

- [ ] **Step 1: Ajouter l'etat pour le bouton**

Dans `src/app/admin/registrations/[id]/page.tsx`, apres la declaration de `confirmBlock` (ligne 65), ajouter :

```typescript
  const [sendingEditLink, setSendingEditLink] = useState(false);
  const [editLinkSent, setEditLinkSent] = useState(false);
```

- [ ] **Step 2: Ajouter la fonction d'envoi**

Apres la fonction `unblockEmail` (ligne 93), ajouter :

```typescript
  async function sendEditLink() {
    setSendingEditLink(true);
    const res = await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send-edit-link" }),
    });
    setSendingEditLink(false);
    if (res.ok) {
      setEditLinkSent(true);
      const updated = await fetch(`/api/registrations/${id}`);
      setRegistration(await updated.json());
    }
  }
```

- [ ] **Step 3: Remplacer le bloc APPROVED dans la colonne actions**

Remplacer le bloc existant (lignes 281-287) :

```tsx
{registration.status === "APPROVED" && (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <Link href="/admin/badges" className="text-sm text-indigo-600 hover:text-indigo-700">
      Voir le badge dans la page Badges
    </Link>
  </div>
)}
```

par :

```tsx
{registration.status === "APPROVED" && (
  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
    <Link href="/admin/badges" className="text-sm text-indigo-600 hover:text-indigo-700 block">
      Voir le badge dans la page Badges
    </Link>
    {contactsConfigured && (
      <div className="border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-700 mb-2">Modification</p>
        {editLinkSent ? (
          <p className="text-sm text-emerald-600">Lien de modification envoyé.</p>
        ) : (
          <Button
            variant="secondary"
            onClick={sendEditLink}
            disabled={sendingEditLink}
          >
            {sendingEditLink ? "Envoi..." : "Envoyer un lien de modification"}
          </Button>
        )}
        <p className="text-xs text-slate-500 mt-2">
          L&apos;inscrit pourra modifier son inscription. Elle repassera en attente de validation.
        </p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/registrations/[id]/page.tsx
git commit -m "ui: bouton envoi lien modification pour inscriptions validees"
```

---

### Task 4: Page d'edition — Conditionner l'affichage du motif de rejet

**Files:**
- Modify: `src/app/edit-registration/[token]/page.tsx:159-168`

- [ ] **Step 1: Conditionner le bloc de rejet**

Dans `src/app/edit-registration/[token]/page.tsx`, remplacer le bloc amber (lignes 159-168) :

```tsx
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
```

par :

```tsx
{registration.rejectionReason ? (
  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
    <p className="text-sm text-amber-700 font-medium mb-1">Votre inscription a été rejetée</p>
    <p className="text-sm text-amber-600">Motif : {registration.rejectionReason}</p>
    {registration.rejectionDetails && (
      <p className="text-sm text-amber-600">{registration.rejectionDetails}</p>
    )}
    <p className="text-sm text-amber-600 mt-2">Veuillez corriger les informations ci-dessous et resoumettre votre inscription.</p>
  </div>
) : (
  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
    <p className="text-sm text-blue-700 font-medium mb-1">Modifier mon inscription</p>
    <p className="text-sm text-blue-600">Modifiez les informations ci-dessous et resoumettez votre inscription. Elle sera de nouveau soumise a validation.</p>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/edit-registration/[token]/page.tsx
git commit -m "ui: conditionner affichage motif de rejet sur page edition"
```

---

### Task 5: Corriger le message d'erreur contacts dans resend

**Files:**
- Modify: `src/app/api/edit-registration/[token]/resend/route.ts:12`

- [ ] **Step 1: Retirer la mention "site web" du message d'erreur**

Dans `src/app/api/edit-registration/[token]/resend/route.ts`, ligne 12, remplacer :

```typescript
{ error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
```

par :

```typescript
{ error: "Veuillez configurer les informations de contact (email, téléphone) dans les paramètres." },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/edit-registration/[token]/resend/route.ts
git commit -m "fix: retirer mention site web des messages erreur contacts"
```
