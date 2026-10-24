# Notifications internes et email — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** prévenir le staff plateforme, le staff des organisations et les participants de
chaque évènement majeur qui les concerne : une notification interne par destinataire,
visible dans une cloche avec pastille (polling 30 s), un panneau des 10 dernières, une page
des notifications par espace, et un email par la queue quand la matrice le prévoit.

**Architecture :** un service serveur `src/lib/notifications/` : résolveur de destinataires
déclaratif (héritage org → évènement de `auth-helpers.ts`, dédoublonnage, exclusion de
l'auteur, des comptes bloqués et archivés), `notify()` qui matérialise une ligne
`Notification` par destinataire et met l'email en file via `enqueueEmail()` (contrat C1),
des constructeurs de textes purs (`messages.ts`) et une fonction déclencheur par ligne de
la matrice (`triggers.ts`), appelée en une ligne **après** l'action dans chaque route.
Quatre routes `api/notifications/**` servent la cloche et les pages. Côté interface,
`NotificationBell` (contrat C2, déjà inséré par le socle) devient un composant client avec
un petit contrôleur de polling testable, et les quatre pages d'attente du socle sont
remplacées par une vue serveur commune.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 6 / MySQL 8,
Zod, Vitest 4 (environnement `node`, rendu `renderToStaticMarkup`, BDD de dev réelle),
Playwright (projet `chromium`), `Intl.RelativeTimeFormat` (aucune dépendance ajoutée).

**Spec :** [`docs/v4/specs/2026-10-24-24-v4-notifications.md`](../specs/2026-10-24-24-v4-notifications.md)
— coordination : [`spec 22`](../specs/2026-10-24-22-v4-lot-notifications-coordination.md)
(contrats C1, C2, propriété des fichiers, ordre de fusion).

**Branche :** `feat/notifications` (créée depuis `origin/development`, après fusion du socle)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma Prisma : `Notification`, `NotificationType`, `NotificationScope` | [x] | 2026-10-24 | schema.test 2/2; db-push dev |
| 2 | Portées pures (`scope.ts`) et type `NotificationScopeRef` | [x] | 2026-10-24 | scope.test 4/4 |
| 3 | Constructeurs de textes et liens (`messages.ts`) | [x] | 2026-10-24 | messages.test 20/20 |
| 4 | Résolveur de destinataires (`recipients.ts`) | [x] | 2026-10-24 | recipients.test 10/10 |
| 5 | Service `notify()` / `notifyAll()` + email par la queue | [x] | 2026-10-24 | notify.test 12/12 |
| 6 | Déclencheurs inscriptions et badges + branchement des routes | [x] | 2026-10-24 | triggers-registrations 10/10; routes existantes vertes |
| 7 | Déclencheurs profils + branchement des routes | [x] | 2026-10-24 | triggers-profiles 6/6 (route profil = PUT, pas PATCH) |
| 8 | Déclencheurs membres et rôles + branchement des routes | [x] | 2026-10-24 | triggers-memberships 13/13 |
| 9 | Déclencheurs évènement, organisation, abonnement, quota | [x] | 2026-10-24 | triggers-org-event 8/8 |
| 10 | Requêtes de lecture (`queries.ts`) | [x] | 2026-10-24 | queries.test 12/12 |
| 11 | Routes API `api/notifications/**` | [x] | 2026-10-24 | routes.test 9/9 |
| 12 | `rewriteNotificationLinks`, purge à 90 jours, déclencheur `EMAIL_FAILED` | [x] | 2026-10-24 | rewrite-links 5, retention 2, email-failed 1 |
| 13 | Date relative, compteur « 9+ » et contrôleur de polling | [x] | 2026-10-24 | format-relative-time 4, unread-poller 7 |
| 14 | `NotificationBell` et panneau déroulant | [x] | 2026-10-24 | NotificationBell.test 6/6; lint ok; verif navigateur laissee au lead |
| 15 | Pages des notifications des quatre espaces | [x] | 2026-10-24 | NotificationsView.test 4/4; typecheck ok; 4 specs e2e socle adaptees (Aucune notification); verif navigateur laissee au lead |
| 16 | E2E : inscription → pastille → panneau → page → lien | [x] | 2026-10-24 | notifications.spec 3/3 verts (1re version rouge : client Prisma perime du serveur Next, redemarrage app+worker) |
| 17 | Après rebase sur 23 et 25 : worker (`EMAIL_FAILED`, purge) et route `resubmit` | [x] | 2026-10-24 | worker (EMAIL_FAILED dans failJob + purge dans worker-loop) et resubmit (rewrite + categoryChanged) cables ; tests process-batch/worker-loop/registrations verts |
| 18 | Documentation | [x] | 2026-10-24 | features/notifications.md + README v4 |
| — | Vérification finale (lint, typecheck, test, couverture, e2e, navigateur 375 / 1280) | [~] | 2026-10-24 | lint 0 erreur, typecheck ok, test-coverage 2075/2075 et 100 %, e2e 139 verts ; reste la vérification navigateur 375 / 1280 et onglet caché > 30 s (lead) |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne (statut, date, notes) après chaque task validée ; en cas d'interruption, `[~]` avec
l'étape en cours et les fichiers touchés.

## Contraintes globales

**Valeurs de la spec (exactes)**

- Polling du compteur : **30 s**, suspendu quand `document.visibilityState === "hidden"`,
  rafraîchi **immédiatement** au retour (`visibilitychange`).
- Pastille : nombre de non lues, **« 9+ » au-delà de 9**, **masquée à 0**.
  `aria-label` : « Notifications, 3 non lues » (à 0 : « Notifications »).
- Panneau : **10 dernières** notifications de la portée ; titre, extrait, date relative
  (« il y a 5 min »), point pour les non lues ; actions « Tout marquer comme lu » et
  « Voir toutes les notifications » ; fermeture par Échap ou clic extérieur ; **plein écran
  sous `sm`**.
- Clic sur une notification du panneau : la marque lue puis mène à la page des
  notifications de l'espace avec l'ancre **`#n-<id>`** (notification mise en évidence).
- Pages : `/platform/notifications`, `/org/[orgId]/notifications`,
  `/event/[eventId]/notifications`, `/account/notifications` ; filtre « non lues
  seulement », pagination par curseur, lien principal + liens secondaires, `EmptyState`.
- Portées : `/platform` → `scope = PLATFORM` ; `/org/[orgId]` → `scope = ORG` de cet
  `orgId` **plus** `scope = EVENT` des évènements de cette org ; `/event/[eventId]` →
  `scope = EVENT` de cet `eventId` ; `/account` → `scope = PARTICIPANT`.
- API : un utilisateur ne voit et ne modifie **que ses propres** notifications ; sinon
  **404** (jamais 403).
- Règles de destinataires : l'auteur n'est **jamais** notifié ; **une seule** notification
  par utilisateur et par évènement (dédoublonnage par `userId`) ; comptes `blocked` ou
  `archived` exclus.
- Une erreur de notification **ne fait jamais échouer** l'action : elle est loggée
  (`console.error("[notify] …")`).
- Rétention : notifications **lues depuis plus de 90 jours** supprimées (passe du worker de
  la spec 23, Task 17).
- Rendu correct à **375 px** (spec 21).

**Règles projet**

- Lire `CLAUDE.md` et `.claude/CLAUDE.md` avant de commencer. Les helpers d'autorisation
  cités par `CLAUDE.md` comme vivant dans `auth.ts` sont en réalité dans
  `src/lib/auth-guards.ts` (`requireStaff`, `requireOrgRole`, …) et
  `src/lib/auth-helpers.ts` (fonctions pures `effectiveEventRole`, `staffRoleAtLeast`,
  `orgRoleAtLeast`) ; `getEffectiveEventRoles` n'existe pas (seul
  `getEffectiveEventRole`, au singulier, dans `auth-guards.ts`). Le résolveur réutilise les
  fonctions **pures** de `auth-helpers.ts`.
- Toutes les commandes tournent dans le conteneur dev (`make dev` démarré) :
  - `make lint`, `make typecheck`, `make test`, `make test-coverage`, `make test-e2e`,
    `make db-push`, `make db-seed`.
  - **Un seul fichier Vitest** (aucune cible `make` dédiée) :
    `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`.
  - **Un seul fichier E2E** :
    `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test <chemin>`.
- `make test` (et tout `vitest run`) **vide la BDD de dev** : `make db-seed` avant toute
  vérification navigateur.
- Couverture **100 %** obligatoire (lignes, branches, fonctions, instructions) sur
  `src/lib/**` et `src/app/api/**` (`vitest.config.ts`, portes actives). **Pas de mock de
  Prisma** : les tests tournent sur la BDD de dev. Mocks autorisés (déjà pratiqués) :
  `next-auth` (`getServerSession`), les `send*` de `@/lib/mail`, et
  `@/lib/jobs/enqueue-email` pour capturer les emails mis en file.
- TDD : test qui échoue → implémentation minimale → test vert, à chaque task.
- Server Components par défaut ; `"use client"` seulement pour la cloche, le panneau et le
  bouton « Tout marquer comme lu ».
- UI, titres et corps de notification en **français avec accents** ; code et identifiants
  en anglais ; commentaires en français (style du fichier).
- Les réponses API n'exposent jamais de secret ni de jeton ; le DTO de notification ne
  contient que les champs listés en Task 10.
- Les routes déclencheuses **ne sont pas réécrites** : on ajoute un appel au déclencheur
  après le `logActivity` existant (spec 22, propriété des fichiers). On ne touche ni aux
  gabarits, ni aux menus, ni à `mail.ts` (socle).
- Aucun `ActivityType` n'est ajouté (la spec 24 n'en définit pas ; marquer comme lu n'est
  pas une action sensible).
- **Commit — uniquement sur demande explicite de l'utilisateur.** Message conventional
  commit en français ASCII (ex. `feat(notifications): ...`), **sans aucun trailer de
  co-auteur IA** ni mention d'outil.
- Aucune étape de déploiement, de SSH ni de migration prod. Schéma en dev uniquement
  (`make db-push`).

## Points de vigilance de revue

Cinq cas d'entrée ou d'échec que la spec implique sans que ses critères les testent. Chacun
a son test dans la task propriétaire.

1. **Échec d'email après insertion** — si `enqueueEmail` rejette, `notify()` ne lève pas,
   logge l'erreur, et les lignes `Notification` déjà créées restent. Test :
   `"une erreur d'enqueueEmail est loggée et n'empêche pas les notifications"` (Task 5).
2. **Ensemble de destinataires vide** — après exclusion de l'auteur (ex. un ADMIN seul qui
   crée une inscription manuelle ou ouvre ses propres inscriptions), aucune ligne, aucun
   email, aucun appel `createMany` avec `data: []`. Test :
   `"aucun destinataire : ni ligne ni email"` (Task 5).
3. **Le staff n'est pas destinataire par son rôle `STAFF`** — `effectiveEventRole()`
   renvoie `"STAFF"` pour tout staff : réutilisé tel quel, il exclurait un staff membre
   explicite d'un évènement, ou (selon l'implémentation) inclurait tout le staff. Le
   résolveur calcule le rôle de membre avec un contexte `isStaff: false`. Tests :
   `"un staff non membre ne reçoit pas les notifications d'évènement"` et
   `"un staff membre ADMIN de l'évènement les reçoit"` (Task 4).
4. **`PROFILE_SUBMITTED` sans nouvelle soumission** — `submitProfile()` renvoie la
   soumission **courante** quand les pièces n'ont pas changé (ex. seul le prénom est
   modifié) : notifier sur son simple retour spammerait le staff. On ne notifie que si l'id
   renvoyé diffère de celui lu avant l'appel. Test :
   `"modifier seulement le prénom ne notifie pas le staff"` (Task 7).
5. **Réécriture d'ID par segment exact** — `rewriteNotificationLinks(old, new)` ne doit pas
   toucher une URL dont l'ID **contient** l'ancien en sous-chaîne (ex. `old = "1234"`,
   `/event/e/registrations/91234`). Test :
   `"ne réécrit pas un ID qui contient l'ancien en sous-chaîne"` (Task 12).

## Structure des fichiers

**Créés**

| Fichier | Rôle |
|---|---|
| `src/lib/notifications/types.ts` | `NotifyInput`, `RecipientSpec`, `NotificationLink`, `NotificationDTO` |
| `src/lib/notifications/scope.ts` | `NotificationScopeRef`, `parseScopeQuery`, `scopeToSearchParams`, `notificationsPagePath` (pur, importable côté client) |
| `src/lib/notifications/messages.ts` | un constructeur pur par `NotificationType` (titre, corps, `href`, `links`) |
| `src/lib/notifications/recipients.ts` | `resolveRecipients` |
| `src/lib/notifications/notify.ts` | `notify`, `notifyAll`, `withNotificationGuard`, `EMAIL_BY_TYPE` |
| `src/lib/notifications/triggers.ts` | un déclencheur par ligne de la matrice |
| `src/lib/notifications/queries.ts` | `scopeWhere`, `listNotifications`, `countUnread`, `markRead`, `markAllRead`, `toNotificationDTO` |
| `src/lib/notifications/rewrite-links.ts` | `rewriteNotificationLinks` |
| `src/lib/notifications/retention.ts` | `purgeReadNotifications`, `NOTIFICATION_RETENTION_DAYS` |
| `src/lib/format-relative-time.ts` | `formatRelativeTime` |
| `src/lib/notifications/__tests__/*.test.ts` | tests unitaires et d'intégration (un fichier par module ou groupe de déclencheurs) |
| `src/app/api/notifications/route.ts` | `GET` liste paginée |
| `src/app/api/notifications/unread-count/route.ts` | `GET` compteur |
| `src/app/api/notifications/[id]/read/route.ts` | `POST` marquer lue |
| `src/app/api/notifications/read-all/route.ts` | `POST` tout marquer lu |
| `src/app/api/notifications/__tests__/routes.test.ts` | intégration des quatre routes |
| `src/components/notifications/unread-poller.ts` | `createUnreadPoller`, `formatBadgeCount` |
| `src/components/notifications/NotificationPanel.tsx` | panneau (client) |
| `src/components/notifications/NotificationsView.tsx` | vue serveur commune des pages |
| `src/components/notifications/MarkAllReadButton.tsx` | bouton client « Tout marquer comme lu » |
| `src/components/notifications/__tests__/*.test.ts(x)` | tests du poller et des rendus |
| `e2e/transverse/notifications.spec.ts` | parcours E2E |
| `docs/v4/features/notifications.md` | fiche feature |

**Modifiés**

| Fichier | Changement |
|---|---|
| `prisma/schema.prisma` | enums `NotificationType`, `NotificationScope`, modèle `Notification`, relation `User.notifications` |
| `src/test-setup.ts` | `prisma.notification.deleteMany()` en tête du `beforeEach` |
| `src/components/notifications/NotificationBell.tsx` | implémentation (le socle renvoie `null`) ; ré-exporte `NotificationScopeRef` depuis `scope.ts` |
| Pages d'attente du socle : `src/app/platform/notifications/page.tsx`, `src/app/org/[orgId]/notifications/page.tsx`, `src/app/event/[eventId]/notifications/page.tsx`, `src/app/account/notifications/page.tsx` | remplacées par `NotificationsView` |
| Routes déclencheuses (liste exacte en Tasks 6 à 9) | une ligne d'appel au déclencheur après l'action |
| `src/worker/**` (spec 23), `src/app/api/account/registrations/[id]/resubmit/route.ts` (spec 25) | Task 17 uniquement |
| `docs/v4/README.md` | entrée spec 24 / plan |

### Matrice → routes déclencheuses (inventaire)

| `NotificationType` | Route (chemin exact, méthode) | Repère existant | Task |
|---|---|---|---|
| `REGISTRATION_CREATED` | `src/app/api/events/[slug]/register/route.ts` `POST` | `logActivity REGISTRATION_CREATED` | 6 |
| `REGISTRATION_RESUBMITTED` | `src/app/api/account/registrations/[id]/resubmit/route.ts` `POST` | `logActivity REGISTRATION_RESUBMITTED` | 6 (puis 17) |
| `REGISTRATION_APPROVED` | `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route.ts` `POST` | `logActivity REGISTRATION_APPROVED` | 6 |
| `REGISTRATION_REJECTED` | `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route.ts` `POST` | `logActivity REGISTRATION_REJECTED` | 6 |
| `BADGE_PRINTED` (unitaire) | `src/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route.ts` `POST` | `logActivity BADGE_PRINTED` | 6 |
| `BADGE_PRINTED` (lot) | `src/app/api/org/[orgId]/events/[eventId]/registrations/print/route.ts` `POST` | `logActivity BADGE_BATCH_PRINTED` | 6 |
| `PROFILE_SUBMITTED` | `src/app/api/account/profile/route.ts` `PATCH` (après `submitProfile`) | aucun `logActivity` (`PROFILE_SUBMITTED` existe dans l'enum mais n'est jamais loggé) | 7 |
| `PROFILE_APPROVED` | `src/app/api/platform/profiles/[userId]/approve/route.ts` `POST` | `logActivity PROFILE_APPROVED` | 7 |
| `PROFILE_REJECTED` | `src/app/api/platform/profiles/[userId]/reject/route.ts` `POST` | `logActivity PROFILE_REJECTED` | 7 |
| `ORG_MEMBERSHIP_ADDED` | `src/app/api/org/[orgId]/members/route.ts` `POST` | `logActivity MEMBERSHIP_ADDED` (`isNewUser` → invitation) | 8 |
| `ORG_MEMBERSHIP_ADDED` | `src/app/api/platform/organizations/[orgId]/owners/route.ts` `POST` (branche création) | `logActivity MEMBERSHIP_ADDED` (`isNewUser`) | 8 |
| `ORG_MEMBERSHIP_ADDED` | `src/app/api/platform/organizations/route.ts` `POST` (OWNER de la nouvelle org) | `logActivity MEMBERSHIP_ADDED` (`userCreated` → invitation) | 8 |
| `ORG_MEMBERSHIP_ADDED` | `src/app/api/platform/users/route.ts` `POST` (une par membership) | `logActivity MEMBERSHIP_ADDED` (invitation toujours envoyée) | 8 |
| `EVENT_MEMBERSHIP_ADDED` | `src/app/api/org/[orgId]/events/[eventId]/members/route.ts` `POST` | `logActivity MEMBERSHIP_ADDED` (`wasNew` → invitation) | 8 |
| `MEMBERSHIP_ROLE_CHANGED` (org) | `src/app/api/org/[orgId]/members/[userId]/route.ts` `PATCH` | `logActivity MEMBERSHIP_ROLE_CHANGED` | 8 |
| `MEMBERSHIP_ROLE_CHANGED` (org) | `src/app/api/platform/organizations/[orgId]/owners/route.ts` `POST` (branche `upgraded`) | `logActivity MEMBERSHIP_ROLE_CHANGED` | 8 |
| `MEMBERSHIP_ROLE_CHANGED` (évènement) | `src/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route.ts` `PATCH` | `logActivity MEMBERSHIP_ROLE_CHANGED` | 8 |
| `EVENT_REGISTRATION_OPENED` / `_CLOSED` | `src/app/api/org/[orgId]/events/[eventId]/route.ts` `PATCH` | `logActivity EVENT_REGISTRATION_OPENED/CLOSED` | 9 |
| `ORG_CREATED` | `src/app/api/platform/organizations/route.ts` `POST` | `logActivity ORG_CREATED` | 9 |
| `SUBSCRIPTION_CHANGED` | `src/app/api/platform/organizations/[orgId]/subscription/route.ts` `PUT` | `logActivity SUBSCRIPTION_CREATED/UPDATED` | 9 |
| `QUOTA_EXCEEDED` | `src/app/api/org/[orgId]/events/route.ts` `POST` (branche staff `QUOTA_BYPASS`) | `logActivity QUOTA_BYPASS` | 9 |
| `EMAIL_FAILED` | worker de la spec 23 (`src/worker/**`), passage d'un job en `FAILED` | — | 12 (déclencheur), 17 (appel) |

Hors périmètre (non listés par la matrice, à ne pas instrumenter sans décision) :
inscription manuelle par un ADMIN (`api/org/[orgId]/events/[eventId]/registrations/route.ts`
`POST`, qui calcule un `quotaBypass` sans logger `QUOTA_BYPASS`), fermeture implicite des
inscriptions à l'archivage (`.../events/[eventId]/archive/route.ts`), abonnement créé
automatiquement à la création d'une org (`auto: true`, déjà couvert par `ORG_CREATED`).

---

## Task 1 — Schéma Prisma

**Fichiers :** modifier `prisma/schema.prisma`, `src/test-setup.ts` ; créer
`src/lib/notifications/__tests__/schema.test.ts`.

**Interfaces**
- Consumes : modèle `User`.
- Produces :
  ```prisma
  enum NotificationType {
    REGISTRATION_CREATED REGISTRATION_RESUBMITTED REGISTRATION_APPROVED REGISTRATION_REJECTED
    BADGE_PRINTED PROFILE_SUBMITTED PROFILE_APPROVED PROFILE_REJECTED
    ORG_MEMBERSHIP_ADDED EVENT_MEMBERSHIP_ADDED MEMBERSHIP_ROLE_CHANGED
    EVENT_REGISTRATION_OPENED EVENT_REGISTRATION_CLOSED ORG_CREATED
    SUBSCRIPTION_CHANGED QUOTA_EXCEEDED EMAIL_FAILED
  }
  enum NotificationScope { PLATFORM ORG EVENT PARTICIPANT }
  ```
  (une valeur par ligne dans le fichier), modèle `Notification` **exactement** comme dans
  la spec (`id`, `userId` + relation `onDelete: Cascade`, `type`, `scope`, `orgId?`,
  `eventId?`, `title`, `body @db.Text`, `href?`, `links Json?`, `readAt?`, `createdAt`,
  `@@index([userId, readAt, createdAt])`, `@@index([userId, scope, createdAt])`) et
  `notifications Notification[]` sur `User`. Placés en fin de fichier (spec 22 : le
  conflit avec `Job` de la spec 23 se règle au rebase).

- [ ] Écrire `schema.test.ts` :
  - `"crée une notification et la relit par l'index utilisateur"` : crée un user, une
    `Notification` (`type: "ORG_CREATED"`, `scope: "PLATFORM"`, `links: [{ label: "A", href: "/a" }]`),
    `findMany({ where: { userId, readAt: null } })` → longueur 1, `links` égal à l'entrée.
  - `"supprime les notifications avec l'utilisateur"` : `user.delete` →
    `notification.count({ where: { userId } })` = 0.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/notifications/__tests__/schema.test.ts`
  → échec attendu : `prisma.notification` n'existe pas (erreur TypeScript / `undefined`).
- [ ] Modifier le schéma, puis `make db-push` (dev uniquement ; régénère le client).
- [ ] Ajouter `await prisma.notification.deleteMany();` en **première** ligne du
  `beforeEach` de `src/test-setup.ts`.
- [ ] Relancer le test → vert. `make typecheck` → vert.

---

## Task 2 — Portées pures (`scope.ts`)

**Fichiers :** créer `src/lib/notifications/scope.ts`,
`src/lib/notifications/__tests__/scope.test.ts` ; modifier
`src/components/notifications/NotificationBell.tsx` (uniquement l'export du type).

**Interfaces**
- Consumes : rien (module pur, sans Prisma, importable côté client).
- Produces :
  ```ts
  export type NotificationScopeRef =
    | { kind: "platform" }
    | { kind: "org"; orgId: string }
    | { kind: "event"; eventId: string }
    | { kind: "participant" };
  export function parseScopeQuery(params: URLSearchParams): NotificationScopeRef | null;
  export function scopeToSearchParams(ref: NotificationScopeRef): URLSearchParams;
  export function notificationsPagePath(ref: NotificationScopeRef): string;
  ```
  `NotificationBell.tsx` remplace sa déclaration locale par
  `export type { NotificationScopeRef } from "@/lib/notifications/scope";` (le contrat C2
  garde son chemin d'import).

Format de requête : `scope=platform|org|event|participant`, plus `orgId` pour `org`,
`eventId` pour `event`.

- [ ] Écrire `scope.test.ts` :
  - `"parse les quatre portées valides"` : `scope=org&orgId=o1` →
    `{ kind: "org", orgId: "o1" }` ; idem `event`, `platform`, `participant`.
  - `"renvoie null pour une portée inconnue, absente, ou sans identifiant requis"` :
    `scope=foo`, `""`, `scope=org`, `scope=event&orgId=x` → `null`.
  - `"scopeToSearchParams est l'inverse de parseScopeQuery"` pour les quatre portées.
  - `"notificationsPagePath"` : `/platform/notifications`, `/org/o1/notifications`,
    `/event/e1/notifications`, `/account/notifications`.
- [ ] Lancer le fichier → échec attendu : module introuvable.
- [ ] Implémenter `scope.ts`, ajuster l'export de `NotificationBell.tsx`.
- [ ] Relancer → vert ; `make typecheck` → vert (les sept gabarits compilent toujours).

---

## Task 3 — Constructeurs de textes et liens (`messages.ts`)

**Fichiers :** créer `src/lib/notifications/types.ts`, `src/lib/notifications/messages.ts`,
`src/lib/notifications/__tests__/messages.test.ts`.

**Interfaces**
- Produces (`types.ts`) :
  ```ts
  export type NotificationLink = { label: string; href: string };
  export type NotificationContent = {
    title: string; body: string; href: string;
    // libellé du bouton du lien principal (« Voir l'inscription »…), stocké en links[0]
    primaryLabel: string;
    links: NotificationLink[];          // liens secondaires
  };
  ```
- Produces (`messages.ts`), fonctions pures, une par type :
  ```ts
  registrationCreatedMessage(a: { eventId: string; eventTitle: string; registrationId: string; participantName: string; categoryName: string }): NotificationContent;
  registrationResubmittedMessage(a: { eventId: string; eventTitle: string; registrationId: string; participantName: string; categoryChanged?: { from: string; to: string } }): NotificationContent;
  registrationApprovedMessage(a: { eventTitle: string; registrationId: string }): NotificationContent;
  registrationRejectedMessage(a: { eventTitle: string; registrationId: string; reason: string | null }): NotificationContent;
  badgePrintedMessage(a: { eventTitle: string; registrationId: string }): NotificationContent;
  profileSubmittedMessage(a: { userId: string; userName: string }): NotificationContent;
  profileApprovedMessage(): NotificationContent;
  profileRejectedMessage(a: { reason: string | null }): NotificationContent;
  orgMembershipAddedMessage(a: { orgId: string; orgName: string; role: OrgRole }): NotificationContent;
  eventMembershipAddedMessage(a: { eventId: string; eventTitle: string; role: EventRole }): NotificationContent;
  membershipRoleChangedMessage(a: { target: { kind: "org"; orgId: string; name: string } | { kind: "event"; eventId: string; name: string }; from: OrgRole | EventRole; to: OrgRole | EventRole }): NotificationContent;
  eventRegistrationToggledMessage(a: { eventId: string; eventTitle: string; eventSlug: string; open: boolean }): NotificationContent;
  orgCreatedMessage(a: { orgId: string; orgName: string }): NotificationContent;
  subscriptionChangedMessage(a: { orgId: string; orgName: string; planName: string; status: SubscriptionStatus; audience: "org" | "platform" }): NotificationContent;
  quotaExceededMessage(a: { orgId: string; orgName: string; eventId: string; audience: "org" | "platform" }): NotificationContent;
  emailFailedMessage(a: { jobId: string; kind: string; recipient: string | null; attempts: number }): NotificationContent;
  export const ROLE_LABELS: Record<OrgRole | EventRole, string>; // accentués : « Propriétaire », « Gérant », « Auditeur », « Administrateur », « Opérateur », « Impression », « Lecteur »
  ```

Liens principaux (valeurs à respecter, tous relatifs et commençant par `/`) :

| Type | `href` | `primaryLabel` | Secondaires |
|---|---|---|---|
| `REGISTRATION_CREATED`, `_RESUBMITTED` | `/event/{eventId}/registrations/{registrationId}` | « Voir l'inscription » | « Voir l'évènement » → `/event/{eventId}` |
| `REGISTRATION_APPROVED`, `_REJECTED`, `BADGE_PRINTED` | `/account/registrations/{registrationId}` | « Voir mon inscription » | — |
| `PROFILE_SUBMITTED` | `/platform/profiles/{userId}` | « Voir le profil » | — |
| `PROFILE_APPROVED`, `_REJECTED` | `/account/profile` | « Voir mon profil » | — |
| `ORG_MEMBERSHIP_ADDED`, rôle org | `/org/{orgId}` | « Ouvrir l'organisation » | — |
| `EVENT_MEMBERSHIP_ADDED`, rôle évènement | `/event/{eventId}` | « Ouvrir l'évènement » | — |
| `EVENT_REGISTRATION_OPENED` / `_CLOSED` | `/event/{eventId}` | « Ouvrir l'évènement » | « Page publique » → `/e/{eventSlug}` |
| `ORG_CREATED` | `/platform/organizations/{orgId}` | « Voir l'organisation » | — |
| `SUBSCRIPTION_CHANGED`, `QUOTA_EXCEEDED` | `org` : `/org/{orgId}/subscription` ; `platform` : `/platform/organizations/{orgId}/subscription` | « Voir l'abonnement » | quota : « Voir l'évènement » → `/event/{eventId}` (org) ou `/platform/organizations/{orgId}/events` (platform) |
| `EMAIL_FAILED` | `/platform/jobs/{jobId}` (à confirmer contre les pages de la spec 23 en Task 17) | « Voir l'envoi » | — |

Les identifiants sont passés par `encodeURIComponent`. Titres : « Nouvelle inscription »,
« Inscription resoumise », « Inscription approuvée », « Inscription rejetée »,
« Badge imprimé », « Profil à valider », « Profil validé », « Documents refusés »,
« Ajout à une organisation », « Ajout à un évènement », « Rôle modifié »,
« Inscriptions ouvertes », « Inscriptions fermées », « Nouvelle organisation »,
« Abonnement modifié », « Quota dépassé », « Email en échec ». Corps : une phrase, en
texte brut (l'échappement HTML se fait à la construction de l'email, Task 5).

- [ ] Écrire `messages.test.ts`, un `it` par constructeur, qui vérifie titre, `href`,
  `primaryLabel`, `links` et un fragment du corps ; plus :
  - `"le corps de resoumission mentionne le changement de catégorie"` :
    `categoryChanged: { from: "Presse", to: "Exposant" }` → corps contient « Exposant » et
    « Presse » ; sans `categoryChanged`, ne contient pas « catégorie ».
  - `"le rejet sans motif n'affiche pas « Motif : »"`.
  - `"encode les identifiants dans les liens"` : `registrationId: "a/b"` → `href` finit
    par `a%2Fb`.
  - `"tous les liens sont relatifs à l'application"` : pour chaque constructeur,
    `href` et `links[].href` matchent `/^\/(?!\/)/`.
- [ ] Lancer le fichier → échec attendu : module introuvable.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 4 — Résolveur de destinataires (`recipients.ts`)

**Fichiers :** créer `src/lib/notifications/recipients.ts`,
`src/lib/notifications/__tests__/recipients.test.ts` ; compléter `types.ts`.

**Interfaces**
- Consumes : `effectiveEventRole`, `staffRoleAtLeast` (`src/lib/auth-helpers.ts`),
  type `UserContext` (`src/types/auth`).
- Produces :
  ```ts
  // types.ts
  export type RecipientSpec =
    | { users: string[] }
    | { eventRoles: { eventId: string; roles: EventRole[] } }
    | { orgRoles: { orgId: string; roles: OrgRole[] } }
    | { staffMinRole: StaffRole };
  // recipients.ts
  export type Recipient = { id: string; email: string; name: string };
  export async function resolveRecipients(
    spec: RecipientSpec,
    opts: { actorId?: string | null; excludeUserIds?: Iterable<string> },
    db?: Prisma.TransactionClient,   // défaut : prisma
  ): Promise<Recipient[]>;
  ```

Algorithme `eventRoles` (à suivre) : charger l'`orgId` de l'évènement ; candidats = users
ayant une `EventMembership` sur l'évènement **ou** une `OrgMembership` sur son org ; pour
chacun, construire un `UserContext` avec **`isStaff: false`** et ses memberships, calculer
`effectiveEventRole(ctx, eventId, orgId)` et garder ceux dont le rôle est dans `roles`.
Ainsi OWNER/MANAGER d'org comptent comme ADMIN et AUDITOR comme VIEWER, comme dans
`auth-helpers.ts`. `staffMinRole` : `isStaff: true` et `staffRoleAtLeast(staffRole, min)`.
`orgRoles` : `OrgMembership` avec `role in roles` (liste exacte, pas de hiérarchie). Pour
tous : filtre `blocked: false, archived: false`, retrait de `actorId` et de
`excludeUserIds`, dédoublonnage par `id`, tri par `id` (déterminisme des tests).

- [ ] Écrire `recipients.test.ts` :
  - `"users : renvoie les utilisateurs existants, ignore les ids inconnus"`.
  - `"eventRoles ADMIN+OPERATOR inclut OWNER et MANAGER de l'org, exclut AUDITOR, PRINTER, VIEWER"`.
  - `"eventRoles : un OWNER d'org également ADMIN de l'évènement n'apparaît qu'une fois"`.
  - `"eventRoles avec les quatre rôles inclut l'AUDITOR (hérité VIEWER) et le PRINTER"`.
  - `"un staff non membre ne reçoit pas les notifications d'évènement"` (vigilance 3).
  - `"un staff membre ADMIN de l'évènement les reçoit"` (vigilance 3).
  - `"staffMinRole STAFF_SUPPORT inclut SUPPORT, ADMIN, SUPER_ADMIN et exclut OBSERVER et les non-staff"`.
  - `"orgRoles OWNER n'inclut que les OWNER"`.
  - `"exclut l'auteur, les comptes bloqués et archivés, et excludeUserIds"`.
  - `"eventRoles sur un évènement inexistant renvoie []"`.
- [ ] Lancer le fichier → échec attendu : module introuvable.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 5 — Service `notify()` / `notifyAll()`

**Fichiers :** créer `src/lib/notifications/notify.ts`,
`src/lib/notifications/__tests__/notify.test.ts` ; compléter `types.ts`.

**Interfaces**
- Consumes : `resolveRecipients` (Task 4), `NotificationContent` (Task 3),
  `enqueueEmail(message, tx?)` (C1, `src/lib/jobs/enqueue-email.ts`),
  `resolveTransporter(ctx)` et `buildEmail({ title, body, ctx })` (`src/lib/mail.ts`,
  utilisés pour le branding uniquement), `buildBaseUrl`, `escapeHtml`
  (`src/lib/mail-helpers.ts`).
- Produces :
  ```ts
  // types.ts
  export type NotifyInput = {
    type: NotificationType;
    scope: NotificationScope;          // ajout à la signature de la spec : une notification a une portée
    recipients: RecipientSpec;
    actorId?: string | null;
    orgId?: string;
    eventId?: string;
    content: NotificationContent;
    email?: boolean;                   // défaut : EMAIL_BY_TYPE[type]
  };
  // notify.ts
  export const EMAIL_BY_TYPE: Record<NotificationType, boolean>;
  export async function notify(input: NotifyInput, tx?: Prisma.TransactionClient): Promise<void>;
  export async function notifyAll(inputs: NotifyInput[], tx?: Prisma.TransactionClient): Promise<void>;
  export async function withNotificationGuard(label: string, fn: () => Promise<void>): Promise<void>;
  ```

Comportement :
- `notify(input, tx)` = `notifyAll([input], tx)`.
- `notifyAll` traite les entrées **dans l'ordre** ; un utilisateur déjà servi par une
  entrée précédente est passé en `excludeUserIds` des suivantes (dédoublonnage entre
  audiences, utile à `SUBSCRIPTION_CHANGED` et `QUOTA_EXCEEDED`, qui visent l'org puis la
  plateforme).
- Si `eventId` est fourni sans `orgId`, `orgId` est lu sur l'évènement : toute
  notification `EVENT` porte son `orgId` (la portée org s'en sert, Task 10).
- Une seule `createMany` par entrée ; `links` stocké = `[{ label: primaryLabel, href }, ...links]`
  (le lien principal en tête, `href` en colonne aussi). Aucun appel si zéro destinataire.
- Email si `input.email ?? EMAIL_BY_TYPE[type]` : `resolveTransporter({ eventId, orgId })`
  **une fois** par entrée, puis pour chaque destinataire
  `enqueueEmail({ to, subject: content.title, html: buildEmail({ title, body, ctx }), kind: \`notification.${type.toLowerCase()}\`, priority: "normal", ctx: { eventId, orgId } }, tx)`.
  Le corps de l'email = corps échappé + bouton vers `buildBaseUrl(process.env) + href`
  (URL absolue) libellé `primaryLabel`.
- `EMAIL_BY_TYPE` = `true` pour `REGISTRATION_CREATED`, `REGISTRATION_RESUBMITTED`,
  `PROFILE_SUBMITTED`, `ORG_MEMBERSHIP_ADDED`, `EVENT_MEMBERSHIP_ADDED`,
  `MEMBERSHIP_ROLE_CHANGED`, `EVENT_REGISTRATION_OPENED`, `EVENT_REGISTRATION_CLOSED`,
  `ORG_CREATED`, `SUBSCRIPTION_CHANGED`, `QUOTA_EXCEEDED` ; `false` pour
  `REGISTRATION_APPROVED`, `REGISTRATION_REJECTED`, `BADGE_PRINTED`, `PROFILE_APPROVED`,
  `PROFILE_REJECTED`, `EMAIL_FAILED`.
- **Aucune exception ne sort** de `notify`/`notifyAll` : chaque entrée est dans un
  `try/catch` qui logge `console.error("[notify] failed", { type, error })`. Un échec
  d'email après insertion n'annule pas les lignes.
- `withNotificationGuard(label, fn)` exécute `fn` et logge toute erreur
  (`console.error("[notify] trigger failed", { label, error })`) sans la propager : les
  déclencheurs l'utilisent pour couvrir aussi leur chargement de données.

- [ ] Écrire `notify.test.ts` (`vi.mock("@/lib/jobs/enqueue-email", () => ({ enqueueEmail: vi.fn(async () => undefined) }))`,
  `__mailTesting.setResolveTransporter` avec un faux transport de branding, `reset()` en
  `afterEach`) :
  - `"crée une ligne par destinataire avec type, portée, orgId, eventId, href et links"`.
  - `"déduit orgId de l'évènement quand il manque"`.
  - `"envoie un email par destinataire quand EMAIL_BY_TYPE le prévoit"` :
    `enqueueEmail` appelé N fois ; `to`, `subject`, `kind: "notification.registration_created"`,
    `html` contient l'URL absolue du lien et le corps échappé (`<` → `&lt;`).
  - `"n'envoie pas d'email pour REGISTRATION_APPROVED, ni si email: false"`.
  - `"aucun destinataire : ni ligne ni email"` (vigilance 2) : seul destinataire = auteur
    → `count` 0, `enqueueEmail` non appelé.
  - `"une erreur d'enqueueEmail est loggée et n'empêche pas les notifications"`
    (vigilance 1) : `enqueueEmail` rejette → `notify` résout, lignes présentes,
    `console.error` appelé avec `"[notify] failed"`.
  - `"notifyAll ne notifie qu'une fois un utilisateur présent dans deux audiences"` :
    OWNER également `STAFF_ADMIN` → une seule ligne, portée de la première entrée.
  - `"écrit dans la transaction fournie"` : `prisma.$transaction(async (tx) => { await notify(input, tx); throw new Error("rollback") })`
    → aucune ligne après le rollback.
  - `"withNotificationGuard avale et logge l'erreur"`.
- [ ] Lancer le fichier → échec attendu : module introuvable.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 6 — Déclencheurs inscriptions et badges

**Fichiers :** créer `src/lib/notifications/triggers.ts` (première partie),
`src/lib/notifications/__tests__/triggers-registrations.test.ts` ; modifier les six routes
de la matrice (types `REGISTRATION_*`, `BADGE_PRINTED`).

**Interfaces**
- Consumes : `notifyAll`, `withNotificationGuard` (Task 5), constructeurs (Task 3).
- Produces :
  ```ts
  export async function notifyRegistrationCreated(registrationId: string, actorId: string): Promise<void>;
  export async function notifyRegistrationResubmitted(registrationId: string, actorId: string, opts?: { categoryChanged?: { from: string; to: string } }): Promise<void>;
  export async function notifyRegistrationDecision(registrationId: string, actorId: string, decision: "APPROVED" | "REJECTED"): Promise<void>;
  export async function notifyBadgePrinted(registrationIds: string[], actorId: string): Promise<void>;
  ```
  Chaque fonction est enveloppée dans `withNotificationGuard`, charge l'inscription
  (`snapshotFirstName`, `snapshotLastName`, `userId`, `rejectionReason`, `event { id, title, orgId }`,
  `category { name }`) et **retourne sans rien faire** si elle est introuvable.
  - Créée / resoumise : `scope: "EVENT"`, `recipients: { eventRoles: { eventId, roles: ["ADMIN", "OPERATOR"] } }`.
  - Décision et badge : `scope: "PARTICIPANT"`, `recipients: { users: [registration.userId] }`,
    `eventId`/`orgId` renseignés.
  - Badge en lot : une entrée par inscription, en un seul `notifyAll`.

Branchements (une ligne, **après** le `logActivity` existant, `await`) :
- `src/app/api/events/[slug]/register/route.ts` : `await notifyRegistrationCreated(registration.id, session.id);`
- `src/app/api/account/registrations/[id]/resubmit/route.ts` : `await notifyRegistrationResubmitted(registration.id, session.id);`
  (le changement de catégorie est câblé en Task 17).
- `.../registrations/[regId]/approve/route.ts` : `await notifyRegistrationDecision(regId, session.user.id, "APPROVED");`
- `.../registrations/[regId]/reject/route.ts` : `await notifyRegistrationDecision(regId, session.user.id, "REJECTED");`
- `.../registrations/[regId]/print/route.ts` : `await notifyBadgePrinted([regId], session.user.id);`
- `.../registrations/print/route.ts` : `await notifyBadgePrinted(ids, session.user.id);`

- [ ] Écrire `triggers-registrations.test.ts` (mocks : `next-auth`, `send*` de
  `@/lib/mail` comme dans `api-event-registrations.test.ts`, `enqueueEmail`) qui appelle
  les **routes** :
  - `"POST register notifie ADMIN et OPERATOR de l'évènement, OWNER d'org compris, pas le participant"` :
    notifications `REGISTRATION_CREATED` pour ADMIN, OPERATOR, OWNER ; aucune pour PRINTER,
    VIEWER, participant ; `enqueueEmail` appelé avec `kind: "notification.registration_created"`.
  - `"un OWNER d'org également ADMIN de l'évènement ne reçoit qu'une notification"` (critère de la spec).
  - `"POST resubmit notifie l'équipe de l'évènement"`.
  - `"approve notifie le participant sans email de notification"` : une ligne
    `PARTICIPANT` ; `enqueueEmail` **non** appelé par la notification ;
    `sendStatusNotification` appelé une fois (email existant).
  - `"reject inclut le motif dans le corps"`.
  - `"print et print en lot notifient chaque participant une fois"`.
  - `"l'opérateur qui approuve n'est pas notifié"` (auteur exclu).
  - `"inscription introuvable : le déclencheur ne crée rien et ne lève pas"` (appel direct
    du déclencheur avec un id inconnu, pour la branche de retour).
- [ ] Lancer le fichier → échec attendu : aucune notification créée / module introuvable.
- [ ] Implémenter les déclencheurs et les six branchements.
- [ ] Relancer → vert ; relancer les tests existants des routes touchées
  (`src/lib/__tests__/api-event-registrations.test.ts`,
  `src/app/api/events/__tests__/register-event.test.ts`,
  `src/app/api/account/__tests__/registrations.test.ts`) → verts.

---

## Task 7 — Déclencheurs profils

**Fichiers :** compléter `triggers.ts` ; créer
`src/lib/notifications/__tests__/triggers-profiles.test.ts` ; modifier
`src/app/api/account/profile/route.ts`,
`src/app/api/platform/profiles/[userId]/approve/route.ts`,
`src/app/api/platform/profiles/[userId]/reject/route.ts`.

**Interfaces**
- Produces :
  ```ts
  export async function notifyProfileSubmitted(userId: string): Promise<void>;           // scope PLATFORM, { staffMinRole: "STAFF_SUPPORT" }, actorId = userId
  export async function notifyProfileDecision(userId: string, actorId: string, decision: "APPROVED" | "REJECTED", reason?: string | null): Promise<void>; // scope PARTICIPANT
  ```

Branchements :
- `account/profile/route.ts` : lire `const before = await getCurrentSubmission(session.id);`
  **avant** `submitProfile`, garder son retour (`const submitted = await submitProfile(session.id);`),
  puis `if (submitted && submitted.id !== before?.id) await notifyProfileSubmitted(session.id);`.
- `approve/route.ts` : après `logActivity`, `await notifyProfileDecision(userId, session.user.id, "APPROVED");`
- `reject/route.ts` : après `logActivity`, `await notifyProfileDecision(userId, session.user.id, "REJECTED", submission.rejectionReasonLabel);`

- [ ] Écrire `triggers-profiles.test.ts` (routes appelées, mocks `next-auth`, `send*`, `enqueueEmail`) :
  - `"déposer de nouvelles pièces notifie le staff STAFF_SUPPORT et au-dessus, avec email"`.
  - `"modifier seulement le prénom ne notifie pas le staff"` (vigilance 4).
  - `"approuver un profil notifie le participant, sans email de notification"`.
  - `"rejeter un profil inclut le motif"`.
  - `"le staff qui décide n'est pas notifié"`.
  - `"utilisateur introuvable : aucun effet"` (appel direct).
- [ ] Lancer → échec attendu.
- [ ] Implémenter + branchements.
- [ ] Relancer → vert ; relancer `src/app/api/account/__tests__/profile.test.ts` et
  `src/lib/__tests__/api-platform-profiles.test.ts` → verts.

---

## Task 8 — Déclencheurs membres et rôles

**Fichiers :** compléter `triggers.ts` ; créer
`src/lib/notifications/__tests__/triggers-memberships.test.ts` ; modifier les sept
branchements de la matrice (`ORG_MEMBERSHIP_ADDED`, `EVENT_MEMBERSHIP_ADDED`,
`MEMBERSHIP_ROLE_CHANGED`).

**Interfaces**
- Produces :
  ```ts
  export async function notifyOrgMembershipAdded(a: { userId: string; orgId: string; role: OrgRole; actorId: string; invitationSent: boolean }): Promise<void>;     // scope ORG
  export async function notifyEventMembershipAdded(a: { userId: string; eventId: string; role: EventRole; actorId: string; invitationSent: boolean }): Promise<void>; // scope EVENT
  export async function notifyMembershipRoleChanged(a: { userId: string; actorId: string; from: OrgRole | EventRole; to: OrgRole | EventRole } & ({ orgId: string } | { eventId: string })): Promise<void>; // scope ORG ou EVENT
  ```
  `email: !invitationSent` pour les ajouts. `notifyMembershipRoleChanged` ne fait rien si
  `from === to`.

Branchements (après le `logActivity MEMBERSHIP_ADDED` / `MEMBERSHIP_ROLE_CHANGED`) :
- `src/app/api/org/[orgId]/members/route.ts` `POST` : `invitationSent: isNewUser`.
- `src/app/api/platform/organizations/[orgId]/owners/route.ts` `POST` : branche création
  `invitationSent: isNewUser` ; branche `upgraded` →
  `notifyMembershipRoleChanged({ userId: user.id, orgId, from: existing.role, to: role, actorId })`.
- `src/app/api/platform/organizations/route.ts` `POST` : OWNER,
  `invitationSent: result.userCreated`.
- `src/app/api/platform/users/route.ts` `POST` : dans la boucle des memberships,
  `invitationSent: true`.
- `src/app/api/org/[orgId]/events/[eventId]/members/route.ts` `POST` :
  `invitationSent: wasNew`.
- `src/app/api/org/[orgId]/members/[userId]/route.ts` `PATCH` : org,
  `from: existing.role, to: nextRole`.
- `src/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route.ts` `PATCH` :
  évènement, `userId: updated.userId, from: existing.role, to: parsed.data.role`.

- [ ] Écrire `triggers-memberships.test.ts` :
  - `"ajouter un membre existant à l'org le notifie avec email"`.
  - `"ajouter un nouvel utilisateur (invitation) le notifie sans email de notification"` :
    `enqueueEmail` non appelé pour `notification.org_membership_added` ;
    `sendUserInvitation` appelé.
  - `"ajouter un membre d'évènement le notifie en portée EVENT avec l'orgId"`.
  - `"le staff qui crée une org notifie l'OWNER existant avec email"` et
    `"… l'OWNER créé sans email"`.
  - `"platform/users POST notifie chaque membership sans email"`.
  - `"changer un rôle d'org notifie la personne avec ancien et nouveau rôle"`.
  - `"changer un rôle d'évènement vers le même rôle ne notifie pas"` (la route
    évènement n'a pas de court-circuit `existing.role === role`).
  - `"la branche upgraded des owners staff notifie un changement de rôle"`.
  - `"l'auteur qui s'ajoute lui-même n'est pas notifié"`.
- [ ] Lancer → échec attendu.
- [ ] Implémenter + branchements.
- [ ] Relancer → vert ; relancer `src/lib/__tests__/api-org.test.ts`,
  `src/lib/__tests__/api-event-members.test.ts`,
  `src/lib/__tests__/api-staff-organizations-post.test.ts`,
  `src/lib/__tests__/api-staff-users-post.test.ts`,
  `src/app/api/platform/organizations/[orgId]/owners/__tests__/route.test.ts` → verts.

---

## Task 9 — Déclencheurs évènement, organisation, abonnement, quota

**Fichiers :** compléter `triggers.ts` ; créer
`src/lib/notifications/__tests__/triggers-org-event.test.ts` ; modifier
`src/app/api/org/[orgId]/events/[eventId]/route.ts`,
`src/app/api/platform/organizations/route.ts`,
`src/app/api/platform/organizations/[orgId]/subscription/route.ts`,
`src/app/api/org/[orgId]/events/route.ts`.

**Interfaces**
- Produces :
  ```ts
  export async function notifyEventRegistrationToggled(eventId: string, open: boolean, actorId: string): Promise<void>; // scope EVENT, eventRoles ["ADMIN","OPERATOR","PRINTER","VIEWER"]
  export async function notifyOrgCreated(orgId: string, actorId: string): Promise<void>;                               // scope PLATFORM, staffMinRole STAFF_ADMIN
  export async function notifySubscriptionChanged(orgId: string, actorId: string): Promise<void>;                       // [ORG: orgRoles OWNER, PLATFORM: staffMinRole STAFF_ADMIN]
  export async function notifyQuotaExceeded(orgId: string, eventId: string, actorId: string): Promise<void>;           // idem, deux audiences
  ```
  Les deux derniers passent **deux** entrées à `notifyAll` (org d'abord, plateforme
  ensuite) avec `audience` correspondante dans le constructeur.

Branchements :
- `events/[eventId]/route.ts` `PATCH` : dans le `if` qui logge
  `EVENT_REGISTRATION_OPENED/CLOSED`, après le `logActivity` :
  `await notifyEventRegistrationToggled(eventId, parsed.data.registrationOpen, session.user.id);`
- `platform/organizations/route.ts` `POST` : après `logActivity ORG_CREATED` :
  `await notifyOrgCreated(result.org.id, session.user.id);` (l'abonnement automatique
  n'est pas notifié, cf. inventaire).
- `subscription/route.ts` `PUT` : après le `logActivity` :
  `await notifySubscriptionChanged(orgId, session.user.id);`
- `org/[orgId]/events/route.ts` `POST` : mémoriser le contournement dans
  `let quotaBypassed = false;` (mis à `true` dans la branche staff existante) et, après le
  `logActivity EVENT_CREATED`, `if (quotaBypassed) await notifyQuotaExceeded(orgId, event.id, session.user.id);`.

- [ ] Écrire `triggers-org-event.test.ts` :
  - `"ouvrir les inscriptions notifie tous les membres de l'évènement, AUDITOR d'org compris, sauf l'auteur"`.
  - `"fermer les inscriptions envoie « Inscriptions fermées »"`.
  - `"un PATCH sans changement de registrationOpen ne notifie pas"`.
  - `"créer une org notifie STAFF_ADMIN et SUPER_ADMIN, pas STAFF_SUPPORT"`.
  - `"modifier l'abonnement notifie l'OWNER (portée ORG, lien /org/…/subscription) et le staff admin (portée PLATFORM)"`.
  - `"un staff à la fois OWNER n'est notifié qu'une fois, en portée ORG"`.
  - `"créer un évènement au-delà du quota par le staff notifie QUOTA_EXCEEDED ; sans dépassement, rien"`.
  - `"org ou évènement introuvable : aucun effet"` (appels directs).
- [ ] Lancer → échec attendu.
- [ ] Implémenter + branchements.
- [ ] Relancer → vert ; relancer `src/lib/__tests__/api-event-settings.test.ts`,
  `src/lib/__tests__/api-staff-organizations.test.ts`,
  `src/app/api/platform/organizations/[orgId]/subscription/__tests__/route.test.ts`,
  `src/lib/__tests__/api-org.test.ts` → verts.

---

## Task 10 — Requêtes de lecture (`queries.ts`)

**Fichiers :** créer `src/lib/notifications/queries.ts`,
`src/lib/notifications/__tests__/queries.test.ts` ; compléter `types.ts`.

**Interfaces**
- Consumes : `NotificationScopeRef` (Task 2).
- Produces :
  ```ts
  export type NotificationDTO = {
    id: string; type: NotificationType; title: string; body: string;
    href: string | null; links: NotificationLink[]; readAt: string | null; createdAt: string;
  };
  export const NOTIFICATIONS_PAGE_SIZE = 20;
  export function scopeWhere(userId: string, ref: NotificationScopeRef): Prisma.NotificationWhereInput;
  export function toNotificationDTO(n: Notification): NotificationDTO; // links invalide/absent → []
  export class InvalidCursorError extends Error {}
  export async function listNotifications(userId: string, ref: NotificationScopeRef, opts?: { cursor?: string; unreadOnly?: boolean; limit?: number }): Promise<{ items: NotificationDTO[]; nextCursor: string | null }>;
  export async function countUnread(userId: string, ref: NotificationScopeRef): Promise<number>;
  export async function markRead(userId: string, id: string): Promise<boolean>;      // false si absente ou d'un autre utilisateur
  export async function markAllRead(userId: string, ref: NotificationScopeRef): Promise<number>;
  ```
  `scopeWhere` : platform → `{ userId, scope: "PLATFORM" }` ; org →
  `{ userId, orgId, scope: { in: ["ORG", "EVENT"] } }` ; event →
  `{ userId, eventId, scope: "EVENT" }` ; participant → `{ userId, scope: "PARTICIPANT" }`.
  Tri `[{ createdAt: "desc" }, { id: "desc" }]`, `take: limit + 1`, curseur
  `{ cursor: { id }, skip: 1 }` ; un curseur qui n'appartient pas à
  `scopeWhere(userId, ref)` lève `InvalidCursorError`. `markRead` est idempotent (ne
  réécrit pas un `readAt` existant).

- [ ] Écrire `queries.test.ts` :
  - `"la portée org inclut ORG et EVENT de cette org, pas ceux d'une autre org"`.
  - `"la portée event n'inclut que cet évènement"`, `"platform"` et `"participant"`.
  - `"pagine par curseur sans doublon ni trou"` (25 notifications → 20 + 5, `nextCursor` null à la fin).
  - `"unreadOnly ne renvoie que les non lues"`.
  - `"un curseur d'un autre utilisateur ou inconnu lève InvalidCursorError"`.
  - `"countUnread compte les non lues de la portée"`.
  - `"markRead renvoie false pour la notification d'un autre utilisateur et ne la modifie pas"`.
  - `"markRead ne réécrit pas readAt"`.
  - `"markAllRead ne touche que la portée et l'utilisateur"`.
  - `"toNotificationDTO renvoie links [] si la colonne est nulle ou mal formée"`.
- [ ] Lancer → échec attendu.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 11 — Routes API `api/notifications/**`

**Fichiers :** créer les quatre `route.ts` listés et
`src/app/api/notifications/__tests__/routes.test.ts`.

**Interfaces**
- Consumes : `requireAuth`, `AuthError` (`src/lib/auth-participant.ts`), `parseScopeQuery`
  (Task 2), fonctions de `queries.ts` (Task 10).
- Produces :
  - `GET /api/notifications?scope=…&orgId=…&eventId=…&cursor=…&unread=1&limit=…` →
    `200 { items: NotificationDTO[], nextCursor: string | null }` ; `limit` entier
    facultatif borné à 1..`NOTIFICATIONS_PAGE_SIZE` (défaut 20 ; le panneau passe 10),
    hors bornes ou non numérique → `400 { code: "VALIDATION", error: "Paramètre limit invalide." }`.
  - `GET /api/notifications/unread-count?scope=…` → `200 { count: number }`.
  - `POST /api/notifications/[id]/read` → `200 { ok: true }` ; `404 { code: "NOT_FOUND", error: "Notification introuvable." }`.
  - `POST /api/notifications/read-all?scope=…` → `200 { updated: number }`.
  - Erreurs communes : `401` (pas de session, format `{ code, error }` de `AuthError`) ;
    `400 { code: "INVALID_SCOPE", error: "Portée invalide." }` ;
    `400 { code: "INVALID_CURSOR", error: "Curseur invalide." }`.
  - `export const dynamic = "force-dynamic";` sur les deux `GET` (pas de cache du compteur).

Aucune vérification de rôle sur l'espace : chaque requête est filtrée par `userId` de la
session, ce qui suffit à la règle « ses propres notifications ».

- [ ] Écrire `routes.test.ts` (mock `next-auth`) :
  - `"401 sans session"` sur les quatre routes.
  - `"400 INVALID_SCOPE pour une portée inconnue ou org sans orgId"`.
  - `"400 INVALID_CURSOR pour un curseur inconnu"`.
  - `"limit=10 renvoie au plus 10 éléments ; limit=0 ou limit=abc renvoie 400"`.
  - `"GET liste les notifications de la portée, avec nextCursor"` ; le DTO ne contient
    que les clés de `NotificationDTO` (`Object.keys` égal à la liste).
  - `"GET unread-count renvoie le compte"`.
  - `"POST read sur la notification d'un autre utilisateur renvoie 404 et ne la modifie pas"` (critère de la spec).
  - `"POST read marque lue"` ; `"POST read-all renvoie le nombre marqué"`.
- [ ] Lancer → échec attendu (404 de route introuvable / module introuvable).
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 12 — Réécriture des liens, purge, déclencheur `EMAIL_FAILED`

**Fichiers :** créer `src/lib/notifications/rewrite-links.ts`,
`src/lib/notifications/retention.ts`, compléter `triggers.ts` ; tests
`src/lib/notifications/__tests__/rewrite-links.test.ts`,
`retention.test.ts`, `triggers-email-failed.test.ts`.

**Interfaces**
- Produces :
  ```ts
  export async function rewriteNotificationLinks(oldRegistrationId: string, newRegistrationId: string, tx?: Prisma.TransactionClient): Promise<number>; // nb de notifications modifiées
  export const NOTIFICATION_RETENTION_DAYS = 90;
  export async function purgeReadNotifications(now?: Date, db?: Prisma.TransactionClient): Promise<number>;
  export async function notifyEmailFailed(job: { id: string; kind: string; recipient: string | null; attempts: number }): Promise<void>; // scope PLATFORM, staffMinRole STAFF_ADMIN, email false, actorId null
  ```
  Réécriture : candidates = `href: { contains: oldRegistrationId }` ; remplacement par
  l'expression ``new RegExp(`/registrations/${escapeRegExp(oldId)}(?=$|[/?#])`)`` dans
  `href` et chaque `links[].href` (le lien principal étant toujours en `links[0]`, une
  référence dans `links` implique une référence dans `href`). Toutes les notifications
  concernées, quel que soit leur destinataire. Purge :
  `deleteMany({ where: { readAt: { lt: now - 90 j } } })` — les non lues sont conservées.

- [ ] Écrire les tests :
  - `"réécrit href et links de toutes les notifications de l'inscription"` (deux
    destinataires) → retour 2.
  - `"ne réécrit pas un ID qui contient l'ancien en sous-chaîne"` (vigilance 5).
  - `"fonctionne dans une transaction"` (rollback → inchangé).
  - `"purge les lues de plus de 90 jours, garde les lues récentes et toutes les non lues"`
    (bornes : 90 j + 1 min supprimée, 89 j conservée).
  - `"notifyEmailFailed notifie STAFF_ADMIN et au-dessus, sans email"` : `enqueueEmail`
    non appelé (pas de boucle).
- [ ] Lancer → échec attendu.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 13 — Date relative, « 9+ » et contrôleur de polling

**Fichiers :** créer `src/lib/format-relative-time.ts`,
`src/lib/__tests__/format-relative-time.test.ts`,
`src/components/notifications/unread-poller.ts`,
`src/components/notifications/__tests__/unread-poller.test.ts`.

**Interfaces**
- Produces :
  ```ts
  // src/lib/format-relative-time.ts — Intl.RelativeTimeFormat("fr", { numeric: "auto", style: "short" })
  export function formatRelativeTime(date: Date | string, now?: Date): string;
  // unread-poller.ts
  export const UNREAD_POLL_INTERVAL_MS = 30_000;
  export function formatBadgeCount(count: number): string | null; // 0 → null, 1..9 → "1".."9", ≥10 → "9+"
  export function createUnreadPoller(deps: {
    fetchCount: () => Promise<number | null>;   // null = 401 : arrêt définitif
    onCount: (n: number) => void;
    doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
    intervalMs?: number;
  }): { start(): void; stop(): void; refresh(): Promise<void> };
  ```
  `start()` : un `refresh` immédiat puis un `setInterval` ; à `visibilitychange` vers
  `hidden`, l'intervalle est suspendu ; vers `visible`, `refresh` immédiat puis reprise.
  Une erreur réseau de `fetchCount` est ignorée (le compteur garde sa dernière valeur).

- [ ] Écrire les tests :
  - `formatRelativeTime` : `"il y a 5 min"` (5 min avant `now`), `"à l'instant"` ou
    l'équivalent `Intl` pour < 1 min (asserter la sortie exacte d'`Intl` en
    `fr`), heures, `"hier"`, jours ; accepte une chaîne ISO.
  - `formatBadgeCount` : `0 → null`, `3 → "3"`, `9 → "9"`, `10 → "9+"`.
  - Poller (faux minuteurs `vi.useFakeTimers()`, faux document `EventTarget` avec
    `visibilityState` modifiable) :
    `"rafraîchit au démarrage puis toutes les 30 s"`,
    `"suspend le polling onglet caché et rafraîchit aussitôt au retour"`,
    `"s'arrête définitivement quand fetchCount renvoie null"`,
    `"ignore une erreur réseau"`, `"stop retire l'écouteur"`.
- [ ] Lancer → échec attendu.
- [ ] Implémenter.
- [ ] Relancer → vert.

---

## Task 14 — `NotificationBell` et panneau

**Fichiers :** modifier `src/components/notifications/NotificationBell.tsx` ; créer
`src/components/notifications/NotificationPanel.tsx`,
`src/components/notifications/__tests__/NotificationBell.test.tsx`.

**Interfaces**
- Consumes : `createUnreadPoller`, `formatBadgeCount`, `UNREAD_POLL_INTERVAL_MS` (Task 13),
  `scopeToSearchParams`, `notificationsPagePath` (Task 2), `formatRelativeTime`, routes
  API (Task 11), icône `Bell` importée de `lucide-react` (le registre `ui/Icon.tsx`
  n'est pas modifié).
- Produces :
  ```ts
  export function NotificationBell(props: { scope: NotificationScopeRef }): JSX.Element; // "use client"
  export function NotificationBellButton(props: { count: number; open: boolean; onToggle: () => void }): JSX.Element; // exporté pour le rendu statique
  export function NotificationPanel(props: { scope: NotificationScopeRef; onClose: () => void; onChanged: () => void }): JSX.Element;
  export function NotificationPanelList(props: { items: NotificationDTO[]; now: Date; onSelect: (id: string) => void }): JSX.Element; // exporté pour le rendu statique
  ```
  - Bouton : `aria-label` « Notifications, N non lues » (ou « Notifications » à 0),
    `aria-expanded`, `aria-haspopup="dialog"`, cible ≥ `h-10 w-10` ; pastille
    `formatBadgeCount(count)` masquée si `null`.
  - Panneau : `role="dialog"`, `aria-label="Notifications"` ; sous `sm` :
    `fixed inset-0 z-50` ; à partir de `sm` : `sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-[70vh]`,
    liste défilante. À l'ouverture : `GET /api/notifications?{scope}&limit=10`
    (Task 11), état de chargement (`Spinner`), état vide « Aucune
    notification ». Élément : titre, corps tronqué (`line-clamp-2`), date relative, point
    `aria-label="Non lue"` si `readAt` nul. Pied : bouton « Tout marquer comme lu »
    (`POST read-all` puis `onChanged`) et lien « Voir toutes les notifications » →
    `notificationsPagePath(scope)`.
  - Clic sur un élément : `POST /api/notifications/{id}/read`, puis
    `router.push(\`${notificationsPagePath(scope)}#n-${id}\`)`, fermeture, `onChanged`.
  - Fermeture : Échap, clic hors du conteneur (`pointerdown` sur `document`), changement
    de `usePathname()`. Le focus revient sur le bouton.
  - `onChanged` relance `poller.refresh()`.

- [ ] Écrire `NotificationBell.test.tsx` (rendu `renderToStaticMarkup`, comme
  `ui/__tests__/Tabs.test.tsx`) :
  - `"pastille masquée et aria-label simple à 0"`.
  - `"aria-label « Notifications, 3 non lues » et pastille 3"`.
  - `"pastille « 9+ » à 12"`.
  - `"la liste affiche titre, date relative et le point des non lues"`.
  - `"la liste vide affiche « Aucune notification »"`.
  - `"le panneau est plein écran sous sm"` (classes `fixed inset-0` et `sm:absolute`).
- [ ] Lancer → échec attendu.
- [ ] Implémenter.
- [ ] Relancer → vert ; `make lint` → vert.
- [ ] Vérification navigateur (après `make db-seed`, puis créer une notification pour
  l'utilisateur connecté via une action réelle, ex. ouvrir les inscriptions avec un autre
  ADMIN) : pastille, panneau à 1280 px ancré à la cloche, plein écran à 375 px, Échap et
  clic extérieur ferment.

---

## Task 15 — Pages des notifications

**Fichiers :** créer `src/components/notifications/NotificationsView.tsx` (serveur),
`src/components/notifications/MarkAllReadButton.tsx` (client),
`src/components/notifications/__tests__/NotificationsView.test.tsx` ; remplacer les
quatre pages d'attente du socle.

**Interfaces**
- Consumes : `listNotifications`, `InvalidCursorError` (Task 10), `EmptyState`
  (`ui/Feedback.tsx`), `formatRelativeTime`, session (`getServerSession(authOptions)`).
- Produces :
  ```ts
  export async function NotificationsView(props: { userId: string; scope: NotificationScopeRef; searchParams: { unread?: string; cursor?: string } }): Promise<JSX.Element>;
  export function NotificationsList(props: { items: NotificationDTO[]; now: Date }): JSX.Element; // exporté pour le test
  export function MarkAllReadButton(props: { scope: NotificationScopeRef }): JSX.Element;       // POST read-all puis router.refresh()
  ```
  - En-tête « Notifications », filtre en deux liens (« Toutes » / « Non lues seulement »,
    `?unread=1`, état actif `aria-current="page"`), `MarkAllReadButton`.
  - Chaque élément : `<li id="n-{id}" class="… target:ring-2 target:ring-green-600 scroll-mt-20">`,
    titre, corps complet, date relative, mention « Non lue », bouton-lien du lien principal
    (`links[0]`, libellé stocké) et liens secondaires (`links.slice(1)`), tous en
    `next/link`.
  - Pagination : lien « Notifications plus anciennes » avec `?cursor={nextCursor}`
    (+ `unread` conservé) ; « Revenir aux plus récentes » si un curseur est présent.
    Un `InvalidCursorError` renvoie la première page.
  - Vide : `EmptyState icon="inbox" title="Aucune notification"` (variante « Aucune
    notification non lue » avec le filtre).
  - Pages (Server Components, chacune quelques lignes) : `platform` →
    `{ kind: "platform" }` ; `org/[orgId]` → `{ kind: "org", orgId }` ;
    `event/[eventId]` → `{ kind: "event", eventId }` ; `account` →
    `{ kind: "participant" }`. Le contrôle d'accès reste celui des `layout.tsx` existants.

- [ ] Écrire `NotificationsView.test.tsx` (rendu statique de `NotificationsList`) :
  - `"chaque élément porte l'ancre n-<id> et la classe target:"`.
  - `"affiche le bouton du lien principal avec son libellé et les liens secondaires"`.
  - `"marque « Non lue » les notifications sans readAt"`.
- [ ] Lancer → échec attendu.
- [ ] Implémenter le composant et remplacer les quatre pages.
- [ ] Relancer → vert ; `make typecheck` → vert.
- [ ] Vérification navigateur (`make db-seed` d'abord) à 375 px et 1280 px sur les quatre
  pages : pas de débordement horizontal, filtre, pagination (> 20 notifications créées par
  des actions réelles ou par Prisma Studio `make db-studio`), ancre mise en évidence après
  un clic dans le panneau.

---

## Task 16 — E2E du parcours

**Fichiers :** créer `e2e/transverse/notifications.spec.ts`.

**Interfaces**
- Consumes : `createTestEvent`, `makeEventAdminUser`, `createTestEventMember`,
  `createTestUser`, `getDb`, `cleanupE2ETestData`, `disconnectDb` (`e2e/helpers/db.ts`),
  `loginAs` (`e2e/helpers/auth.ts`), `loginAndEnter` (`e2e/helpers/nav.ts`), `mailpit`
  (`e2e/helpers/mailpit.ts`). Le nettoyage des notifications suit celui des users
  (`onDelete: Cascade`) : aucun helper à modifier.
- Produces : `test.describe("Transverse — Notifications")`, contrat « test UI » de
  `e2e/README.md` (zéro `page.request`, URL assertée à chaque étape).

- [ ] Écrire les tests (`test.setTimeout(120_000)` : la pastille peut mettre 30 s) :
  - `"inscription → pastille → panneau → page → lien de l'inscription"` :
    1. `createTestEvent({ scope: "notif" })`, `makeEventAdminUser` (OWNER + ADMIN),
       `createTestEventMember({ role: "OPERATOR" })`, participant
       `createTestUser({ verified: true, profile: true })`, `mailpit.clear()`.
    2. Contexte A : `loginAndEnter(admin, { kind: "event", id: eventId })` ; la cloche
       `getByRole("button", { name: /^Notifications$/ })` est visible, sans pastille.
    3. Contexte B (`browser.newContext()`) : le participant s'inscrit par l'UI
       (`/e/{slug}` → « S'inscrire à cet événement » → catégorie « Visiteur » → case →
       « S'inscrire ») ; URL `/e/{slug}/success`.
    4. Contexte A, **sans recharger** : `expect(getByRole("button", { name: "Notifications, 1 non lues" })).toBeVisible({ timeout: 35_000 })`.
    5. Clic sur la cloche : le dialogue « Notifications » montre « Nouvelle inscription ».
    6. Clic sur l'élément : URL `/event/{eventId}/notifications#n-{id}` (id lu en BDD) ;
       l'élément `#n-{id}` est visible ; la pastille disparaît.
    7. Clic sur « Voir l'inscription » : URL `/event/{eventId}/registrations/{regId}`.
    8. BDD : exactement **une** notification `REGISTRATION_CREATED` pour l'admin (OWNER +
       ADMIN), une pour l'OPERATOR, aucune pour le participant.
    9. Mailpit : `mailpit.expectMail({ to: admin.email, subjectPattern: /Nouvelle inscription/, timeoutMs: 15_000 })`.
  - `"approbation → le participant voit la notification dans /account, un seul email"` :
    l'admin approuve par l'UI (`/event/{eventId}/registrations/{regId}` → « Approuver ») ;
    le participant (`loginAs`, `/account`) voit « Notifications, 1 non lues », le panneau
    affiche « Inscription approuvée » ; Mailpit : un seul message au participant dont le
    sujet matche `/est approuvée/` (email existant), aucun `notification.*`.
  - `"à 375 px, le panneau s'ouvre en plein écran et se ferme par Échap"` (viewport
    `{ width: 375, height: 812 }`).
- [ ] Lancer
  `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/transverse/notifications.spec.ts`
  → vert (si un email manque : vérifier d'abord le SMTP de la BDD de dev, `make db-seed`).

---

## Task 17 — Après rebase sur 23 et 25

Cette task ne commence **qu'après** `git rebase origin/development` une fois les specs 23
et 25 fusionnées. Résoudre les conflits de `prisma/schema.prisma` (garder `Job`,
`JobStatus`, `JobType` **et** `Notification`, `NotificationType`, `NotificationScope`),
de `src/test-setup.ts` (les deux `deleteMany`) et de la route `resubmit`, puis
`make db-push`.

**Fichiers :** `src/worker/**` (fonction de passage en `FAILED` et passe horaire de
rétention de la spec 23), `src/app/api/account/registrations/[id]/resubmit/route.ts`, leurs
tests existants.

**Interfaces**
- Consumes : `notifyEmailFailed`, `purgeReadNotifications`, `rewriteNotificationLinks`,
  `notifyRegistrationResubmitted(id, actorId, { categoryChanged })` (Tasks 6 et 12) ; dans
  le worker de 23, la fonction qui passe un job en `FAILED` et la passe de rétention
  horaire (noms à lire dans `src/worker/**` et `src/lib/jobs/**` après rebase) ; dans la
  route de 25, l'ancien et le nouvel ID, la transaction et
  `details.categoryChanged = { from: { id, name }, to: { id, name } }`.

- [ ] Worker — écrire le test dans le fichier de test du worker de la spec 23 :
  `"un job qui passe FAILED notifie le staff STAFF_ADMIN (EMAIL_FAILED) sans créer de job email"` ;
  lancer → échec ; ajouter `await notifyEmailFailed({ id, kind, recipient, attempts })`
  juste après la mise à jour en `FAILED` ; relancer → vert.
- [ ] Worker — test `"la passe de rétention purge aussi les notifications lues de plus de 90 jours"` ;
  lancer → échec ; appeler `purgeReadNotifications()` dans la passe horaire existante ;
  relancer → vert.
- [ ] Vérifier le chemin de détail d'un job livré par 23 ; s'il diffère de
  `/platform/jobs/{jobId}`, corriger `emailFailedMessage` et son test.
- [ ] `resubmit` — tests dans le fichier de test de la route livré par 25 :
  `"un changement de catégorie réécrit les liens des notifications existantes vers le nouvel ID"`
  et `"la notification de resoumission mentionne le changement de catégorie et pointe vers le nouvel ID"` ;
  lancer → échec ; dans la transaction de 25, appeler
  `await rewriteNotificationLinks(oldId, newId, tx)` quand l'ID change ; après le
  `logActivity`, appeler
  `await notifyRegistrationResubmitted(newId, session.id, { categoryChanged: { from: from.name, to: to.name } })`
  (sans `categoryChanged` si la catégorie est inchangée) en remplaçant l'appel de la
  Task 6 ; relancer → vert.
- [ ] `make test-coverage` → seuils 100 % respectés.

---

## Task 18 — Documentation

**Fichiers :** créer `docs/v4/features/notifications.md` ; modifier `docs/v4/README.md`.

- [ ] `docs/v4/features/notifications.md` (style des fiches voisines, ex.
  `validation-profils.md`) : objectif, matrice finale (type → route → destinataires →
  email), règles de destinataires, portées par espace, API (4 routes, codes d'erreur),
  interface (cloche, panneau, pages, polling 30 s), rétention 90 j (worker), réécriture des
  liens à la régénération d'ID, points hors périmètre de l'inventaire, liens vers la spec
  et ce plan.
- [ ] `docs/v4/README.md` : ajouter la spec 24 et ce plan dans la liste des plans à
  implémenter, et la fiche dans les features, au format des entrées existantes.
- [ ] Marquer le statut de la spec 24 selon la convention de `docs/README.md` (sans
  supprimer la spec ni ce plan).

---

## Vérification finale

- [ ] `make lint` → 0 erreur, 0 warning.
- [ ] `make typecheck` → OK.
- [ ] `make test-coverage` → tous les tests verts, seuils 100 % (`src/lib`, `src/app/api`).
- [ ] `make db-seed` (la suite Vitest a vidé la BDD), puis `make test-e2e` → vert
  (incluant `e2e/transverse/notifications.spec.ts`).
- [ ] Navigateur à **375 px** et **1280 px** : cloche et pastille dans les sept gabarits
  (StaffShell, OrgShell, EventShell, EventOperatorShell, EventPrinterShell,
  EventViewerShell, `/account`), panneau (ancré / plein écran), Échap, clic extérieur,
  quatre pages (filtre, pagination, ancre), aucun débordement horizontal.
- [ ] Onglet caché > 30 s puis retour : une requête `unread-count` part aussitôt
  (onglet Réseau).
- [ ] Mettre à jour la ligne « — Vérification finale » de la Progression.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(notifications): notifications internes, cloche et emails par la queue`
  (français ASCII, aucun trailer de co-auteur IA).

---

## Self-review

- **Couverture de la matrice** : chaque ligne a son déclencheur et sa task —
  `REGISTRATION_CREATED`, `_RESUBMITTED`, `_APPROVED`, `_REJECTED`, `BADGE_PRINTED` (6) ;
  `PROFILE_SUBMITTED`, `_APPROVED`, `_REJECTED` (7) ; `ORG_MEMBERSHIP_ADDED`,
  `EVENT_MEMBERSHIP_ADDED`, `MEMBERSHIP_ROLE_CHANGED` (8) ; `EVENT_REGISTRATION_OPENED`,
  `_CLOSED`, `ORG_CREATED`, `SUBSCRIPTION_CHANGED`, `QUOTA_EXCEEDED` (9) ; `EMAIL_FAILED`
  (12 + 17). Règles (auteur exclu, dédoublonnage, bloqués/archivés) : Tasks 4 et 5.
  Critères d'acceptation : pastille < 30 s, panneau, page, lien, email (16) ; un seul email
  à l'approbation (6, 16) ; OWNER + ADMIN une seule fois (4, 6, 16) ; 404 sur la
  notification d'autrui (10, 11) ; couverture (vérification finale).
- **Cohérence des noms** : `NotificationScopeRef` (2) utilisé par 10, 11, 14, 15 ;
  `NotificationContent` (3) consommé par `NotifyInput` (5) ; `notifyAll` /
  `withNotificationGuard` (5) utilisés par tous les déclencheurs ; `NotificationDTO` et
  `NOTIFICATIONS_PAGE_SIZE` (10) utilisés par 11, 14, 15 ; `rewriteNotificationLinks`,
  `purgeReadNotifications`, `notifyEmailFailed` (12) consommés en 17.
- **Indépendance vis-à-vis de 23 et 25** : Tasks 1 à 16 n'utilisent que le contrat C1
  (signature) et la route `resubmit` actuelle ; tout ce qui lit le code de 23 ou 25 est en
  Task 17.
- **Écart assumé avec la spec** : `NotifyInput` porte un champ `scope` et un `content`
  structuré, absents de la signature indicative de la spec, parce que `Notification.scope`
  est obligatoire et que `SUBSCRIPTION_CHANGED` / `QUOTA_EXCEEDED` visent deux espaces
  (d'où `notifyAll` avec dédoublonnage entre audiences).
