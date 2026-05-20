# Pré-requis contacts pour actions email — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquer toutes les actions envoyant un email (sauf confirmation d'inscription) tant que les informations de contact (email, téléphone, URL site web) ne sont pas configurées dans les paramètres. Mettre à jour le footer des emails avec les infos de contact.

**Architecture:** Ajout d'un champ `websiteUrl` au modèle Settings. Fonction utilitaire `areContactsConfigured()` dans `src/lib/mail.ts` réutilisée côté API pour le blocage et côté client via l'endpoint GET `/api/settings`. Les emails (sauf confirmation inscription) utilisent un nouveau footer avec les coordonnées.

**Tech Stack:** Next.js 16 (App Router), Prisma 6, MySQL, TypeScript, React 19, Tailwind CSS 4

---

### Task 1: Ajouter `websiteUrl` au schéma Prisma et migrer

**Files:**
- Modify: `prisma/schema.prisma:140-153`

- [ ] **Step 1: Ajouter le champ websiteUrl au modèle Settings**

Dans `prisma/schema.prisma`, ajouter `websiteUrl` après `contactPhone` (ligne 149) :

```prisma
model Settings {
  id                String  @id @default(cuid())
  smtpHost          String  @default("")
  smtpPort          Int     @default(587)
  smtpFrom          String  @default("")
  smtpUser          String  @default("")
  smtpPassword      String  @default("")
  smtpSecure        Boolean @default(false)
  contactEmail      String  @default("")
  contactPhone      String  @default("")
  websiteUrl        String  @default("")
  recaptchaEnabled  Boolean @default(false)
  recaptchaSiteKey  String  @default("")
  recaptchaSecretKey String @default("")
}
```

- [ ] **Step 2: Créer et appliquer la migration**

```bash
npx prisma migrate dev --name add-website-url-to-settings
```

Expected: Migration créée et appliquée, `websiteUrl` ajouté avec valeur par défaut `""`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "schema: ajouter websiteUrl au modèle Settings"
```

---

### Task 2: Fonction utilitaire `areContactsConfigured` et nouveau footer email

**Files:**
- Modify: `src/lib/mail.ts`

- [ ] **Step 1: Ajouter la fonction `areContactsConfigured` et `getContactInfo`**

Ajouter en haut du fichier `src/lib/mail.ts`, après les imports existants :

```typescript
interface ContactInfo {
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
}

export async function getContactInfo(): Promise<ContactInfo | null> {
  const settings = await prisma.settings.findFirst();
  if (!settings) return null;
  return {
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    websiteUrl: settings.websiteUrl,
  };
}

export function areContactsConfigured(contacts: ContactInfo | null): boolean {
  if (!contacts) return false;
  return !!(contacts.contactEmail && contacts.contactPhone && contacts.websiteUrl);
}
```

- [ ] **Step 2: Modifier `buildEmail` pour accepter un footer optionnel avec contacts**

Remplacer la signature de `buildEmail` et le bloc footer :

```typescript
function buildEmail(
  body: string,
  eventTitle: string,
  logoUrl: string,
  contacts?: ContactInfo | null
): string {
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${eventTitle}" style="max-height:64px;max-width:200px;margin-bottom:16px;" />`
    : "";

  const footerContent = contacts && contacts.contactEmail && contacts.contactPhone && contacts.websiteUrl
    ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">
        <a href="mailto:${contacts.contactEmail}" style="color:#94a3b8;text-decoration:none;">${contacts.contactEmail}</a>
      </p>
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">${contacts.contactPhone}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        <a href="${contacts.websiteUrl}" style="color:#94a3b8;text-decoration:none;">${contacts.websiteUrl}</a>
      </p>`
    : `<p style="margin:0;color:#94a3b8;font-size:12px;">${eventTitle}</p>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0f172a;padding:28px 24px;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.02em;">${eventTitle}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 28px;border-top:1px solid #e2e8f0;">
              ${footerContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 3: Mettre à jour `sendRegistrationConfirmation` — PAS de contacts dans le footer**

Cette fonction ne change pas de signature. Elle appelle `buildEmail` sans le paramètre `contacts` (donc footer = titre événement). Aucune modification nécessaire car le 4e paramètre est optionnel et absent par défaut.

- [ ] **Step 4: Mettre à jour `sendStatusNotification` — footer avec contacts**

Ajouter la récupération des contacts et les passer à `buildEmail` :

```typescript
export async function sendStatusNotification(
  to: string,
  fullName: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string,
  rejectionDetails?: string,
  editToken?: string | null
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();
  const contacts = await getContactInfo();

  if (status === "APPROVED") {
    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Votre inscription a été <span style="color:#059669;font-weight:600;">validée</span>.</p>
      <p style="margin:0;">Vous recevrez un email lorsque votre badge sera prêt à être retiré.</p>
    `;
    await transporter.sendMail({
      from,
      to,
      subject: `Inscription validée — ${title}`,
      html: buildEmail(body, title, logoUrl, contacts),
    });
  } else {
    const reasonBlock = rejectionReason
      ? `<p style="margin:0 0 8px;"><strong>Motif :</strong> ${rejectionReason}</p>`
      : "";
    const detailsBlock = rejectionDetails
      ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">${rejectionDetails}</p>`
      : "";

    const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";
    const editBlock = editToken
      ? `<p style="margin:0 0 24px;text-align:center;">
          <a href="${baseUrl}/edit-registration/${editToken}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Modifier et resoumettre mon inscription</a>
        </p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>`
      : "";

    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Nous sommes désolés, votre inscription a été <span style="color:#e11d48;font-weight:600;">rejetée</span>.</p>
      ${reasonBlock}
      ${detailsBlock}
      ${editBlock}
      <p style="margin:0;">Pour plus d'informations, veuillez contacter l'organisation.</p>
    `;
    await transporter.sendMail({
      from,
      to,
      subject: `Inscription rejetée — ${title}`,
      html: buildEmail(body, title, logoUrl, contacts),
    });
  }
}
```

- [ ] **Step 5: Mettre à jour `sendUserInvitation` — footer avec contacts**

```typescript
export async function sendUserInvitation(
  to: string,
  userName: string,
  setupUrl: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();
  const contacts = await getContactInfo();

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 16px;">Vous avez été invité(e) à rejoindre la plateforme <strong>${title}</strong>.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour configurer votre mot de passe et activer votre compte :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${setupUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Configurer mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Invitation — ${title}`,
    html: buildEmail(body, title, logoUrl, contacts),
  });
}
```

- [ ] **Step 6: Mettre à jour `sendEditLinkEmail` — footer avec contacts**

```typescript
export async function sendEditLinkEmail(
  to: string,
  fullName: string,
  editToken: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();
  const contacts = await getContactInfo();
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
    html: buildEmail(body, title, logoUrl, contacts),
  });
}
```

- [ ] **Step 7: Mettre à jour `sendBadgePrintedNotification` — footer avec contacts**

```typescript
export async function sendBadgePrintedNotification(
  to: string,
  fullName: string,
  contactEmail: string,
  contactPhone: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();
  const contacts = await getContactInfo();

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre badge a été imprimé et est prêt à être retiré.</p>
    <p style="margin:0 0 16px;">Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
    <p style="margin:0 0 8px;">Pour toute question concernant le retrait :</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
      <tr>
        <td style="padding:4px 0;color:#64748b;font-size:14px;">Email :</td>
        <td style="padding:4px 0 4px 8px;"><a href="mailto:${contactEmail}" style="color:#4f46e5;text-decoration:none;">${contactEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#64748b;font-size:14px;">Tél :</td>
        <td style="padding:4px 0 4px 8px;color:#334155;">${contactPhone}</td>
      </tr>
    </table>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Badge prêt — ${title}`,
    html: buildEmail(body, title, logoUrl, contacts),
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/mail.ts
git commit -m "mail: areContactsConfigured, getContactInfo, footer contacts"
```

---

### Task 3: Blocage API — PATCH `/api/registrations/[id]`

**Files:**
- Modify: `src/app/api/registrations/[id]/route.ts`

- [ ] **Step 1: Ajouter l'import et la vérification contacts dans PATCH**

En haut du fichier, ajouter l'import :

```typescript
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

(Combiner les imports en une seule ligne.)

Dans la fonction `PATCH`, après la vérification `APPROVED && previous?.status === "REJECTED"` (ligne 43), ajouter :

```typescript
  // Vérifier contacts configurés avant toute action email
  if (data.status === "APPROVED" || data.status === "REJECTED" || data.badgePrinted === true) {
    const contacts = await getContactInfo();
    if (!areContactsConfigured(contacts)) {
      return NextResponse.json(
        { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
        { status: 400 }
      );
    }
  }
```

- [ ] **Step 2: Simplifier le check existant pour `badgePrinted`**

Supprimer le bloc existant (lignes 117-124) qui vérifie `settings?.contactEmail || settings?.contactPhone` pour `badgePrinted` puisque c'est maintenant géré en amont. Le bloc de notification reste :

```typescript
  // Send badge printed notification
  if (data.badgePrinted === true) {
    const contacts = await getContactInfo();
    try {
      await sendBadgePrintedNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        contacts!.contactEmail,
        contacts!.contactPhone
      );
    } catch (e) {
      console.error("Failed to send badge printed notification:", e);
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/registrations/[id]/route.ts
git commit -m "api: blocage validation/rejet/badge si contacts non configurés"
```

---

### Task 4: Blocage API — Print batch, resend-edit-link, resend token, test SMTP, invitation user

**Files:**
- Modify: `src/app/api/registrations/print/route.ts`
- Modify: `src/app/api/registrations/resend-edit-link/route.ts`
- Modify: `src/app/api/edit-registration/[token]/resend/route.ts`
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/users/route.ts`

- [ ] **Step 1: Mettre à jour `print/route.ts`**

Ajouter l'import en haut :

```typescript
import { sendBadgePrintedNotification } from "@/lib/mail";
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

Remplacer le check existant (lignes 20-26) par :

```typescript
  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }
```

Et mettre à jour l'appel `sendBadgePrintedNotification` (ligne 47-51) pour utiliser `contacts!.contactEmail` et `contacts!.contactPhone` au lieu de `settings.contactEmail` et `settings.contactPhone`. Supprimer le `const settings = await prisma.settings.findFirst();` devenu inutile.

- [ ] **Step 2: Mettre à jour `resend-edit-link/route.ts`**

Ajouter en haut :

```typescript
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

Après le check `if (!email)` (ligne 9-11), ajouter :

```typescript
  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }
```

- [ ] **Step 3: Mettre à jour `edit-registration/[token]/resend/route.ts`**

Ajouter en haut :

```typescript
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

Au début de la fonction POST, avant le `findUnique` :

```typescript
  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }
```

- [ ] **Step 4: Mettre à jour `settings/route.ts` — blocage test SMTP**

Ajouter en haut :

```typescript
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

Dans la fonction `POST`, après le check `!settings.smtpHost` (ligne 70-75), ajouter :

```typescript
    const contacts = await getContactInfo();
    if (!areContactsConfigured(contacts)) {
      return NextResponse.json(
        { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
        { status: 400 }
      );
    }
```

Dans la fonction `PUT`, ajouter `websiteUrl` à la destructuration du body (ligne 24) :

```typescript
  const { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone, websiteUrl,
    recaptchaEnabled, recaptchaSiteKey, recaptchaSecretKey } = body;
```

Et ajouter `websiteUrl` dans `baseData` (ligne 30) :

```typescript
  const baseData = { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone, websiteUrl };
```

- [ ] **Step 5: Mettre à jour `users/route.ts` — blocage invitation**

Ajouter en haut :

```typescript
import { getContactInfo, areContactsConfigured } from "@/lib/mail";
```

Dans la fonction `POST`, après le check de l'email existant (ligne 36-38), ajouter :

```typescript
  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/registrations/print/route.ts src/app/api/registrations/resend-edit-link/route.ts src/app/api/edit-registration/[token]/resend/route.ts src/app/api/settings/route.ts src/app/api/users/route.ts
git commit -m "api: blocage email sur toutes les routes si contacts non configurés"
```

---

### Task 5: Page paramètres — Ajouter champ `websiteUrl`

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Ajouter `websiteUrl` à l'interface et aux valeurs par défaut**

Dans l'interface `Settings` (ligne 7-19), ajouter après `contactPhone` :

```typescript
  websiteUrl: string;
```

Dans `defaultSettings` (ligne 21-33), ajouter après `contactPhone: ""` :

```typescript
  websiteUrl: "",
```

- [ ] **Step 2: Ajouter le champ dans la section "Informations de contact"**

Après le champ "Téléphone de contact" (lignes 200-205), ajouter :

```tsx
          <Input
            label="URL du site web"
            type="url"
            value={settings.websiteUrl}
            onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
            placeholder="https://example.com"
          />
```

Mettre à jour le texte d'aide (ligne 207-209) :

```tsx
          <p className="text-sm text-slate-500">
            Ces informations seront incluses dans les emails envoyés aux inscrits. Les trois champs doivent être remplis pour pouvoir envoyer des emails.
          </p>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "ui: ajouter champ websiteUrl dans la page paramètres"
```

---

### Task 6: Blocage UI — Page détail inscription

**Files:**
- Modify: `src/app/admin/registrations/[id]/page.tsx`

- [ ] **Step 1: Ajouter le state et le fetch des settings**

Ajouter un state pour les contacts configurés (après les states existants, ~ligne 63) :

```typescript
  const [contactsConfigured, setContactsConfigured] = useState(true);
```

Dans le `useEffect` existant (ligne 65-70), ajouter le fetch des settings :

```typescript
  useEffect(() => {
    fetch(`/api/registrations/${id}`).then((r) => r.json()).then((data) => {
      setRegistration(data);
      setEmailBlocked(data.emailBlocked || false);
    });
    fetch("/api/settings").then((r) => r.json()).then((settings) => {
      if (settings) {
        setContactsConfigured(!!(settings.contactEmail && settings.contactPhone && settings.websiteUrl));
      } else {
        setContactsConfigured(false);
      }
    });
  }, [id]);
```

- [ ] **Step 2: Ajouter le bandeau d'alerte et désactiver les boutons**

Dans le bloc actions `PENDING` (lignes 253-261), remplacer par :

```tsx
          {registration.status === "PENDING" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Actions</p>
              {!contactsConfigured && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p>Veuillez configurer les informations de contact dans les <Link href="/admin/settings" className="underline font-medium">paramètres</Link> avant de pouvoir valider ou rejeter.</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={() => setConfirmAction("APPROVED")} disabled={!contactsConfigured}>Valider</Button>
                <Button variant="danger" onClick={() => setConfirmAction("REJECTED")} disabled={!contactsConfigured}>Rejeter</Button>
              </div>
            </div>
          )}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/registrations/[id]/page.tsx
git commit -m "ui: désactiver validation/rejet si contacts non configurés"
```

---

### Task 7: Blocage UI — Page utilisateurs et page paramètres (test SMTP)

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Page utilisateurs — Ajouter vérification contacts**

Ajouter un state (après les states existants, ~ligne 20) :

```typescript
  const [contactsConfigured, setContactsConfigured] = useState(true);
```

Modifier le `useEffect` pour charger les settings :

```typescript
  useEffect(() => {
    fetchUsers();
    fetch("/api/settings").then((r) => r.json()).then((settings) => {
      if (settings) {
        setContactsConfigured(!!(settings.contactEmail && settings.contactPhone && settings.websiteUrl));
      } else {
        setContactsConfigured(false);
      }
    });
  }, []);
```

Modifier le bouton "Nouvel utilisateur" (ligne 67) et ajouter un avertissement :

```tsx
        <div className="flex items-center gap-3">
          {!contactsConfigured && (
            <span className="text-xs text-amber-600">Contacts non configurés</span>
          )}
          <Button onClick={() => setShowForm(true)} disabled={!contactsConfigured}>Nouvel utilisateur</Button>
        </div>
```

- [ ] **Step 2: Page paramètres — Désactiver test SMTP si contacts non configurés**

Dans `src/app/admin/settings/page.tsx`, ajouter une variable dérivée après le state loading (avant le `return`) :

```typescript
  const contactsReady = !!(settings.contactEmail && settings.contactPhone && settings.websiteUrl);
```

Modifier le bouton "Tester la configuration" (ligne 152-157) pour le désactiver et ajouter un message :

```tsx
          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowTestForm(!showTestForm); setTestResult(null); }}
              disabled={!contactsReady}
            >
              Tester la configuration
            </Button>
            {!contactsReady && (
              <p className="mt-1 text-xs text-amber-600">Configurez d&apos;abord les informations de contact ci-dessous.</p>
            )}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/users/page.tsx src/app/admin/settings/page.tsx
git commit -m "ui: bloquer création utilisateur et test SMTP si contacts manquants"
```

---

### Task 8: Vérification manuelle complète

- [ ] **Step 1: Vérifier la compilation**

```bash
npx next build
```

Expected: Build réussi sans erreurs.

- [ ] **Step 2: Tests manuels à effectuer**

1. Aller dans `/admin/settings` → vérifier que le champ "URL du site web" apparaît
2. Avec contacts vides : aller sur une inscription PENDING → boutons Valider/Rejeter grisés + message
3. Avec contacts vides : aller dans `/admin/users` → bouton "Nouvel utilisateur" grisé
4. Remplir les 3 champs de contact dans les paramètres → les boutons se débloquent
5. Valider une inscription → vérifier le footer de l'email avec les contacts
6. Créer une inscription publique → vérifier que le footer de confirmation reste avec le titre

- [ ] **Step 3: Commit final si ajustements nécessaires**

```bash
git add -A
git commit -m "fix: ajustements post-vérification"
```
