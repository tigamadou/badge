# Plan gratuit d'un mois et droits selon l'abonnement — Plan d'implémentation

> **Pour les agents d'exécution :** sous-skill requis : `superpowers:executing-plans` (recommandé) ou `superpowers:subagent-driven-development`. Les étapes utilisent la syntaxe `- [ ]`.
> **Règle projet :** aucun commit sans demande explicite de l'utilisateur ; avant tout commit, `make lint && make typecheck && make test`.
> **Branche :** `feat/paiement-fedapay` (avant fusion). Aucune migration de données en production.

**Objectif :** limiter `free` à un mois non renouvelable, passer l'abonnement à `EXPIRED` à l'échéance, interdire la création d'évènement sans abonnement actif, garder les évènements en cours exploitables, et régler dans `/platform/settings` les droits accordés selon que l'abonnement est actif ou non.

**Architecture :** un module pur `subscription-rights.ts` (droits, défauts, évènement « en cours », décision `can`) et un lecteur `loadOrgAccess(orgId)` dans `src/lib/subscription-access.ts`, utilisé par les gardes d'API ; les Server Components passent par `getOrgAccess = cache(loadOrgAccess)` dans `src/lib/org-access.ts` (fichier séparé : le worker importe `subscription.ts` et ne doit pas embarquer `react` ; `subscription-access.ts` n'importe pas `react` non plus). `assertCanCreateEvent`, `assertCanRegister`, `withEventAuth`, la route de re-soumission, le layout org et les pages d'évènements s'appuient dessus.

**Stack :** Next.js 16, React 19 (`cache`), Prisma 6 / MySQL, Vitest 4, zod.

**Spec :** [`specs/2026-11-01-30-v4-abonnement-essai-droits.md`](../specs/2026-11-01-30-v4-abonnement-essai-droits.md)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Expiration : free 30 j, `EXPIRED`, seed | [x] | 2026-11-01 | free 30 j, EXPIRED, seed nettoyé ; texte du rappel corrigé |
| 2 | Droits : colonne, module pur, lecteur, réglages plateforme | [x] | 2026-11-01 | matrice, loadOrgAccess/getOrgAccess, réglages |
| 3 | Gardes serveur (création, inscription, re-soumission, `withEventAuth`) | [x] | 2026-11-01 | gardes ; tests à date en dur corrigés ; singleton PlatformSettings préservé |
| 4 | UI org : bouton, redirection, layout | [x] | 2026-11-01 | bouton, redirection, OrgAccessGate pour la navigation douce |
| 5 | Documentation et vérification finale | [x] | 2026-11-01 | docs ; test-coverage 221 fichiers / 2400 tests / 100 %, lint 0 erreur, typecheck OK, navigateur 375/1280 vérifié |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettre à jour la ligne après chaque task validée ; en cas d'interruption, `[~]` avec l'étape et les fichiers touchés.

## Global Constraints

- Free : `endDate = startDate + 30 jours` (`computeSubscriptionDates("MONTHLY")`) ; aucun code ne crée d'`endDate = null`.
- Échéance sans plan programmé : `status = "EXPIRED"`, `planId` inchangé, aucun repli sur `free`.
- Défauts (actif / inactif) : `CREATE_EVENT` true/false ; `RECEIVE_REGISTRATIONS` true/true ; `MANAGE_ONGOING_EVENTS` true/true ; `ACCESS_ORG_SPACE` true/false. Les quotas du plan s'appliquent en plus.
- La condition « évènement en cours » ne s'applique qu'à l'état inactif.
- Évènement en cours : `!archived` et `now <` début du jour UTC suivant `endDate ?? date`.
- Toujours accessibles hors réglage : `/org/[orgId]/subscription[/…]` et `/org/[orgId]/events` (liste).
- Code et identifiants en anglais ; commentaires, UI et docs en français avec accents ; commits en français ASCII.
- Modification des réglages journalisée via `logActivity` ; route protégée par `withStaffAuth`, écriture des droits réservée `STAFF_ADMIN`+.
- Le staff garde son bypass audité (`QUOTA_BYPASS`) à la création d'évènement et n'est pas soumis au garde de `withEventAuth`.

## Review Focus

- Évènement d'un seul jour (`endDate` null), `now` le jour même à 23 h UTC : en cours.
- Abonnement `ACTIVE` échu jamais réglé (worker arrêté) : `active` faux dès la lecture, `EXPIRED` après la première lecture.
- Plan programmé lui-même échu : bascule puis `EXPIRED` dans le même appel, boucle bornée.
- `subscriptionRights` `null`, chaîne, tableau, clé inconnue, valeur non booléenne : défauts, aucune exception.
- Requête `GET` sur une route `withEventAuth` avec abonnement expiré et évènement terminé : jamais refusée.

## File Structure

- Créer `src/lib/subscription-rights.ts` — droits, défauts, `parseRights`, `isEventOngoing`, `can`.
- Créer `src/lib/org-access.ts` — `getOrgAccess = cache(loadOrgAccess)`, pour les Server Components uniquement.
- Créer `src/lib/subscription-access.ts` — `loadOrgAccess` (sans `react`).
- Modifier `src/lib/subscription.ts` — suppression de `subscriptionDatesForPlan`, gardes réécrites sur `loadOrgAccess`.
- Modifier `src/lib/subscription-changes.ts`, `src/lib/jobs/subscription-sweep.ts` (commentaire), `prisma/seed.ts`, `prisma/schema.prisma`.
- Modifier `src/app/api/platform/organizations/route.ts`, `src/app/api/platform/organizations/[orgId]/subscription/route.ts` (appelants de `subscriptionDatesForPlan`).
- Modifier `src/lib/with-event-auth.ts`, `src/app/api/account/registrations/[id]/resubmit/route.ts`.
- Modifier `src/app/api/platform/settings/route.ts`, `src/app/platform/settings/page.tsx` ; créer `src/components/staff/SubscriptionRightsForm.tsx`.
- Modifier `src/app/org/[orgId]/layout.tsx`, `src/lib/subscription-path.ts`, `src/app/org/[orgId]/events/page.tsx`, `src/app/org/[orgId]/events/new/page.tsx`, `src/components/admin/SubscriptionBlockedNotice.tsx`.

---

### Task 1: Expiration — free 30 jours, `EXPIRED`, seed

Revient sur la partie « free illimité / repli sur free » du commit `ed6f23d`. Indépendante des autres tâches.

**Files:**
- Modify: `src/lib/subscription.ts`, `src/lib/subscription-changes.ts`, `src/lib/jobs/subscription-sweep.ts`, `prisma/seed.ts`, `src/app/api/platform/organizations/route.ts`, `src/app/api/platform/organizations/[orgId]/subscription/route.ts`
- Test: `src/lib/__tests__/subscription.test.ts`, `src/lib/__tests__/subscription-changes.test.ts`, `src/lib/__tests__/api-staff-organizations-post.test.ts`, `src/app/api/platform/organizations/[orgId]/subscription/__tests__/route.test.ts`, test du sweep s'il couvre le repli

**Interfaces:**
- Produces:
  - `subscriptionDatesForPlan` **supprimé** ; les appelants utilisent `computeSubscriptionDates(plan.period, from)`. `DEFAULT_PLAN_NAME` reste.
  - `expiryTransition(sub: SubscriptionState, scheduled: PlanLite | null, now: Date)` → `null` si non échu, sinon `{ reason: "SCHEDULED"; data: { planId; startDate; endDate; scheduledPlanId: null } }` ou `{ reason: "EXPIRED"; data: { status: "EXPIRED"; scheduledPlanId: null } }`.

- [ ] **Step 1: Tests (rouges)** : création d'organisation → abonnement `free` avec `endDate = start + 30 j` ; échéance sans programmation → `updateMany` avec `{ status: "EXPIRED", scheduledPlanId: null }`, `planId` absent des données ; échéance avec plan programmé → bascule, `status` non modifié ; plan programmé déjà échu → deux écritures (bascule puis `EXPIRED`) ; `prisma.plan.findFirst` jamais appelé par `settleSubscription` ; `EXPIRED`/`CANCELLED` manuel → aucune écriture ; le message `SUBSCRIPTION_CHANGED` avec `status: "EXPIRED"` ne mentionne pas `free` (vérifier `subscriptionChangedMessage` et ajuster son texte si besoin). Supprimer les tests de `subscriptionDatesForPlan`.
- [ ] **Step 2:** lancer les tests ciblés — attendu : rouges sur ces points.
- [ ] **Step 3: Implémenter** : `expiryTransition` sans paramètre `free` ; `settleSubscription` sans recherche du plan `free`, la boucle (3 itérations max) s'arrête après une transition `EXPIRED` ; garde `updateMany` inchangée (`where: { id, endDate: state.endDate, status: "ACTIVE" }`). Commentaire de `settleDue` : « passe à EXPIRED ou bascule vers le plan programmé ».
- [ ] **Step 4: Seed** : supprimer le bloc « Rattrapage : les organisations free existantes n'ont plus d'échéance », sans le remplacer. Corriger la base de dev une fois, hors code : `make db-seed` après correction, puis dans `make db-studio` ou via une commande Prisma ponctuelle, `endDate = startDate + 30 jours` pour les abonnements `free` à `endDate` nulle.
- [ ] **Step 5:** `make typecheck` et tests ciblés — attendu : verts.

---

### Task 2: Droits — colonne, module pur, lecteur, réglages plateforme

**Files:**
- Modify: `prisma/schema.prisma` (`subscriptionRights Json?` sur `PlatformSettings`), `src/app/api/platform/settings/route.ts`, `src/app/platform/settings/page.tsx`
- Create: `src/lib/subscription-rights.ts`, `src/lib/subscription-access.ts`, `src/lib/org-access.ts`, `src/components/staff/SubscriptionRightsForm.tsx`
- Test: `src/lib/__tests__/subscription-rights.test.ts`, `src/lib/__tests__/subscription-access.test.ts`, `src/app/api/platform/settings/__tests__/route.test.ts`, test de rendu du formulaire

**Interfaces:**
- Produces dans `subscription-rights.ts` (aucun import Prisma) :
  - `export const SUBSCRIPTION_RIGHTS = ["CREATE_EVENT", "RECEIVE_REGISTRATIONS", "MANAGE_ONGOING_EVENTS", "ACCESS_ORG_SPACE"] as const`
  - `export type SubscriptionRight = (typeof SUBSCRIPTION_RIGHTS)[number]`
  - `export type RightsMatrix = Record<SubscriptionRight, { active: boolean; inactive: boolean }>`
  - `export const DEFAULT_RIGHTS: RightsMatrix`
  - `export function parseRights(raw: unknown): RightsMatrix` — fusion champ par champ sur les défauts
  - `export type EventTiming = { date: Date; endDate: Date | null; archived: boolean }`
  - `export function isEventOngoing(event: EventTiming, now?: Date): boolean`
  - `export type OrgAccess = { active: boolean; maxEvents: number | null; maxParticipantsPerEvent: number | null; rights: RightsMatrix }`
  - `export function can(access: OrgAccess, right: SubscriptionRight, event?: EventTiming, now?: Date): boolean` — si `access.active` : `access.rights[right].active` ; sinon `access.rights[right].inactive`, et pour `RECEIVE_REGISTRATIONS` / `MANAGE_ONGOING_EVENTS` il faut aussi `event` et `isEventOngoing(event, now)`.
- Produces dans `subscription-access.ts` : `export async function loadOrgAccess(orgId: string): Promise<OrgAccess>` — `Promise.all([resolveOrgLimits(orgId), lecture de PlatformSettings.subscriptionRights])`.
- Produces dans `org-access.ts` : `export const getOrgAccess = cache(loadOrgAccess)` (import de `cache` depuis `react`).
- Produces côté API : `PATCH /api/platform/settings` accepte `subscriptionRights: RightsMatrix` (zod strict : quatre droits, chacun `{ active: boolean, inactive: boolean }`) ; `GET` renvoie `subscriptionRights: parseRights(…)`. Composant `SubscriptionRightsForm({ initial, canManage }: { initial: RightsMatrix; canManage: boolean })` : tableau droit × (« Abonnement actif », « Abonnement inactif ») avec une case par cellule, libellés français de la spec, enregistrement via `useAsyncAction` + toast.

- [ ] **Step 1: Tests (rouges)** : `parseRights(null)`, `("x")`, `([])` → défauts ; `({ CREATE_EVENT: { inactive: true }, FOO: {}, ACCESS_ORG_SPACE: { active: "oui" } })` → `CREATE_EVENT` `{ active: true, inactive: true }`, `ACCESS_ORG_SPACE` `{ active: true, inactive: false }`, pas de `FOO`. `isEventOngoing` : `date` aujourd'hui 00:00 UTC, `endDate` null, `now` 23:00 UTC → true ; `now` lendemain 00:00 UTC → false ; archivé → false ; `date` passée et `endDate` future → true. `can` : actif + défauts → true pour tout droit, y compris `MANAGE_ONGOING_EVENTS` sur un évènement terminé ; actif + `CREATE_EVENT.active = false` → false ; inactif + défauts → `CREATE_EVENT` false, `MANAGE_ONGOING_EVENTS` avec évènement en cours → true, avec évènement terminé → false, sans évènement → false. `loadOrgAccess` : abonnement échu + réglage `{ CREATE_EVENT: { inactive: true } }` → `active` false, `rights.CREATE_EVENT.inactive` true. API : `PATCH` valide → `update` + `logActivity` ; clé inconnue ou non-booléen → 400 `VALIDATION` ; `STAFF_SUPPORT` → 403 ; `GET` sans valeur → défauts. Formulaire : huit cases (4 droits × 2 états) cochées selon `initial`, désactivées si `!canManage`.
- [ ] **Step 2:** tests ciblés — attendu : rouges.
- [ ] **Step 3: Implémenter** : colonne au schéma puis `make db-push` (nullable, non destructif) ; module ; `getOrgAccess` ; route (la règle `STAFF_ADMIN`+ suit celle des motifs de rejet) ; carte « Droits selon l'abonnement » dans `page.tsx` sous les motifs de rejet, avec `canManage = canManageReasons`.
- [ ] **Step 4:** `make lint && make typecheck`, tests ciblés — attendu : verts.

---

### Task 3: Gardes serveur

**Files:**
- Modify: `src/lib/subscription.ts`, `src/lib/with-event-auth.ts`, `src/app/api/account/registrations/[id]/resubmit/route.ts`
- Test: `src/lib/__tests__/subscription.test.ts`, `src/lib/__tests__/with-event-auth.test.ts`, tests des routes `register` et `resubmit`

**Interfaces:**
- Consumes: Task 2 (`loadOrgAccess`, `can`, `EventTiming`).
- Produces :
  - `assertCanCreateEvent(orgId)` : `SUBSCRIPTION_INACTIVE` si `!can(access, "CREATE_EVENT")`, puis quota `maxEvents` inchangé.
  - `assertCanRegister(eventId)` : charge `orgId`, `date`, `endDate`, `archived` ; `SUBSCRIPTION_INACTIVE` si `!can(access, "RECEIVE_REGISTRATIONS", event)` ; plafond par évènement inchangé.
  - `withEventAuth` : pour une méthode hors `GET`/`HEAD`/`OPTIONS` et un utilisateur non staff, 403 `{ error: "SUBSCRIPTION_INACTIVE", code: "SUBSCRIPTION_INACTIVE" }` si `!can(await loadOrgAccess(orgId), "MANAGE_ONGOING_EVENTS", event)` ; le `select` de l'évènement ajoute `date` et `endDate`.
  - `resubmit` : appelle `assertCanRegister(registration.eventId)` avant la re-soumission (sans le plafond s'il compte déjà l'inscription : vérifier que l'inscription rejetée n'est pas comptée, `REJECTED` étant exclu du comptage) et renvoie l'erreur comme la route `register`.

- [ ] **Step 1: Tests (rouges)** : expiré + évènement en cours → `assertCanRegister` passe ; expiré + évènement terminé → `SUBSCRIPTION_INACTIVE` ; expiré + `RECEIVE_REGISTRATIONS.inactive = false` → refus même en cours ; `assertCanCreateEvent` expiré → refus, accepté avec `CREATE_EVENT.inactive = true` ; actif + `CREATE_EVENT.active = false` → refus ; `withEventAuth` : `POST` expiré + en cours → handler appelé ; `POST` expiré + terminé → 403 ; `GET` expiré + terminé → handler appelé ; staff → handler appelé ; `resubmit` expiré + évènement terminé → 403 `SUBSCRIPTION_INACTIVE`.
- [ ] **Step 2:** tests ciblés — attendu : rouges.
- [ ] **Step 3: Implémenter.** Ajouter le mock de `loadOrgAccess` (abonnement actif par défaut) aux tests existants qui passent par `withEventAuth` : corriger les mocks, jamais les assertions métier.
- [ ] **Step 4:** `make test` puis `yarn build:worker` dans le conteneur (vérifier que `build/worker.cjs` n'embarque pas `react`) — attendu : vert.

---

### Task 4: UI de l'espace organisation

**Files:**
- Modify: `src/app/org/[orgId]/layout.tsx`, `src/lib/subscription-path.ts`, `src/app/org/[orgId]/events/page.tsx`, `src/app/org/[orgId]/events/new/page.tsx`, `src/components/admin/SubscriptionBlockedNotice.tsx`
- Test: `src/lib/__tests__/subscription-path.test.ts`, e2e de l'espace org (abonnement expiré)

**Interfaces:**
- Consumes: Task 2 (`getOrgAccess`, `can`).
- Produces: `export function isAlwaysAllowedOrgPath(pathname: string, orgId: string): boolean` — vrai pour `/org/<orgId>/subscription[/…]` et exactement `/org/<orgId>/events` (avec ou sans `/` final) ; `isSubscriptionPath` reste exporté.

- [ ] **Step 1: Tests (rouges)** : `isAlwaysAllowedOrgPath` vrai pour l'onglet abonnement, sa page de retour, la liste des évènements ; faux pour `/org/x/events/new`, `/org/x/members`, `/org/y/events`. E2E, organisation expirée : `/org/<id>/events` s'affiche ; « Créer un événement » est désactivé avec le texte « Abonnement inactif » ; `/org/<id>/events/new` redirige vers `/org/<id>/events` ; `/org/<id>/members` affiche l'écran « Abonnement inactif ».
- [ ] **Step 2:** tests ciblés — attendu : rouges.
- [ ] **Step 3: Implémenter** : le layout lit `getOrgAccess(orgId)` et affiche `children` si `can(access, "ACCESS_ORG_SPACE")` ou `isAlwaysAllowedOrgPath(pathname, orgId)`, sinon `SubscriptionBlockedNotice` ; la page des évènements lit `getOrgAccess` (même lecture grâce à `cache`) et rend, si `!can(access, "CREATE_EVENT")`, un bouton désactivé (`aria-disabled`, sans lien) avec le lien « Voir mon abonnement » ; `events/new/page.tsx` fait `redirect(\`/org/${orgId}/events\`)` avant tout chargement si `!can(access, "CREATE_EVENT")` ; le texte de `SubscriptionBlockedNotice` invite à renouveler depuis l'onglet Abonnement, avec le contact support en secours.
- [ ] **Step 4: Navigateur** 375 px et 1280 px sur `/org/<id>/events`, organisation expirée puis active (bouton actif et fonctionnel).

---

### Task 5: Documentation et vérification finale

**Files:**
- Modify: `docs/v4/features/abonnements.md`, `docs/v4/features/paiements-fedapay.md`, `docs/v4/specs/2026-10-28-29-v4-paiement-fedapay.md`, `docs/v4/README.md`, ce plan

- [ ] **Step 1:** `abonnements.md` : réécrire « Abonnement par défaut », « Blocage de l'espace org » et « Résolution + enforcement » d'après la spec ; ajouter le tableau des droits et `/platform/settings` ; retirer la note de migration `endDate = NULL`. `paiements-fedapay.md` et spec FedaPay : corriger la décision 1 (free 30 jours, échéance → `EXPIRED`) avec renvoi vers la spec 2026-11-01. README v4 : ajouter la spec et le plan.
- [ ] **Step 2:** `make lint && make typecheck && make test && make test-coverage` (100 %) puis le e2e de l'espace org — rapporter les résultats réels.
- [ ] **Step 3:** Mettre à jour la table Progression.
