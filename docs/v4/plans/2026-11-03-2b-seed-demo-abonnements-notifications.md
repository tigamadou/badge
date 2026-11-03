# Vague 2 · Lot 2b — Seed de démo : abonnements, notifications, journal — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2b feat/seed-demo` ; branche du lot `feat/seed-demo-2b`.
> Toutes les commandes `make` se lancent **dans le worktree**. Sous-skill :
> `superpowers:executing-plans`. En exécution automatisée (tâche planifiée), **un commit par
> tâche est autorisé** sur la branche du plan (voir la spec, « Organisation du travail ») ;
> sinon aucun commit sans demande explicite de l'utilisateur.

**Objectif :** remplir la démo des domaines abonnements, paiements d'abonnement, jobs email,
notifications (hors impression) et journal d'activité (hors impression), avec des statuts
variés et des données cohérentes avec les règles de `src/lib/**`.

**Architecture :** `seedBilling(ctx)` (`billing.ts`) puis `seedNotificationsAndActivity(ctx)`
(`notifications.ts`) orchestrent des sous-modules. Chaque module **relit le monde déjà seedé
dans la base** (organisations `demo-*`, comptes `@demo.local`, inscriptions) plutôt que de
dépendre de la forme exacte des registres du socle. Les écritures sont directes
(`createMany`, dates relatives étalées) ; les fonctions pures de `src/lib/**`
(`computeSubscriptionDates`, `planChangeFor`, `REMINDER_DAYS`, constructeurs de `messages.ts`)
servent à produire des valeurs identiques à celles de l'application. Les fonctions qui
notifient, journalisent ou mettent un email en file (`notify*`, `logActivity`,
`enqueueEmail`, `settleSubscription`, `confirmPayment`) ne sont **jamais appelées** : elles
horodatent à « maintenant » et un email partirait.

**Tech Stack :** Prisma 6 / MySQL, `@faker-js/faker` (via `ctx`), Vitest 4, tsx.

**Spec :** [`specs/2026-11-03-37-v4-seed-de-demo.md`](../specs/2026-11-03-37-v4-seed-de-demo.md)
(« Précisions » et « Organisation du travail » font autorité). Plan du socle :
[`2026-11-03-1-socle-seed-demo.md`](2026-11-03-1-socle-seed-demo.md) (s'il existe, il prime
sur les hypothèses ci-dessous).

## Amendements (relecture croisée de l'orchestrateur, 2026-11-03)

Le contrat du socle est figé dans `2026-11-03-1-socle-seed-demo.md` (« Contrats figés ») ; il prime
sur les hypothèses de ce plan :
- `billing.ts` exporte `seedBilling(ctx)` et `cleanupBilling(ctx)` ; `notifications.ts` exporte
  `seedNotificationsAndActivity(ctx)` et `cleanupNotificationsAndActivity(ctx)`, tous appelés par
  `prisma/seed/demo/index.ts` (nettoyages avant tous les seeds).
- Dates et jobs : `ctx.backdate(...)` et `ctx.parkJobs(...)` du socle (pas de copie locale).
- Journal : ce lot écrit **tous** les `BADGE_PRINTED` et `BADGE_*` (le lot 2a n'en écrit aucun) ;
  le lot 2a écrit les activités du domaine impression.
- `fedapayTransactionId` : plage `910_000_000`–`919_999_999` confirmée (2a : `920_000_000`–`929_999_999`).
- `orgMembers` / `eventMembers` souvent vides (voir 2a) : `?.` et repli pour tout abonnement, paiement ou notification destiné à un owner.
- Filtrer `!org.archived` / `!event.archived` pour les abonnements actifs et les notifications de nouvelle inscription.
- Slugs d'événement via `DemoEvent.slug` ; `DemoRegistrationRef` sans dates : relire le monde en base (impression sur place, `BADGE_PRINTED`).
- Ne jamais antidater (`backdate("job")`) un `Job` PENDING : le créer directement avec un `runAt` lointain. Appeler `ctx.parkJobs()` après chaque création de jobs. (Le socle reporte aussi les PENDING dont le destinataire finit par `@demo.local`, et `runDemoSeed` appelle `parkJobs` dans son `finally`.)
- `cleanupNotificationsAndActivity` doit supprimer les `Job` parqués des runs précédents (aucune cascade ne les atteint) ainsi que `Notification`, `Payment`, `Subscription`, `OrgPrintCredit` non liés par cascade : vérifier chaque `onDelete` (`Payment.planId` est `Restrict` vers `Plan`) ; critère de sélection : `recipient endsWith @demo.local`, `kind`, `orgId` des organisations `demo-%`.
- `ctx.backdate` : découper en tranches de 1 000 ids pour les gros volumes (limite de 65 535 placeholders MySQL).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Contrat du socle, monde relu en base, plans de démo | [x] | 2026-11-03 | Ecarts : dates via ctx.dates (pas daysAgo), loadWorld() sans ctx, WorldUser/WorldEvent etendus; seulement 4 orgs sur 12 ont un OWNER (repli membre/null); cleanupBilling(_ctx). |
| 2 | Abonnements, rappels, quotas | [x] | 2026-11-03 | near-limit: ratio >= 85 % verifie seulement si plus gros evenement >= 9 (a petite echelle +1 suffit); echeance verifiee contre endInDays (garde-fou). |
| 3 | Paiements d'abonnement | [x] | 2026-11-03 | Payeur = owner, sinon membre, sinon null (8 orgs sur 12 sans owner). PENDING/EXPIRED/DECLINED/CANCELED visent Standard (plan avec prix). cleanupActivity() (notifications/activity.ts) appelee en tete du journal de seedBilling; modes verifies par planChangeFor (erreur si ecart). |
| 4 | Jobs email de chaque statut | [x] | 2026-11-03 | SeededJobs etendu (completedAt, retried). PENDING/RUNNING crees directement avec runAt/lockedAt +3650 j (createdAt = maintenant, jamais antedates). |
| 5 | Notifications de chaque type hors impression | [x] | 2026-11-03 | Ecart: assignScenarios donne les scenarios preferOwner (big-annual, monthly-renewed, expiring-7, expiring-1) aux orgs ayant un OWNER (sinon aucun rappel/notification ORG possible). Destinataires: staff demo uniquement (admin@badge.local exclu). cleanupNotifications dans notifications/notifications.ts. |
| 6 | Journal d'activité | [x] | 2026-11-03 | Types non seedes: USER_DELETED, ORG_DELETED, REGISTRATION_DELETED. Plafond des dates = horloge reelle (comptes/membres crees apres ctx.dates.now). seedJobs renvoie un resultat vide si le monde est vide (framework.test). PLAN_UPDATED ajoute cote facturation; plans crees a now-175 j (fenetre de 180 j). cleanupActivity({keepBilling}). |
| 7 | Vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables : `prisma/seed/demo/billing.ts`, `prisma/seed/demo/notifications.ts`,
`prisma/seed/demo/billing/**`, `prisma/seed/demo/notifications/**` (dont leurs
`__tests__/`).
**En lecture seule** : `prisma/seed/demo/context.ts`, `prisma/seed/demo/index.ts` et les autres
modules du socle, `prisma/schema.prisma`, `src/lib/**`, `src/test/factories.ts`, `Makefile`,
`docker-compose*.yml`. Besoin d'y toucher → s'arrêter et le signaler (statut NEEDS_CONTEXT).

## Global Constraints

- Règles de test de CLAUDE.md : base `badge_test` uniquement (`make test`) ; **aucun mock de la
  base ni de Prisma** ; données préparées par le socle réduit (facteur d'échelle) et les
  fabriques de `src/test/factories.ts` ; jamais de modification de code de production
  (`src/` hors `__tests__`) pour faire passer un test : s'arrêter et demander.
- Pas d'appel externe : aucun FedaPay, SMTP, renderer. Paiements simulés en base. Adresses
  `@demo.local`. Aucun email réel.
- Faker à graine fixe (celui de `ctx`) : deux exécutions au même instant donnent les mêmes données.
- Idempotence : relancer `seedBilling` / `seedNotificationsAndActivity` sans reset donne le même
  état (la suppression des organisations `demo-*` et des utilisateurs `@demo.local` par le
  nettoyage du socle emporte abonnements, paiements, rappels, notifications ; les plans
  `demo-*` sont `upsert` par nom ; jobs et journal de démo sont supprimés par leur propre
  nettoyage : jobs dont `recipient` finit par `@demo.local`, journal dont `orgId` ou `userId`
  est dans le monde de démo).
- Dates relatives à `ctx.now`, étalées ; jamais dans le futur sauf échéances, `runAt` des jobs
  en file et verrou des jobs `RUNNING`. Notifications lues datées de moins de 60 jours
  (rétention 90 j), jobs `SUCCEEDED` / `CANCELLED` terminés depuis moins de 25 jours
  (rétention 30 j).
- Les paiements d'abonnement ne portent jamais de `printRequestId` (lot 2a) ; les notifications
  et le journal de ce lot n'utilisent aucun type `PRINT_*`.
- `fedapayTransactionId` (Int unique) : plage réservée `910_000_000`–`919_999_999` à ce lot.
- Format : UI et messages en français avec accents, code en anglais, commentaires en français.

## Review Focus

- Un abonnement `ACTIVE` ne doit jamais être échu (`endDate <= now`) : l'application ne le
  produit pas (le sweep le passe `EXPIRED`).
- Un job `PENDING` ou `RUNNING` de la démo ne doit jamais devenir exécutable par le worker :
  `runAt` loin dans le futur, `lockedAt` futur pour `RUNNING` (sinon `recoverStaleJobs` le
  remet en file après 10 min).
- Un paiement `PENDING` avec `fedapayTransactionId` serait relu chez FedaPay par le sweep après
  15 min : les `PENDING` de la démo n'ont pas de transaction.
- Une notification `EMAIL_FAILED` pointe vers un job `FAILED` qui existe ; une notification
  `SUBSCRIPTION_EXPIRING` correspond à un `SubscriptionReminder` existant.
- Quotas : aucun évènement au-delà de la limite de l'abonnement `ACTIVE` sans entrée
  `QUOTA_BYPASS` ; le cas « proche de la limite » reste en dessous.
- Journal : chaque inscription `APPROVED` / `REJECTED` a son entrée de décision, chaque
  `badgePrinted` son `BADGE_PRINTED` (sans doublon avec le lot 2a) ; aucune entrée antérieure à
  la création de l'entité visée.

---

### Task 1: Contrat du socle, monde relu en base, plans de démo

**Files:**
- Create: `prisma/seed/demo/billing/world.ts`, `prisma/seed/demo/billing/plans.ts`,
  `prisma/seed/demo/billing/__tests__/helpers.ts`, `prisma/seed/demo/billing/__tests__/plans.test.ts`
- Modify: `prisma/seed/demo/billing.ts` (stub → orchestration)

**Interfaces:**
- Consumes (hypothèses, à vérifier d'abord) : `DemoContext` de `prisma/seed/demo/context.ts` avec
  `faker`, `now: Date`, `scale: number` (1 = complet), helpers de dates (`daysAgo(n)`,
  `daysFromNow(n)`), accès au client Prisma ; `createDemoContext(opts)` et les fonctions de
  seed du socle (comptes, organisations/évènements, inscriptions).
- Produces :
  - `loadWorld(ctx): Promise<DemoWorld>` avec
    `DemoWorld = { orgs: WorldOrg[]; staff: WorldUser[]; participants: WorldUser[] }`,
    `WorldOrg = { id; name; archived: boolean; owners: WorldUser[]; members: WorldUser[]; events: { id; title; date; archived; countable: number }[]; createdAt: Date }`
    (`countable` = inscriptions `PENDING` + `APPROVED`), `WorldUser = { id; email; name; staffRole: StaffRole | null }` ;
    les orgs sont triées par taille décroissante (somme de `countable`), puis par `id`.
  - `ensurePlans(): Promise<PlanCatalog>` avec `PlanCatalog = Record<"free" | "standard" | "pro" | "enterprise" | "partner" | "legacy", Plan>`.
  - `buildWorld(scale?: number): Promise<{ ctx: DemoContext; world: DemoWorld }>` dans
    `__tests__/helpers.ts` : exécute les modules du socle sur la base de test, facteur
    d'échelle réduit (≈ 0.05), sans toucher à `billing` ni `notifications`.
  - `seedBilling(ctx: DemoContext): Promise<void>` (signature du stub, inchangée).

- [ ] **Step 1: lire `context.ts`, `index.ts` et le plan du socle ; consigner dans la colonne
  Notes de la Progression les écarts avec les hypothèses ci-dessus (noms, signatures).** Adapter
  les Interfaces de ce plan avant d'écrire du code ; si le socle ne fournit pas ce qu'il faut
  (ex. aucune échelle, moins de 12 organisations), s'arrêter et le signaler.
- [ ] **Step 2: écrire `plans.test.ts` (échoue)** : `ensurePlans()` deux fois de suite ne crée
  qu'un jeu de plans (compte par nom) ; valeurs exactes :
  `free` (maxEvents 1, maxParticipantsPerEvent 100, MONTHLY, price null),
  `standard` = nom `Standard` (10 / 1000, MONTHLY, 15000),
  `pro` = `demo-pro` (30 / 5000, MONTHLY, 30000),
  `enterprise` = `demo-entreprise-annuel` (null / null, ANNUAL, 450000),
  `partner` = `demo-partenaire` (null / null, ANNUAL, price null),
  `legacy` = `demo-ancien-offre` (3 / 300, MONTHLY, 8000, `archived: true`).
  (`free` et `Standard` sont recréés s'ils manquent : la base de test est vidée avant chaque test.)
- [ ] **Step 3: écrire `world.test.ts`/helpers** : `buildWorld()` renvoie au moins 12
  organisations dont une archivée, des owners par org, du staff, des participants ; tri par taille.
- [ ] **Step 4: implémenter `ensurePlans` (`upsert` par `name`, `update: {}` sauf `archived`),
  `loadWorld` (requêtes sur `slug`/`name` préfixé `demo-` et `@demo.local`, comptage groupé des
  inscriptions), `buildWorld`.** Brancher `seedBilling` : `ensurePlans` puis les sous-modules
  (ajoutés aux tâches 2 et 3).
- [ ] **Step 5:** `make test FILE=prisma/seed/demo/billing/__tests__/plans.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat(seed-demo): plans de demo et lecture du monde pour la facturation`

### Task 2: Abonnements, rappels, quotas

**Files:**
- Create: `prisma/seed/demo/billing/scenarios.ts`, `prisma/seed/demo/billing/subscriptions.ts`,
  `prisma/seed/demo/billing/__tests__/subscriptions.test.ts`
- Modify: `prisma/seed/demo/billing.ts`

**Interfaces:**
- Consumes : `DemoWorld`, `PlanCatalog` (Task 1) ; `computeSubscriptionDates`, `PERIOD_DAYS`
  (`src/lib/subscription.ts`) ; `REMINDER_DAYS` (`src/lib/jobs/constants.ts`).
- Produces :
  - `SCENARIOS: Scenario[]` (`scenarios.ts`), `Scenario = { key: string; plan: keyof PlanCatalog; status: SubscriptionStatus; startDaysAgo: number; endInDays: number | null; scheduledPlan?: keyof PlanCatalog; reminders: number[]; overrides?: "near-limit" | "partner"; payments: PaymentSpec[] }` (`PaymentSpec` : type défini ici, consommé par la Task 3).
  - `assignScenarios(world: DemoWorld): { org: WorldOrg; scenario: Scenario }[]`.
  - `seedSubscriptions(ctx, world, plans): Promise<SeededSubscription[]>` avec
    `SeededSubscription = { subscriptionId; orgId; scenario: Scenario; startDate: Date; endDate: Date | null }`.

Scénarios (rang = position dans `world.orgs`, la plus grosse en premier ; l'organisation
archivée prend `archived-expired`, les autres suivent l'ordre du tableau) :

| Clé | Plan | Statut | Début / fin | Particularité |
|---|---|---|---|---|
| `big-annual` (rang 0) | enterprise | ACTIVE | −120 j / +245 j | ANNUAL, illimité |
| `monthly-renewed` | standard | ACTIVE | −45 j / +15 j | paiement IMMEDIATE puis EXTENSION |
| `expiring-7` | standard | ACTIVE | −24 j / +6 j | rappel J-7 envoyé |
| `expiring-1` | standard | ACTIVE | −29 j / +1 j | rappels J-7 et J-1 |
| `expired-renewable` | standard | EXPIRED | −39 j / −9 j | plan inchangé, rappels J-7 et J-1 envoyés |
| `downgrade-scheduled` | pro | ACTIVE | −10 j / +20 j | `scheduledPlan` = standard (SCHEDULED), pas de rappel |
| `trial` | free | ACTIVE | −10 j / +20 j | essai ; deux évènements actifs → dépassement de quota assumé |
| `trial-expired` | free | EXPIRED | −55 j / −25 j | essai terminé |
| `cancelled` | standard | CANCELLED | −20 j / +10 j | annulé par le staff |
| `partner-open` | partner | ACTIVE | −90 j / `null` | sans échéance, overrides 20 évènements / 5 000 participants, offert par le staff (pas de paiement) |
| `near-limit` | standard | ACTIVE | −8 j / +22 j | overrides à 90 % d'usage (voir ci-dessous) |
| `archived-expired` | legacy | EXPIRED | −150 j / −120 j | organisation archivée |

- [ ] **Step 1: écrire `subscriptions.test.ts` (échoue)** sur `buildWorld()` + `seedBilling` :
  chaque `SubscriptionStatus` présent ; `SubscriptionPeriod.MONTHLY` et `ANNUAL` présents
  (via `plan.period`) ; au moins un `scheduledPlanId` non nul ; au moins un `overrideMax*` non nul ;
  **toute** organisation (archivée comprise) a exactement une `Subscription` ; aucun `ACTIVE`
  avec `endDate <= ctx.now` ; `endDate - startDate` = `PERIOD_DAYS[plan.period]` pour les
  scénarios sans extension ni sans-échéance ; `SubscriptionReminder` : `expiring-7` a
  `daysBefore = 7`, `expiring-1` a `7` et `1`, chaque `daysBefore ∈ REMINDER_DAYS`, `endDate`
  du rappel = `endDate` de l'abonnement, `sentAt` ≈ `endDate − daysBefore` ; aucun rappel sur un
  abonnement `scheduledPlanId` non nul ; `EXPIRED` et `CANCELLED` ont `scheduledPlanId = null` ;
  quotas : pour tout abonnement `ACTIVE`, chaque évènement non archivé a `countable <=` limite
  effective participants et le nombre d'évènements non archivés `<=` limite effective
  d'évènements (override sinon plan), **sauf** l'org `trial` (dépassement délibéré, couvert par
  Task 6 via `QUOTA_BYPASS`) ; `near-limit` : plus gros évènement entre 85 % et 100 % de la
  limite participants et nombre d'évènements non archivés = limite évènements ; relancer
  `seedBilling` deux fois donne les mêmes lignes (comptes identiques).
- [ ] **Step 2: implémenter `scenarios.ts` (tableau ci-dessus en données) et
  `assignScenarios`** (déterministe, sans faker). `near-limit` :
  `overrideMaxParticipantsPerEvent = max(ceil(plusGrosEvenement / 0.9), plusGrosEvenement + 1)`,
  `overrideMaxEvents = nombre d'évènements non archivés` (au moins 1).
  Règle générale « ajustement » : pour tout autre scénario `ACTIVE` (hors `trial`), si l'usage
  dépasse le plan, poser des overrides égaux à l'usage plutôt que de laisser un dépassement.
- [ ] **Step 3: implémenter `seedSubscriptions`** : `upsert` par `orgId` ; dates via
  `computeSubscriptionDates(plan.period, début)` quand la fin suit la règle, sinon valeurs du
  scénario ; rappels en `createMany` avec `sentAt = endDate − daysBefore` jours.
- [ ] **Step 4:** test PASS (`make test FILE=prisma/seed/demo/billing/__tests__/subscriptions.test.ts`).
- [ ] **Step 5: Commit** `feat(seed-demo): abonnements de demo a chaque statut, rappels et quotas`

### Task 3: Paiements d'abonnement

**Files:**
- Create: `prisma/seed/demo/billing/payments.ts`, `prisma/seed/demo/billing/activity.ts`,
  `prisma/seed/demo/billing/__tests__/payments.test.ts`
- Modify: `prisma/seed/demo/billing.ts`

**Interfaces:**
- Consumes : `SeededSubscription[]`, `PaymentSpec` (Task 2) ; `planChangeFor`, `isRunning`
  (`src/lib/subscription-changes.ts`) ; `FEDAPAY_ID_BASE = 910_000_000`.
- Produces : `seedSubscriptionPayments(ctx, world, plans, subs): Promise<SeededPayment[]>`,
  `SeededPayment = { id; orgId; planId; status: PaymentStatus; mode: SubscriptionChangeMode | null; approvedAt: Date | null; createdAt: Date }` ;
  `writeBillingActivity(ctx, subs, payments): Promise<void>` (journal du domaine, voir ci-dessous).

`PaymentSpec = { plan: keyof PlanCatalog; status: PaymentStatus; mode?: SubscriptionChangeMode; daysAgo: number }`.
Jeu de paiements (en plus de ceux que l'abonnement impose : un `APPROVED` par abonnement à plan
payant ; aucun pour `free` et `partner`) :

| Scénario | Paiements |
|---|---|
| `big-annual` | APPROVED IMMEDIATE (−120 j) |
| `monthly-renewed` | APPROVED IMMEDIATE (−45 j), APPROVED EXTENSION (−20 j) |
| `expiring-7` | APPROVED IMMEDIATE (−24 j), DECLINED (−50 j) |
| `expiring-1` | APPROVED IMMEDIATE (−29 j) |
| `expired-renewable` | APPROVED IMMEDIATE (−39 j), CANCELED (−5 j) |
| `downgrade-scheduled` | APPROVED IMMEDIATE pro (−10 j), APPROVED SCHEDULED standard (−3 j) |
| `trial` | PENDING (−10 min, sans transaction) |
| `trial-expired` | EXPIRED (−24 j) |
| `cancelled` | APPROVED IMMEDIATE (−20 j) |
| `near-limit` | APPROVED IMMEDIATE (−8 j) |
| `archived-expired` | APPROVED IMMEDIATE (−150 j) |

- [ ] **Step 1: écrire `payments.test.ts` (échoue)** : les 5 `PaymentStatus` présents ; les 3
  `SubscriptionChangeMode` présents sur des `APPROVED` ; tous `purpose = SUBSCRIPTION`,
  `planId` non nul, `printRequestId` nul ; `amount = plan.price` ; `currency = "XOF"` ;
  `approvedAt` non nul **ssi** `APPROVED`, `mode` non nul **ssi** `APPROVED` ; `userId` = un OWNER
  de l'org ; `fedapayTransactionId` dans la plage réservée, unique, **nul pour `PENDING`** ;
  cohérence abonnement ↔ paiement : tout abonnement dont le plan a un `price` a au moins un
  `APPROVED` ; le dernier `APPROVED` `IMMEDIATE` a `approvedAt` = `startDate` de l'abonnement ;
  l'`EXTENSION` de `monthly-renewed` est antérieure à l'échéance initiale ; le paiement
  `SCHEDULED` de `downgrade-scheduled` vise le plan de `scheduledPlanId` ; aucun abonnement
  `ACTIVE` à plan payant sans paiement `APPROVED` (seul `partner`, sans prix, en est exempt) ;
  idempotence : deux exécutions, même nombre de paiements.
- [ ] **Step 2: implémenter `seedSubscriptionPayments`** : créer les paiements du jeu ci-dessus,
  `createdAt` à `ctx.now − daysAgo`, `approvedAt = createdAt + quelques minutes` ; `userId` = un
  owner (choisi par faker de `ctx`) ; `fedapayReference` factice `demo-<id>` ; `mode` de
  `APPROVED` calculé avec `planChangeFor` sur l'état de l'abonnement à la date du paiement
  (vérifie que les scénarios ci-dessus donnent bien les modes annoncés ; sinon corriger les
  dates du tableau, pas l'inverse).
- [ ] **Step 3: implémenter `writeBillingActivity`** (`createMany`, dates = celles des paiements /
  abonnements) : `PLAN_CREATED` (staff admin) pour chaque plan `demo-*` ; par paiement
  `PAYMENT_INITIATED`, puis `PAYMENT_APPROVED` (+ `SUBSCRIPTION_UPDATED` `details.source = "payment"`)
  ou `PAYMENT_FAILED` (DECLINED / CANCELED / EXPIRED) ; `SUBSCRIPTION_CREATED` pour chaque
  abonnement (par le staff pour `partner-open` et `trial`) ; `SUBSCRIPTION_UPDATED` par le staff
  pour `cancelled` et les overrides ; `QUOTA_BYPASS` pour l'org `trial` si elle a plus
  d'évènements actifs que `maxEvents`. `staffActor = true` quand l'acteur est staff et `orgId`
  renseigné. `targetId` = id du paiement ou de l'abonnement.
- [ ] **Step 4:** tests PASS ; `make test FILE=prisma/seed/demo/billing/__tests__/payments.test.ts`.
- [ ] **Step 5: Commit** `feat(seed-demo): paiements d'abonnement simules a chaque statut`

### Task 4: Jobs email de chaque statut

**Files:**
- Create: `prisma/seed/demo/notifications/jobs.ts`, `prisma/seed/demo/notifications/__tests__/jobs.test.ts`
- Modify: `prisma/seed/demo/notifications.ts` (stub → orchestration : jobs, notifications,
  journal, dans cet ordre)

**Interfaces:**
- Consumes : `DemoWorld`/`loadWorld` (Task 1) ; `EMAIL_KIND` (`src/lib/jobs/enqueue-email.ts`),
  `isSensitiveEmailKind`, `RETENTION_MS`, `STALE_LOCK_MS`, `EMAIL_PRIORITY_VALUE`
  (`src/lib/jobs/*`).
- Produces : `seedJobs(ctx, world): Promise<SeededJobs>` avec
  `SeededJobs = { failed: { id; kind; recipient: string; attempts: number }[]; cancelled: { id }[] }`
  (lu par les Tasks 5 et 6) ; `cleanupJobs()` (supprime les jobs dont `recipient` finit par
  `@demo.local`, appelé au début de `seedJobs`).

- [ ] **Step 1: écrire `jobs.test.ts` (échoue)** : les 5 `JobStatus` présents ; tout
  `recipient` finit par `@demo.local` et `payload.to` = `recipient` ; **aucun** job `PENDING`
  avec `runAt <= now + 365 jours` ; tout `RUNNING` a `lockedAt > now + 365 jours` et `lockedBy`
  non nul ; `SUCCEEDED` : `completedAt` renseigné (< 25 jours), `payload.html = ""` (purgé),
  `attempts >= 1` ; `FAILED` : `attempts = maxAttempts = 5`, `lastError` non vide ≤ 2000
  caractères, `completedAt` renseigné ; `CANCELLED` : `completedAt` renseigné ; jamais de
  `kind` sensible (`isSensitiveEmailKind`) en `PENDING` avec HTML en clair non vide hors
  `@demo.local` ; `kind` ∈ `EMAIL_KIND` ou `notification.<type en minuscules>` ; priorité
  `high` (10) pour les kinds sensibles ; au moins un `PENDING` avec `attempts > 0` (en attente
  d'un nouvel essai) ; deux exécutions : même nombre de jobs de démo.
- [ ] **Step 2: implémenter `seedJobs`** : ≈ 60 jobs à `scale = 1` (minimum 12 pour couvrir les
  statuts), répartis `SUCCEEDED` 55 %, `FAILED` 15 %, `PENDING` 15 %, `CANCELLED` 10 %,
  `RUNNING` 5 % ; destinataires tirés dans `world` (participants, owners, staff) ; sujets et
  `kind` réalistes (inscription reçue / approuvée, invitation, vérification email,
  notification abonnement) ; `PENDING` : `runAt = now + 3650 jours` ; `RUNNING` :
  `lockedAt = now + 3650 jours`, `lockedBy = "demo-worker"`, `runAt` identique ; `html` court
  généré localement (`escapeHtml` de `src/lib/mail-helpers.ts`), jamais d'URL réelle.
- [ ] **Step 3:** tests PASS ; `make test FILE=prisma/seed/demo/notifications/__tests__/jobs.test.ts`.
- [ ] **Step 4: Commit** `feat(seed-demo): jobs email de chaque statut sans envoi possible`

### Task 5: Notifications de chaque type hors impression

**Files:**
- Create: `prisma/seed/demo/notifications/notifications.ts`,
  `prisma/seed/demo/notifications/__tests__/notifications.test.ts`

**Interfaces:**
- Consumes : `DemoWorld`, `SeededJobs` (Task 4) ; abonnements, rappels et paiements relus en
  base ; constructeurs de `src/lib/notifications/messages.ts` (`registrationCreatedMessage`,
  `subscriptionChangedMessage`, `subscriptionExpiringMessage`, `quotaExceededMessage`,
  `emailFailedMessage`, etc.) et `ROLE_LABELS`.
- Produces : `seedNotifications(ctx, world, jobs): Promise<void>`.

- [ ] **Step 1: écrire `notifications.test.ts` (échoue)** : chaque `NotificationType` hors
  `PRINT_REQUEST_SUBMITTED`, `PRINT_REQUEST_QUOTED`, `PRINT_REQUEST_MESSAGE`,
  `PRINT_REQUEST_STATUS_CHANGED` présent (18 types), aucun type `PRINT_*` créé par ce lot ; les 4
  `NotificationScope` présents ; lues **et** non lues pour au moins 5 types ; au moins un
  utilisateur avec plus de 20 non lues (pagination, `NOTIFICATIONS_PAGE_SIZE`) ; `readAt >= createdAt`,
  `createdAt` entre `now − 60 j` et `now` ; `links[0].href = href` ; cohérence de portée :
  `PLATFORM` → destinataire `isStaff`, `ORG` → `orgId` renseigné et destinataire membre de l'org
  (OWNER pour les types abonnement), `EVENT` → `eventId` et `orgId` renseignés et destinataire
  titulaire d'un rôle sur l'évènement ou membre de l'org, `PARTICIPANT` → destinataire
  participant ; aucun destinataire `blocked` ou `archived` ; `EMAIL_FAILED` : `href` pointe
  `/platform/jobs/<id>` d'un job `FAILED` existant, destinataire staff ; `SUBSCRIPTION_EXPIRING` :
  une notification par `SubscriptionReminder` existant, destinataires OWNER de l'org, titre
  contenant le délai ; `SUBSCRIPTION_CHANGED` : une par paiement `APPROVED` (OWNER portée ORG
  + staff portée PLATFORM) ; `QUOTA_EXCEEDED` : pour l'org en dépassement délibéré ; aucune
  notification n'existe pour un utilisateur supprimé (FK) ; deux exécutions : mêmes comptes.
- [ ] **Step 2: implémenter `seedNotifications`** : un générateur par type, qui choisit un
  contexte réel dans `world` (inscription, évènement, membre) et construit le contenu via le
  constructeur de `messages.ts` correspondant (mêmes `title`/`body`/`href`/`links` que
  l'application, `links = [{label: primaryLabel, href}, ...links]`) ; insertion `createMany` par
  lots de 1000 ; `readAt` renseigné pour ≈ 60 % (`createdAt` + 5 min à 3 jours, jamais après
  `now`), `createdAt` étalé sur 60 jours ; volume ≈ 400 à `scale = 1` (minimum de couverture à
  `scale` réduit) dont un staff et un owner de la grosse org très servis ; ne pas insérer de
  `Job` ici (les emails associés sont déjà dans les jobs de la Task 4).
- [ ] **Step 3:** tests PASS ; `make test FILE=prisma/seed/demo/notifications/__tests__/notifications.test.ts`.
- [ ] **Step 4: Commit** `feat(seed-demo): notifications de chaque type hors impression`

### Task 6: Journal d'activité

**Files:**
- Create: `prisma/seed/demo/notifications/activity.ts`,
  `prisma/seed/demo/notifications/__tests__/activity.test.ts`

**Interfaces:**
- Consumes : `DemoWorld`, `SeededJobs` ; inscriptions, évènements, membres relus en base ;
  `logKind`, `ActivityType` (`src/lib/activity-labels.ts`) ; journal déjà écrit par la Task 3.
- Produces : `seedActivity(ctx, world, jobs): Promise<void>` ;
  `cleanupActivity()` (supprime les entrées de démo non liées au domaine d'impression : `orgId`
  d'une org `demo-*` ou `userId` d'un `@demo.local`, hors types `PRINT_*`) appelé au début du
  module, **avant** l'écriture de la Task 3 dans l'ordre d'exécution (l'orchestrateur appelle
  donc `cleanupActivity` en tête de `seedBilling` — à régler dans `billing.ts`).

Couverture visée : tous les types hors `PRINT_*`, sauf ceux justifiés dans une liste
`ACTIVITY_NOT_SEEDED` (constante exportée, commentée) du module ; types principaux détaillés :
auth/compte (`USER_LOGIN`, `USER_REGISTERED`, `USER_EMAIL_VERIFIED`, `USER_PASSWORD_RESET_*`,
`USER_BLOCKED`/`UNBLOCKED`, `USER_PROFILE_UPDATED`), organisations (`ORG_*` dont `ORG_ARCHIVED`
pour l'org archivée), membres (`MEMBERSHIP_ADDED`/`REMOVED`/`ROLE_CHANGED`), évènements
(`EVENT_*`, ouverture/fermeture des inscriptions), inscriptions (`REGISTRATION_*`,
`BADGE_PRINTED`, `BADGE_BATCH_PRINTED`, `BADGE_EXPORTED`, `BADGE_SCANNED`), profils
(`PROFILE_*`, `REJECTION_REASON_*`), catégories, blocages plateforme, templates de badge,
paramètres, jobs (`JOB_RETRIED`, `JOB_CANCELLED` pour les jobs `CANCELLED`).

- [ ] **Step 1: écrire `activity.test.ts` (échoue)** : tout `ActivityType` hors `PRINT_*` et
  hors `ACTIVITY_NOT_SEEDED` présent (et `ACTIVITY_NOT_SEEDED` ne contient que des types
  réellement absents) ; aucun `PRINT_*` écrit par ce lot ; dates entre `now − 180 j` et `now`,
  étalées (au moins 20 jours distincts), jamais antérieures à la création de l'entité visée
  (`targetId` d'inscription, org, évènement, utilisateur) ; chaque inscription `APPROVED` a un
  `REGISTRATION_APPROVED`, chaque `REJECTED` un `REGISTRATION_REJECTED`, chaque inscription un
  `REGISTRATION_CREATED` (`targetId` = id, `eventId`/`orgId` renseignés) ; chaque inscription
  `badgePrinted = true` a **exactement un** `BADGE_PRINTED` (si le lot 2a en a déjà écrit un,
  ne pas en ajouter) ; `staffActor = true` ssi l'auteur est staff et `orgId` renseigné ;
  `ipAddress` et `userAgent` renseignés pour `USER_LOGIN` ; l'org archivée a `ORG_ARCHIVED` ;
  chaque `EventMembership` / `OrgMembership` a un `MEMBERSHIP_ADDED` ; chaque utilisateur
  `blocked` a un `USER_BLOCKED` ; chaque job `CANCELLED` a un `JOB_CANCELLED` ; aucune
  `details` ne contient de mot de passe, jeton ou hash ; deux exécutions : mêmes comptes.
- [ ] **Step 2: implémenter `seedActivity`** : génération par domaine à partir de l'état réel de
  la base, `createMany` par lots de 1000 ; pour les inscriptions, entrées de cycle de vie pour
  toutes (≈ 3 par inscription au plus) à `scale` complet ; connexions (`USER_LOGIN`) pour un
  échantillon d'utilisateurs, plusieurs par jour ; `details` JSON minimal et réaliste
  (`{ categoryName }`, `{ reason }`, `{ from, to }`) ; au moins une entrée par type listé
  ci-dessus, avec acteur approprié (staff pour paramètres, owner pour membres…).
- [ ] **Step 3: brancher dans `notifications.ts`** (`seedJobs` → `seedNotifications` →
  `seedActivity`) et régler l'appel de `cleanupActivity` dans `billing.ts`.
- [ ] **Step 4:** `make test FILE=prisma/seed/demo/notifications/__tests__/activity.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(seed-demo): journal d'activite etale hors impression`

### Task 7: Vérification

- [ ] **Step 1: test de bout en bout du lot** (`prisma/seed/demo/notifications/__tests__/lot2b.test.ts`) :
  `buildWorld()` puis `seedBilling` puis `seedNotificationsAndActivity`, deux fois de suite ;
  vérifier : aucun abonnement `ACTIVE` sans paiement `APPROVED` (hors plan sans prix), aucun
  job `PENDING`/`RUNNING` exécutable avant `now + 365 j`, aucun paiement `PENDING` avec
  transaction, aucune ligne de ce lot avec une date postérieure à `now` (hors échéances,
  `runAt`, `lockedAt`), mêmes comptes après la 2e exécution, et qu'aucun `Notification`/`Job`/
  `ActivityLog` n'a été créé par `fakeExporter`/mail (aucun appel externe).
- [ ] **Step 2: dans le worktree** : `make lint && make typecheck && make test-coverage` ; les
  gates 100 % de `src/lib/**` et `src/app/api/**` restent vertes (ce lot ne touche pas `src/`).
- [ ] **Step 3: seed réel dans le worktree** : `make db-seed` puis `make db-seed-demo` ; mesurer
  la durée des modules `billing` et `notifications` (cible : quelques secondes à < 1 min) ; vérifier
  par requêtes : comptes par statut d'abonnement, de paiement, de job, par type de
  notification et par type d'activité.
- [ ] **Step 4: contrôle navigateur** (stack du worktree, `http://localhost:<AGENT_APP_PORT>`,
  mot de passe commun de démo) à **375 px et 1280 px** : (a) abonnement d'une organisation en
  `EXPIRED` puis en `ACTIVE` proche de l'échéance (propriétaire de l'org : onglet Abonnement,
  statut, plan, dates, rappels, historique de paiements) ; (b) notifications d'un owner et du
  staff (liste lues/non lues, pagination au-delà de 20, liens fonctionnels dont `EMAIL_FAILED`
  vers `/platform/jobs/<id>`) ; (c) journal staff `/platform/…` (liste étalée, filtres par type,
  entrées lisibles avec libellés) et `/platform/jobs` (5 statuts, aperçu d'un job) ; aucune
  erreur console, aucun débordement horizontal.
- [ ] **Step 5:** mettre à jour la Progression (statuts, dates, notes). Rapport : fichiers
  touchés, résultats (lint, typecheck, couverture, durées, captures), hypothèses du socle
  corrigées, plage `fedapayTransactionId` réservée ; prêt à fusionner.
