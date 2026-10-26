# Spec v4 — Notifications internes et email

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : nouvelle fonctionnalité transverse
> **Périmètre** : v4 — espaces `/platform`, `/org/[orgId]`, `/event/[eventId]`, `/account`
> **Plan** : [`plans/2026-10-24-notifications.md`](../plans/2026-10-24-notifications.md)
> **Coordination** : [spec 22](2026-10-24-22-v4-lot-notifications-coordination.md) — contrats C1 (`enqueueEmail`) et C2 (`NotificationBell`)
> **Source** : `Todo.md` du 2026-10-24, point 1

## Contexte et objectif

Le staff de la plateforme, le staff des organisations et les participants doivent être
**prévenus de chaque évènement majeur** qui les concerne, pour pouvoir agir. Aujourd'hui,
seuls quelques emails existent, et rien n'est visible dans l'application.

Ce que l'utilisateur a décrit :

- dans chaque compte, une **cloche** avec une **pastille** indiquant le nombre de
  notifications non lues ;
- un clic sur la cloche montre les **dernières notifications sans quitter la page** ;
- un clic sur une notification mène à la **page des notifications** ;
- chaque notification porte des **liens vers les éléments concernés**.

## Non-objectifs

- Préférences par utilisateur (désactiver un type, choisir email ou interne).
- Temps réel par WebSocket ou SSE : un **polling** suffit.
- Notifications push mobiles ou navigateur.

## Matrice des évènements (validée par l'utilisateur le 2026-10-24)

| Évènement (déclencheur) | `NotificationType` | Destinataires | Email |
|---|---|---|---|
| Nouvelle inscription (`api/events/[slug]/register`) | `REGISTRATION_CREATED` | ADMIN et OPERATOR de l'évènement (y compris par héritage OWNER/MANAGER de l'org) | oui |
| Inscription resoumise (`api/account/registrations/[id]/resubmit`) — mentionne le changement de catégorie s'il y en a un (spec 25) | `REGISTRATION_RESUBMITTED` | idem | oui |
| Inscription approuvée | `REGISTRATION_APPROVED` | le participant | **non** — email existant `sendStatusNotification` |
| Inscription rejetée (avec motif) | `REGISTRATION_REJECTED` | le participant | **non** — email existant |
| Badge imprimé (unitaire et lot) | `BADGE_PRINTED` | le participant | **non** — email existant `sendBadgePrintedNotification` |
| Profil soumis pour validation | `PROFILE_SUBMITTED` | staff plateforme `STAFF_SUPPORT` et au-dessus | oui |
| Profil approuvé | `PROFILE_APPROVED` | le participant | **non** — email existant |
| Profil rejeté (avec motif) | `PROFILE_REJECTED` | le participant | **non** — email existant |
| Ajout comme membre d'une org | `ORG_MEMBERSHIP_ADDED` | la personne ajoutée | **non** si une invitation est envoyée, oui sinon |
| Ajout comme membre d'un évènement | `EVENT_MEMBERSHIP_ADDED` | la personne ajoutée | idem |
| Changement de rôle (org ou évènement) | `MEMBERSHIP_ROLE_CHANGED` | la personne concernée | oui |
| Ouverture des inscriptions d'un évènement | `EVENT_REGISTRATION_OPENED` | membres de l'évènement (tous rôles) | oui |
| Fermeture des inscriptions | `EVENT_REGISTRATION_CLOSED` | idem | oui |
| Organisation créée | `ORG_CREATED` | staff plateforme `STAFF_ADMIN` et au-dessus | oui |
| Abonnement créé ou modifié | `SUBSCRIPTION_CHANGED` | OWNER de l'org + staff plateforme `STAFF_ADMIN` et au-dessus | oui |
| Quota dépassé (contournement `QUOTA_BYPASS`) | `QUOTA_EXCEEDED` | idem | oui |
| Email en échec définitif (job `FAILED`, spec 23) | `EMAIL_FAILED` | staff plateforme `STAFF_ADMIN` et au-dessus | **non** (éviter la boucle) |

Règles :

- **L'auteur de l'action n'est jamais notifié** de sa propre action.
- Un même utilisateur n'est notifié **qu'une fois** par évènement, même s'il cumule
  plusieurs rôles (dédoublonnage par `userId`).
- Les comptes **bloqués** ou **archivés** ne sont pas notifiés.
- `EMAIL_FAILED` dépend de la spec 23 : le worker appelle `notify()` quand un job passe
  `FAILED`. Si la spec 24 est fusionnée après la 23 (ordre prévu), elle ajoute cet appel
  dans le worker ; sinon elle le laisse en tâche finale.

## Conception

### Modèle de données

```prisma
enum NotificationType { … }          // valeurs de la matrice

enum NotificationScope {
  PLATFORM      // destinée au staff plateforme
  ORG
  EVENT
  PARTICIPANT
}

model Notification {
  id        String            @id @default(cuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  scope     NotificationScope
  orgId     String?
  eventId   String?
  title     String            // ex. « Nouvelle inscription »
  body      String            @db.Text   // ex. « Awa Diallo s'est inscrite à Forum 2026 (catégorie Presse). »
  // Lien principal (élément concerné), relatif à l'app : « /event/abc/registrations/xyz ».
  href      String?
  // Liens secondaires : [{ label, href }] (ex. l'évènement, le profil).
  links     Json?
  readAt    DateTime?
  createdAt DateTime          @default(now())

  @@index([userId, readAt, createdAt])
  @@index([userId, scope, createdAt])
}
```

Les notifications sont **matérialisées par destinataire** (une ligne par utilisateur) au
moment de l'évènement : lecture et compteur sont de simples requêtes indexées.

### Service

`src/lib/notifications/notify.ts` :

```ts
export async function notify(input: {
  type: NotificationType;
  recipients: RecipientSpec;     // voir ci-dessous
  actorId?: string | null;       // exclu des destinataires
  orgId?: string;
  eventId?: string;
  title: string;
  body: string;
  href?: string;
  links?: { label: string; href: string }[];
  email?: boolean;               // défaut : selon la matrice
}, tx?: Prisma.TransactionClient): Promise<void>;
```

- `RecipientSpec` décrit les destinataires de façon déclarative (`{ users: [id] }`,
  `{ eventRoles: { eventId, roles } }`, `{ staffMinRole }`, `{ orgRoles: { orgId, roles } }`)
  et un résolveur unique (`src/lib/notifications/recipients.ts`) applique l'héritage
  org → évènement de `auth.ts`, le dédoublonnage et l'exclusion de l'auteur.
- Les textes et liens de chaque type sont construits par des fonctions dédiées
  (`src/lib/notifications/messages.ts`), une par type, testées.
- L'email, quand il est prévu, passe par `enqueueEmail()` (contrat C1) avec le gabarit
  `buildEmail` existant : titre, corps, bouton vers le lien principal (URL absolue).
- `notify()` est appelé **après** l'action dans chaque route, avec la transaction de la
  route si elle en a une. Une erreur de notification **ne fait pas échouer** l'action :
  elle est loggée.

### Changement d'ID d'une inscription

La spec 25 régénère l'ID d'une inscription quand sa catégorie change. Ce chantier fournit
`rewriteNotificationLinks(oldRegistrationId, newRegistrationId, tx)` dans
`src/lib/notifications/`, qui réécrit `href` et `links` des notifications existantes, et
l'appelle dans la route `resubmit`.

### API

| Route | Rôle |
|---|---|
| `GET /api/notifications?scope=…&orgId=…&eventId=…&cursor=…` | liste paginée (curseur) des notifications de l'utilisateur connecté pour la portée |
| `GET /api/notifications/unread-count?scope=…` | compteur pour la pastille |
| `POST /api/notifications/[id]/read` | marque comme lue (propriétaire uniquement) |
| `POST /api/notifications/read-all?scope=…` | tout marquer comme lu dans la portée |

Toutes vérifient la session ; un utilisateur ne voit et ne modifie **que ses propres**
notifications (404 sinon, pas 403, pour ne pas révéler l'existence).

### Portée par espace (choix de conception)

La cloche et la page d'un espace montrent les notifications de **cet espace** :

| Espace | Notifications affichées |
|---|---|
| `/platform` | `scope = PLATFORM` |
| `/org/[orgId]` | `scope = ORG` avec cet `orgId`, **plus** `scope = EVENT` des évènements de cette org |
| `/event/[eventId]` | `scope = EVENT` avec cet `eventId` |
| `/account` | `scope = PARTICIPANT` |

### Interface

- **Cloche** (`NotificationBell`, contrat C2, déjà placée par le socle dans les sept
  gabarits) : icône cloche, pastille avec le nombre de non lues (« 9+ » au-delà de 9),
  masquée à 0. `aria-label` « Notifications, 3 non lues ».
- Compteur rafraîchi par **polling toutes les 30 s**, suspendu quand l'onglet est caché
  (`visibilitychange`), et rafraîchi immédiatement au retour.
- Clic sur la cloche : **panneau déroulant** ancré à la cloche (plein écran sous `sm`),
  avec les **10 dernières** notifications de la portée : titre, extrait, date relative
  (« il y a 5 min »), point pour les non lues. Actions : « Tout marquer comme lu »,
  « Voir toutes les notifications ». Fermeture par Échap ou clic extérieur.
- Clic sur une notification du panneau : la marque **lue** et mène à la **page des
  notifications** de l'espace, la notification cliquée mise en évidence (ancre
  `#n-<id>`), comme demandé.
- **Page des notifications** (`/platform/notifications`, `/org/[orgId]/notifications`,
  `/event/[eventId]/notifications`, `/account/notifications`) : liste complète, filtre
  « non lues seulement », pagination par curseur, chaque notification avec son **lien
  principal** (bouton « Voir l'inscription », « Voir le profil »…) et ses liens
  secondaires. État vide avec `EmptyState`.
- Lien « Notifications » ajouté à la navigation des gabarits.
- Rendu correct à 375 px (cf. spec 21).

### Rétention

Les notifications **lues de plus de 90 jours** sont supprimées (passe périodique du worker
de la spec 23, ou purge à la lecture de la liste si le worker n'est pas encore fusionné —
au choix du constructeur).

## Critères d'acceptation

- Un participant s'inscrit : les ADMIN et OPERATOR de l'évènement voient la pastille
  passer à 1 en moins de 30 s, sans recharger la page ; le panneau montre « Nouvelle
  inscription » ; un clic mène à la page des notifications où le lien ouvre
  l'inscription. Un email part par la queue.
- L'organisateur approuve l'inscription : le participant voit la notification dans
  `/account` ; **un seul** email (l'existant) est reçu.
- Un OWNER d'org qui est aussi ADMIN de l'évènement ne reçoit qu'une notification.
- Un utilisateur ne peut ni lire ni marquer lue la notification d'un autre (404).
- L'auteur d'une action n'est pas notifié de sa propre action.
- Couverture 100 % maintenue sur `src/lib` et les routes API ; test E2E du parcours
  inscription → cloche → page → lien.

## Laissé au constructeur

- Formulation exacte des titres et corps (français, accents).
- Choix de la bibliothèque de date relative (`Intl.RelativeTimeFormat` recommandé, sans
  dépendance).
- Liste précise des routes API à instrumenter (à partir de la matrice et des
  `logActivity` existants).
