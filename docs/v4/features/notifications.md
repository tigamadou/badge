# Notifications internes et email (v4 — spec 24)

> Le *pourquoi* et les arbitrages sont dans la spec
> [`../specs/2026-10-24-24-v4-notifications.md`](../specs/2026-10-24-24-v4-notifications.md)
> et le plan [`../plans/2026-10-24-notifications.md`](../plans/2026-10-24-notifications.md).
> Ce document décrit le *quoi* et le *comment* actuels.

## Objectif

Prévenir le staff plateforme, le staff des organisations et les participants de chaque
évènement majeur qui les concerne : une **notification interne par destinataire**, visible
dans une **cloche** avec pastille (polling 30 s), un **panneau** des 10 dernières, une
**page des notifications** par espace, et un **email par la queue** (`enqueueEmail`) quand
la matrice le prévoit.

## Modèle

`Notification` (`prisma/schema.prisma`) : `userId` (cascade), `type` (`NotificationType`),
`scope` (`NotificationScope` : `PLATFORM` | `ORG` | `EVENT` | `PARTICIPANT`), `orgId?`,
`eventId?`, `title`, `body`, `href?` (lien principal, relatif), `links` (JSON
`[{ label, href }]`, **le lien principal en tête** puis les liens secondaires), `readAt?`,
`createdAt`. Une ligne par destinataire, matérialisée au moment de l'évènement. Toute
notification d'évènement porte son `orgId` (la portée org s'en sert).

## Service (`src/lib/notifications/`)

| Fichier | Rôle |
|---|---|
| `scope.ts` | `NotificationScopeRef` et passage portée ↔ paramètres de requête ↔ chemin de page (pur, importable côté client) |
| `messages.ts` | un constructeur pur par type : titre, corps, lien principal, libellé du bouton, liens secondaires |
| `recipients.ts` | `resolveRecipients` : résolveur déclaratif (`users`, `eventRoles`, `orgRoles`, `staffMinRole`) |
| `notify.ts` | `notify` / `notifyAll`, `EMAIL_BY_TYPE`, `withNotificationGuard` |
| `triggers.ts` | un déclencheur par ligne de la matrice, appelé en une ligne **après** l'action |
| `queries.ts` | lecture : portées, liste paginée par curseur, compteur, marquer lu |
| `rewrite-links.ts` | `rewriteNotificationLinks` : suit le changement d'ID d'une inscription |
| `retention.ts` | `purgeReadNotifications` : rétention des lues |

### Règles de destinataires

- L'**auteur** de l'action n'est jamais notifié.
- Un utilisateur n'est notifié qu'**une fois** par évènement (dédoublonnage par `userId`) ;
  `notifyAll` dédoublonne aussi **entre audiences** (un staff également OWNER d'une org ne
  reçoit que la notification de portée `ORG` pour l'abonnement ou le quota).
- Les comptes `blocked` et `archived` sont exclus.
- `eventRoles` applique l'héritage de `auth-helpers.ts` : OWNER/MANAGER d'org valent
  `ADMIN`, AUDITOR d'org vaut `VIEWER`. Le rôle **`STAFF` n'est pas un rôle de membre** :
  le résolveur calcule avec `isStaff: false`, un staff n'est destinataire d'un évènement
  que s'il y est membre explicite.
- Une erreur de notification **ne fait jamais échouer l'action** : elle est loggée
  (`[notify] failed`, `[notify] trigger failed`). Un échec d'email après insertion
  conserve les lignes `Notification`.
- Aucun `ActivityType` n'est ajouté (marquer comme lu n'est pas une action sensible).

### Email

Quand la matrice le prévoit (`EMAIL_BY_TYPE`), un email part par destinataire via
`enqueueEmail` (`kind: notification.<type>`, priorité normale), avec le gabarit `buildEmail`
(branding Event → Org) : corps échappé et bouton vers l'URL **absolue** du lien principal.
Pour les ajouts de membre, l'email est omis quand une **invitation** part déjà
(`invitationSent`). Les types dont un email existe déjà (`REGISTRATION_APPROVED`,
`_REJECTED`, `BADGE_PRINTED`, `PROFILE_APPROVED`, `_REJECTED`) n'en ajoutent pas :
**un seul email** pour le participant.

## Matrice

| Type | Déclencheur (route) | Destinataires | Email |
|---|---|---|---|
| `REGISTRATION_CREATED` | `POST /api/events/[slug]/register` | `ADMIN`, `OPERATOR` de l'évènement (héritage org) | oui |
| `REGISTRATION_RESUBMITTED` | `POST /api/account/registrations/[id]/resubmit` (mentionne le changement de catégorie) | idem | oui |
| `REGISTRATION_APPROVED` / `_REJECTED` | `POST …/registrations/[regId]/approve` / `reject` | le participant | non (email existant) |
| `BADGE_PRINTED` | `POST …/registrations/[regId]/print` et `…/registrations/print` (lot) | le participant | non (email existant) |
| `PROFILE_SUBMITTED` | `PUT /api/account/profile` (seulement si une **nouvelle** soumission est créée) | staff `STAFF_SUPPORT`+ | oui |
| `PROFILE_APPROVED` / `_REJECTED` | `POST /api/platform/profiles/[userId]/approve` / `reject` | le participant | non (email existant) |
| `ORG_MEMBERSHIP_ADDED` | `POST /api/org/[orgId]/members`, `POST /api/platform/organizations/[orgId]/owners`, `POST /api/platform/organizations` (OWNER), `POST /api/platform/users` | la personne ajoutée | non si invitation, oui sinon |
| `EVENT_MEMBERSHIP_ADDED` | `POST …/events/[eventId]/members` | la personne ajoutée | idem |
| `MEMBERSHIP_ROLE_CHANGED` | `PATCH /api/org/[orgId]/members/[userId]`, `PATCH …/events/[eventId]/members/[membershipId]`, branche `upgraded` de `…/owners` | la personne concernée (rien si le rôle ne change pas) | oui |
| `EVENT_REGISTRATION_OPENED` / `_CLOSED` | `PATCH …/events/[eventId]` (changement de `registrationOpen`) | membres de l'évènement, tous rôles, AUDITOR d'org compris | oui |
| `ORG_CREATED` | `POST /api/platform/organizations` | staff `STAFF_ADMIN`+ | oui |
| `SUBSCRIPTION_CHANGED` | `PUT /api/platform/organizations/[orgId]/subscription` | OWNER de l'org (portée `ORG`) puis staff `STAFF_ADMIN`+ (portée `PLATFORM`) | oui |
| `QUOTA_EXCEEDED` | `POST /api/org/[orgId]/events` (contournement staff `QUOTA_BYPASS`) | idem | oui |
| `EMAIL_FAILED` | worker : job passé en `FAILED` (`src/lib/jobs/process-batch.ts`) | staff `STAFF_ADMIN`+ | non (éviter la boucle) |

## Portées par espace

| Espace | Notifications affichées |
|---|---|
| `/platform` | `scope = PLATFORM` |
| `/org/[orgId]` | `scope = ORG` de cet `orgId`, plus `scope = EVENT` des évènements de cette org |
| `/event/[eventId]` | `scope = EVENT` de cet `eventId` |
| `/account` | `scope = PARTICIPANT` |

## API

Toutes exigent une session (`401 { code, error }` sinon) et ne voient que les notifications
de l'utilisateur connecté.

| Route | Rôle |
|---|---|
| `GET /api/notifications?scope=…&orgId=…&eventId=…&cursor=…&unread=1&limit=…` | liste paginée par curseur (`limit` 1 à 20, défaut 20 ; le panneau passe 10) → `{ items, nextCursor }` |
| `GET /api/notifications/unread-count?scope=…` | `{ count }` (jamais mis en cache) |
| `POST /api/notifications/[id]/read` | `{ ok: true }` ; **404** `NOT_FOUND` pour la notification d'autrui (jamais 403) |
| `POST /api/notifications/read-all?scope=…` | `{ updated }` |

Erreurs communes : `400 INVALID_SCOPE`, `400 INVALID_CURSOR`, `400 VALIDATION` (limit).
Le DTO ne contient que `id`, `type`, `title`, `body`, `href`, `links`, `readAt`, `createdAt`.

## Interface

- **Cloche** (`NotificationBell`, contrat C2, dans les sept gabarits) : pastille du nombre de
  non lues (« 9+ » au-delà de 9, masquée à 0), `aria-label` « Notifications, 3 non lues ».
  Le compteur est rafraîchi toutes les **30 s**, suspendu onglet caché
  (`visibilitychange`) et rafraîchi aussitôt au retour (`unread-poller.ts`).
- **Panneau** : 10 dernières de la portée (titre, extrait, date relative, point des non
  lues), « Tout marquer comme lu », « Voir toutes les notifications » ; fermeture par Échap,
  clic extérieur ou changement de page ; plein écran sous `sm`. Un clic sur une
  notification la marque lue et mène à `…/notifications#n-<id>`.
- **Pages** `/platform/notifications`, `/org/[orgId]/notifications`,
  `/event/[eventId]/notifications`, `/account/notifications` (`NotificationsView`) : filtre
  « Non lues seulement », pagination par curseur, lien principal et liens secondaires,
  notification ciblée mise en évidence (`:target`), `EmptyState`.

## Rétention et liens

- Les notifications **lues depuis plus de 90 jours** sont supprimées par la passe horaire
  du worker (`purgeReadNotifications`, `src/lib/jobs/worker-loop.ts`). Les non lues restent.
- Quand la catégorie d'une inscription change (spec 25), l'ID est régénéré :
  `rewriteNotificationLinks(ancien, nouveau, tx)` réécrit `href` et `links` de toutes les
  notifications concernées, par segment exact (`/registrations/<id>`), dans la transaction de
  `resubmit`.

## Hors périmètre (décisions)

Non notifiés : l'inscription manuelle par un ADMIN (`…/registrations` `POST`), la fermeture
implicite des inscriptions à l'archivage, l'abonnement créé automatiquement avec une
organisation (déjà couvert par `ORG_CREATED`). Préférences par utilisateur, temps réel
(WebSocket/SSE) et notifications push restent des non-objectifs.
