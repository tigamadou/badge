# Notifications email multi-tenant

## Description fonctionnelle

L'application envoie des emails transactionnels aux participants et aux utilisateurs. En v2, la configuration SMTP et les coordonnées de contact sont résolues en cascade `PlatformSettings → OrgSettings → EventSettings`, et les templates sont contextualisés par l'événement ou l'organisation source.

Tous les emails utilisateurs sont en français avec accents complets.

## Périmètre

Inclus :

- Résolveur d'expéditeur (`smtpFrom`) et de SMTP pour l'envoi
- Templates HTML pour tous les emails (avec branding event/org)
- Refonte de `src/lib/mail.ts` (signatures avec contexte `eventId` ou `orgId`)
- Tests Vitest sur la composition des emails et la résolution de l'expéditeur

Exclu :

- Configuration UI des settings (specs 2, 3, 4)
- Test SMTP UI (specs 2, 3, 4)
- Modèles de mots de passe (spec 7)

## Types d'emails

### Côté participants (inscription publique)

| Code | Déclencheur | Destinataire |
|---|---|---|
| `REGISTRATION_CONFIRMATION` | Soumission inscription | Participant |
| `REGISTRATION_APPROVED` | Approbation par ADMIN | Participant |
| `REGISTRATION_REJECTED` | Rejet par ADMIN (+ lien édition 48h) | Participant |
| `BADGE_PRINTED` | `badgePrinted=true` | Participant |
| `REGISTRATION_RESUBMITTED_ACK` | Resoumission via edit-link | Participant |
| `EDIT_LINK_SENT` | Renvoi manuel du lien | Participant |

### Côté utilisateurs internes

| Code | Déclencheur | Destinataire |
|---|---|---|
| `USER_INVITATION` | Création user (staff ou OWNER ou Membership) | Nouvel utilisateur |
| `USER_PASSWORD_RESET` | Reset par staff | Utilisateur ciblé |
| `STAFF_NEW_ORG_OWNER_INVITED` (optionnel) | Création OWNER par staff | Co-OWNERs existants |

## Résolveur SMTP

Le résolveur (`src/lib/mail.ts → resolveTransporter()`) prend en argument un contexte (`eventId` ou `orgId` ou rien) et retourne :

```typescript
type ResolvedTransport = {
  transporter: Transporter;  // nodemailer
  from: string;              // adresse expéditeur
  contactEmail: string;      // pour footer
  contactPhone: string;
  eventTitle?: string;       // si eventId fourni
  orgName?: string;          // si orgId fourni
  logoUrl?: string;          // si eventId fourni et logo non null
};
```

Algorithme :

1. Charger les settings en cascade (`resolveSettings(eventId, orgId)`)
2. Construire le `transporter` nodemailer avec host/port/secure/user/password résolus
3. `from` :
   - Si `EventSettings.smtpFrom` non null → `"[Event.title] <event.smtpFrom>"`
   - Sinon si `OrgSettings.smtpFrom` non null → `"[Org.name] <org.smtpFrom>"`
   - Sinon `PlatformSettings.smtpFrom` (ex: `"Badge <noreply@badge.local>"`)

**Cas particulier — User Invitation envoyé par le staff** : pas d'eventId/orgId → utilise `PlatformSettings` directement.

## Templates

Tous les templates sont rendus en HTML inline (compatibles clients mail). Structure commune :

```
┌──────────────────────────────────────────┐
│ [Logo event si dispo] ou [Logo Badge]    │
│                                          │
│  Titre de l'email                        │
│                                          │
│  Corps personnalisé                      │
│                                          │
│ ─────────────────────────────────────── │
│ Contact : [contactEmail] / [contactPhone]│
│ [Nom org ou event]                       │
└──────────────────────────────────────────┘
```

Implémentation : helper `buildEmail({ title, body, ctx: ResolvedTransport })` (refonte de la fonction v1).

### Variables disponibles dans chaque template

| Variable | Source |
|---|---|
| `{{eventTitle}}` | `event.title` |
| `{{eventDate}}` | `event.date` formatée en français |
| `{{eventLocation}}` | `event.location` |
| `{{orgName}}` | `event.organization.name` ou directement org |
| `{{contactEmail}}` / `{{contactPhone}}` | settings résolus |
| `{{firstName}}` / `{{lastName}}` | inscription |
| `{{badgeId}}` | inscription |
| `{{editLink}}` | `https://[host]/edit-registration/[token]` |
| `{{setupPasswordLink}}` | `https://[host]/setup-password?token=...` |
| `{{verifyBadgeLink}}` | `https://[host]/verify/[badgeId]` |
| `{{rejectionReason}}` / `{{rejectionDetails}}` | inscription |

### Exemples

**`REGISTRATION_APPROVED`** (FR) :

> Objet : Votre inscription à **{{eventTitle}}** est approuvée
>
> Bonjour {{firstName}},
>
> Votre inscription à {{eventTitle}} ({{eventDate}}, {{eventLocation}}) a été approuvée. Votre badge sera disponible le jour de l'événement.
>
> ─
> Contact : {{contactEmail}} • {{contactPhone}}

**`USER_INVITATION`** (FR) :

> Objet : Bienvenue sur Badge
>
> Bonjour {{name}},
>
> Un compte vous a été créé sur Badge{{#if orgName}} pour l'organisation **{{orgName}}**{{/if}}. Cliquez sur le lien ci-dessous pour définir votre mot de passe (valide 24h) :
>
> {{setupPasswordLink}}
>
> ─
> L'équipe Badge

## Refonte de `src/lib/mail.ts`

Signatures v2 (cassent les anciennes) :

```typescript
async function sendRegistrationConfirmation(registrationId: string): Promise<void>;
async function sendStatusNotification(registrationId: string): Promise<void>;  // dispatche APPROVED/REJECTED
async function sendBadgePrintedNotification(registrationId: string): Promise<void>;
async function sendEditLinkEmail(registrationId: string): Promise<void>;
async function sendUserInvitation(userId: string, options?: { orgId?: string }): Promise<void>;
async function sendPasswordResetEmail(userId: string): Promise<void>;
async function sendSmtpTest(args: { to: string; orgId?: string; eventId?: string }): Promise<void>;
```

Chaque fonction :

1. Charge la `Registration` ou `User` + relations nécessaires
2. Détermine le contexte (eventId via registration.eventId, orgId via owner ou via membership)
3. Appelle `resolveTransporter(ctx)`
4. Compose le HTML via `buildEmail(...)`
5. Envoie via `transporter.sendMail({ from, to, subject, html })`
6. Logge un `ActivityLog` correspondant (REGISTRATION_*, USER_*, etc.) — déjà déclenché par la mutation appelante, l'envoi mail n'a pas son propre log sauf échec

Gestion des erreurs :

- Échec d'envoi → log d'erreur côté server, **ne fait pas échouer la transaction métier** (le badge est créé même si l'email casse)
- Retry : pas pour la v2 — affichage d'une bannière "Email non envoyé, voir journal" dans l'UI admin

## Tests

`src/lib/__tests__/mail.test.ts` :

- `resolveTransporter()` retourne PlatformSettings quand ni eventId ni orgId
- `resolveTransporter(eventId)` cascade jusqu'à EventSettings non null
- `from` formaté : `"[Org.name] <smtp.from>"` quand override org
- `from` formaté : `"Badge <platform.from>"` quand pas d'override
- `buildEmail()` injecte le logo event si fourni, sinon logo Badge
- Variables `{{eventTitle}}` etc. résolues correctement
- Anti-XSS : variables HTML-escaped (les valeurs viennent de la BDD mais sécurisons quand même)

## Critères d'acceptation

1. Email de confirmation envoyé après création inscription avec expéditeur résolu en cascade.
2. Email de rejet inclut motif + lien d'édition (`/edit-registration/[token]`).
3. Logo event affiché dans tous les emails participants quand `event.logo` est défini.
4. Contact (email + tél) affiché en footer si settings configurés, sinon footer minimal "Badge".
5. Email d'invitation user contient le lien `/setup-password?token=...` (24h).
6. Test SMTP envoie un email "Test SMTP — Badge" via la cascade (selon contexte org ou event).
7. Émojis et accents français préservés (UTF-8, headers MIME).
8. Aucun secret SMTP n'est jamais inclus dans le corps de l'email.

## Dépendances

- Spec 1 : `resolveSettings()`, `ActivityLog`
- Spec 5 : route `/edit-registration/[token]`, `/verify/[badgeId]`
- Spec 7 : `PlatformSettings` initial seedé
