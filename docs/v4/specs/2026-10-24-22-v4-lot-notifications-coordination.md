# Spec v4 — Lot « notifications, queue d'emails et confort » : coordination et contrats partagés

> **Statut** : proposée — 2026-10-24 — en attente de relecture
> **Type** : spec de coordination (découpage, contrats, ordre de fusion)
> **Périmètre** : v4 — specs 22 à 28
> **Plan** : [`plans/2026-10-24-socle-commun.md`](../plans/2026-10-24-socle-commun.md) (socle, vague 0)
> **Source** : `Todo.md` du 2026-10-24 + échanges avec l'utilisateur du même jour

## Contexte

Le `Todo.md` liste cinq demandes, auxquelles l'utilisateur en a ajouté une sixième
(queue d'emails). Elles sont **indépendantes fonctionnellement** mais se croisent dans le
code à trois endroits :

1. **L'envoi d'emails** : la queue (spec 23) change la façon d'envoyer, les
   notifications (spec 24) ajoutent de nouveaux emails.
2. **Les en-têtes des espaces** : la cloche (spec 24) et l'avatar (spec 27) s'insèrent
   dans les mêmes gabarits (`StaffShell`, `OrgShell`, `EventShell` et variantes,
   `src/app/account/layout.tsx`).
3. **Les boutons d'action** : les toasts et loaders (spec 28) touchent tous les
   composants clients ; les specs 24 et 25 créent ou modifient des boutons.

L'objectif est de **paralléliser au maximum** : une petite vague 0 (le *socle*) pose
les contrats partagés, puis les six chantiers partent **en même temps**, chacun confié à
un agent distinct dans son propre worktree git.

## Les specs du lot

| Spec | Sujet | Plan |
|---|---|---|
| 22 | Coordination + socle commun (ce document) | `plans/2026-10-24-socle-commun.md` |
| 23 | [Queue d'emails MySQL + écran d'admin des jobs](2026-10-24-23-v4-queue-emails.md) | `plans/2026-10-24-queue-emails.md` |
| 24 | [Notifications internes et email](2026-10-24-24-v4-notifications.md) | `plans/2026-10-24-notifications.md` |
| 25 | [Changer la catégorie d'une inscription rejetée](2026-10-24-25-v4-categorie-inscription-rejetee.md) | `plans/2026-10-24-categorie-inscription-rejetee.md` |
| 26 | [Afficher la cover (bannière) de l'évènement](2026-10-24-26-v4-cover-evenement.md) | `plans/2026-10-24-cover-evenement.md` |
| 27 | [Photo validée affichée comme avatar](2026-10-24-27-v4-avatar-photo-validee.md) | `plans/2026-10-24-avatar-photo-validee.md` |
| 28 | [Loader et toast sur toutes les actions](2026-10-24-28-v4-feedback-actions.md) | `plans/2026-10-24-feedback-actions.md` |

## Graphe d'exécution

```
                 ┌──────────────────────────────┐
  vague 0        │ 22 socle commun (1 agent)    │   fusionné dans development
                 └──────────────┬───────────────┘
                                │
  vague 1   ┌──────┬──────┬─────┴┬──────┬──────┐   6 agents en parallèle,
            23     24     25     26     27     28   un worktree chacun
            └──────┴──────┴──────┴──────┴──────┘
                                │
  fusion       23 → 25 → 26 → 27 → 24 → 28         (rebase avant chaque fusion)
```

La vague 0 est volontairement **petite** (une demi-journée d'agent) : elle ne livre aucune
fonctionnalité visible, seulement les points d'ancrage.

## Contrats posés par le socle (vague 0)

Chaque contrat est créé par le socle avec une implémentation minimale **fonctionnelle**,
puis enrichi par le chantier propriétaire. Les autres chantiers codent contre la
signature, jamais contre l'implémentation.

### C1 — `enqueueEmail()` (propriétaire : spec 23)

Fichier : `src/lib/jobs/enqueue-email.ts`.

```ts
export type EmailPriority = "high" | "normal";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  // Identifiant fonctionnel de l'email (ex. "registration.approved") : sert aux
  // filtres de l'écran d'admin et à masquer le contenu des emails sensibles.
  kind: string;
  priority?: EmailPriority;        // défaut "normal"
  // Contexte de transport/branding déjà utilisé par mail.ts (from, logo...).
  ctx?: TransportContext;
}

export async function enqueueEmail(
  message: EmailMessage,
  tx?: Prisma.TransactionClient,
): Promise<void>;
```

- **Socle** : envoie immédiatement via `resolveTransporter` (comportement actuel), `tx`
  ignoré. Aucune table. Le socle **rebranche aussi toutes les fonctions `send*` de
  `mail.ts`** (sauf `sendSmtpTest`) pour qu'elles construisent l'email puis appellent
  `enqueueEmail()` avec leur `kind` et leur `priority`. Ainsi la spec 23 ne touche plus aux
  `send*`, et la spec 25 peut modifier `sendRegistrationResubmitted` sans conflit.
- **Spec 23** : remplace le corps d'`enqueueEmail` par une insertion dans la table `Job`
  (dans `tx` si fourni). La signature ne change pas.
- **Transaction** : les `send*` relisent leurs données avec le client `prisma` global ;
  elles restent donc appelées **après** la validation de l'action, comme aujourd'hui, sans
  `tx`. Le paramètre `tx` sert aux appels directs d'`enqueueEmail` (par ex. `notify()`
  de la spec 24, qui a déjà toutes ses données).

### C2 — `<NotificationBell />` (propriétaire : spec 24)

Fichier : `src/components/notifications/NotificationBell.tsx`, composant client.

```ts
export function NotificationBell(props: { scope: NotificationScopeRef }): JSX.Element | null;

export type NotificationScopeRef =
  | { kind: "platform" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string }
  | { kind: "participant" };
```

- **Socle** : renvoie `null`. Il est **inséré dans les en-têtes** des sept gabarits
  (`StaffShell`, `OrgShell`, `EventShell`, `EventOperatorShell`, `EventPrinterShell`,
  `EventViewerShell`, `src/app/account/layout.tsx`) avec le bon `scope`.
- **Socle, navigation** : le socle ajoute aussi **toutes les entrées de menu** du lot,
  pour qu'aucun chantier ne touche aux menus :
  - « Notifications » dans les sept gabarits et dans `src/components/public/AccountNav.tsx` ;
  - « Emails » dans `StaffShell` (spec 23).

  Il crée les **pages d'attente** correspondantes, avec un `EmptyState` « Bientôt
  disponible » : `/platform/notifications`, `/org/[orgId]/notifications`,
  `/event/[eventId]/notifications`, `/account/notifications` et `/platform/jobs`. Les
  chantiers 23 et 24 **remplacent** ces pages, qui leur appartiennent.
- **Spec 24** : implémente le composant et les pages ; **ne touche plus aux gabarits ni
  aux menus**.

### C3 — `<UserAvatar />` (propriétaire : spec 27)

Fichier : `src/components/layout/UserAvatar.tsx`, **composant client** (le repli sur les
initiales quand l'image ne charge pas exige `onError`).

```ts
export function UserAvatar(props: {
  name: string | null;
  photoUrl?: string | null;   // URL déjà résolue, null => initiales
  size?: number;              // défaut 32
}): JSX.Element;
```

- **Socle** : affiche les initiales (rendu actuel). Remplace les **quatre fonctions
  `initials()` dupliquées** (`StaffShell`, `OrgShell`, `EventShell`,
  `src/app/account/layout.tsx`) et les pastilles associées. Il l'**ajoute** aussi aux
  gabarits `EventOperatorShell`, `EventPrinterShell` et `EventViewerShell`, qui n'ont pas
  d'avatar aujourd'hui. Chaque gabarit reçoit une prop `photoUrl?: string | null`, qu'il
  transmet à `UserAvatar` (toujours `null` dans le socle).
- **Spec 27** : affiche la photo quand `photoUrl` est fourni, et calcule cette valeur
  dans les `layout.tsx` des quatre espaces (`src/app/platform`, `src/app/org/[orgId]`,
  `src/app/event/[eventId]`, `src/app/account`). Elle **ne modifie pas les gabarits**.

### C4 — Toasts et boutons à état (propriétaire : spec 28)

- Dépendance **`sonner`** ajoutée ; `<Toaster />` monté **une fois** dans
  `src/app/layout.tsx` (position en bas à droite, `richColors`, libellés français).
- `src/lib/toast.ts` : `toastSuccess(message)`, `toastError(message)`, et
  `toastApiError(response | unknown, fallback)` qui lit le champ `error` des réponses
  JSON de l'API (format `{ code, error }` déjà en place).
- `Button` (`src/components/ui/Button.tsx`) gagne une prop `loading?: boolean` :
  spinner dans le bouton, bouton `disabled` et `aria-busy` pendant le chargement, largeur
  stable.
- Hook `src/hooks/useAsyncAction.ts` :

```ts
export function useAsyncAction<T>(
  action: () => Promise<T>,
  options?: { success?: string; error?: string; onSuccess?: (result: T) => void },
): { run: () => Promise<void>; pending: boolean };
```

  Il ignore les appels pendant `pending` (pas de double clic), affiche le toast de succès
  ou d'erreur, et appelle `onSuccess`.

- **Socle** : livre ces quatre éléments, testés, et les applique à **un seul** bouton
  témoin (`ResubmitButton`) pour valider l'usage.
- **Spec 28** : généralise à tous les composants clients.

## Propriété des fichiers en vague 1

Pour limiter les conflits de fusion, chaque chantier a un périmètre de fichiers. Un
fichier listé chez un chantier ne doit pas être modifié par un autre, sauf mention.

| Chantier | Possède | Peut aussi toucher |
|---|---|---|
| 23 | `src/lib/jobs/**`, `src/worker/**`, `src/app/platform/jobs/**`, `src/app/api/platform/jobs/**`, modèle `Job` du schéma Prisma, fichiers Docker/Compose (selon l'accord utilisateur) | — |
| 24 | `src/lib/notifications/**`, `src/components/notifications/**`, `src/app/api/notifications/**`, pages `notifications` des quatre espaces, modèle `Notification` du schéma | les routes API où un évènement est déclenché (ajout d'un appel `notify()` **après** l'action existante, sans réécrire la route) ; `src/worker/**` après la fusion de 23 (notification `EMAIL_FAILED`, purge des notifications) |
| 25 | route `api/org/[orgId]/events/[eventId]/registrations/[regId]/reject` (garde « badge imprimé ») et le bouton « Rejeter » côté évènement, route `api/account/registrations/[id]/resubmit`, `src/app/account/registrations/[id]/**` (hors bloc cover), `sendRegistrationResubmitted` dans `mail.ts`, tout nouveau helper d'ID d'inscription dans `src/lib` | `api/events/[slug]/register/route.ts`, seulement pour en extraire la génération d'ID (si l'ID est régénéré) |
| 26 | `src/components/event/EventCover.tsx`, insertion du bloc cover dans les pages serveur de détail (`/event/[eventId]/page.tsx`, `/e/[slug]`, `/account/registrations/[id]/page.tsx`, liste des inscriptions du compte) | — |
| 27 | `src/components/layout/UserAvatar.tsx`, résolution de l'URL de la photo approuvée | les quatre `layout.tsx` d'espace, uniquement pour calculer `photoUrl` |
| 28 | tous les autres composants clients qui déclenchent une action, y compris les composants clients des pages touchées par 26 | — |

**Fichiers partagés en ajout seul** : les helpers E2E (`e2e/helpers/**`) et les fixtures
de seed peuvent être étendus par tous les chantiers, **uniquement par ajout** (nouvelle
fonction, nouveau paramètre optionnel), sans modifier le comportement existant. Les
conflits se règlent au rebase.

Le socle (vague 0) possède `src/lib/mail.ts` (rebranchement des `send*`),
`src/app/api/contact/route.ts` (son envoi direct passe aussi par `enqueueEmail`), les sept
gabarits, `AccountNav.tsx`, les entrées de menu et les pages d'attente.

**Règle du chantier 28** : il **exclut** de son balayage les fichiers possédés par 23 à 27.
Ceux-ci utilisent directement les primitives du socle (C4) ; le chantier 28 vérifie
seulement leur conformité après sa propre fusion, en dernier.

## Ordre de fusion et rebase

Les six branches partent de `development` **après** la fusion du socle. Ordre de fusion
recommandé, du moins conflictuel au plus conflictuel :

1. **23** (queue) — isolé dans `lib/jobs`, `mail.ts`, `platform/jobs`.
2. **25**, **26**, **27** — petits périmètres. 25 et 26 touchent tous deux
   `/account/registrations/[id]/page.tsx` (26 n'y insère que le bloc cover) : le second
   fusionné se rebase.
3. **24** (notifications) — touche de nombreuses routes API ; il se rebase sur 23
   (worker) et 25 (route `resubmit`, `register/route.ts`).
4. **28** (feedback) — balayage le plus large, fusionné en dernier après rebase.

Avant chaque fusion : rebase sur `development`, puis `make lint && make typecheck && make
test`, puis vérification navigateur des écrans touchés.

**Migrations Prisma** : 23 ajoute `Job`, `JobType`, `JobStatus` et deux valeurs à
`ActivityType` ; 24 ajoute `Notification`, `NotificationType` et `NotificationScope`
(sans toucher à `ActivityType`). Les nouveaux modèles vont en fin de fichier ; le conflit
éventuel se règle au rebase de 24. Dev uniquement (`make db-push`), aucun déploiement dans les plans.

## Décisions transverses

- **Aucun commit sans demande explicite** de l'utilisateur, y compris par les agents de
  vague 1 : chaque agent livre une branche avec des modifications non commitées *ou*
  commitées seulement si l'utilisateur l'a demandé pour ce lancement.
- **Aucun déploiement**, aucune commande SSH : les plans s'arrêtent à `development` vert en
  local.
- **Doc mise à jour dans le même changement** : chaque chantier met à jour
  `docs/v4/features/` (nouvelle fiche ou fiche existante) et `docs/v4/README.md`.
- **Tests** : TDD, couverture 100 % maintenue sur `src/lib` et les routes API (portes
  actives). Pas de mock de Prisma ; les tests tournent sur la BDD de dev (`make db-seed`
  ensuite avant les vérifications navigateur).
