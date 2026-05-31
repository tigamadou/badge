# Notifications email multi-tenant

## Description fonctionnelle

L'application envoie des emails transactionnels aux participants et aux utilisateurs. En v2 :

- **Configuration SMTP (connexion + expéditeur) = plateforme uniquement** (décision 2026-05-31). Hôte, port, user, password, secure et `smtpFrom` sont lus directement depuis `PlatformSettings` ; aucune cascade Org/Event. Tous les emails partent avec la même identité d'expéditeur (ex. `Badge <noreply@badge.local>`).
- **Branding contextuel** (logo, coordonnées de contact) résolu en cascade `EventSettings → OrgSettings → PlatformSettings`. Les emails affichent toujours le bon logo et le bon contact selon le contexte (event ou org), même si l'expéditeur SMTP est unique.
- Les templates sont contextualisés par l'événement ou l'organisation source.

Tous les emails utilisateurs sont en français avec accents complets.

## Périmètre

Inclus :

- Lecture directe de la config SMTP depuis `PlatformSettings` (via `getPlatformSmtp()`)
- Résolveur du branding contextuel (logo, contact) en cascade Event → Org → Platform
- Templates HTML pour tous les emails (avec branding event/org)
- Refonte de `src/lib/mail.ts` (signatures avec contexte `eventId` ou `orgId`)
- Tests Vitest sur la composition des emails et la résolution du branding

Exclu :

- Configuration UI des settings plateforme (spec 2)
- Test SMTP UI (spec 2 uniquement — il n'y a pas de Test SMTP côté Org/Event)
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
| `USER_INVITATION` | Création user (staff, OrgMembership ou EventMembership) avec rôle précisé | Nouvel utilisateur |
| `USER_PASSWORD_RESET` | Reset par staff | Utilisateur ciblé |
| `STAFF_NEW_ORG_MEMBER_INVITED` (optionnel) | Création d'un membre org (OWNER, MANAGER ou AUDITOR) par le staff | Co-OWNERs existants |

> Note : pour `STAFF_NEW_ORG_MEMBER_INVITED`, seuls les co-OWNERs sont notifiés (ils restent décisionnaires sur l'organisation). Les MANAGER et AUDITOR ne sont pas destinataires pour éviter le bruit.

## Résolveur de transporteur

Le résolveur (`src/lib/mail.ts → resolveTransporter()`) prend en argument un contexte (`eventId` ou `orgId` ou rien) et retourne :

```typescript
type ResolvedTransport = {
  transporter: Transporter;  // nodemailer (configuré depuis PlatformSettings)
  from: string;              // expéditeur unique plateforme
  contactEmail: string;      // résolu en cascade Event → Org → Platform
  contactPhone: string;
  eventTitle?: string;       // si eventId fourni
  orgName?: string;          // si orgId fourni
  logoUrl?: string;          // si eventId fourni et logo non null
};
```

Algorithme :

1. Charger la config SMTP via `getPlatformSmtp()` (lecture directe `PlatformSettings`, **pas** de cascade)
2. Charger le branding contextuel en cascade : `resolveSettings(eventId, orgId)` pour `contactEmail` / `contactPhone`, plus `Event.logo` et `Event.title` / `Organization.name` si applicable
3. Construire le `transporter` nodemailer avec host/port/secure/user/password de la plateforme
4. `from` = `PlatformSettings.smtpFrom` (ex. `"Badge <noreply@badge.local>"`) — **identique pour tous les emails**, quel que soit le contexte. Le branding contextuel (logo, contact) reste affiché dans le corps de l'email.

**Cas particulier — User Invitation** :

- Invitation staff pure (création d'un compte sans rattachement org/event) → pas d'eventId/orgId → branding générique Badge.
- Invitation portant sur une OrgMembership (OWNER / MANAGER / AUDITOR) → utiliser le contexte `orgId` pour résoudre le branding (logo et coordonnées de l'organisation). L'expéditeur SMTP reste celui de la plateforme.
- Invitation portant sur une EventMembership (ADMIN / OPERATOR / PRINTER / VIEWER) → utiliser le contexte `eventId` pour résoudre le branding (logo et coordonnées de l'événement, avec cascade vers l'organisation puis la plateforme). L'expéditeur SMTP reste celui de la plateforme.

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
| `{{role}}` | libellé français du rôle attribué (voir ci-dessous), déterminé au moment de l'envoi selon le membership créé |

Libellés `{{role}}` :

- Invitations staff : `SUPER ADMIN`, `ADMIN STAFF`, `SUPPORT STAFF`, `OBSERVATEUR STAFF`
- Invitations org (OrgMembership) : `OWNER`, `MANAGER`, `AUDITOR`
- Invitations event (EventMembership) : `ADMIN`, `OPÉRATEUR`, `OPÉRATEUR D'IMPRESSION`, `OBSERVATEUR`

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
> Un compte vous a été créé sur Badge{{#if orgName}} pour l'organisation **{{orgName}}** en tant que **{{role}}**{{/if}}{{#if eventTitle}} pour l'événement **{{eventTitle}}** en tant que **{{role}}**{{/if}}{{#unless orgName eventTitle}} en tant que **{{role}}**{{/unless}}. Cliquez sur le lien ci-dessous pour définir votre mot de passe (valide 24h) :
>
> {{setupPasswordLink}}
>
> ─
> L'équipe Badge

Le pseudo-template ci-dessus est indicatif : adapter la syntaxe au moteur réellement utilisé, mais conserver les trois cas (org + rôle, event + rôle, ou rôle seul pour une invitation staff pure).

## Refonte de `src/lib/mail.ts`

Signatures v2 (cassent les anciennes) :

```typescript
async function sendRegistrationConfirmation(registrationId: string): Promise<void>;
async function sendStatusNotification(registrationId: string): Promise<void>;  // dispatche APPROVED/REJECTED
async function sendBadgePrintedNotification(registrationId: string): Promise<void>;
async function sendEditLinkEmail(registrationId: string): Promise<void>;
async function sendUserInvitation(
  userId: string,
  options?: { orgId?: string; eventId?: string; role?: string },
): Promise<void>;
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

Cas spécifique `sendUserInvitation` :

- Si `options.orgId` ou `options.eventId` est fourni, la fonction résout automatiquement le branding correspondant (`orgName`, `eventTitle`, logo, contact) et utilise la cascade SMTP appropriée.
- Si `options.role` est fourni, la fonction résout le libellé français via une table de mapping (`OWNER → "OWNER"`, `MANAGER → "MANAGER"`, `PRINTER → "OPÉRATEUR D'IMPRESSION"`, etc.) et injecte la variable `{{role}}` dans le template.
- Si aucune option n'est fournie, fallback sur `PlatformSettings` (branding générique Badge).

Gestion des erreurs :

- Échec d'envoi → log d'erreur côté server, **ne fait pas échouer la transaction métier** (le badge est créé même si l'email casse)
- Retry : pas pour la v2 — affichage d'une bannière "Email non envoyé, voir journal" dans l'UI admin

## Tests

`src/lib/__tests__/mail.test.ts` :

- `resolveTransporter()` utilise toujours la config SMTP de `PlatformSettings`, quel que soit le contexte (eventId, orgId, ou aucun)
- `from` = `PlatformSettings.smtpFrom` dans les trois cas (pas de variation par org/event)
- `resolveTransporter(eventId)` cascade le branding (logo, contact) Event → Org → Platform — pas le SMTP
- `buildEmail()` injecte le logo event si fourni, sinon logo Badge
- Variables `{{eventTitle}}` etc. résolues correctement
- Anti-XSS : variables HTML-escaped (les valeurs viennent de la BDD mais sécurisons quand même)
- `sendUserInvitation(userId, { orgId, role: 'MANAGER' })` envoie un email contextualisé org (logo + contact org) avec le libellé `MANAGER`, expéditeur SMTP plateforme
- `sendUserInvitation(userId, { eventId, role: 'VIEWER' })` envoie un email contextualisé event (logo + contact event) avec le libellé `OBSERVATEUR`, expéditeur SMTP plateforme

## Critères d'acceptation

1. Email de confirmation envoyé après création inscription avec expéditeur `PlatformSettings.smtpFrom` (identique pour tous les events) et branding event résolu en cascade (logo + contact).
2. Email de rejet inclut motif + lien d'édition (`/edit-registration/[token]`).
3. Logo event affiché dans tous les emails participants quand `event.logo` est défini.
4. Contact (email + tél) affiché en footer si settings configurés, sinon footer minimal "Badge".
5. Email d'invitation user contient le lien `/setup-password?token=...` (24h).
6. Test SMTP (UI staff uniquement) envoie un email "Test SMTP — Badge" via `PlatformSettings`. Aucun Test SMTP n'est exposé côté Org ou Event.
7. Émojis et accents français préservés (UTF-8, headers MIME).
8. Aucun secret SMTP n'est jamais inclus dans le corps de l'email.
9. L'email d'invitation `USER_INVITATION` mentionne explicitement le rôle attribué (staff, org ou event).
10. L'email d'invitation utilise le branding de l'org ou de l'event correspondant (logo, contact) quand le contexte est fourni ; fallback sur le branding Badge sinon.

## Dépendances

- Spec 1 : `getPlatformSmtp()`, `resolveSettings()` (cascade branding), `ActivityLog`
- Spec 5 : route `/edit-registration/[token]`, `/verify/[badgeId]`
- Spec 7 : `PlatformSettings` initial seedé avec config SMTP complète (host, port, from, user, password, secure) — pas de fallback Org/Event possible
