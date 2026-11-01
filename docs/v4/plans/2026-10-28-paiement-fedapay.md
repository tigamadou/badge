# Paiement des abonnements par FedaPay — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un OWNER d'organisation choisit et paie seul un plan payant via FedaPay depuis
`/org/[orgId]/subscription` ; l'abonnement s'active à la confirmation du paiement, redescend
sur `free` (sans échéance) quand il n'est pas renouvelé, et des rappels J-7 / J-1 partent par
email.

**Architecture :** trois couches. (1) Règles d'abonnement **pures** dans
`src/lib/subscription-changes.ts` (quel changement produit un paiement, que devient un
abonnement échu). (2) Un client FedaPay minimal `fetch` + vérification de signature dans
`src/lib/fedapay.ts`, configuré depuis `PlatformSettings`. (3) Un service `src/lib/payments.ts`
(`startCheckout`, `confirmPayment`) appelé par la route de checkout, le webhook, la page de
retour et le worker. Une tâche horaire `runSubscriptionSweep` est branchée dans la boucle du
worker existant.

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8, zod, Vitest 4 (BDD réelle),
API REST FedaPay v1.

**Spec :** [`docs/v4/specs/2026-10-28-29-v4-paiement-fedapay.md`](../specs/2026-10-28-29-v4-paiement-fedapay.md)

**Branche :** `feat/paiement-fedapay` (créée depuis `development` le 2026-10-28)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma, seed, `free` sans échéance | [x] | 2026-10-28 | schéma, free sans échéance, seed |
| 2 | Règles pures de changement d'abonnement + `settleSubscription` | [x] | 2026-10-28 | règles pures + settleSubscription ; 1 tour de correctifs (requêtes, audit protégé, boucle bornée) |
| 3 | Prix des plans (API + `PlanManager`) | [x] | 2026-10-28 | prix + édition inline du prix des plans existants |
| 4 | Réglages FedaPay (settings + API + formulaire) | [x] | 2026-10-28 | réglages FedaPay, secrets SUPER_ADMIN |
| 5 | Client FedaPay + signature de webhook | [x] | 2026-10-28 | client fetch + signature ; formes de réponse à confirmer en sandbox |
| 6 | Service de paiement + route de checkout | [x] | 2026-10-28 | checkout + confirmPayment ; 1 tour (verrou FOR UPDATE, sens selon montant payé) |
| 7 | Webhook + page de retour | [x] | 2026-10-28 | webhook + page de retour ; logique extraite (payment-return, subscription-path) |
| 8 | Page abonnement de l'org (catalogue, paiement, historique) | [x] | 2026-10-28 | catalogue, paiement, historique |
| 9 | Tâche horaire : échéances, rappels, paiements orphelins | [x] | 2026-10-28 | rappels, échéances, orphelins ; 1 tour (pas d'expiration si relecture en échec) |
| 10 | Historique des paiements côté staff | [x] | 2026-10-28 | historique staff, résumé enrichi |
| 11 | Documentation | [x] | 2026-10-28 | features, installation, README |
| — | Vérification finale (lint, typecheck, test, sandbox FedaPay, navigateur) | [~] | 2026-10-28 | lint 0 erreur, typecheck OK, test-coverage 215/215 vert 100 % ; vérif HTTP OK ; restent sandbox FedaPay et rendu navigateur 375/1280 px |

2026-10-28 : configuration FedaPay passée en variables d'environnement (décision utilisateur) ; les mentions de `PlatformSettings` / `getPlatformFedapay` ci-dessous sont historiques.

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **UI et emails en français avec accents.** Code et identifiants en anglais. Commentaires
  en français, dans le style du fichier touché.
- **Devise XOF uniquement, montants entiers.** Affichage : `Intl.NumberFormat("fr-FR")` +
  « FCFA » (ex. « 15 000 FCFA »).
- **Billing = `OWNER`** : `withOrgAuth("OWNER", …)` (`src/lib/with-org-auth.ts`) pour toute
  mutation de paiement ; lecture de la page par `MANAGER` inchangée.
- **Secrets FedaPay** (`fedapaySecretKey`, `fedapayWebhookSecret`) jamais renvoyés par une
  API ; écriture réservée à `SUPER_ADMIN` ; journalisés en booléens `*Changed` seulement.
- **Ne jamais croire le webhook ni l'URL de retour** : seule la transaction relue via l'API
  FedaPay fait foi (statut, montant, devise).
- **Idempotence** : un paiement n'est appliqué qu'une fois (`updateMany where status=PENDING`
  puis test `count === 1`, dans la même transaction Prisma que la mise à jour de
  l'abonnement).
- **Aucune nouvelle dépendance npm. Aucune nouvelle variable d'environnement.** L'URL de
  retour est construite depuis `NEXTAUTH_URL`.
- **Toute action sensible loggée** via `logActivity` (`src/lib/activity-log.ts`) ; tout
  nouveau `ActivityType` reçoit un libellé dans `src/lib/activity-labels.ts`.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (`vitest.config.ts`). L'API
  FedaPay est externe : on **mocke `fetch`** (`vi.stubGlobal("fetch", …)`), jamais Prisma.
- **Tests sur BDD réelle** : chaque nouveau modèle est ajouté à la purge de
  `src/test-setup.ts` dans l'ordre des FK (`subscriptionReminder`, `payment` avant
  `subscription` et `plan`).
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un fichier : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - schéma : `make db-push` (dev uniquement, pas de migration de prod dans ce plan) ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur.
- **Les pages de paiement vivent sous `/org/[orgId]/subscription/…`** et le layout
  (`src/app/org/[orgId]/layout.tsx:63-67`) doit les laisser passer même abonnement inactif
  (Task 8).
- **Commit — uniquement sur demande explicite de l'utilisateur.** Les étapes « commit » de ce
  plan ne valent pas autorisation. Jamais de trailer de co-auteur IA.
- **Pas de déploiement, pas de SSH, pas de prod.**

## Points de vigilance de revue

1. **Webhook et page de retour simultanés** : les deux appellent `confirmPayment` en même
   temps ; une seule application, un seul `PAYMENT_APPROVED`, une seule notification.
2. **Montant falsifié / transaction d'un autre marchand** : une transaction `approved` dont
   `amount` ou `currency` diffère du `Payment` ne doit rien activer (paiement marqué
   `DECLINED`, log `PAYMENT_FAILED` avec `details.reason = "MISMATCH"`).
3. **Corps brut du webhook** : la signature se calcule sur `await req.text()` **avant** tout
   `JSON.parse` ; un corps re-sérialisé fait échouer toute vérification.
4. **Org bloquée sur la page de retour** : si l'abonnement est `CANCELLED` par le staff,
   `/org/[orgId]/subscription/return` doit rester accessible (pas seulement `/subscription`).
5. **Paiement lancé deux fois** (double clic, deux onglets) : deux `Payment` `PENDING`
   coexistent ; si les deux aboutissent, le second applique sa règle sur l'état produit par le
   premier (même plan → prolongation). C'est accepté, mais le bouton est désactivé pendant la
   requête.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | `Plan.price`, `Subscription.scheduledPlanId`, modèles `Payment` et `SubscriptionReminder`, enums `PaymentStatus`, `SubscriptionChangeMode`, `FedapayEnvironment`, champs FedaPay de `PlatformSettings`, nouveaux `ActivityType` et `NotificationType` |
| `src/lib/subscription.ts` | + `subscriptionDatesForPlan` (free sans échéance) ; `resolveOrgLimits` appelle `settleSubscription` |
| `src/lib/subscription-changes.ts` (nouveau) | règles pures : `planChangeFor`, `expiryTransition` ; effet en base : `settleSubscription` |
| `src/lib/fedapay.ts` (nouveau) | config, client REST, `verifyWebhookSignature` |
| `src/lib/payments.ts` (nouveau) | `startCheckout`, `confirmPayment`, `applyApprovedPayment` |
| `src/lib/jobs/subscription-sweep.ts` (nouveau) | `runSubscriptionSweep(now)` |
| `src/lib/jobs/worker-loop.ts` | branche la tâche horaire |
| `src/app/api/org/[orgId]/subscription/checkout/route.ts` (nouveau) | `POST` |
| `src/app/api/webhooks/fedapay/route.ts` (nouveau) | `POST` |
| `src/app/org/[orgId]/subscription/page.tsx` | catalogue + historique |
| `src/app/org/[orgId]/subscription/return/page.tsx` (nouveau) | confirmation après paiement |
| `src/components/admin/PlanCatalog.tsx` (nouveau, client) | cartes de plans + bouton de paiement |
| `src/components/admin/PaymentHistory.tsx` (nouveau, serveur) | tableau des paiements (réutilisé côté staff) |
| `src/app/api/platform/plans/**`, `src/components/staff/PlanManager.tsx` | champ prix |
| `src/app/api/platform/settings/route.ts`, `src/lib/settings.ts`, `src/components/staff/PlatformSettingsForm.tsx` | réglages FedaPay |
| `src/lib/notifications/{messages,triggers,notify}.ts` | `SUBSCRIPTION_EXPIRING` |

---

## Task 1 — Schéma, seed et plan `free` sans échéance

**Files :**
- Modify : `prisma/schema.prisma`, `prisma/seed.ts`, `src/test-setup.ts`,
  `src/lib/subscription.ts`, `src/app/api/platform/organizations/route.ts:171-186`,
  `src/app/api/platform/organizations/[orgId]/subscription/route.ts`
- Test : `src/lib/__tests__/subscription.test.ts` (existant, compléter), tests existants des
  deux routes

**Interfaces :**
- Produces :
  - Prisma : `Plan.price Int?` ; `Subscription.scheduledPlanId String?` (relation
    `scheduledPlan Plan? @relation("ScheduledPlan")`, `onDelete: SetNull`) ;
    `Subscription.payments Payment[]` n'est pas requis (le paiement pointe l'org).
  - `enum PaymentStatus { PENDING APPROVED DECLINED CANCELED EXPIRED }`
  - `enum SubscriptionChangeMode { IMMEDIATE EXTENSION SCHEDULED }`
  - `enum FedapayEnvironment { SANDBOX LIVE }`
  - `model Payment { id cuid, orgId (Cascade), planId, userId (payeur, SetNull, String?),
    amount Int, currency String @default("XOF"), status PaymentStatus @default(PENDING),
    fedapayTransactionId Int? @unique, fedapayReference String?, mode SubscriptionChangeMode?,
    approvedAt DateTime?, createdAt, updatedAt ; @@index([orgId, createdAt]) @@index([status, createdAt]) }`
  - `model SubscriptionReminder { id cuid, subscriptionId (Cascade), endDate DateTime,
    daysBefore Int, sentAt DateTime @default(now()) ; @@unique([subscriptionId, endDate, daysBefore]) }`
  - `PlatformSettings` : `fedapayEnvironment FedapayEnvironment @default(SANDBOX)`,
    `fedapaySecretKey String @default("")`, `fedapayWebhookSecret String @default("")`
  - `ActivityType` : `PAYMENT_INITIATED`, `PAYMENT_APPROVED`, `PAYMENT_FAILED`
  - `NotificationType` : `SUBSCRIPTION_EXPIRING`
  - `subscriptionDatesForPlan(plan: { name: string; period: SubscriptionPeriod }, from?: Date): { startDate: Date; endDate: Date | null }`
    — `endDate = null` si `plan.name === DEFAULT_PLAN_NAME`, sinon `computeSubscriptionDates`.

- [ ] **Step 1 : tests de `subscriptionDatesForPlan`** dans `subscription.test.ts` :
  `free` → `endDate === null` et `startDate` = `from` ; plan `MONTHLY` nommé `Pro` →
  `endDate` = `from` + 30 j.
- [ ] **Step 2 : adapter les tests de routes** : création d'org → l'abonnement auto a
  `endDate === null` ; `PUT …/subscription` avec le plan `free` → `endDate === null`, avec un
  plan payant → `endDate` = maintenant + période (comportement actuel conservé).
- [ ] **Step 3 : lancer, vérifier l'échec** (`subscriptionDatesForPlan` non défini).
- [ ] **Step 4 : schéma** (champs ci-dessus), `make db-push`, puis `subscriptionDatesForPlan`
  et son usage dans les deux routes à la place de `computeSubscriptionDates`. Libellés des 3
  `ActivityType` dans `activity-labels.ts` (« Paiement initié », « Paiement approuvé »,
  « Paiement échoué ») ; `EMAIL_BY_TYPE.SUBSCRIPTION_EXPIRING = true` dans
  `src/lib/notifications/notify.ts`. Ajouter `subscriptionReminder` et `payment` à la purge de
  `src/test-setup.ts`.
- [ ] **Step 5 : seed** : plan `free` sans prix ; `Standard` reçoit `price: 15000` (valeur de
  démo, ajustable par le staff) ; après création des plans,
  `subscription.updateMany({ where: { plan: { name: DEFAULT_PLAN_NAME } }, data: { endDate: null, status: "ACTIVE" } })`
  (rattrapage des org `free` existantes, idempotent).
- [ ] **Step 6 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 7 : commit** (sur demande) — `feat(abonnements): plan free sans echeance et modeles de paiement`

## Task 2 — Règles pures de changement d'abonnement + `settleSubscription`

**Files :**
- Create : `src/lib/subscription-changes.ts`
- Modify : `src/lib/subscription.ts` (`resolveOrgLimits`)
- Test : `src/lib/__tests__/subscription-changes.test.ts`

**Interfaces :**
- Consumes : `subscriptionDatesForPlan`, `PERIOD_DAYS`, `DEFAULT_PLAN_NAME` (Task 1).
- Produces :
  ```ts
  type PlanLite = { id: string; name: string; period: SubscriptionPeriod; price: number | null };
  type SubscriptionState = {
    planId: string; plan: PlanLite; status: SubscriptionStatus;
    startDate: Date; endDate: Date | null; scheduledPlanId: string | null;
  };
  type PlanChange =
    | { mode: "IMMEDIATE"; data: { planId: string; status: "ACTIVE"; startDate: Date; endDate: Date | null; scheduledPlanId: null } }
    | { mode: "EXTENSION"; data: { status: "ACTIVE"; endDate: Date } }
    | { mode: "SCHEDULED"; data: { scheduledPlanId: string } };
  export function planChangeFor(current: SubscriptionState | null, target: PlanLite, now: Date): PlanChange;
  export function isRunning(sub: Pick<SubscriptionState, "status" | "endDate">, now: Date): boolean; // ACTIVE et (endDate null ou > now)
  export function expiryTransition(sub: SubscriptionState, scheduled: PlanLite | null, free: PlanLite | null, now: Date):
    | { reason: "SCHEDULED" | "EXPIRED"; data: { planId: string; startDate: Date; endDate: Date | null; scheduledPlanId: null } }
    | null;
  export async function settleSubscription(orgId: string, now?: Date): Promise<boolean>; // true si transition appliquée
  ```

Règles de `planChangeFor` (spec, décisions 2 et 3) :
- pas d'abonnement, abonnement non `isRunning`, ou `endDate === null` (free) → `IMMEDIATE`,
  dates = `subscriptionDatesForPlan(target, now)` ;
- `target.id === current.planId` → `EXTENSION`, `endDate = current.endDate + PERIOD_DAYS[target.period]` ;
- `(target.price ?? 0) < (current.plan.price ?? 0)` → `SCHEDULED` ;
- sinon (plus cher ou égal) → `IMMEDIATE` depuis `now`, `scheduledPlanId: null`.

Règles de `expiryTransition` : `null` si `status !== "ACTIVE"` ou `endDate === null` ou
`endDate > now`. Sinon, plan programmé présent → `reason: "SCHEDULED"`, période qui commence
à **l'ancienne `endDate`** (pas `now`) ; sinon `free` présent → `reason: "EXPIRED"`,
`planId = free.id`, `startDate = now`, `endDate = null` ; sinon `null` (comportement actuel :
bloqué).

`settleSubscription` charge l'abonnement + `plan` + `scheduledPlan` + le plan `free` non
archivé, calcule `expiryTransition`, et l'applique par
`subscription.updateMany({ where: { id, endDate: sub.endDate, status: "ACTIVE" }, data })`
(garde contre la double application). Si `count === 1` : `logActivity({ type:
"SUBSCRIPTION_UPDATED", orgId, targetId, details: { auto: true, reason, planId } })` puis
`notifySubscriptionChanged(orgId, null)` — passer la signature de ce trigger à
`actorId: string | null` (le type `NotifyInput.actorId` l'accepte déjà).

`resolveOrgLimits` appelle `await settleSubscription(orgId)` en tête puis relit.

- [ ] **Step 1 : tests de `planChangeFor`** (dates fixes `2026-11-01T00:00:00Z`) :
  - `"aucun abonnement → IMMEDIATE avec dates du plan"` ;
  - `"depuis free → IMMEDIATE"` ;
  - `"même plan → EXTENSION depuis l'ancienne échéance"` (fin 2026-11-10, MONTHLY →
    2026-12-10) ;
  - `"plan plus cher → IMMEDIATE depuis now, programmation effacée"` ;
  - `"plan moins cher → SCHEDULED"` ;
  - `"abonnement échu → IMMEDIATE même pour le même plan"` ;
  - `"prix égal, autre plan → IMMEDIATE"`.
- [ ] **Step 2 : tests de `expiryTransition`** : non échu → `null` ; `CANCELLED` échu →
  `null` ; échu + programmé → `SCHEDULED`, `startDate` = ancienne `endDate` ; échu sans
  programmé → `EXPIRED` vers `free`, `endDate null` ; échu sans `free` → `null`.
- [ ] **Step 3 : tests BDD de `settleSubscription`** : org `Standard` échue → passe sur `free`,
  1 `ActivityLog` `SUBSCRIPTION_UPDATED` avec `details.auto`, 1 notification
  `SUBSCRIPTION_CHANGED` pour l'OWNER ; deux appels concurrents (`Promise.all`) → un seul log ;
  `resolveOrgLimits` d'une org échue renvoie `active: true` et les limites de `free`.
- [ ] **Step 4 : lancer, vérifier l'échec.**
- [ ] **Step 5 : implémenter**, adapter `notifySubscriptionChanged`.
- [ ] **Step 6 : `make lint && make typecheck && make test`** → vert (les tests existants qui
  attendaient un blocage à l'échéance d'un plan payant doivent maintenant attendre le retour
  sur `free` ; ceux qui créent un abonnement échu **sans** plan `free` restent bloqués).
- [ ] **Step 7 : commit** (sur demande) — `feat(abonnements): retour sur free a l'echeance et regles de changement de plan`

## Task 3 — Prix des plans

**Files :**
- Modify : `src/app/api/platform/plans/route.ts`, `src/app/api/platform/plans/[planId]/route.ts`,
  `src/components/staff/PlanManager.tsx`, `src/app/platform/plans/page.tsx` (si le `select`
  limite les champs)
- Test : tests existants des deux routes

**Interfaces :** zod `price: z.number().int().min(100).max(10_000_000).nullable().optional()`
(FedaPay refuse les montants trop faibles ; 100 FCFA plancher). `null` = non vendu.

- [ ] **Step 1 : tests** : `POST` avec `price: 15000` → plan créé avec ce prix ; `price: 50`
  → 400 `VALIDATION` ; `PATCH` `price: null` → plan retiré de la vente ; le `details` de
  `PLAN_UPDATED` contient `price`.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter** (API + champ « Prix (FCFA) » dans le
  formulaire de création et d'édition, vide = « Non vendu en ligne » ; colonne prix dans la
  liste).
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : commit** (sur demande) — `feat(plans): prix des plans en FCFA`

## Task 4 — Réglages FedaPay

**Files :**
- Modify : `src/lib/settings.ts`, `src/app/api/platform/settings/route.ts`,
  `src/components/staff/PlatformSettingsForm.tsx`, `src/app/platform/settings/page.tsx`
- Test : tests existants de `settings.ts` et de la route settings

**Interfaces :**
- Produces : `getPlatformFedapay(): Promise<{ environment: FedapayEnvironment; secretKey: string; webhookSecret: string; configured: boolean }>`
  (`configured = secretKey !== "" && webhookSecret !== ""`), sur le modèle de
  `getPlatformRecaptcha` (`src/lib/settings.ts:101`).
- API settings : `fedapayEnvironment` modifiable par `STAFF_ADMIN` ; `fedapaySecretKey` et
  `fedapayWebhookSecret` suivent **exactement** la règle des secrets existants
  (SUPER_ADMIN, chaîne vide = inchangé, `403 FORBIDDEN_SECRET_CHANGE`, `publicView` expose
  `fedapaySecretKeySet` / `fedapayWebhookSecretSet`, audit en `*Changed`).

- [ ] **Step 1 : tests** : `GET` ne contient ni `fedapaySecretKey` ni
  `fedapayWebhookSecret` mais les deux booléens ; `STAFF_ADMIN` qui envoie une clé → 403 ;
  `SUPER_ADMIN` → enregistré, log avec `fedapaySecretKeyChanged: true` et sans la valeur ;
  `getPlatformFedapay` → `configured: false` tant qu'un secret manque.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter** (section « Paiements FedaPay » du
  formulaire : environnement Sandbox / Production, clé secrète, secret de webhook, et l'URL
  de webhook à déclarer dans FedaPay, affichée en lecture seule :
  `${NEXTAUTH_URL}/api/webhooks/fedapay`).
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : commit** (sur demande) — `feat(parametres): configuration fedapay`

## Task 5 — Client FedaPay et signature de webhook

**Files :**
- Create : `src/lib/fedapay.ts`
- Test : `src/lib/__tests__/fedapay.test.ts`

**Interfaces :**
- Consumes : `getPlatformFedapay` (Task 4).
- Produces :
  ```ts
  export type FedapayTransactionStatus = "pending" | "approved" | "declined" | "canceled" | "refunded" | "transferred" | string;
  export type FedapayTransaction = { id: number; reference: string; amount: number; currencyIso: string; status: FedapayTransactionStatus };
  export class FedapayError extends Error { readonly code: "NOT_CONFIGURED" | "API_ERROR" | "BAD_SIGNATURE"; readonly httpStatus?: number }
  export function fedapayBaseUrl(env: FedapayEnvironment): string; // SANDBOX → https://sandbox-api.fedapay.com/v1, LIVE → https://api.fedapay.com/v1
  export async function createTransaction(input: {
    description: string; amount: number; callbackUrl: string;
    customer: { email: string; firstname?: string; lastname?: string };
    metadata: Record<string, string>;
  }): Promise<FedapayTransaction>;          // POST /transactions, currency { iso: "XOF" }
  export async function createPaymentUrl(transactionId: number): Promise<string>; // POST /transactions/{id}/token → url
  export async function retrieveTransaction(transactionId: number): Promise<FedapayTransaction>; // GET /transactions/{id}
  export function isPaidStatus(status: FedapayTransactionStatus): boolean; // approved | transferred
  export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, nowSec?: number): void; // throw FedapayError("BAD_SIGNATURE")
  ```
- Auth : `Authorization: Bearer <secretKey>`, `Content-Type: application/json`.
- **Enveloppe de réponse** : l'API FedaPay renvoie l'objet sous une clé `"v1/transaction"`.
  Lire `body["v1/transaction"] ?? body`. La devise est dans `currency.iso` ou se déduit de
  `currency_id` : **vérifier sur une vraie réponse sandbox** en début de task (curl avec la
  clé sandbox fournie par l'utilisateur) et figer le parseur sur ce qui est observé ; noter
  la forme réelle en commentaire.
- Signature (reproduit `fedapay@1.2.5`, `dist/Webhook.js`) : en-tête `t=<unix>,s=<hex>[,s=<hex>]`,
  `expected = HMAC_SHA256(secret, "<t>.<rawBody>")` en hex, comparaison
  `crypto.timingSafeEqual` sur buffers de même longueur, rejet si `nowSec - t > 300`.

- [ ] **Step 1 : tests** (`fetch` stubé) :
  - `"createTransaction envoie montant, devise XOF, callback et Bearer"` (assertions sur
    l'URL sandbox, la méthode, `JSON.parse(init.body)`) ;
  - `"createTransaction lit l'enveloppe v1/transaction"` ;
  - `"createPaymentUrl renvoie url"` ;
  - `"réponse non 2xx → FedapayError API_ERROR avec httpStatus"` ;
  - `"non configuré → FedapayError NOT_CONFIGURED sans appel fetch"` ;
  - `"environnement LIVE → https://api.fedapay.com/v1"` ;
  - `"verifyWebhookSignature accepte une signature calculée avec le secret"` ;
  - `"rejette : en-tête absent, sans t, sans s, mauvais secret, corps modifié, horodatage > 300 s"` ;
  - `"accepte si l'une de plusieurs signatures s= correspond"`.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter.**
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : commit** (sur demande) — `feat(paiements): client fedapay et verification de signature`

## Task 6 — Service de paiement et route de checkout

**Files :**
- Create : `src/lib/payments.ts`, `src/app/api/org/[orgId]/subscription/checkout/route.ts`
- Test : `src/lib/__tests__/payments.test.ts`,
  `src/app/api/org/[orgId]/subscription/checkout/__tests__/route.test.ts`

**Interfaces :**
- Consumes : `planChangeFor` (Task 2), client FedaPay (Task 5), `notifySubscriptionChanged`.
- Produces :
  ```ts
  export class PaymentError extends Error {
    readonly code: "PLAN_NOT_FOR_SALE" | "CHANGE_ALREADY_SCHEDULED" | "PAYMENTS_DISABLED" | "PROVIDER_ERROR";
    readonly httpStatus: number; // 400 | 409 | 503 | 502
  }
  export async function startCheckout(input: { orgId: string; planId: string; userId: string; req?: NextRequest }): Promise<{ paymentId: string; url: string }>;
  export async function confirmPayment(fedapayTransactionId: number): Promise<{ status: PaymentStatus; applied: boolean } | null>; // null = transaction inconnue
  ```
- Route : `POST` `withOrgAuth("OWNER", …)`, body zod `{ planId: z.string().min(1) }`,
  réponse `200 { url }`, erreurs `{ error: code }` avec `httpStatus`.

`startCheckout` :
1. plan introuvable, archivé ou `price === null` → `PLAN_NOT_FOR_SALE` (400) ;
2. abonnement avec `scheduledPlanId` → `CHANGE_ALREADY_SCHEDULED` (409) ;
3. `getPlatformFedapay().configured === false` → `PAYMENTS_DISABLED` (503) ;
4. crée `Payment { PENDING, amount: plan.price, currency: "XOF" }` ;
5. `createTransaction` (description `Abonnement <plan> — <org>`, `callbackUrl =
   ${NEXTAUTH_URL}/org/${orgId}/subscription/return`, client = email/nom du payeur,
   `metadata: { paymentId, orgId }`) puis `createPaymentUrl` ; enregistre
   `fedapayTransactionId` et `fedapayReference` ;
6. échec FedaPay → `Payment` passé `CANCELED`, `PROVIDER_ERROR` (502) ;
7. `logActivity PAYMENT_INITIATED { paymentId, planId, amount }`.

`confirmPayment` :
1. `Payment` par `fedapayTransactionId` ; absent → `null` ; déjà non `PENDING` →
   `{ status, applied: false }` sans appel FedaPay ;
2. `retrieveTransaction` ; statut `pending` → `{ PENDING, applied: false }` ;
3. payé mais `amount` ou devise ≠ `Payment` → `DECLINED`, `PAYMENT_FAILED { reason: "MISMATCH" }` ;
4. payé → dans une `prisma.$transaction` : `payment.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPROVED", approvedAt, mode } })` ;
   si `count === 0` → sortie `applied: false` ; sinon relire l'abonnement, appliquer
   `planChangeFor(current, plan, now)` (upsert si pas d'abonnement) ; puis, hors
   transaction : `PAYMENT_APPROVED { paymentId, mode }`, `SUBSCRIPTION_UPDATED { source: "payment", paymentId }`,
   `notifySubscriptionChanged(orgId, payment.userId)` ;
5. `declined` / `canceled` → statut correspondant, `PAYMENT_FAILED { reason: status }`.

- [ ] **Step 1 : tests de service** (`fetch` stubé, BDD réelle) :
  - `"startCheckout crée un Payment PENDING et renvoie l'URL FedaPay"` ;
  - `"plan sans prix → PLAN_NOT_FOR_SALE"`, `"plan archivé → PLAN_NOT_FOR_SALE"` ;
  - `"downgrade déjà programmé → CHANGE_ALREADY_SCHEDULED"` ;
  - `"FedaPay non configuré → PAYMENTS_DISABLED, aucun Payment créé"` ;
  - `"erreur FedaPay → Payment CANCELED, PROVIDER_ERROR"` ;
  - `"confirmPayment approved depuis free → plan actif, endDate +30 j, mode IMMEDIATE, 1 notification"` ;
  - `"confirmPayment même plan → EXTENSION"`, `"plan moins cher → SCHEDULED, plan courant inchangé"` ;
  - `"deux confirmPayment concurrents → un seul APPROVED, un seul PAYMENT_APPROVED"` ;
  - `"montant différent → DECLINED, abonnement inchangé"` ;
  - `"declined → DECLINED"`, `"pending → reste PENDING"`, `"transaction inconnue → null"`.
- [ ] **Step 2 : tests de route** : non connecté → 401 ; `MANAGER` → 403 ; `OWNER` → 200
  `{ url }` ; body invalide → 400 ; `PaymentError` → son `httpStatus`.
- [ ] **Step 3 : lancer, échec. Step 4 : implémenter.**
- [ ] **Step 5 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 6 : commit** (sur demande) — `feat(paiements): checkout et confirmation des paiements fedapay`

## Task 7 — Webhook et page de retour

**Files :**
- Create : `src/app/api/webhooks/fedapay/route.ts`,
  `src/app/org/[orgId]/subscription/return/page.tsx`
- Modify : `src/app/org/[orgId]/layout.tsx:65`
- Test : `src/app/api/webhooks/fedapay/__tests__/route.test.ts`

**Interfaces :** consomme `verifyWebhookSignature`, `getPlatformFedapay`, `confirmPayment`.

Webhook `POST` (hors matcher du middleware, aucune session) :
`raw = await req.text()` → `verifyWebhookSignature(raw, req.headers.get("x-fedapay-signature"), webhookSecret)`
(échec → 400) → `event = JSON.parse(raw)` → si `event.name` commence par `transaction.` et
`event.entity?.id` est un nombre → `confirmPayment(id)`. Répond **toujours 200**
`{ received: true }` après signature valide (transaction inconnue, évènement ignoré, ou
erreur FedaPay loggée en `console.error`) pour ne pas faire désactiver le webhook par
FedaPay ; la reprise est assurée par la tâche horaire (Task 9). FedaPay non configuré → 503.
**Vérifier en sandbox** que l'id est bien dans `entity.id` et ajuster si besoin.

Page de retour (Server Component, `hasOrgRole(ctx, orgId, "MANAGER")` comme la page
abonnement) : lit `searchParams.id`, appelle `confirmPayment(Number(id))` **seulement si**
le `Payment` appartient à cette org, et affiche :
- `APPROVED` → « Paiement confirmé. Votre abonnement <plan> est actif. » (ou « … sera activé le
  <date> » si `mode === "SCHEDULED"`) ;
- `PENDING` → « Paiement en cours de confirmation. Cette page se met à jour dès que FedaPay
  confirme. » + lien « Actualiser » ;
- `DECLINED` / `CANCELED` → « Le paiement n'a pas abouti. Votre abonnement n'a pas changé. » ;
- inconnu ou autre org → « Paiement introuvable. »
Toujours un lien « Retour à l'abonnement ».

Layout : remplacer `pathname.endsWith("/subscription")` par un test sur le segment
`/org/<orgId>/subscription` (égal ou suivi de `/`).

- [ ] **Step 1 : tests du webhook** : signature valide + `transaction.approved` → paiement
  appliqué, 200 ; rejoué → 200, une seule application ; signature invalide → 400 et rien
  n'est appliqué ; évènement `customer.created` → 200 sans appel FedaPay ; transaction
  inconnue → 200 ; non configuré → 503 ; `retrieveTransaction` en erreur → 200 et paiement
  toujours `PENDING`.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter.**
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : commit** (sur demande) — `feat(paiements): webhook fedapay et page de retour`

## Task 8 — Page abonnement de l'organisation

**Files :**
- Modify : `src/app/org/[orgId]/subscription/page.tsx`
- Create : `src/components/admin/PlanCatalog.tsx` (`"use client"`),
  `src/components/admin/PaymentHistory.tsx`
- Test : `src/components/admin/__tests__/PaymentHistory.test.tsx`
  (`renderToStaticMarkup`, comme les tests de composants existants)

**Interfaces :**
- `PlanCatalog({ orgId, plans, currentPlanId, currentPrice, scheduledPlanId, canPay })` où
  `plans: { id; name; period; price: number; maxEvents; maxParticipantsPerEvent }[]`. Libellé
  du bouton par plan : plan courant → « Renouveler » ; prix inférieur au courant →
  « Programmer à l'échéance » ; sinon → « Passer à ce plan ». Clic : `POST …/checkout`, puis
  `window.location.assign(url)` ; bouton désactivé pendant la requête ; erreur affichée
  selon `error` (`CHANGE_ALREADY_SCHEDULED` → « Un changement de plan est déjà programmé. »,
  `PAYMENTS_DISABLED` → « Le paiement en ligne n'est pas disponible pour le moment. », autre →
  « Le paiement n'a pas pu démarrer. Réessayez. »). `canPay = false` (MANAGER) → pas de
  bouton, mention « Seul le propriétaire de l'organisation peut changer d'abonnement. ».
- `PaymentHistory({ payments })` : date, plan, montant FCFA, statut (« En attente »,
  « Payé », « Refusé », « Annulé », « Expiré »), référence FedaPay. Vide → « Aucun paiement. ».

Page : sous-titre « lecture seule — géré par la plateforme » retiré ; le bloc « Détails »
affiche « Sans échéance » quand `endDate` est nul, et « Changement programmé : <plan> le
<date> » si `scheduledPlanId` ; l'alerte « abonnement non actif » reste ; ajout des cartes
« Changer de plan » (`PlanCatalog`, plans non archivés avec `price != null`, triés par prix)
et « Historique des paiements » (20 derniers).

- [ ] **Step 1 : tests `PaymentHistory`** : libellés de statut, « 15 000 FCFA », état vide.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter.**
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : vérification navigateur** (`make db-seed`, OWNER d'une org de démo, 375 px
  et 1280 px) : catalogue visible, bouton → redirection vers la page sandbox FedaPay ;
  connecté en MANAGER → pas de bouton.
- [ ] **Step 6 : commit** (sur demande) — `feat(abonnements): choix et paiement du plan depuis l'espace org`

## Task 9 — Tâche horaire : échéances, rappels, paiements orphelins

**Files :**
- Create : `src/lib/jobs/subscription-sweep.ts`
- Modify : `src/lib/jobs/worker-loop.ts`, `src/lib/jobs/constants.ts`,
  `src/lib/notifications/messages.ts`, `src/lib/notifications/triggers.ts`
- Test : `src/lib/jobs/__tests__/subscription-sweep.test.ts`, test existant de
  `worker-loop.ts`, test de `messages.ts`

**Interfaces :**
- Produces :
  - `SUBSCRIPTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000` et `REMINDER_DAYS = [7, 1] as const`
    dans `constants.ts` ;
  - `runSubscriptionSweep(now: Date): Promise<{ settled: number; reminded: number; reconciled: number; expired: number }>` ;
  - `WorkerDeps.runSubscriptionSweep`, appelée dans `runOnce` avec sa propre garde
    `lastSweepAt` (même schéma que `lastPurgeAt`) et un `log` si un compteur est non nul ;
  - `notifySubscriptionExpiring(orgId: string, daysBefore: number, endDate: Date): Promise<void>`
    (ORG / OWNER uniquement) et `subscriptionExpiringMessage({ orgId, orgName, planName, daysBefore, endDate })`
    → titre « Votre abonnement <plan> expire dans 7 jours » / « … expire demain », corps
    rappelant qu'à l'échéance l'organisation repasse sur le plan gratuit, bouton
    « Renouveler » vers `/org/<orgId>/subscription`.

`runSubscriptionSweep` :
1. **Échéances** : pour chaque abonnement `ACTIVE` avec `endDate <= now` →
   `settleSubscription(orgId, now)`.
2. **Rappels** : pour chaque `d` de `REMINDER_DAYS`, abonnements `ACTIVE`, `scheduledPlanId`
   nul, `endDate` dans `(now, now + d jours]` → `subscriptionReminder.create({ subscriptionId,
   endDate, daysBefore: d })` ; si conflit d'unicité (P2002) → ignoré ; sinon
   `notifySubscriptionExpiring`. Un abonnement à J-1 qui n'a jamais reçu J-7 ne reçoit que J-1
   (tester J-1 avant J-7 dans la boucle et sauter J-7 si J-1 s'applique).
3. **Paiements orphelins** : `Payment` `PENDING` avec `fedapayTransactionId` et
   `createdAt <= now - 15 min` → `confirmPayment(id)` (erreur FedaPay loggée, on continue) ;
   puis `PENDING` avec `createdAt <= now - 24 h` → `EXPIRED`.

- [ ] **Step 1 : tests** :
  - `"abonnement échu → repasse sur free"` ;
  - `"endDate à 6 j → rappel J-7 une seule fois sur deux passages"` ;
  - `"endDate à 20 h → seul J-1 est envoyé"` ;
  - `"nouvelle échéance après renouvellement → nouveaux rappels"` ;
  - `"downgrade programmé → pas de rappel"`, `"free (endDate null) → pas de rappel"` ;
  - `"PENDING de 20 min → confirmPayment appelé"`, `"PENDING de 25 h → EXPIRED"`,
    `"PENDING de 5 min → ignoré"` ;
  - worker-loop : `runSubscriptionSweep` appelé au premier `runOnce`, pas au suivant à +10 min,
    de nouveau à +1 h ;
  - messages : libellés J-7 et J-1.
- [ ] **Step 2 : lancer, échec. Step 3 : implémenter.**
- [ ] **Step 4 : `make lint && make typecheck && make test`** → vert.
- [ ] **Step 5 : commit** (sur demande) — `feat(abonnements): rappels d'echeance et reprise des paiements`

## Task 10 — Historique des paiements côté staff

**Files :** Modify `src/app/platform/organizations/[orgId]/subscription/page.tsx`.

- [ ] **Step 1 : implémenter** : sous le résumé, carte « Historique des paiements »
  (`PaymentHistory`, 50 derniers) ; le résumé affiche le changement programmé et « Sans
  échéance ». Le formulaire staff, quand il assigne un plan, efface `scheduledPlanId`
  (ajouter `scheduledPlanId: null` dans les données de l'upsert de
  `PUT …/subscription` + assertion dans son test).
- [ ] **Step 2 : `make lint && make typecheck && make test`** → vert ; vérification
  navigateur en staff.
- [ ] **Step 3 : commit** (sur demande) — `feat(platform): historique des paiements d'une organisation`

## Task 11 — Documentation

**Files :** `docs/v4/features/abonnements.md` (free sans échéance, retour sur free,
changement programmé, rappels, paiement libre-service — retirer « facturation manuelle »),
nouvelle `docs/v4/features/paiements-fedapay.md` (parcours, configuration, sécurité du
webhook, statuts, procédure sandbox), `docs/v4/installation.md` (configurer FedaPay en dev :
compte sandbox, clés dans `/platform/settings`, exposer le webhook via un tunnel pour tester),
`docs/v4/README.md` (index), guide utilisateur org si une page abonnement y existe.

- [ ] **Step 1 : rédiger. Step 2 : relire contre le code. Step 3 : commit** (sur demande) —
  `docs(paiements): paiement des abonnements par fedapay`

## Vérification finale

- [ ] `make lint && make typecheck && make test` → vert, couverture 100 % conservée.
- [ ] **Sandbox FedaPay de bout en bout** (clés sandbox fournies par l'utilisateur, saisies
  dans `/platform/settings`) : OWNER paie `Standard` depuis `free` avec un numéro de test
  approuvé → retour sur la page de confirmation, limites `Standard` ; paiement refusé (numéro
  de test d'échec) → aucun changement ; renouvellement → `endDate` prolongée de 30 j.
- [ ] Webhook : via tunnel (ou rejeu manuel depuis le tableau de bord FedaPay) → 200, aucun
  double effet.
- [ ] Échéance : mettre `endDate` d'un abonnement dans le passé en BDD de dev → la page org
  n'est pas bloquée, plan `free` affiché, notification reçue dans Mailpit.
- [ ] Rappel : `endDate` à +6 j → `docker compose … exec worker` redémarré → email J-7 dans
  Mailpit, un seul.
- [ ] Navigateur 375 / 1280 px : page abonnement (OWNER et MANAGER), page de retour, réglages
  FedaPay, prix dans les plans.
