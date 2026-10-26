# Lot notifications — socle commun (vague 0)

> **Statut : livré** — spec [22 — coordination du lot](../specs/2026-10-24-22-v4-lot-notifications-coordination.md) · plan [socle commun](../plans/2026-10-24-socle-commun.md).

Le socle pose quatre contrats partagés (C1 à C4) avec une implémentation minimale mais
fonctionnelle, sans fonctionnalité visible nouvelle. Les chantiers 23 (queue d'emails),
24 (notifications), 27 (avatar) et 28 (feedback) codent contre ces signatures et
complètent ou remplacent leur section ci-dessous.

## C1 — `enqueueEmail()` (propriétaire : spec 23)

`src/lib/jobs/enqueue-email.ts` :

```ts
type EmailPriority = "high" | "normal";
interface EmailMessage {
  to: string; subject: string; html: string;
  kind: string;
  replyTo?: string;           // ajouté pour la route contact
  priority?: EmailPriority;   // défaut "normal"
  ctx?: TransportContext;     // { eventId?, orgId? }
}
enqueueEmail(message: EmailMessage, tx?: Prisma.TransactionClient): Promise<void>
```

> **Mis à jour par la spec 23** : `enqueueEmail` insère désormais un `Job` (queue MySQL, worker séparé), voir [queue-emails.md](queue-emails.md). Le paragraphe qui suit décrit l'état du socle seul.

Dans le socle : envoi **immédiat** via `resolveTransporter(ctx ?? {})`, `tx` ignoré, aucune
table. Une erreur SMTP est **avalée et loggée** (`to`, `subject`, `kind`, `error`), comme
l'ancien `safeSend` : une action déjà validée ne doit pas répondre 500. `EMAIL_KIND` est la
liste unique des `kind` existants.

| Fonction de `mail.ts` | `kind` | `priority` | `ctx` |
|---|---|---|---|
| `sendRegistrationConfirmation` | `registration.received` | normal | `{ eventId }` |
| `sendStatusNotification` (approuvée) | `registration.approved` | normal | `{ eventId }` |
| `sendStatusNotification` (rejetée) | `registration.rejected` | normal | `{ eventId }` |
| `sendRegistrationResubmitted` | `registration.resubmitted` | normal | `{ eventId }` |
| `sendBadgePrintedNotification` | `badge.printed` | normal | `{ eventId }` |
| `sendAccountVerifyEmail` | `account.verify-email` | **high** | `{}` |
| `sendAccountPasswordReset` | `account.password-reset` | **high** | `{}` |
| `sendUserInvitation` | `user.invitation` | **high** | `{ eventId?, orgId? }` |
| `sendPasswordResetEmail` | `user.password-reset` | **high** | `{}` |
| `sendProfileApproved` | `profile.approved` | normal | `{}` |
| `sendProfileRejected` | `profile.rejected` | normal | `{}` |

Les `kind` **sensibles** (à masquer côté suivi, spec 23) : `account.verify-email`,
`account.password-reset`, `user.invitation`, `user.password-reset`.
La route `POST /api/contact` passe aussi par la file (`contact.message`, `replyTo` = e-mail du visiteur) ; un échec d'envoi n'y renvoie plus 502 (retries et visibilité : spec 23).
`sendSmtpTest` **n'est pas rebranchée** : elle reste synchrone et propage ses erreurs.

## C2 — `NotificationBell` (propriétaire : spec 24)

`src/components/notifications/NotificationBell.tsx` (composant client) :
`NotificationBell({ scope: NotificationScopeRef }): JSX.Element | null` avec
`NotificationScopeRef = { kind: "platform" } | { kind: "org"; orgId } | { kind: "event"; eventId } | { kind: "participant" }`.
Le socle rend `null`. Portées par gabarit :

| Gabarit | Portée |
|---|---|
| `StaffShell` | `platform` |
| `OrgShell` | `org` |
| `EventShell`, `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell` | `event` |
| `src/app/account/layout.tsx` | `participant` |

Entrées de menu « Notifications » dans les sept gabarits et dans `AccountNav` (masquée sous
`sm` : la cloche donne l'accès sur mobile) ; « Emails » dans `StaffShell`. Pages d'attente
(`EmptyState` « Bientôt disponible »), à remplacer par leur chantier propriétaire :

| Page | Chantier |
|---|---|
| `/platform/notifications`, `/org/[orgId]/notifications`, `/event/[eventId]/notifications`, `/account/notifications` | spec 24 |
| `/platform/jobs` | spec 23 |

## C3 — `UserAvatar` (propriétaire : spec 27)

`src/components/layout/UserAvatar.tsx` (composant client) :
`UserAvatar({ name: string | null; photoUrl?: string | null; size?: number })`, `size` par
défaut 32. Le socle affiche les initiales (deux premiers mots, `?` si le nom est vide) et
ignore `photoUrl`. Les six gabarits composants reçoivent une prop `photoUrl?` transmise à
l'avatar ; le layout `/account` passe `null` (la spec 27 calculera la valeur). Les
`initials()` de liste (`PickCard`, `MembersClient`, `MemberTable`, pages `/platform/users`)
sont hors périmètre.

## C4 — Primitives de feedback (propriétaire : spec 28)

- `sonner` ; `<AppToaster />` (`src/components/ui/AppToaster.tsx`) monté une fois dans
  `src/app/layout.tsx`, bas-droite, `richColors`, région libellée « Messages ».
- `src/lib/toast.ts` : `toastSuccess`, `toastError`, `toastApiError(source, fallback)`.
  `toastApiError` délègue à `apiErrorMessage` (spec 28) : message d'une `ActionError`, sinon
  `message` / `error` lisible du corps d'une `Response` ; un code technique, un message
  anglais connu, un corps non JSON, déjà lu ou une erreur réseau donnent le repli
  (`« Une erreur est survenue. Réessayez. »` par défaut). Voir [feedback-actions](feedback-actions.md).
- `Button` : prop `loading` (spinner, `disabled`, `aria-busy`, largeur stable).
- `useAsyncAction(action, { success, error, onSuccess })` → `{ run, pending }` ; ignore les
  appels pendant `pending` (garde par `ref`). **Convention : l'action lève la `Response`**
  quand `!res.ok` (`if (!res.ok) throw res;`). Appliqué à `ResubmitButton`, puis à toutes les actions par la spec 28 ; `run(...args)` transmet ses arguments à l'action.
