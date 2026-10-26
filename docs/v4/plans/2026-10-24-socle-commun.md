# Socle commun du lot « notifications, queue d'emails et confort » (vague 0) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** poser les quatre contrats partagés du lot (C1 à C4) avec une implémentation
minimale **fonctionnelle**, sans fonctionnalité visible nouvelle, pour que les chantiers
23 à 28 partent en parallèle sans se marcher dessus. On livre : `enqueueEmail()` avec envoi
immédiat, et toutes les `send*` de `mail.ts` rebranchées dessus ; une cloche `NotificationBell`
qui ne rend rien mais est déjà placée dans les sept gabarits ; les entrées de menu
« Notifications » et « Emails » avec leurs pages d'attente ; l'avatar `UserAvatar` à la
place des initiales dupliquées ; les toasts `sonner`, `Button loading` et `useAsyncAction`,
appliqués au seul `ResubmitButton`.

**Architecture :** chaque contrat vit dans le fichier que son chantier propriétaire
enrichira ensuite : `src/lib/jobs/enqueue-email.ts` (spec 23),
`src/components/notifications/NotificationBell.tsx` (spec 24),
`src/components/layout/UserAvatar.tsx` (spec 27), `src/lib/toast.ts`, `Button` et
`src/hooks/useAsyncAction.ts` (spec 28). Les autres chantiers codent contre la signature,
jamais contre le corps. Le socle possède `src/lib/mail.ts`, les sept gabarits,
`AccountNav.tsx`, les entrées de menu et les pages d'attente.

**Tech Stack :** Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 6 / MySQL 8,
Vitest 4 (environnement `node`, rendu statique `renderToStaticMarkup`, pas de jsdom ni de
Testing Library), Playwright, `sonner` 2.0.7 (nouvelle dépendance).

**Spec :** [`docs/v4/specs/2026-10-24-22-v4-lot-notifications-coordination.md`](../specs/2026-10-24-22-v4-lot-notifications-coordination.md) — sections « Contrats posés par le socle (vague 0) » C1 à C4 et « Propriété des fichiers ».
Specs voisines dont le socle respecte les contrats : [23 — queue](../specs/2026-10-24-23-v4-queue-emails.md), [24 — notifications](../specs/2026-10-24-24-v4-notifications.md), [27 — avatar](../specs/2026-10-24-27-v4-avatar-photo-validee.md), [28 — feedback](../specs/2026-10-24-28-v4-feedback-actions.md).

**Branche :** `feat/socle-notifications` (créée depuis `origin/development`). Les sept specs
22 à 28, aujourd'hui non suivies dans `feat/notifications-loader`, sont reportées sur cette
branche avec ce plan.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | C1 — `enqueueEmail()` avec envoi immédiat | [x] | 2026-10-24 | 6 tests verts |
| 2 | C1 — rebranchement des `send*` de `mail.ts` (`kind`, `priority`) | [x] | 2026-10-24 | `mail.ts` rebranché ; route contact via `enqueueEmail` avec `replyTo` ajouté à `EmailMessage` et `kind` `contact.message` (le 502 disparaît, décision lead) |
| 3 | C3 — composant `UserAvatar` (initiales) | [x] | 2026-10-24 | 4 tests verts |
| 4 | C2 — `NotificationBell` (rend `null`) et icône `bell` | [x] | 2026-10-24 | 11 tests verts (avec avatar, icône) |
| 5 | Gabarits `StaffShell`, `OrgShell`, `EventShell` : avatar, cloche, menus | [x] | 2026-10-24 | space-shells : 16 tests verts, typecheck OK |
| 6 | Gabarits `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell` | [x] | 2026-10-24 | couvert par space-shells.test.tsx |
| 7 | Espace `/account` : layout et `AccountNav` | [x] | 2026-10-24 | AccountNav 3 tests verts ; `MemberTable` garde son `initials()` (hors périmètre) |
| 8 | Pages d'attente (4 × notifications + `/platform/jobs`) et E2E de navigation | [x] | 2026-10-24 | 14 e2e verts (pages créées avant le run rouge des e2e) |
| 9 | C4 — `sonner`, `<Toaster />` et `src/lib/toast.ts` | [x] | 2026-10-24 | toast 5 + AppToaster 1 tests verts, `sonner@2.0.7` |
| 10 | C4 — `Button` avec `loading` | [x] | 2026-10-24 | Button 4 tests verts (test « sans disabled » ajusté : les classes contiennent `disabled:opacity-50`) |
| 11 | C4 — hook `useAsyncAction` | [x] | 2026-10-24 | 6+1 tests verts |
| 12 | C4 — bouton témoin `ResubmitButton` | [x] | 2026-10-24 | 7 e2e verts (dont 2 nouveaux) |
| 13 | Documentation (`docs/v4/features/`, `docs/v4/README.md`) | [x] | 2026-10-24 | fiche + README |
| — | Vérification finale (lint, typecheck, test, couverture, e2e, navigateur 375 / 1280 px) | [~] | 2026-10-24 | lint 0 erreur, typecheck OK, 167 fichiers / 1780 tests verts, couverture 100 %. Restent : `make test-e2e` complet et navigateur (lead) ; route contact en attente |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée (tests verts et critères d'acceptation remplis). En cas
d'interruption, passez la ligne à `[~]` et notez précisément l'état (étape, fichiers
touchés, prochaine étape).

## Contraintes globales

**Valeurs des specs (à respecter à l'identique)**

- **C1** — `src/lib/jobs/enqueue-email.ts` exporte exactement :
  `type EmailPriority = "high" | "normal"`, `interface EmailMessage { to: string; subject: string; html: string; kind: string; priority?: EmailPriority; ctx?: TransportContext }`
  et `enqueueEmail(message: EmailMessage, tx?: Prisma.TransactionClient): Promise<void>`.
  Priorité par défaut `"normal"`. Dans le socle : envoi **immédiat** via
  `resolveTransporter`, `tx` ignoré, **aucune table**.
- **Priorité `high`** pour les emails de sécurité : vérification de compte,
  réinitialisation de mot de passe, invitation (spec 23). `normal` pour le reste.
- **`sendSmtpTest` n'est pas rebranchée** : elle reste synchrone et propage ses erreurs
  (spec 23).
- Les `send*` restent appelées **après** la validation de l'action, avec le client `prisma`
  global, **sans `tx`**. Aucun appelant de `mail.ts` n'est modifié.
- **C2** — `NotificationBell(props: { scope: NotificationScopeRef }): JSX.Element | null`,
  `NotificationScopeRef = { kind: "platform" } | { kind: "org"; orgId: string } | { kind: "event"; eventId: string } | { kind: "participant" }`.
  Composant client. Socle : rend `null`. Portées : `/platform` → `platform`,
  `/org/[orgId]` → `org`, `/event/[eventId]` (quatre gabarits) → `event`, `/account` →
  `participant`.
- Entrées de menu : « Notifications » dans les **sept** gabarits et dans `AccountNav` ;
  « Emails » dans `StaffShell` (vers `/platform/jobs`). Pages d'attente avec `EmptyState`
  titre **« Bientôt disponible »** : `/platform/notifications`,
  `/org/[orgId]/notifications`, `/event/[eventId]/notifications`, `/account/notifications`,
  `/platform/jobs`.
- **C3** — `UserAvatar(props: { name: string | null; photoUrl?: string | null; size?: number }): JSX.Element`,
  **composant client**, `size` par défaut **32**. Socle : initiales seulement. Remplace les
  quatre `initials()` de `StaffShell`, `OrgShell`, `EventShell`, `src/app/account/layout.tsx`
  (les autres `initials()` du dépôt — `PickCard`, `MembersClient`, `MemberTable`, pages
  `/platform/users` — sont des pastilles de liste, **hors périmètre**). Chaque gabarit
  composant reçoit `photoUrl?: string | null` et le transmet à `UserAvatar` (toujours
  absent/`null` dans le socle).
- **C4** — `sonner` ; `<Toaster />` monté **une seule fois** dans `src/app/layout.tsx`,
  position `bottom-right`, `richColors`, libellés français. `src/lib/toast.ts` :
  `toastSuccess(message)`, `toastError(message)`, `toastApiError(response | unknown, fallback)`
  qui lit le champ `error` du format API `{ code, error }`. Repli d'erreur :
  **« Une erreur est survenue. Réessayez. »** (spec 28). `Button` : prop `loading?: boolean`
  → spinner, `disabled`, `aria-busy`, largeur stable.
  `useAsyncAction<T>(action: () => Promise<T>, options?: { success?: string; error?: string; onSuccess?: (result: T) => void }): { run: () => Promise<void>; pending: boolean }`
  ignore les appels pendant `pending`. Appliqué au **seul** `ResubmitButton`.

**Règles projet**

- Commandes dans le conteneur dev (`make dev` démarré) : `make lint`, `make typecheck`,
  `make test`, `make test-coverage`, `make test-e2e`, `make db-push`, `make db-seed`.
  - Un seul fichier Vitest : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>`.
  - Un seul fichier E2E : `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test <chemin>`.
- **`make test` (et tout `yarn vitest run`) vide la BDD de dev** : lancer `make db-seed`
  avant toute vérification navigateur ou E2E qui dépend du seed. Si un E2E lisant Mailpit
  échoue, vérifier d'abord le SMTP de la BDD de dev (`make db-seed` le répare).
- **Couverture 100 %** (lignes, branches, fonctions, instructions) sur `src/lib/**` et
  `src/app/api/**` : portes actives (`make test-coverage`). `src/lib/jobs/enqueue-email.ts`
  et `src/lib/toast.ts` entrent dans la porte. **Pas de mock de Prisma** : les tests de
  `src/lib` tournent sur la BDD de dev. Mocker `sonner`, `next/navigation` ou un module
  interne isolé (pour observer un appel) est autorisé.
- Tests de composants : environnement `node`, `renderToStaticMarkup` (convention des tests
  existants dans `src/components/**/__tests__`). Pas de nouvelle dépendance de test.
- Toute route API garde son contrôle de rôle ; le socle n'en crée ni n'en modifie.
- UI en **français avec accents** ; code et identifiants en anglais ; commentaires en
  français, dans le style du fichier.
- **Server Components par défaut** ; `"use client"` seulement pour `UserAvatar`,
  `NotificationBell`, `AppToaster`, `AccountNav` (déjà client), `ResubmitButton` (déjà
  client) et le hook.
- **Commits** : uniquement sur demande explicite de l'utilisateur ; messages conventional
  commits en français ASCII ; **aucun trailer de co-auteur IA**, aucune mention d'outil.
- **Aucun déploiement, aucune commande SSH, aucune migration prod.** Le socle ne touche pas
  au schéma Prisma. Dev uniquement.
- Fichiers à risque (`.env*`, `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`) : **non
  touchés** par le socle.

## Points de vigilance de revue

Cinq cas d'entrée ou d'échec que la spec implique sans les tester. Chacun a son test dans la
tâche propriétaire.

1. **Échec SMTP pendant `enqueueEmail`** (Task 1). Aujourd'hui `safeSend` avale l'erreur et
   la logge ; les routes font `await send…()` après l'action. Si `enqueueEmail` propageait,
   une action réussie répondrait 500. Test : `it("avale une erreur SMTP et logge to, subject et kind")`.
2. **`send*` qui ne doivent rien mettre en file** (Task 2) : inscription introuvable,
   statut non éligible (`PENDING`), badge non imprimé, et `sendSmtpTest` qui contourne la
   file. Test : `it("n'appelle pas enqueueEmail quand le statut n'est pas éligible")` et
   `it("sendSmtpTest n'utilise pas enqueueEmail")`.
3. **Double clic rapide** (Task 11). Deux appels synchrones de `run()` dans le même tick :
   un garde basé sur l'état React (`pending`) laisse passer le second, il faut un `ref`.
   Test : `it("ignore un second appel lancé avant la fin du premier")`.
4. **Réponse d'erreur non JSON, corps déjà lu, erreur réseau** (Task 9). `toastApiError`
   doit afficher le repli français, jamais un message technique (« Failed to fetch »,
   « Unexpected token »). Test : `it("retombe sur le repli pour un corps non JSON, un corps déjà lu ou une erreur réseau")`.
5. **Noms dégénérés dans `UserAvatar`** (Task 3) : `null`, `""`, espaces seuls, espaces
   multiples. L'algorithme actuel (`split(" ")`) donne `"?"` pour `null` mais une chaîne vide
   ou un caractère manquant pour `"  Jean   Dupont "`. Test :
   `it("ignore les espaces superflus et retombe sur « ? »")`.

## Structure des fichiers

| Fichier | Action | Tâche |
|---|---|---|
| `src/lib/jobs/enqueue-email.ts` | créer | 1 |
| `src/lib/jobs/__tests__/enqueue-email.test.ts` | créer | 1 |
| `src/lib/mail.ts` | modifier (suppression de `safeSend`, appels `enqueueEmail`) | 2 |
| `src/lib/__tests__/mail-enqueue.test.ts` | créer | 2 |
| `src/components/layout/UserAvatar.tsx` | créer | 3 |
| `src/components/layout/__tests__/UserAvatar.test.tsx` | créer | 3 |
| `src/components/notifications/NotificationBell.tsx` | créer | 4 |
| `src/components/notifications/__tests__/NotificationBell.test.tsx` | créer | 4 |
| `src/components/ui/Icon.tsx`, `src/components/ui/__tests__/Icon.test.tsx` | modifier (icône `bell`) | 4 |
| `src/components/staff/StaffShell.tsx` | modifier | 5 |
| `src/components/admin/OrgShell.tsx` | modifier | 5 |
| `src/components/event/EventShell.tsx` | modifier | 5 |
| `src/components/layout/__tests__/space-shells.test.tsx` | créer (5), compléter (6) | 5, 6 |
| `src/components/event/EventOperatorShell.tsx`, `EventPrinterShell.tsx`, `EventViewerShell.tsx` | modifier | 6 |
| `src/app/account/layout.tsx` | modifier | 7 |
| `src/components/public/AccountNav.tsx` | modifier | 7 |
| `src/components/public/__tests__/AccountNav.test.tsx` | créer | 7 |
| `src/app/platform/notifications/page.tsx` | créer | 8 |
| `src/app/platform/jobs/page.tsx` | créer | 8 |
| `src/app/org/[orgId]/notifications/page.tsx` | créer | 8 |
| `src/app/event/[eventId]/notifications/page.tsx` | créer | 8 |
| `src/app/account/notifications/page.tsx` | créer | 8 |
| `e2e/platform/notifications.spec.ts`, `e2e/platform/jobs.spec.ts`, `e2e/org/notifications.spec.ts`, `e2e/event/notifications.spec.ts`, `e2e/public/account-notifications.spec.ts` | créer | 8 |
| `e2e/transverse/responsive.spec.ts` | modifier (ajout de `/account/notifications`) | 8 |
| `package.json`, `yarn.lock` | modifier (`sonner@2.0.7`) | 9 |
| `src/components/ui/AppToaster.tsx`, `src/components/ui/__tests__/AppToaster.test.tsx` | créer | 9 |
| `src/app/layout.tsx` | modifier | 9 |
| `src/lib/toast.ts`, `src/lib/__tests__/toast.test.ts` | créer | 9 |
| `src/components/ui/Button.tsx`, `src/components/ui/__tests__/Button.test.tsx` | modifier / créer | 10 |
| `src/hooks/useAsyncAction.ts`, `src/hooks/__tests__/useAsyncAction.test.ts` | créer | 11 |
| `src/app/account/registrations/[id]/ResubmitButton.tsx` | modifier | 12 |
| `e2e/public/account-registration.spec.ts` | modifier | 12 |
| `docs/v4/features/lot-notifications-socle.md` | créer | 13 |
| `docs/v4/README.md` | modifier | 13 |

---

## Task 1 — C1 : `enqueueEmail()` avec envoi immédiat

**Interfaces**

- *Consumes* : `resolveTransporter(ctx: TransportContext): Promise<ResolvedTransport>` et
  `type TransportContext = { eventId?: string; orgId?: string }` de `src/lib/mail.ts` ;
  `__mailTesting.setResolveTransporter(fn)` / `__mailTesting.reset()` (tests) ;
  `type Prisma` de `@prisma/client`.
- *Produces* (`src/lib/jobs/enqueue-email.ts`) :
  ```ts
  export type EmailPriority = "high" | "normal";
  export interface EmailMessage {
    to: string; subject: string; html: string;
    kind: string;
    priority?: EmailPriority;   // défaut "normal"
    ctx?: TransportContext;
  }
  export const EMAIL_KIND: {
    readonly REGISTRATION_RECEIVED: "registration.received";
    readonly REGISTRATION_APPROVED: "registration.approved";
    readonly REGISTRATION_REJECTED: "registration.rejected";
    readonly REGISTRATION_RESUBMITTED: "registration.resubmitted";
    readonly BADGE_PRINTED: "badge.printed";
    readonly ACCOUNT_VERIFY_EMAIL: "account.verify-email";
    readonly ACCOUNT_PASSWORD_RESET: "account.password-reset";
    readonly USER_INVITATION: "user.invitation";
    readonly USER_PASSWORD_RESET: "user.password-reset";
    readonly PROFILE_APPROVED: "profile.approved";
    readonly PROFILE_REJECTED: "profile.rejected";
  };
  export async function enqueueEmail(message: EmailMessage, tx?: Prisma.TransactionClient): Promise<void>;
  ```
  `EMAIL_KIND` est un objet `as const` : la liste unique des `kind` existants, dont la
  spec 23 se servira pour ses filtres et pour masquer les `kind` sensibles
  (`account.verify-email`, `account.password-reset`, `user.invitation`,
  `user.password-reset`). `kind` reste typé `string` (la spec 24 ajoute ses propres valeurs).

**Étapes**

- [ ] Écrire `src/lib/jobs/__tests__/enqueue-email.test.ts` (BDD de dev réelle, transport
  simulé via `__mailTesting.setResolveTransporter`, `afterEach(__mailTesting.reset)`) :
  - `it("envoie immédiatement avec le from résolu depuis ctx")` : le faux `resolveTransporter`
    enregistre son argument ; après `enqueueEmail({ to: "a@x.test", subject: "S", html: "<p>H</p>", kind: "registration.approved", ctx: { eventId: "e1" } })`,
    `expect(resolvedWith).toEqual([{ eventId: "e1" }])` et
    `expect(sendMail).toHaveBeenCalledWith({ from: "x@y", to: "a@x.test", subject: "S", html: "<p>H</p>" })`.
  - `it("résout un contexte plateforme quand ctx est absent")` :
    `expect(resolvedWith).toEqual([{}])`.
  - `it("ignore tx dans le socle et envoie une seule fois")` : appel dans
    `prisma.$transaction(async (tx) => enqueueEmail(msg, tx))` → `sendMail` appelé une fois.
  - `it("avale une erreur SMTP et logge to, subject et kind")` (vigilance 1) : `sendMail`
    rejette `new Error("SMTP down")` → `await expect(enqueueEmail(msg)).resolves.toBeUndefined()` ;
    `expect(consoleError).toHaveBeenCalledWith("[mail] sendMail failed", { to: msg.to, subject: msg.subject, kind: msg.kind, error: "SMTP down" })`.
  - `it("logge String(err) quand la valeur rejetée n'est pas une Error")` : rejet
    `"boom-string"` → `error: "boom-string"` dans le log.
  - `it("déclare des kind uniques")` :
    `expect(new Set(Object.values(EMAIL_KIND)).size).toBe(Object.values(EMAIL_KIND).length)`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/jobs/__tests__/enqueue-email.test.ts`
  → échec attendu : module `@/lib/jobs/enqueue-email` introuvable.
- [ ] Implémenter `src/lib/jobs/enqueue-email.ts` avec les exports ci-dessus. Corps :
  `resolveTransporter(message.ctx ?? {})`, puis `transporter.sendMail({ from, to, subject, html })`
  dans un `try` ; le `catch` reproduit le log de l'ancien `safeSend` en ajoutant `kind`.
  `tx` est neutralisé par `void tx;` avec le commentaire « socle : tx ignoré jusqu'à la
  spec 23 (insertion du Job dans la transaction) » — pas de préfixe `_`, la règle
  `no-unused-vars` de `eslint-config-next` ne l'ignore pas. `priority` n'a pas d'effet dans
  le socle. L'import de `resolveTransporter` depuis `@/lib/mail` crée un cycle
  `mail.ts ↔ enqueue-email.ts` (Task 2) : il est sans danger car les fonctions ne sont
  appelées qu'à l'exécution ; le noter en commentaire (la spec 23 le supprime).
- [ ] Relancer la commande → 6 tests verts.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(mail): ajoute enqueueEmail avec envoi immediat (socle C1)`.

## Task 2 — C1 : rebranchement des `send*` de `mail.ts`

**Interfaces**

- *Consumes* : `enqueueEmail`, `EMAIL_KIND`, `EmailMessage` (Task 1).
- *Produces* : aucune signature publique ne change dans `src/lib/mail.ts`. La fonction
  privée `safeSend` est **supprimée**. Correspondance appliquée :

| Fonction | `kind` | `priority` | `ctx` transmis |
|---|---|---|---|
| `sendRegistrationConfirmation` | `REGISTRATION_RECEIVED` | — | `{ eventId: reg.eventId }` |
| `sendStatusNotification` (APPROVED) | `REGISTRATION_APPROVED` | — | `{ eventId: reg.eventId }` |
| `sendStatusNotification` (REJECTED) | `REGISTRATION_REJECTED` | — | `{ eventId: reg.eventId }` |
| `sendBadgePrintedNotification` | `BADGE_PRINTED` | — | `{ eventId: reg.eventId }` |
| `sendAccountVerifyEmail` | `ACCOUNT_VERIFY_EMAIL` | `"high"` | `{}` |
| `sendAccountPasswordReset` | `ACCOUNT_PASSWORD_RESET` | `"high"` | `{}` |
| `sendRegistrationResubmitted` | `REGISTRATION_RESUBMITTED` | — | `{ eventId: reg.eventId }` |
| `sendUserInvitation` | `USER_INVITATION` | `"high"` | `{ eventId: options?.eventId, orgId: options?.orgId }` |
| `sendPasswordResetEmail` | `USER_PASSWORD_RESET` | `"high"` | `{}` |
| `sendProfileApproved` | `PROFILE_APPROVED` | — | `{}` |
| `sendProfileRejected` | `PROFILE_REJECTED` | — | `{}` |
| `sendSmtpTest` | **inchangée** (envoi direct, erreurs propagées) | | |
| `src/app/api/contact/route.ts` (envoi direct `resolveTransporter` + `sendMail`, hors `mail.ts`) | `CONTACT_MESSAGE` | — | celui qu'utilise la route aujourd'hui |

La route contact est ajoutée au périmètre du socle (décision du coordinateur du
2026-10-24) : sans elle, l'objectif « aucun email dans la requête » de la spec 23 n'est pas
tenu. Elle construit son HTML comme aujourd'hui puis appelle `enqueueEmail`. La réponse
HTTP et les erreurs de validation ne changent pas.

**Étapes**

- [ ] Écrire `src/lib/__tests__/mail-enqueue.test.ts`. En tête :
  `vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()), enqueueEmail: vi.fn(async () => {}) }))`
  (observe l'appel sans envoyer). Fixtures réelles en BDD, sur le modèle de
  `mail.test.ts` (`resetSettings`, `mkParticipantUser`, organisation, évènement, catégorie,
  inscription avec champs `snapshot*`). Tests :
  - `it.each` sur les onze lignes du tableau : `it("<fonction> met en file le kind <kind>")`
    → `expect(enqueueEmail).toHaveBeenCalledTimes(1)` ;
    `expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({ to: <destinataire attendu>, kind: <kind>, ctx: <ctx attendu> }), undefined)` ;
    `expect(call.priority ?? "normal").toBe(<"high" | "normal">)` ;
    `expect(call.html).toContain('<html lang="fr"')`.
  - `it("n'appelle pas enqueueEmail quand l'inscription est introuvable")`
    (`sendRegistrationConfirmation("REG-INCONNUE")`) (vigilance 2).
  - `it("n'appelle pas enqueueEmail quand le statut n'est pas éligible")`
    (`sendStatusNotification` sur une inscription `PENDING`) (vigilance 2).
  - `it("n'appelle pas enqueueEmail quand le badge n'est pas imprimé")` (vigilance 2).
  - `it("sendSmtpTest n'utilise pas enqueueEmail")` : transport simulé via
    `__mailTesting.setResolveTransporter` → `sendMail` du transport appelé une fois,
    `enqueueEmail` jamais (vigilance 2).
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail-enqueue.test.ts`
  → échec attendu : `enqueueEmail` jamais appelé (les `send*` utilisent encore `safeSend`).
- [ ] Modifier `src/lib/mail.ts` : importer `enqueueEmail` et `EMAIL_KIND` ; dans chaque
  fonction du tableau, poser `const transportCtx: TransportContext = …` (valeur du tableau),
  l'utiliser **à la fois** pour `resolveTransporter(transportCtx)` (branding du HTML) et pour
  `enqueueEmail({ to, subject, html, kind, priority, ctx: transportCtx })` — ainsi
  l'expéditeur affiché reste celui d'aujourd'hui. Supprimer `safeSend`. Ne pas toucher
  `sendSmtpTest`, `buildEmail`, `resolveTransporter`, `__mailTesting`.
- [ ] Route contact : dans son fichier de test existant (repérer `src/app/api/contact/__tests__/`),
  ajouter `it("met en file le message de contact avec le kind CONTACT_MESSAGE")` (même
  `vi.mock` d'`enqueueEmail`) → `toHaveBeenCalledWith(expect.objectContaining({ kind: "CONTACT_MESSAGE" }), undefined)`.
  Le lancer → échec. Ajouter `CONTACT_MESSAGE` à `EMAIL_KIND` (Task 1), puis remplacer
  l'envoi direct de la route par `enqueueEmail`. Relancer → vert.
- [ ] Relancer la commande → tous verts. Puis
  `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/mail.test.ts src/lib/jobs`
  → `mail.test.ts` vert **sans modification** (les tests « safeSend error handling »
  passent désormais par `enqueueEmail`).
- [ ] `make test-coverage` → seuils 100 % tenus sur `mail.ts` et `enqueue-email.ts`
  (puis `make db-seed`).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `refactor(mail): rebranche les send sur enqueueEmail avec kind et priorite`.

## Task 3 — C3 : composant `UserAvatar`

**Interfaces**

- *Consumes* : rien.
- *Produces* (`src/components/layout/UserAvatar.tsx`, `"use client"`) :
  ```ts
  export function UserAvatar(props: {
    name: string | null;
    photoUrl?: string | null;   // ignoré dans le socle (spec 27)
    size?: number;              // défaut 32
  }): React.JSX.Element;
  ```
  Rendu : `<span aria-hidden="true" class="flex flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600" style="width:<size>px;height:<size>px">` +
  initiales. Initiales : mots séparés par `/\s+/`, vides filtrés, premières lettres des deux
  premiers mots, en majuscules ; `"?"` si aucun mot. Ne destructurer que `name` et `size`
  (`photoUrl` reste dans le type, pour la spec 27, sans variable inutilisée).
  Le style unique est celui des gabarits d'administration ; la pastille de `/account`
  (`bg-slate-100 text-brand-navy`) prend ce style — écart visuel mineur assumé.

**Étapes**

- [ ] Écrire `src/components/layout/__tests__/UserAvatar.test.tsx` (`renderToStaticMarkup`) :
  - `it("affiche au plus deux initiales en majuscules")` : `"awa diallo kone"` →
    `toContain(">AD</span>")`.
  - `it("ignore les espaces superflus et retombe sur « ? »")` (vigilance 5) :
    `"  Jean   Dupont "` → `">JD<"` ; `null`, `""`, `"   "` → `">?<"`.
  - `it("utilise 32 px par défaut et respecte size")` : `toContain("width:32px;height:32px")` ;
    `size={30}` → `"width:30px;height:30px"`.
  - `it("affiche les initiales même si photoUrl est fourni (socle)")` :
    `photoUrl="/api/files/x"` → `not.toContain("<img")`, `toContain(">AD<")`. *(La spec 27
    remplacera ce test.)*
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/layout/__tests__/UserAvatar.test.tsx`
  → échec attendu : module introuvable.
- [ ] Implémenter le composant.
- [ ] Relancer → 4 tests verts.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): ajoute le composant UserAvatar (socle C3)`.

## Task 4 — C2 : `NotificationBell` et icône `bell`

**Interfaces**

- *Consumes* : rien.
- *Produces* :
  - `src/components/notifications/NotificationBell.tsx` (`"use client"`) :
    ```ts
    export type NotificationScopeRef =
      | { kind: "platform" }
      | { kind: "org"; orgId: string }
      | { kind: "event"; eventId: string }
      | { kind: "participant" };
    export function NotificationBell(props: { scope: NotificationScopeRef }): React.JSX.Element | null;
    ```
    Corps du socle : `void props; return null;` avec le commentaire « socle : la spec 24
    implémente la cloche ».
  - `src/components/ui/Icon.tsx` : ajout de `Bell` (lucide-react) sous la clé `bell` du
    registre `ICONS` ; `IconName` inclut donc `"bell"`.

**Étapes**

- [ ] Écrire `src/components/notifications/__tests__/NotificationBell.test.tsx` :
  `it.each` sur les quatre portées → `it("ne rend rien pour la portée <kind> (socle)")` :
  `expect(renderToStaticMarkup(<NotificationBell scope={scope} />)).toBe("")`.
- [ ] Ajouter à `src/components/ui/__tests__/Icon.test.tsx` :
  `it("rend la cloche")` → `renderToStaticMarkup(<Icon name="bell" />)` contient `"<svg"`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/notifications src/components/ui/__tests__/Icon.test.tsx`
  → échec attendu : module introuvable et type `"bell"` inconnu (le test d'icône rend `""`).
- [ ] Implémenter les deux fichiers.
- [ ] Relancer → verts.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(notifications): ajoute NotificationBell vide et l'icone bell (socle C2)`.

## Task 5 — Gabarits `StaffShell`, `OrgShell`, `EventShell`

**Interfaces**

- *Consumes* : `UserAvatar` (Task 3), `NotificationBell` + `NotificationScopeRef`, icône
  `bell` (Task 4), icône existante `mail`.
- *Produces* — props ajoutées (toutes optionnelles, aucun appelant à modifier) :
  - `StaffShell({ user, photoUrl, children }: { user: { name: string; email: string; staffRole: StaffRole }; photoUrl?: string | null; children: React.ReactNode })`
  - `OrgShell({ org, user, orgs, orgRole, photoUrl, children }: { …existant…; photoUrl?: string | null })`
  - `EventShell({ org, event, effectiveRole, isStaffMode, user, photoUrl, children }: { …existant…; photoUrl?: string | null })`

  Modifications :
  - **`StaffShell`** : `NAV` reçoit `{ href: "/platform/notifications", label: "Notifications", icon: "bell" }`
    juste après « Tableau de bord », et `{ href: "/platform/jobs", label: "Emails", icon: "mail" }`
    juste avant « Paramètres ». En-tête : `<NotificationBell scope={{ kind: "platform" }} />`
    avant le bloc nom + avatar ; la pastille devient
    `<UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />`.
  - **`OrgShell`** : `navByRole` reçoit `{ href: \`/org/${org.id}/notifications\`, label: "Notifications", icon: "bell", minRole: "AUDITOR" }`
    après « Tableau de bord ». En-tête : `<NotificationBell scope={{ kind: "org", orgId: org.id }} />`
    entre `OrgSelector` et l'avatar ; `UserAvatar` `size={30}`.
  - **`EventShell`** : `nav` reçoit `{ href: \`${base}/notifications\`, label: "Notifications", icon: "bell" }`
    après « Tableau de bord ». En-tête : `<NotificationBell scope={{ kind: "event", eventId: event.id }} />`
    avant l'avatar ; `UserAvatar` `size={30}`.
  - Suppression des trois fonctions `initials()` locales.

**Étapes**

- [ ] Écrire `src/components/layout/__tests__/space-shells.test.tsx` :
  - En tête : `vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))` ;
    `vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: ({ scope }: { scope: unknown }) => <span data-testid="bell" data-scope={JSON.stringify(scope)} /> }))`.
  - Helper `bellScope(html: string): unknown` : extrait `data-scope="…"` par
    `/data-scope="([^"]*)"/`, remplace `&quot;` par `"`, `JSON.parse`.
  - `describe("StaffShell")` : `it("place la cloche en portée platform")` →
    `expect(bellScope(html)).toEqual({ kind: "platform" })` ;
    `it("ajoute les entrées Notifications et Emails")` → `toContain('href="/platform/notifications"')`,
    `toContain('href="/platform/jobs"')`, `toContain("Emails")` ;
    `it("affiche l'avatar à initiales")` → nom `"Awa Diallo"` → `toContain(">AD</span>")`,
    `toContain("width:30px")`.
  - `describe("OrgShell")` (orgRole `"AUDITOR"`, `org.id = "o1"`) :
    `bellScope` = `{ kind: "org", orgId: "o1" }` ; `toContain('href="/org/o1/notifications"')` ;
    initiales présentes.
  - `describe("EventShell")` (`event.id = "e1"`) : `bellScope` = `{ kind: "event", eventId: "e1" }` ;
    `toContain('href="/event/e1/notifications"')` ; initiales présentes.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/layout/__tests__/space-shells.test.tsx`
  → échec attendu : pas de `data-testid="bell"`, pas de lien notifications.
- [ ] Modifier les trois gabarits comme décrit.
- [ ] Relancer → verts. `make typecheck` → OK.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): cloche, avatar et menus notifications dans les shells staff, org et event`.

## Task 6 — Gabarits `EventOperatorShell`, `EventPrinterShell`, `EventViewerShell`

**Interfaces**

- *Consumes* : `UserAvatar`, `NotificationBell` (Tasks 3, 4).
- *Produces* — même prop ajoutée aux trois :
  `{ org: Org; event: Event; user: { name: string; email: string }; photoUrl?: string | null; children: React.ReactNode }`.
  Modifications identiques dans les trois fichiers :
  - menu latéral : un `Link` `href={\`${base}/notifications\`}` libellé « Notifications »,
    mêmes classes que les liens voisins, placé **avant** « Profil » ;
  - en-tête, après le lien e-mail : `<NotificationBell scope={{ kind: "event", eventId: event.id }} />`
    puis `<UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />` (ces
    gabarits n'avaient pas d'avatar).

**Étapes**

- [ ] Compléter `space-shells.test.tsx` : `describe.each([["EventOperatorShell", EventOperatorShell], ["EventPrinterShell", EventPrinterShell], ["EventViewerShell", EventViewerShell]])` :
  - `it("place la cloche en portée event")` → `{ kind: "event", eventId: "e1" }` ;
  - `it("ajoute l'entrée Notifications avant Profil")` →
    `html.indexOf('href="/event/e1/notifications"')` ≥ 0 et
    `< html.indexOf('href="/profile"')` ;
  - `it("affiche désormais un avatar")` → `toContain(">AD</span>")`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/layout/__tests__/space-shells.test.tsx`
  → échec attendu sur les trois nouveaux `describe`.
- [ ] Modifier les trois gabarits.
- [ ] Relancer → verts.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): cloche, avatar et entree notifications dans les shells de role event`.

## Task 7 — Espace `/account` : layout et `AccountNav`

**Interfaces**

- *Consumes* : `UserAvatar`, `NotificationBell`, `Icon` (`bell`).
- *Produces* :
  - `src/components/public/AccountNav.tsx` : `ITEMS` reçoit
    `{ href: "/account/notifications", label: "Notifications", icon: "bell", exact: false }`
    en troisième position. Type d'item : `{ href: string; label: string; shortLabel?: string; hideBelowSm?: boolean; exact: boolean }`.
    L'item Notifications porte `hideBelowSm: true` : il est **masqué sous `sm`**
    (`hidden sm:inline-flex`). Sur mobile, la cloche (`NotificationBell`, à côté de
    l'avatar) donne déjà accès à la page via « Voir toutes les notifications », et un
    libellé de plus ferait déborder l'en-tête à 375 px. Décision du coordinateur
    (2026-10-24), pour éviter deux cloches côte à côte. Les deux items existants gardent
    leur rendu.
  - `src/app/account/layout.tsx` : suppression de `initials()` ; dans le bloc de droite,
    `<NotificationBell scope={{ kind: "participant" }} />` puis
    `<UserAvatar name={user.name} photoUrl={null} />` (32 px par défaut) à la place de la
    pastille. La spec 27 remplacera `null` par la valeur calculée dans ce layout.

**Étapes**

- [ ] Écrire `src/components/public/__tests__/AccountNav.test.tsx` avec
  `let currentPath = "/account"; vi.mock("next/navigation", () => ({ usePathname: () => currentPath }))` :
  - `it("ajoute l'entrée Notifications, masquée sous sm")` →
    `toContain('href="/account/notifications"')`, `toContain(">Notifications<")`, et la
    balise du lien notifications contient `hidden sm:inline-flex`.
  - `it("marque Notifications active sans activer Mes inscriptions")` : `currentPath = "/account/notifications"` →
    le seul `aria-current="page"` du rendu est sur le lien `/account/notifications`
    (`html.match(/aria-current="page"/g)` de longueur 1, situé dans la balise du lien notifications).
  - `it("garde Mes inscriptions actif sur /account")` : `currentPath = "/account"` →
    `aria-current` sur `href="/account"`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/public/__tests__/AccountNav.test.tsx`
  → échec attendu : lien absent.
- [ ] Modifier `AccountNav.tsx` puis `src/app/account/layout.tsx`.
- [ ] Relancer → verts. `make typecheck` → OK.
- [ ] Vérification `grep -rn "function initials" src/components/staff src/components/admin src/components/event src/app/account`
  → aucune ligne.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(account): cloche, avatar et entree notifications dans l'espace participant`.

## Task 8 — Pages d'attente et E2E de navigation

**Interfaces**

- *Consumes* : `EmptyState` (`src/components/ui/Feedback.tsx`), `Card`
  (`src/components/ui/Card.tsx`), icônes `bell` et `mail`. Les layouts existants assurent
  l'accès (staff pour `/platform`, membre AUDITOR+ et abonnement actif pour `/org/[orgId]`,
  tout rôle évènement pour `/event/[eventId]`, session pour `/account`).
- *Produces* — cinq Server Components sans donnée, `export default function …Page()` :

| Fichier | Composant | `<h1>` | `EmptyState` |
|---|---|---|---|
| `src/app/platform/notifications/page.tsx` | `PlatformNotificationsPage` | « Notifications » | `icon="bell"`, `title="Bientôt disponible"`, `description="Les notifications de la plateforme apparaîtront ici."` |
| `src/app/org/[orgId]/notifications/page.tsx` | `OrgNotificationsPage` | « Notifications » | idem, `description="Les notifications de l'organisation et de ses évènements apparaîtront ici."` |
| `src/app/event/[eventId]/notifications/page.tsx` | `EventNotificationsPage` | « Notifications » | idem, `description="Les notifications de l'évènement apparaîtront ici."` |
| `src/app/account/notifications/page.tsx` | `AccountNotificationsPage` | « Notifications » | idem, `description="Vos notifications apparaîtront ici."` |
| `src/app/platform/jobs/page.tsx` | `PlatformJobsPage` | « Emails » | `icon="mail"`, `title="Bientôt disponible"`, `description="Le suivi des emails envoyés par la plateforme apparaîtra ici."` |

  Mise en page : `<div className="flex flex-col gap-4">`, `<h1 className="text-xl font-semibold text-slate-900">`,
  `<Card>` contenant l'`EmptyState`. Les pages appartiennent ensuite aux specs 23 (`jobs`)
  et 24 (`notifications`), qui les remplacent.

**Étapes**

- [ ] Écrire les E2E (convention `e2e/README.md` : un fichier par page, un `describe` nommé
  d'après la page, `loginAndEnter`, URL vérifiée à chaque étape, navigation par le menu du
  gabarit via `page.locator("#app-shell-nav").getByRole("link", { name: … })`) :
  - `e2e/platform/notifications.spec.ts` — `describe("Platform — Notifications")` :
    `test("le staff ouvre Notifications depuis le menu")` (`createTestStaff({ role: "STAFF_OBSERVER", scope: "notif-platform" })`)
    → `toHaveURL(/\/platform\/notifications$/)`, `getByRole("heading", { name: "Notifications" })`
    et `getByText("Bientôt disponible")` visibles.
  - `e2e/platform/jobs.spec.ts` — `describe("Platform — Emails")` :
    `test("le staff ouvre Emails depuis le menu")` (STAFF_OBSERVER) → `/platform/jobs`,
    titre « Emails », « Bientôt disponible ».
  - `e2e/org/notifications.spec.ts` — `describe("Org — Notifications")` :
    `test("un AUDITOR ouvre Notifications depuis le menu")`
    (`createTestOrgWithOwner` + `createTestOrgMember({ role: "AUDITOR" })`) →
    `/org/<orgId>/notifications`, « Bientôt disponible ».
  - `e2e/event/notifications.spec.ts` — `describe("Event — Notifications")` : boucle sur
    `ADMIN` (`makeEventAdminUser`), `OPERATOR`, `PRINTER`, `VIEWER`
    (`createTestEventMember({ scope, eventId, orgId, role })`) →
    `test("<rôle> ouvre Notifications depuis le menu")` → `/event/<eventId>/notifications`,
    « Bientôt disponible ».
  - `e2e/public/account-notifications.spec.ts` — `describe("Compte — Notifications")` :
    `test("le participant ouvre Notifications depuis l'en-tête")` (`createTestUser({ verified: true, profile: true })`, `loginAs`)
    → `page.getByRole("link", { name: "Notifications" })` → `/account/notifications`,
    « Bientôt disponible ».
  - `e2e/transverse/responsive.spec.ts` : ajouter `"/account/notifications"` à la liste du
    test « Compte : aucune page ne déborde horizontalement » (garde l'en-tête à 375 px).
- [ ] `make db-seed` puis lancer chaque fichier, par exemple
  `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/platform/notifications.spec.ts e2e/platform/jobs.spec.ts e2e/org/notifications.spec.ts e2e/event/notifications.spec.ts e2e/public/account-notifications.spec.ts e2e/transverse/responsive.spec.ts`
  → échec attendu : pages 404 (« Bientôt disponible » introuvable).
- [ ] Créer les cinq pages.
- [ ] Relancer la même commande → verts.
- [ ] Vérification navigateur (navigateur intégré, après `make db-seed`) : à 1280 px puis
  375 px, ouvrir chaque page par le menu (tiroir sous `lg`) ; aucun débordement horizontal
  (`document.documentElement.scrollWidth === innerWidth`) ; l'en-tête `/account` tient sur
  une ligne.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): pages d'attente notifications et emails`.

## Task 9 — C4 : `sonner`, `<Toaster />` et `src/lib/toast.ts`

**Interfaces**

- *Consumes* : `toast` de `sonner`.
- *Produces* :
  - Dépendance `sonner@2.0.7` dans `package.json` (`dependencies`) et `yarn.lock`.
  - `src/components/ui/AppToaster.tsx` (`"use client"`) :
    `export function AppToaster(): React.JSX.Element` →
    `<Toaster position="bottom-right" richColors containerAriaLabel="Messages" toastOptions={{ closeButtonAriaLabel: "Fermer" }} />`.
    `containerAriaLabel` vaut « Messages » (et non « Notifications », valeur par défaut de
    `sonner`) pour ne pas se confondre avec la cloche.
  - `src/app/layout.tsx` : `<AppToaster />` rendu une fois dans `<body>`, après `{children}`.
  - `src/lib/toast.ts` :
    ```ts
    export const DEFAULT_ERROR_MESSAGE = "Une erreur est survenue. Réessayez.";
    export function toastSuccess(message: string): void;      // toast.success(message)
    export function toastError(message: string): void;        // toast.error(message)
    export async function toastApiError(source: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): Promise<void>;
    ```
    `toastApiError` affiche `toast.error(m)` où `m` est : pour une `Response`, le champ
    `error` de `await source.json()` s'il s'agit d'une chaîne non vide ; pour un objet
    `{ error: string }` non vide, ce champ ; sinon `fallback`. Une `Error` (réseau ou autre)
    donne toujours `fallback`. Asynchrone parce qu'il lit le corps de la réponse.

**Étapes**

- [ ] Ajouter la dépendance :
  `docker compose -f docker-compose.dev.yml exec app yarn add sonner@2.0.7`
  (puis `yarn install` sur l'hôte pour les types de l'IDE, `NPM_TOKEN` requis).
- [ ] Écrire `src/lib/__tests__/toast.test.ts` avec
  `vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))` :
  - `it("toastSuccess et toastError délèguent à sonner")`.
  - `it("affiche le champ error d'une réponse API")` :
    `new Response(JSON.stringify({ code: "INVALID_STATE", error: "Seules les inscriptions rejetées peuvent être resoumises." }), { status: 409 })`
    → `toast.error` appelé avec ce message.
  - `it("affiche le champ error d'un objet déjà lu")` : `{ error: "Accès refusé." }`.
  - `it("retombe sur le repli pour un corps non JSON, un corps déjà lu ou une erreur réseau")`
    (vigilance 4) : `new Response("<html>", { status: 500 })` ; une `Response` dont le corps a
    déjà été lu (`await r.text()` avant) ; `new TypeError("Failed to fetch")` ; `undefined` ;
    `{ error: "" }` ; `{ error: 42 }` → `toast.error(DEFAULT_ERROR_MESSAGE)` à chaque fois,
    jamais le message technique.
  - `it("utilise le repli fourni par l'appelant")` : `toastApiError(undefined, "Resoumission impossible.")`.
- [ ] Écrire `src/components/ui/__tests__/AppToaster.test.tsx` :
  `it("monte la région des toasts avec un libellé français")` →
  `renderToStaticMarkup(<AppToaster />)` contient `aria-label="Messages`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib/__tests__/toast.test.ts src/components/ui/__tests__/AppToaster.test.tsx`
  → échec attendu : modules introuvables.
- [ ] Implémenter `toast.ts`, `AppToaster.tsx`, monter `<AppToaster />` dans `src/app/layout.tsx`.
- [ ] Relancer → verts. `make test-coverage` → `src/lib/toast.ts` à 100 % (puis `make db-seed`).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): ajoute sonner, le Toaster global et les helpers de toast`.

## Task 10 — C4 : `Button` avec `loading`

**Interfaces**

- *Consumes* : rien.
- *Produces* (`src/components/ui/Button.tsx`) :
  ```ts
  interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    loading?: boolean;
  }
  export function Button({ variant = "primary", loading = false, className = "", disabled, children, ...props }: ButtonProps): React.JSX.Element;
  ```
  - Classe `relative` ajoutée aux classes de base (sans effet visuel).
  - `disabled={disabled || loading}` ; `aria-busy={loading || undefined}`.
  - Si `loading` : `children` enveloppés dans `<span className="opacity-0">` (la largeur ne
    bouge pas et le **nom accessible reste lu** — `invisible` le retirerait de l'arbre
    d'accessibilité), plus
    `<span aria-hidden="true" data-testid="button-spinner" className="absolute inset-0 flex items-center justify-center"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /></span>`.
  - Si `!loading` : `children` rendus tels quels (DOM identique à aujourd'hui hors `relative`).

**Étapes**

- [ ] Écrire `src/components/ui/__tests__/Button.test.tsx` :
  - `it("rend le bouton sans état de chargement par défaut")` → `not.toContain("aria-busy")`,
    `not.toContain("button-spinner")`, `not.toContain("disabled")`, `toContain(">Valider</button>")`.
  - `it("affiche le spinner, désactive et marque aria-busy pendant le chargement")` →
    `toContain('aria-busy="true"')`, `toContain('disabled=""')`, `toContain("button-spinner")`.
  - `it("garde le libellé pour la largeur et le nom accessible")` → `toContain("Valider")`,
    `toContain("opacity-0")`, `not.toContain("invisible")`.
  - `it("respecte disabled fourni par l'appelant hors chargement")` →
    `<Button disabled>` contient `disabled=""` sans `aria-busy`.
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/components/ui/__tests__/Button.test.tsx`
  → échec attendu sur les tests 2 et 3.
- [ ] Modifier `Button.tsx`.
- [ ] Relancer → verts. `make typecheck` → OK.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): ajoute l'etat loading au composant Button`.

## Task 11 — C4 : hook `useAsyncAction`

**Interfaces**

- *Consumes* : `toastSuccess`, `toastApiError` (Task 9).
- *Produces* (`src/hooks/useAsyncAction.ts`, nouveau dossier `src/hooks/`) :
  ```ts
  export type AsyncActionOptions<T> = { success?: string; error?: string; onSuccess?: (result: T) => void };

  // Logique testable sans DOM (Vitest tourne en environnement node).
  export async function runAsyncAction<T>(
    action: () => Promise<T>,
    options: AsyncActionOptions<T> | undefined,
    guard: { current: boolean },
    setPending: (pending: boolean) => void,
  ): Promise<void>;

  export function useAsyncAction<T>(
    action: () => Promise<T>,
    options?: AsyncActionOptions<T>,
  ): { run: () => Promise<void>; pending: boolean };
  ```
  `runAsyncAction` : si `guard.current` → retour immédiat ; sinon `guard.current = true`,
  `setPending(true)` ; `try` : `const result = await action()`, `options?.onSuccess?.(result)`,
  puis `toastSuccess(options.success)` si `success` est fourni ; `catch (err)` :
  `await toastApiError(err, options?.error)` (l'`error` de l'option est le **repli** ; le
  message de l'API, déjà en français, passe devant) ; `finally` : `guard.current = false`,
  `setPending(false)`. `onSuccess` passe avant le toast : s'il lève, seul le toast d'erreur
  s'affiche.
  Convention pour l'appelant : l'action **lève la `Response`** quand `!res.ok`
  (`if (!res.ok) throw res;`), `toastApiError` sait la lire.
  `useAsyncAction` : `useState(false)` pour `pending`, `useRef(false)` pour le garde,
  `run = useCallback(() => runAsyncAction(action, options, guardRef, setPending), [action, options])`.

**Étapes**

- [ ] Écrire `src/hooks/__tests__/useAsyncAction.test.ts` (teste `runAsyncAction`, avec
  `vi.mock("sonner", …)` comme en Task 9) :
  - `it("passe pending à true puis false et affiche le toast de succès")` →
    `setPending` appelé avec `true` puis `false` ; `toast.success("Inscription resoumise.")`.
  - `it("appelle onSuccess avec le résultat de l'action")`.
  - `it("n'affiche pas de toast de succès sans option success")`.
  - `it("affiche le message error de la réponse API levée")` : l'action lève
    `new Response(JSON.stringify({ error: "Accès refusé." }), { status: 403 })` →
    `toast.error("Accès refusé.")` ; `setPending(false)` appelé ; `guard.current === false`.
  - `it("utilise l'option error comme repli")` : l'action lève `new TypeError("Failed to fetch")`
    → `toast.error("Resoumission impossible.")`.
  - `it("ignore un second appel lancé avant la fin du premier")` (vigilance 3) : action
    pilotée par une promesse différée ; deux `runAsyncAction(…)` lancés sans `await` →
    `expect(action).toHaveBeenCalledTimes(1)` ; après résolution, un troisième appel exécute
    l'action (`toHaveBeenCalledTimes(2)`).
- [ ] Lancer `docker compose -f docker-compose.dev.yml exec app yarn vitest run src/hooks`
  → échec attendu : module introuvable.
- [ ] Implémenter `src/hooks/useAsyncAction.ts`.
- [ ] Relancer → verts. `make lint` → aucune alerte `react-hooks`.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(ui): ajoute le hook useAsyncAction`.

## Task 12 — C4 : bouton témoin `ResubmitButton`

**Interfaces**

- *Consumes* : `Button` (`loading`), `useAsyncAction` ; route existante
  `POST /api/account/registrations/[id]/resubmit` (réponses `{ code, error }`, 409
  « Seules les inscriptions rejetées peuvent être resoumises. »).
- *Produces* : `ResubmitButton({ registrationId }: { registrationId: string })` (export
  par défaut inchangé). Corps :
  `useAsyncAction(async () => { const res = await fetch(\`/api/account/registrations/${registrationId}/resubmit\`, { method: "POST" }); if (!res.ok) throw res; }, { success: "Inscription resoumise.", error: "Resoumission impossible.", onSuccess: () => router.refresh() })`.
  Rendu : `<Button onClick={run} loading={pending}>Resoumettre mon inscription</Button>`.
  Suppression des états `loading`/`error` locaux et du `<p>` d'erreur (remplacés par les
  toasts) ; le libellé ne change plus pendant le chargement (le spinner le signale).

**Étapes**

- [ ] Modifier `e2e/public/account-registration.spec.ts` :
  - dans `test("user can resubmit a rejected registration from /account/registrations/[id]")`,
    après le clic : `await expect(page.getByText("Inscription resoumise.")).toBeVisible()`
    (puis les assertions BDD existantes).
  - nouveau `test("affiche l'erreur de l'API dans un toast quand l'inscription n'est plus rejetée")` :
    inscription rejetée, page ouverte, puis `setRegistrationStatus(regId, "PENDING")` (la
    page affiche encore le bouton) ; clic → `getByText("Seules les inscriptions rejetées peuvent être resoumises.")`
    visible ; en BDD le statut reste `PENDING`.
  - nouveau `test("un double clic n'envoie qu'une requête")` : compter les requêtes
    `POST …/resubmit` via `page.on("request")` ; `dblclick` sur le bouton → une seule.
- [ ] `make db-seed`, puis
  `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test e2e/public/account-registration.spec.ts`
  → échec attendu : toasts absents.
- [ ] Modifier `ResubmitButton.tsx`.
- [ ] Relancer → verts (les tests existants du fichier, dont l'email « Inscription
  resoumise », restent verts).
- [ ] Vérification navigateur à 1280 px et 375 px : spinner dans le bouton, largeur
  stable, toast en bas à droite qui ne masque pas le bouton de menu ni la déconnexion.
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `feat(account): loader et toast sur la resoumission d'inscription`.

## Task 13 — Documentation

**Interfaces**

- *Consumes* : tout ce qui précède.
- *Produces* : documentation à jour, sans code.

**Étapes**

- [ ] Créer `docs/v4/features/lot-notifications-socle.md` (français, accents) : contrats
  C1 à C4 **tels que livrés** — signatures ; tableau `kind` / `priority` / `ctx` de la
  Task 2 et liste des `kind` sensibles ; `sendSmtpTest` hors file ; portées de la cloche par
  gabarit ; entrées de menu et pages d'attente (avec leur chantier propriétaire) ;
  `UserAvatar` et sa prop `photoUrl` dans les six gabarits et le layout `/account` ;
  primitives de feedback et convention « l'action lève la `Response` ». Lien vers la
  spec 22. Chaque chantier 23 à 28 complète ou remplace sa section.
- [ ] `docs/v4/README.md` : sous « Plans a implementer », une entrée par spec 22 à 28
  (lien spec + plan, en attente de relecture), le socle marqué livré ; ligne
  « Lot notifications — socle (spec 22) » dans « Etat d'avancement » ; lien vers la fiche
  dans « References ».
- [ ] Mettre à jour la section `## Progression` de ce plan (statuts, dates, notes).
- [ ] Commit — **uniquement sur demande explicite de l'utilisateur** :
  `docs(v4): fiche du socle commun du lot notifications`.

## Vérification finale

- [ ] `make lint` → 0 erreur, 0 alerte.
- [ ] `make typecheck` → OK.
- [ ] `make test` → tout vert ; `make test-coverage` → seuils 100 % tenus sur `src/lib`
  et `src/app/api`.
- [ ] `make db-seed` (la suite a vidé la BDD), puis `make test-e2e` → tout vert.
- [ ] Vérification navigateur (navigateur intégré), à **1280 px** puis **375 px**, pour
  chaque espace (`/platform` en STAFF, `/org/[orgId]` en OWNER, `/event/[eventId]` en ADMIN
  puis OPERATOR, `/account` en participant) : entrée « Notifications » présente et page
  d'attente atteinte ; « Emails » dans `/platform` ; avatar à initiales dans les sept
  en-têtes (nouveau chez opérateur, imprimeur, lecteur) ; aucune cloche visible (rend
  `null`) ; aucun débordement horizontal ; bureau identique à `development` en dehors des
  nouvelles entrées.
- [ ] Email : une action réelle (approbation d'une inscription depuis `/event/[eventId]`)
  produit toujours l'email dans Mailpit (`https://mail.badge.local`), avec le même
  expéditeur qu'avant.
- [ ] Mettre la ligne « — Vérification finale » de la `## Progression` à `[x]` avec la date
  et les chiffres (nombre de tests, e2e).

## Self-review

- **Couverture de la spec 22** : C1 → Tasks 1-2 (signature exacte, envoi immédiat, `tx`
  ignoré, toutes les `send*` sauf `sendSmtpTest`, `kind` et `priority`, pas de `tx` côté
  `send*`) ; C2 → Tasks 4-8 (composant `null`, sept gabarits avec la bonne portée,
  « Notifications » ×7 + `AccountNav`, « Emails » dans `StaffShell`, cinq pages
  « Bientôt disponible ») ; C3 → Tasks 3, 5-7 (composant client, quatre `initials()`
  remplacées, ajout aux trois gabarits de rôle, prop `photoUrl` transmise) ; C4 → Tasks
  9-12 (`sonner`, `Toaster` unique bas-droite `richColors` en français, `toast.ts`,
  `Button loading`, `useAsyncAction`, `ResubmitButton` seul). Doc → Task 13.
- **Cohérence des noms** : `enqueueEmail`, `EMAIL_KIND`, `EmailMessage`, `EmailPriority`
  (1, 2, 13) ; `NotificationBell`, `NotificationScopeRef` (4-7) ; `UserAvatar` (3, 5-7) ;
  `toastSuccess`, `toastError`, `toastApiError`, `DEFAULT_ERROR_MESSAGE` (9, 11) ;
  `runAsyncAction`, `useAsyncAction` (11, 12) ; `AppToaster` (9).
- **Propriété des fichiers** : le socle ne touche ni au schéma Prisma, ni aux routes API,
  ni aux fichiers Docker ; il possède `mail.ts`, les sept gabarits, `AccountNav`, les menus
  et les pages d'attente, conformément à la spec 22.
- **Proportion** : 13 tâches courtes, dont 8 de composants de quelques lignes ; aucune
  fonctionnalité visible hors les entrées de menu, l'avatar des gabarits de rôle et le
  bouton témoin.
