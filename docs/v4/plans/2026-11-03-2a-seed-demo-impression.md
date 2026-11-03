# Vague 2 · Lot 2a — Seed de démo : impression — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2b et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2a feat/seed-demo`, branche `feat/seed-demo-2a`. Toutes les
> commandes `make` se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`.
> En exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche
> du plan (voir la spec, « Organisation du travail ») ; sinon aucun commit sans demande explicite.
> Pas de mention de co-auteur IA dans les commits ; messages en français ASCII, style conventional commits.

**Objectif :** remplir le domaine impression de la démo : catalogue, commandes aux 10 statuts et
aux 2 types avec conversation, non-lus, devis multi-versions, crédits, paiements, impression sur
place, planches (avec PDF), notifications et journal d'activité du domaine.

**Architecture :** `seedPrint(ctx)` (`prisma/seed/demo/print.ts`) orchestre des modules de
`prisma/seed/demo/print/`. Les **cas vitrine** (un par statut et par type, rejoués étape par
étape) passent par les fonctions de `src/lib/print-requests/**` et `src/lib/print-sheets/**` ; le
**volume** (commandes des organisations moyennes et grosses) s'écrit en direct (`createMany`) avec
la même cohérence (totaux = somme des lignes, réservations d'inscriptions, références uniques).
Les horodatages sont ramenés dans le passé après coup (`backdate`), car les fonctions du domaine
écrivent `new Date()`.

**Tech Stack :** Prisma 6 (client `@prisma/client`), `@faker-js/faker` (via `ctx.faker`), `pdf-lib`,
`jszip`, Vitest 4 sur la base `badge_<lot>_test`.

**Spec :** [`specs/2026-11-03-37-v4-seed-de-demo.md`](../specs/2026-11-03-37-v4-seed-de-demo.md)
(« Précisions » et « Organisation du travail » font autorité). Socle :
[`2026-11-03-1-socle-seed-demo.md`](2026-11-03-1-socle-seed-demo.md). Audit :
`.superpowers/sdd/seed-demo/audit.md`. Docs métier : `docs/v4/features/impression-demandes.md`,
`impression-planches.md`, `impression-sur-place.md`, `catalogue-impression.md`.

## Amendements (relecture croisée de l'orchestrateur, 2026-11-03)

Le contrat du socle est figé dans `2026-11-03-1-socle-seed-demo.md` (« Contrats figés ») ; il prime
sur les hypothèses de ce plan :
- `print.ts` exporte `seedPrint(ctx: DemoContext)` **et** `cleanupPrint(ctx: DemoContext)`, tous deux
  appelés par `prisma/seed/demo/index.ts` (le nettoyage avant tous les seeds). Pas de `PrintState`
  passé de l'extérieur : un état local reste possible à l'intérieur du module.
- Fichiers : clés du code (planches, pièces jointes, images de produits) via
  `ctx.storage.putAt(key, …)`, qui les suit pour le nettoyage (manifeste du socle) ; pas de
  `trackKey` local. Autres fichiers : `ctx.storage.put` (sous `demo/`).
- Dates et jobs : `ctx.backdate(...)` et `ctx.parkJobs(...)` du socle (pas de copie locale).
- Registres : noms exacts du socle (`ctx.registry.orgsBySize`, `eventsByPhase`, `registrations`…).
- Journal : ce lot écrit les activités du domaine impression (`PRINT_*` et apparentées) ; il
  n'écrit **aucun** `BADGE_PRINTED` ni `BADGE_*` (lot 2b).
- `fedapayTransactionId` : plage `920_000_000`–`929_999_999` (2b a `910_000_000`–`919_999_999`).
- `registry.orgMembers` / `registry.eventMembers` ne couvrent que les organisations et événements qui ont des comptes membres (4 organisations sur 12 ; 4 événements avec `EventMembership`). Ne jamais supposer `orgMembers.get(org.id)?.OWNER[0]` : utiliser `?.` et prévoir un repli (staff de démo, ou création du membre manquant dans le lot).
- `registry.events` / `eventsByPhase.past` contiennent des événements archivés (et `demo-archivee` ses inscriptions PENDING) : filtrer `!event.archived` et `!org.archived` pour toute action « ouverte » (commande d'impression, ...), ou assumer le cas comme vitrine d'archive.
- Slugs d'événement : ne jamais les reconstruire à la main (réalité `demo-grosse-org-past-1`, pas `demo-<org>-<événement>`) ; utiliser `DemoEvent.slug`.
- `DemoRegistrationRef` ne porte ni dates, ni `allAccessGranted`, ni `badgePrintedAt` : relire les lignes en base.
- Stockage : lister les préfixes de clés utilisés (`print-sheets/`, `print-requests/`, images produit) ; toute écriture passe par `ctx.storage.putAt` (suivi du manifeste). Les templates supplémentaires passent par `installDemoTemplate` (famille `demo-*`) pour rester dans le périmètre du nettoyage.
- `PrintRequestPrint` n'a ni `createdAt` ni `updatedAt` : `ctx.backdate("printRequestPrint", ...)` lève toujours. Écrire `printedAt` directement à la création et ne pas appeler `backdate` pour ce modèle.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Contrat du socle, helpers, nettoyage et catalogue | [x] | 2026-11-03 | `DemoContext` reel : OrgSize = `huge` (pas `large`), `ctx.dates.*`, `ctx.storage.putAt`. `PrintState` local (cles suivies par le manifeste du socle). `cleanupPrint` supprime aussi notifications, jobs et journaux du domaine. Test = un seul `it` par fichier (reset global avant chaque test). |
| 2 | Commandes vitrine : cycle de vie et devis multi-versions | [x] | 2026-11-03 | 25 scenarios (`scenarios.ts`), horodatages ramenes par `timeline.ts` (`retimeRequest`, fenetre bornee par l'evenement). Hooks de cycle (`ScenarioHooks`) pour la conversation et les planches. Proprietaire manquant cree (`owner.<slug>@demo.local`). `payments.ts` et `onsite.ts` livres des cette tache (necessaires au cycle). |
| 3 | Conversation, pièces jointes, notes internes et non-lus | [ ] | | |
| 4 | Paiements, crédits et impression sur place | [ ] | | |
| 5 | Planches : gabarits, générations et PDF | [ ] | | |
| 6 | Volume, notifications, journal d'activité et orchestration | [ ] | | |
| 7 | Vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables : `prisma/seed/demo/print.ts`, `prisma/seed/demo/print/**` (dont
`prisma/seed/demo/print/__tests__/**`).
**En lecture seule** : `prisma/seed/demo/context.ts` et `index.ts` (contrats du socle),
`src/lib/**`, `src/test/**`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seed/minimal.ts`,
`Makefile`, `docker-compose*.yml`. Besoin d'y toucher → s'arrêter et le signaler (NEEDS_CONTEXT).

## Global Constraints

- Tests : base de test dédiée (`badge_2a_test`, jamais une base de dev, le garde-fou de
  `src/test-setup.ts` refuse le reste), **pas de mock de la base ni de Prisma**, données préparées
  avec les fabriques de `src/test/factories.ts` quand le test a besoin de données propres ;
  `DemoContext` construit avec un **facteur d'échelle réduit**. Seuls les services externes se
  mockent (aucun n'est appelé ici).
- **Ne jamais modifier le code de production** (`src/**` hors `__tests__`) pour faire passer un test :
  s'arrêter et demander.
- Aucun appel externe : ni FedaPay (paiements simulés en base), ni SMTP, ni renderer. Les jobs
  d'email créés par les notifications du domaine sont mis en attente à `runAt` lointain (task 6).
- `@faker-js/faker` via `ctx.faker` (graine fixe) : le seed est reproductible, jamais de `Math.random`
  ni de `Date.now()` hors `ctx.now`.
- Dates relatives à `ctx.now` ; stockage via `src/lib/storage.ts` (`uploadFile`) ; images petites,
  prises dans la réserve du contexte, PDF minimaux `pdf-lib`.
- **Clés de fichiers** : celles du code, car `/api/files` classe l'accès par préfixe
  (`print-sheets/…` staff seulement, `print-requests/<eventId>/…` et `print-requests/staff/<requestId>/…`
  pièces jointes). Les images du catalogue (publiques) vont sous `demo/platform/print-products/`.
  Toute clé hors `demo/` est enregistrée pour le nettoyage (task 1).
- Idempotence : `seedPrint` supprime d'abord ce qu'il a créé hors cascade d'organisation
  (`PrintProduct.slug` préfixé `demo-`, `PrintSheetLayout.name` préfixé `Démo `, fichiers enregistrés).
- Mot de passe, comptes, organisations, évènements, inscriptions : fournis par le socle, jamais créés ici.
- Soft delete : produits, options, valeurs et gabarits archivés présents.
- Textes de démo en français avec accents ; identifiants en anglais.

## Review Focus

- Un non-lu **organisateur** ne compte jamais une note interne (`internal = true`) ni une entrée
  dont l'organisateur est l'auteur ; le même fil donne un nombre plus grand côté staff.
- Une inscription n'est dans qu'une seule commande réservante par évènement
  (`RESERVING_STATUSES` : tout sauf DRAFT, REJECTED, CANCELLED) ; seules des inscriptions `APPROVED`
  sont liées.
- `total` = somme des lignes actives ; `acceptedTotal` = `total` de la version acceptée ;
  `quoteVersion` = nombre de `QUOTE_SENT` du fil ; une commande `PAID` et au-delà a `paidAt`
  et (si en ligne) `paidPaymentId` pointant un `Payment` `APPROVED` de même montant.
- Un fichier référencé (`attachmentKey`, `PrintProductImage.storageKey`, `imageKey`, `fileKey`)
  existe dans le stockage ; une génération `FAILED`, `PENDING` ou `RUNNING` n'a pas de `fileKey`.
- Relancer `seedPrint` sans reset ne double ni produits, ni commandes, ni fichiers orphelins.
- Un devis couvert par le crédit (total 0) existe et passe `PAID` sans paiement (`byCredit`).

---

### Task 1: Contrat du socle, helpers, nettoyage et catalogue

**Files:**
- Create: `prisma/seed/demo/print/helpers.ts`, `prisma/seed/demo/print/catalog.ts`,
  `prisma/seed/demo/print/__tests__/helpers.ts` (contexte de test), `prisma/seed/demo/print/__tests__/catalog.test.ts`
- Modify: `prisma/seed/demo/print.ts` (remplace le stub)

- [ ] **Step 1 : lire `prisma/seed/demo/context.ts` et `index.ts`, et le plan du socle
  (`2026-11-03-1-socle-seed-demo.md`).** Relever les noms exacts : générateur faker, `now`,
  helpers de dates (`daysAgo`/`daysFromNow` ou équivalent), écriture de fichier sous `demo/`,
  réserve d'images, registres (organisations par taille, évènements par phase, utilisateurs par
  rôle, inscriptions par évènement et statut), `recordAccount`, facteur d'échelle. Si le contrat
  diffère de celui supposé ci-dessous, **adapter les signatures de ce plan** avant de coder et noter
  l'écart dans la colonne Notes. Contrat supposé :
  `ctx.faker`, `ctx.now: Date`, `ctx.scale: number`, `ctx.daysAgo(n): Date`,
  `ctx.storage.put(key, body, contentType): Promise<string>` (clé rangée sous `demo/` si elle n'est
  pas déjà une clé du code, voir Global Constraints), `ctx.images.pick(): { body: Buffer; contentType: string; ext: string }`,
  `ctx.orgs.bySize('large' | 'medium' | 'small' | 'archived')`, `ctx.events.byPhase(…)`,
  `ctx.users.byRole(…)`, `ctx.registrations.of(eventId, status)`, `ctx.recordAccount(email, role, case)`.
  Vérifier aussi si le socle enregistre les clés hors `demo/` pour le nettoyage ; sinon prévoir
  `trackKey(key)` dans `helpers.ts` (liste dans `ctx`-extension locale `PrintState`) et le signaler
  au lot socle dans les Notes.
- [ ] **Step 2 : test d'abord (`catalog.test.ts`).** Sur `seedCatalog(ctx, state)` avec un contexte de
  test : au moins un `PrintProduct` `demo-*` de chaque `PrintProductKind` (dont `BADGE` avec paliers
  `PrintProductPriceTier`) ; des options de **chaque** `PrintOptionType` (CHOICE, MULTI_CHOICE, COLOR,
  TEXT, FILE, QUANTITY_SPLIT) avec valeurs ; un produit publié, un non publié, un archivé
  (`archived`+`archivedAt`) ; une option et une valeur archivées ; chaque `PrintProductImage.storageKey`
  et chaque `imageKey` de valeur répond à `getFile` ; relancer deux fois laisse le même nombre de
  produits `demo-*`.
- [ ] **Step 3 : lancer le test, il échoue.** `make test` ciblé :
  `yarn vitest run prisma/seed/demo/print/__tests__/catalog.test.ts` dans le worktree (via le conteneur,
  voir `make test` pour la forme exacte). Attendu : échec « seedCatalog is not defined ».
- [ ] **Step 4 : `helpers.ts`.** Exporter `type PrintState` (clés de fichiers à nettoyer, produits
  par rôle `{ badge: PrintProduct[]; accessories: PrintProduct[] }`, `staff` et acteurs résolus,
  fenêtre de départ `startedAt: Date`), `cleanupPrint(state)` (supprime `PrintProduct demo-%`
  — cascade images, paliers, options, valeurs —, `PrintSheetLayout` `Démo %`, fichiers suivis via
  `deleteFile`), `backdate(requestId, at: Date)` (met `createdAt`/`updatedAt` des messages, lignes,
  `submittedAt`… cohérents ; signature détaillée en task 2), `trackKey`, `png()`/`pdf()` qui
  fabriquent un petit fichier via la réserve d'images ou `pdf-lib`.
- [ ] **Step 5 : `catalog.ts`.** `seedCatalog(ctx, state): Promise<void>` : ≥ 3 produits BADGE
  (support standard, premium, cordon intégré) avec paliers dégressifs et options (matière CHOICE,
  finition MULTI_CHOICE, couleur de cordon COLOR, texte à imprimer TEXT avec `maxLength` et
  `priceDelta`, fichier de maquette FILE avec `priceDelta`, répartition par taille QUANTITY_SPLIT) ;
  ≥ 4 accessoires `demo-*` (les 5 accessoires du seed minimal restent intacts) dont un non publié et
  un archivé ; 1 à 3 images par produit prises dans la réserve, écrites sous
  `demo/platform/print-products/<uuid>.<ext>` (forme de `PRODUCT_IMAGE_KEY` du code) ; `position`
  continues, valeurs avec `colorHex`/`imageKey` pour les options COLOR.
- [ ] **Step 6 : `print.ts`.** `export async function seedPrint(ctx: DemoContext): Promise<void>` :
  crée le `PrintState`, appelle `cleanupPrint` puis `seedCatalog` (les tasks suivantes ajoutent leurs
  appels dans l'ordre : catalogue → sheets layouts → commandes → conversation → paiements → planches
  → volume → notifications).
- [ ] **Step 7 : relancer le test, il passe ; commit** `feat(seed-demo): catalogue d'impression de demo`.

---

### Task 2: Commandes vitrine : cycle de vie et devis multi-versions

**Files:**
- Create: `prisma/seed/demo/print/scenarios.ts`, `prisma/seed/demo/print/orders.ts`,
  `prisma/seed/demo/print/__tests__/orders.test.ts`
- Modify: `prisma/seed/demo/print/helpers.ts` (`backdate`), `prisma/seed/demo/print.ts`

**Interfaces:**
- Consumes: `PrintState`, `seedCatalog` (task 1) ; `createDraft`, `setOrganizerProducts`, `setBadges`,
  `updateDetails` (`content.ts`), `submitRequest`, `acceptQuote`, `cancelRequest` (`lifecycle.ts`),
  `addStaffLine`, `updateStaffLine`, `removeStaffLine`, `sendQuote`, `reopenQuote`, `rejectRequest`,
  `advanceStatus` (`quote.ts`).
- Produces: `type Scenario = { key: string; type: PrintRequestType; target: PrintRequestStatus; org: 'large'|'medium'|'small'; phase: EventPhase; delivery?: PrintDelivery; quoteVersions: 1|2|3; badgeCount: number; extras: ('SERVICE'|'DISCOUNT'|'CUSTOM'|'CREDIT')[]; timeline: Record<string, number> /* jours avant ctx.now par étape */ }` ;
  `SCENARIOS: Scenario[]` ; `runScenario(ctx, state, s): Promise<{ requestId: string }>` ;
  `seedShowcaseOrders(ctx, state): Promise<Map<string, string>>` (clé de scénario → id de commande) ;
  `backdate(requestId: string, steps: Record<string, Date>): Promise<void>`.

- [ ] **Step 1 : tests (`orders.test.ts`)** sur `seedShowcaseOrders` : chaque `PrintRequestStatus`
  (les 10) présent au moins une fois et chaque `PrintRequestType` ; pour toute commande vitrine
  `total` = somme des `lineTotal` des lignes `removedAt = null` ; `quoteVersion` = nombre d'entrées
  `QUOTE_SENT` ; au moins une commande à `quoteVersion = 3` ; les lignes couvrent `PRODUCT`,
  `SERVICE`, `DISCOUNT`, `CUSTOM`, avec au moins une ligne `removedAt` non nul et une ligne
  `usesOrgCredit` ; `acceptedTotal` = total de la version acceptée pour les statuts ACCEPTED et
  au-delà ; chaque `PrintRequestItem` vise une inscription `APPROVED` du même évènement et une
  inscription n'apparaît que dans une commande réservante ; les deux modes `PICKUP` et `DELIVERY`
  présents ; une commande ayant un `parentRequestId` ; relancer `seedPrint` ne double pas les commandes.
- [ ] **Step 2 : échec attendu** (`seedShowcaseOrders` absent).
- [ ] **Step 3 : `scenarios.ts`** : tableau d'environ 20 scénarios. ADVANCE : DRAFT, SUBMITTED, QUOTED
  (v3 après deux allers-retours organisateur/staff), ACCEPTED, PAID, IN_PRODUCTION, READY, COMPLETED,
  REJECTED, CANCELLED (depuis ACCEPTED), livraison `DELIVERY` (adresse et contact) et `PICKUP` ;
  ONSITE : SUBMITTED, QUOTED, PAID, IN_PRODUCTION, READY, COMPLETED (clôture, task 4), plus une
  complémentaire (`parentRequestId`). Répartir sur les évènements passés, en cours et à venir
  (ONSITE sur un évènement en cours ou passé, ADVANCE sur le futur proche) et sur 3 organisations.
- [ ] **Step 4 : `runScenario`** : rejoue le cycle par les fonctions du domaine, avec un acteur
  organisateur (OWNER de l'organisation, requis par `acceptQuote`) et un acteur staff
  (`STAFF_ADMIN`, requis par `markPaidManually`) pris dans les registres du contexte. Ordre :
  `createDraft` → `setOrganizerProducts` (une ligne BADGE de quantité = badges + accessoires avec
  choix valides) → `setBadges` (mode IDS sur des inscriptions `APPROVED` encore libres ; ONSITE :
  `updateDetails` avec quantité estimée, créneaux, lieu, contact) → `updateDetails` (livraison) →
  `submitRequest` → lignes staff (`addStaffLine` SERVICE, DISCOUNT, CUSTOM ; `removeStaffLine` pour
  une ligne retirée) → `sendQuote` (puis, pour v2 et v3, modification organisateur via
  `setOrganizerProducts`, retour `SUBMITTED`, ajustement et `sendQuote` de nouveau) → `acceptQuote` →
  paiement (task 4) → `advanceStatus` ; `rejectRequest` / `cancelRequest` pour les cas terminaux.
  S'arrêter au `target`. Les statuts PAID et au-delà sont complétés par la task 4 via le hook
  `settleOrder(ctx, state, requestId, s)` (stub `no-op` ici, rempli en task 4).
- [ ] **Step 5 : `backdate`** : après le cycle, ramener `PrintRequest.{createdAt,submittedAt,quotedAt,
  acceptedAt,paidAt,completedAt,cancelledAt}`, `PrintRequestMessage.createdAt` (dans l'ordre existant,
  espacés selon `timeline`), `PrintQuoteLine.createdAt` et `Notification.createdAt` dont le `href`
  contient l'id de la commande, par `updateMany`/SQL, sans jamais dépasser `ctx.now`.
- [ ] **Step 6 : tests verts ; commit** `feat(seed-demo): commandes d'impression vitrine`.

---

### Task 3: Conversation, pièces jointes, notes internes et non-lus

**Files:**
- Create: `prisma/seed/demo/print/conversation.ts`, `prisma/seed/demo/print/__tests__/conversation.test.ts`
- Modify: `prisma/seed/demo/print.ts`

**Interfaces:**
- Consumes: `seedShowcaseOrders` (task 2) ; `postMessage`, `appendThreadEvent` (`thread.ts`),
  `markRead`, `unreadByRequest`, `countOrdersWithUnread` (`read-state.ts`), `listThread`.
- Produces: `seedConversations(ctx, state, orders: Map<string, string>): Promise<void>`.

- [ ] **Step 1 : tests (`conversation.test.ts`)** : au moins une commande avec des messages
  `ORGANIZER` et `STAFF`, une avec `kind = EVENT` et `side = SYSTEM`, une avec `attachmentKey` côté
  organisateur (`print-requests/<eventId>/…`) et une côté staff (`print-requests/staff/<requestId>/…`),
  chaque `attachmentKey` répond à `getFile` ; au moins une note `internal = true` (staff uniquement,
  jamais `side = ORGANIZER`) ; non-lus : une commande avec `unreadByRequest(staffUser, "STAFF", …) > 0`
  et une avec `unreadByRequest(organizerUser, "ORGANIZER", …) > 0`, une entièrement lue des deux côtés ;
  sur une commande contenant une note interne postérieure à la dernière lecture de l'organisateur,
  le compte organisateur est strictement inférieur au compte staff et **ne compte aucune note
  interne** (comparer à `listThread(id, "ORGANIZER")`) ; `countOrdersWithUnread` cohérent avec la
  somme par commande ; aucune conversation sur une commande `DRAFT`.
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : `seedConversations`** : par scénario non-DRAFT, un fil scénarisé en français
  (questions sur les délais, demande de maquette, confirmation de livraison, précision sur la
  quantité) via `postMessage` pour les messages (`side` et auteur réels : l'organisateur de l'org, un
  staff `STAFF_SUPPORT`/`STAFF_ADMIN`), notes internes `internal: true`
  (« Vérifier le stock de cordons »), pièces jointes (petit PNG/PDF écrit sous la clé stricte
  attendue par `postMessage`, nom `demo-<n>.<ext>`, clé suivie pour le nettoyage), et événements
  automatiques déjà produits par le cycle (task 2) complétés par `appendThreadEvent` pour les types
  absents (`REGISTRATIONS_SKIPPED`, `ORG_CREDIT_APPLIED`, `TEMPLATE_CHANGED`, `BADGES_CHANGED`,
  `ONSITE_MARGIN_CHANGED` avec `internal: true` côté staff). Horodatages : après le dernier événement du
  cycle ou entre, via `backdate` (ordre croissant strict, `createdAt` distincts).
- [ ] **Step 4 : lectures** `PrintRequestRead` (via `markRead(requestId, userId, at)`) selon un plan
  de scénarios : (a) lu partout, (b) staff n'a pas lu le dernier message organisateur, (c) organisateur
  n'a pas lu la dernière réponse staff, (d) organisateur n'a pas lu une note interne postérieure
  (reste à 0 pour lui), (e) jamais ouvert par l'organisateur. Utiliser les utilisateurs de rôle
  staff et organisateur **réellement connectables** (enregistrés via `recordAccount` par le socle).
- [ ] **Step 5 : tests verts ; commit** `feat(seed-demo): conversations et non-lus des commandes`.

---

### Task 4: Paiements, crédits et impression sur place

**Files:**
- Create: `prisma/seed/demo/print/payments.ts`, `prisma/seed/demo/print/onsite.ts`,
  `prisma/seed/demo/print/__tests__/payments.test.ts`
- Modify: `prisma/seed/demo/print/orders.ts` (hook `settleOrder`), `prisma/seed/demo/print.ts`

**Interfaces:**
- Consumes: `markPaid`, `markPaidManually`, `spendOrgCreditForPaidRequest`, `applyOrgCredit`,
  `advanceStatus`, `getOrgPrintCreditBalance`, `listOrgPrintCreditMovements`, `onsiteCap`.
- Produces: `settleOrder(ctx, state, requestId, s: Scenario): Promise<void>` ;
  `simulateFedapay(ctx, requestId, outcome: PaymentStatus): Promise<Payment>` ;
  `seedOnsitePrints(ctx, state, orders): Promise<void>`.

- [ ] **Step 1 : tests (`payments.test.ts`)** : `Payment` de purpose `PRINT_REQUEST` à **chacun** des 5
  `PaymentStatus` ; `planId` nul et `printRequestId` non nul (jamais les deux, règle du schéma) ;
  `fedapayTransactionId` uniques ; chaque commande `PAID`+ payée en ligne a `paidPaymentId` = un
  `Payment` `APPROVED` du même `amount` que `acceptedTotal` et `approvedAt` ≤ `paidAt` ; au moins un
  paiement hors ligne (commande `PAID` sans `paidPaymentId`, entrée de fil `PAYMENT_RECEIVED` avec
  `reason`) ; une commande en `ACCEPTED` avec un `Payment` `DECLINED` puis entrée `PAYMENT_FAILED` ;
  une commande `PAYMENT_UNMATCHED` n'est pas exigée ; crédits : mouvement `EARNED` (`amount > 0`,
  `quantity`, `unitPrice`) issu d'une clôture ONSITE et mouvement `SPENT` (`amount < 0`, requestId
  unique par `kind`) ; solde `getOrgPrintCreditBalance` = somme des mouvements ; commande à total 0
  couverte par le crédit passée `PAID` avec `byCredit` ; commande ONSITE avec `PrintRequestPrint`
  dont au moins un `reprint = true` ; première impressions ≤ plafond `onsiteCap(ordered, marginPercent)`
  de la commande ; `PlatformSettings.onsitePrintTemplateIds` non vide, `onsitePrinterNote` renseignée.
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : `simulateFedapay`** : crée le `Payment` (`orgId`, `purpose: PRINT_REQUEST`,
  `printRequestId`, `userId` payeur, `amount`, `fedapayTransactionId` pris dans une suite
  `9_000_000 + n` pilotée par `ctx`, `fedapayReference` factice `demo-fedapay-<n>`, `status`
  demandé, `approvedAt` pour APPROVED) sans aucun appel réseau ; pour `APPROVED`, enchaîne
  `markPaid(tx, id, { paymentId })` puis `spendOrgCreditForPaidRequest` dans une transaction ;
  pour `DECLINED` ajoute l'entrée `PAYMENT_FAILED` ; pour `PENDING`/`CANCELED`/`EXPIRED` la commande
  reste `ACCEPTED` (un `PENDING` récent bloque `reopen` : un seul, sur une commande vitrine dédiée).
- [ ] **Step 4 : `settleOrder`** : selon le scénario, paiement en ligne simulé, hors ligne par
  `markPaidManually` (acteur `STAFF_ADMIN`, motif « Virement reçu — rapprochement manuel »), ou par
  crédit (`applyOrgCredit` puis `acceptQuote`/`markPaid` avec `byCredit`) ; ensuite `advanceStatus`
  jusqu'au statut cible. Un scénario ONSITE `COMPLETED` termine par `advanceStatus(to: "COMPLETED")`
  qui produit le mouvement `EARNED` (`closeOnsiteInTx`) ; un autre dépasse la commande de quelques
  badges pour produire la complémentaire (`ONSITE_SUPPLEMENT_CREATED`). Le crédit `EARNED` d'abord
  obtenu sert ensuite à `applyOrgCredit` sur un devis d'une commande suivante de la même organisation
  (ordre des scénarios à respecter : crédit gagné avant d'être dépensé).
- [ ] **Step 5 : `seedOnsitePrints`** : pour les ONSITE `IN_PRODUCTION`/`READY`/`COMPLETED`, des
  `PrintRequestPrint` (`registrationId` d'inscriptions `APPROVED` de la commande ou de l'évènement,
  `printedById` = opérateur staff, `printedAt` étalés dans la fenêtre de l'évènement, quelques
  `reprint = true`) en respectant le plafond ; marquer `Registration.badgePrinted` pour celles-ci.
  Renseigner `PlatformSettings` (`onsitePrintTemplateIds` = templates de référence adaptés,
  `onsitePrinterNote`, `onsiteDefaultMarginPercent`) par `update` du singleton (idempotent).
- [ ] **Step 6 : tests verts ; commit** `feat(seed-demo): paiements, credits et impression sur place`.

---

### Task 5: Planches : gabarits, générations et PDF

**Files:**
- Create: `prisma/seed/demo/print/sheets.ts`, `prisma/seed/demo/print/__tests__/sheets.test.ts`
- Modify: `prisma/seed/demo/print.ts`

**Interfaces:**
- Consumes: `createGeneration` (`generations.ts`), `orderRegistrations` ; commandes `PAID`/`IN_PRODUCTION`
  (task 4) ; `pdf-lib`, `jszip`.
- Produces: `seedSheets(ctx, state, orders): Promise<void>`.

- [ ] **Step 1 : tests (`sheets.test.ts`)** : gabarits `Démo …` en `SheetOrientation` PORTRAIT **et**
  LANDSCAPE, `BadgeOrientation` AUTO/ORIGINAL/ROTATED, `DuplexFlip` LONG_EDGE/SHORT_EDGE, un gabarit
  archivé ; générations aux 4 `PrintSheetGenerationStatus` ; pour chaque `DONE` : `fileKey` non nul,
  fichier lisible par `getFile`, PDF valide (`PDFDocument.load` réussit, `getPageCount()` = `sheetCount`),
  `badgeCount` ≤ taille de `registrationIds` ; pour `FAILED`, `PENDING`, `RUNNING` : `fileKey` nul ;
  `FAILED` a `error` ; au moins une génération `output = ZIP` `DONE` avec clé
  `badge-exports/<eventId>/<id>.zip` lisible ; une génération par commande au plus (contrainte
  `printRequestId` unique) et, quand elle est `DONE`, clé `print-sheets/orders/<requestId>.pdf` ;
  une génération libre (sans commande) `DONE` avec clé `print-sheets/<id>.pdf` ; au moins une
  commande `PAID`/`IN_PRODUCTION` « à traiter » (sans génération) et une « générée » ;
  `registrationIds` ne contient que des inscriptions `APPROVED` ; jamais de génération sur ONSITE.
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : `seedSheets`** : crée les gabarits (`prisma.printSheetLayout.create`, longueurs en
  dixièmes de mm, format portrait stocké `sheetWidth <= sheetHeight`, A3 portrait existant du seed
  minimal laissé tel quel) ; pour les commandes ADVANCE `PAID`/`IN_PRODUCTION`/`READY`, appelle
  `createGeneration({ eventId, layoutId, selection: { mode: "REQUEST" }, duplex, userId, printRequestId })`
  (cela écrit aussi l'entrée `SHEETS_GENERATED` et le journal `PRINT_SHEETS_GENERATED`) puis fixe
  directement l'état final de la ligne : `DONE` (`sheetCount`, `badgeCount`, `startedAt`,
  `completedAt`, `fileKey`, PDF écrit sous la clé stable de commande), `FAILED` (`error`
  « le badge n° 3 n'a pas le format attendu… », `completedAt`), `RUNNING` (`lockedBy`, `heartbeatAt`,
  `startedAt`), `PENDING` laissé tel quel. Ajoute des générations libres (`prisma.printSheetGeneration.create`,
  hors commande, plusieurs gabarits, duplex, `skippedIds` non vide) et un export ZIP. PDF : une page
  par `sheetCount` au format du gabarit (`pdf-lib`, texte « Planche de démonstration »), ZIP : `jszip`
  avec deux mini PDF. Note : un worker de génération en marche reprend les lignes `PENDING` et les
  `RUNNING` périmées ; les lignes de démo sont telles après le seed, ce qui est vérifié juste après
  son exécution (voir Notes de la task 7 si un worker tourne dans la stack).
- [ ] **Step 4 : tests verts ; commit** `feat(seed-demo): planches de demo avec PDF`.

---

### Task 6: Volume, notifications, journal d'activité et orchestration

**Files:**
- Create: `prisma/seed/demo/print/volume.ts`, `prisma/seed/demo/print/activity.ts`,
  `prisma/seed/demo/print/__tests__/volume.test.ts`, `prisma/seed/demo/print/__tests__/seed-print.test.ts`
- Modify: `prisma/seed/demo/print.ts`

**Interfaces:**
- Consumes: tout ce qui précède ; `ActivityType` PRINT_* du schéma ; `NotificationType`
  `PRINT_REQUEST_*` ; `staffPrintHref`, `organizerPrintHref` de `src/lib/notifications/messages.ts` (lecture).
- Produces: `seedVolumeOrders(ctx, state): Promise<void>` ; `seedPrintActivity(ctx, state): Promise<void>` ;
  `parkPrintJobs(state): Promise<number>`.

- [ ] **Step 1 : tests.** `volume.test.ts` : avec `ctx.scale` réduit, le nombre de commandes crée
  est proportionnel à l'échelle (≥ 1 par organisation moyenne ou grosse) ; les statuts sont répartis
  (au moins 6 des 10 dans le volume) ; références uniques au format `IMP-<année>-NNNN` suivant la
  séquence de `nextReference` ; `total` = somme des lignes ; items distincts par évènement.
  `seed-print.test.ts` (test de bout en bout du module) : **les 10 statuts** et **les 2 types**
  présents sur l'ensemble ; **aucun non-lu organisateur ne compte de note interne** (requête SQL
  de contrôle : pour chaque commande, `unreadByRequest(organizer)` = nombre d'entrées non internes
  postérieures à la dernière lecture, auteur ≠ organisateur) ; chaque fichier référencé existe
  (`attachmentKey`, `storageKey`, `imageKey`, `fileKey`) ; `Notification` de types `PRINT_REQUEST_SUBMITTED`,
  `…_QUOTED`, `…_MESSAGE`, `…_STATUS_CHANGED` avec lus et non lus (`readAt`), `href` pointant une
  commande existante, scopes `PLATFORM` et `EVENT` ; `ActivityLog` pour chaque type PRINT_REQUEST_*,
  PRINT_CREDIT_*, PRINT_SHEETS_GENERATED, PRINT_PRODUCT_*, PRINT_LAYOUT_* avec `createdAt` ≤ `ctx.now` ;
  aucun `Job` créé par le lot en `PENDING` avec `runAt` ≤ `ctx.now` ; deuxième exécution de `seedPrint`
  : mêmes décomptes (commandes, produits, notifications du domaine, journaux du domaine).
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : `seedVolumeOrders`** : pour les organisations `medium` et `large`, `≈ 6 × ctx.scale`
  commandes par évènement concerné (grosse organisation : davantage), écrites par `createMany` par lots
  de 500 : statuts répartis (distribution réaliste : beaucoup de COMPLETED/PAID, quelques
  SUBMITTED/QUOTED/CANCELLED/REJECTED), 1 à 3 lignes (ligne BADGE de quantité = nombre d'items,
  accessoire éventuel), items = inscriptions `APPROVED` encore libres de l'évènement (tracker de
  réservation en mémoire), `total`/`acceptedTotal`/`quoteVersion`/horodatages cohérents avec le statut
  (mêmes champs que la table de `applyTransition`), un fil minimal (entrées `SUBMITTED`, `QUOTE_SENT`,
  `QUOTE_ACCEPTED`, `PAYMENT_RECEIVED`, `STATUS_CHANGED` générées avec `describeThreadEvent` pour le
  texte) ; les paiements en ligne par `simulateFedapay`-équivalent en lot. Références à partir de
  `max(reference) + 1`.
- [ ] **Step 4 : `seedPrintActivity`** : (a) `ActivityLog` pour chaque transition créée (SUBMITTED,
  QUOTED, ACCEPTED, REOPENED, STATUS_CHANGED, CANCELLED, REJECTED, MARKED_PAID, MARGIN_RAISED,
  CREDIT_APPLIED, CREDIT_EARNED, SUPPLEMENT_CREATED) avec `userId`, `orgId`, `eventId`, `targetId`
  = id de la commande, `details`, `staffActor` vrai pour le staff, et `createdAt` = date de l'entrée
  de fil correspondante ; `PRINT_PRODUCT_CREATED/UPDATED/ARCHIVED` et `PRINT_LAYOUT_*` pour le
  catalogue et les gabarits (les générations ont déjà le leur) ; écriture par `createMany`
  (pas `logActivity`, qui date de maintenant). (b) Notifications du domaine : celles que les
  fonctions du domaine ont déjà écrites pendant les cas vitrine sont conservées ; pour le volume,
  `createMany` de `PRINT_REQUEST_SUBMITTED/QUOTED/MESSAGE/STATUS_CHANGED` vers les utilisateurs staff
  (scope `PLATFORM`) et administrateurs d'évènement (scope `EVENT`), `href` via les helpers de
  messages, mélange lus/non lus (`readAt` aléatoire graine fixe), dates cohérentes. (c)
  `parkPrintJobs` : `Job` `PENDING` créés depuis `state.startedAt` (emails des notifications) →
  `runAt = ctx.now + 5 ans` pour que le worker ne les prenne pas ; quelques-uns passés `SUCCEEDED`
  (`completedAt`, payload purgé) pour varier sans empiéter sur le lot 2b (`kind` du domaine seulement).
- [ ] **Step 5 : `print.ts`** : ordre final dans `seedPrint` : `cleanupPrint` → catalogue → gabarits
  → commandes vitrine (cycle + paiements via `settleOrder`) → conversations et lectures → impressions
  sur place → planches → volume → activité et notifications → `parkPrintJobs` ; journalise une ligne
  de durée par étape sur la sortie standard.
- [ ] **Step 6 : tests verts ; commit** `feat(seed-demo): volume, notifications et journal d'impression`.

---

### Task 7: Vérification

**Files:** aucun nouveau fichier (corrections éventuelles dans les fichiers du lot).

- [ ] **Step 1 :** dans le worktree, `scripts/agent-stack.sh status` (sinon
  `scripts/agent-stack.sh up 2a feat/seed-demo`), puis
  `make lint && make typecheck && make test-coverage`. Attendu : 0 warning, 0 erreur, tests verts, gates
  de couverture à 100 % sur `src/lib/**` et `src/app/api/**` inchangées (le lot n'y touche pas).
- [ ] **Step 2 :** `make db-seed` puis `make db-seed-demo` dans le worktree (les modules des autres lots
  sont éventuellement encore des stubs ; la partie impression doit se suffire). Attendu : fin sans
  erreur, durée de l'étape impression lue dans les journaux (cible : quelques dizaines de secondes à
  l'échelle 1) ; relancer `make db-seed-demo` donne les mêmes décomptes (`SELECT status, COUNT(*) FROM
  PrintRequest GROUP BY status`).
- [ ] **Step 3 : contrôle navigateur** (obligatoire pour l'UI, voir `.claude/CLAUDE.md` §4) avec les
  comptes de démo du fichier de comptes du socle, à **375 px puis 1280 px** (golden path + cas
  limites) : staff `/platform/print/orders` (les 10 statuts filtrables, badges de non-lus, ouverture
  d'une commande : fil avec notes internes, devis v3 et lignes des 4 genres, paiement, compteur ONSITE),
  `/platform/print/sheets` (À traiter, Générées avec `DONE`/`FAILED`/`PENDING`/`RUNNING`, téléchargement
  d'un PDF), `/platform/print/layouts` si présent, catalogue `/platform/print/products` (produits de
  chaque type, images visibles, archivé et non publié) ; organisateur `/event/<id>/print` (liste,
  non-lus sans note interne, fil, pièces jointes téléchargeables, devis à accepter, crédit
  d'impression de l'organisation). Aucune image cassée, aucune 404/403 de fichier (console réseau).
- [ ] **Step 4 :** vérifier qu'aucun fichier hors `prisma/seed/demo/print.ts` et
  `prisma/seed/demo/print/**` n'est modifié (`git status`), mettre à jour la table Progression,
  commiter les corrections éventuelles.
- [ ] **Step 5 : Notes de passation** dans la Progression : écart de contrat du socle constaté,
  clés hors `demo/` à nettoyer par le socle ou le lot, comportement d'un worker de génération vis-à-vis
  des lignes `PENDING`/`RUNNING`, et durée mesurée.
