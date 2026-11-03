# Paiement des devis d'impression par FedaPay — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'OWNER d'une organisation paie en ligne, par FedaPay, le montant du devis
d'impression qu'il a accepté ; la demande passe `ACCEPTED → PAID` dès que FedaPay confirme,
une seule fois, sans intervention du staff. Le staff peut, à défaut, marquer une demande
payée à la main avec un motif.

**Architecture :** on **généralise** le paiement des abonnements au lieu d'en créer un second.
(1) `Payment` reçoit un `purpose` (`SUBSCRIPTION` | `PRINT_REQUEST`), `planId` devient
nullable, `printRequestId` apparaît. (2) `src/lib/payments.ts` garde une seule mécanique de
confirmation (relecture FedaPay, contrôle montant/devise, transition idempotente
`PENDING|EXPIRED → APPROVED`) et **aiguille** l'effet selon `purpose` : abonnement inchangé,
ou `markPaid` du service des demandes (plan 33) dans la même transaction Prisma. Le webhook
et la tâche horaire, qui passent déjà par `confirmPayment`, couvrent les deux usages sans
changement de code. (3) Une route de checkout sous l'évènement, une page de retour sous
`/event/[eventId]/print/[requestId]/return`, et `PaymentHistory` qui affiche un « Objet »
(plan ou référence de la demande). Le passage manuel en `PAID` (service `markPaidManually`,
route `…/mark-paid`, bouton « Marquer payée ») est **produit par le plan 33** ; ce plan le
branche seulement sur les vrais paiements (sonde `isPaymentInProgress`, notification dédiée).

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8 (`db push`, pas de dossier de
migrations), zod, Vitest 4 (BDD réelle, `fetch` stubé), Playwright, API REST FedaPay v1.

**Spec :** [`docs/v4/specs/2026-11-01-34-v4-paiement-des-devis-d-impression.md`](../specs/2026-11-01-34-v4-paiement-des-devis-d-impression.md)

**Branche :** `feat/service-impression` (créée depuis `development` le 2026-11-01)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma `Payment` généralisé + lecteurs de `plan` sûrs | [ ] | | |
| 2 | Historique des paiements : colonne « Objet » | [ ] | | |
| 3 | `startPrintRequestCheckout` (un seul paiement en cours) | [ ] | | |
| 4 | `confirmPayment` aiguillé + notifications | [ ] | | |
| 5 | Route de checkout (OWNER seul) | [ ] | | |
| 6 | Webhook et tâche horaire : non-régression des deux usages | [ ] | | |
| 7 | Page de retour d'un paiement d'impression | [ ] | | |
| 8 | Passage manuel du plan 33 : notification de paiement | [ ] | | |
| 9 | Écran organisateur : « Payer », historique | [ ] | | |
| 10 | Écran staff : historique des paiements | [ ] | | |
| 11 | E2E et documentation | [ ] | | |
| — | Vérification finale (lint, typecheck, test, e2e, sandbox FedaPay) | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **Prérequis : plan 33 exécuté** (modèle `PrintRequest`, `src/lib/print-requests/service.ts`,
  pages `/event/[eventId]/print/[requestId]` et `/platform/print/requests/[requestId]`,
  permission `print.request`, `NotificationType` `PRINT_REQUEST_STATUS_CHANGED`,
  `ActivityType` `PRINT_REQUEST_MARKED_PAID`, passage manuel `markPaidManually` et route
  `POST /api/platform/print/requests/[requestId]/mark-paid`). Contrat consommé
  (`src/lib/print-requests/service.ts` et `thread.ts`), **à vérifier en début de Task 3**
  contre le code réel (adapter les appels, jamais le comportement) :
  - `markPaid(tx, requestId, { paymentId?: string; manual?: { userId: string; reason: string } }): Promise<boolean>`
    — transition conditionnelle `ACCEPTED → PAID` par `applyTransition`, `paidAt`,
    `paidPaymentId = paymentId ?? null`, entrée `PAYMENT_RECEIVED` « Paiement reçu :
    {montant} » (suffixée « (hors ligne : {motif}) » en manuel) ; `false` si la demande
    n'était plus `ACCEPTED`, rien d'écrit. **Ni log ni notification** : l'appelant les fait,
    hors transaction.
  - `appendThreadEvent(tx, requestId, eventType: ThreadEventType, details: Record<string, unknown>, actor?: ThreadActor): Promise<PrintRequestMessage>`
    (`kind: EVENT`, acteur `SYSTEM` par défaut ; `ThreadEventType` est une union fermée que
    ce plan étend de `PAYMENT_UNMATCHED`, Task 4).
  - `assertOwner(userId, orgId): Promise<void>` — lève `PrintRequestError` 403
    `STAFF_FORBIDDEN` (staff) ou `OWNER_REQUIRED` ; `printRequestErrorResponse` la traduit.
  - `paymentProbe` / `isPaymentInProgress(requestId)` : `false` par défaut au plan 33 ;
    **ce plan branche la vraie requête** sur `Payment.printRequestId` (Task 1).
- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en français,
  dans le style du fichier touché. Commits et noms de fichiers en ASCII.
- **XOF uniquement, montants entiers.** Affichage `Intl.NumberFormat("fr-FR")` + « FCFA »
  (« 150 000 FCFA » ; l'espace produit par `fr-FR` est une espace fine insécable U+202F —
  les tests comparent après `replace(/\s/g, " ")`).
- **Ne jamais croire le webhook ni l'URL de retour** : seule la transaction relue chez FedaPay
  fait foi. **Idempotence** : `payment.updateMany({ where: { id, status: { in: CONFIRMABLE } } })`
  puis `count === 1`, dans la même `prisma.$transaction` que `markPaid`.
- **Les paiements d'abonnement ne changent pas** : tous les tests existants de `payments`,
  `payment-return`, webhook, checkout et `subscription-sweep` restent verts sans être
  réécrits (seuls ajouts autorisés : `purpose` dans des `toMatchObject`, libellé « Objet »).
- **Qui paie : OWNER de l'org, jamais le staff** (403 explicite, `hasEventPermission` laisse
  passer le staff). Marquage manuel : `STAFF_ADMIN`, motif obligatoire.
- **Aucune nouvelle dépendance, aucune nouvelle variable d'environnement.** URL de retour
  construite depuis `NEXTAUTH_URL`.
- **Toute action sensible loggée** (`logActivity`) : on réutilise `PAYMENT_INITIATED`,
  `PAYMENT_APPROVED`, `PAYMENT_FAILED` avec `details.purpose` et `details.printRequestId`.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**`. On mocke `fetch`
  (`vi.stubGlobal`), jamais Prisma. `payment` doit être purgé **avant** `printRequest` dans
  `src/test-setup.ts`.
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un fichier : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - schéma : `make db-push` ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Les étapes « commit » de ce
  plan ne valent pas autorisation. Jamais de trailer de co-auteur.
- **Pas de déploiement, pas de SSH, pas de prod.**

## Points de vigilance de revue

1. **Webhook et page de retour simultanés** sur un paiement d'impression : une seule
   transition `PAID`, une seule entrée « Paiement reçu », un seul `PAYMENT_APPROVED`, une
   seule vague de notifications. (Task 4.)
2. **Paiement approuvé hors contexte** : demande plus `ACCEPTED` (rouverte, annulée, déjà
   payée) **ou** `acceptedTotal` courant ≠ montant du paiement (devis rouvert puis réaccepté
   à un autre total) → paiement `APPROVED`, **aucune** transition, entrée
   `PAYMENT_UNMATCHED` et notification staff. (Task 4.)
3. **`planId` nullable** : chaque lecteur de `payment.plan` (`confirmPayment`,
   `resolvePaymentReturn`, pages d'historique) tient le cas nul ; un paiement d'impression ne
   touche jamais `Subscription`. (Tasks 1, 2, 4.)
4. **Un seul `PENDING` par demande** : double clic ou deux onglets n'ouvrent jamais deux
   transactions FedaPay ; un checkout répété réutilise la transaction encore `pending`.
   (Task 3.)
5. **Staff** : 403 au checkout même avec `hasEventPermission` ; marquage manuel (plan 33)
   refusé (`409 PAYMENT_IN_PROGRESS`) tant qu'un paiement est `PENDING`, grâce à la sonde
   branchée en Task 1. (Tasks 1, 5, 8.)

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | `enum PaymentPurpose`, `Payment.purpose`, `planId` nullable, `printRequestId`, back-relation sur `PrintRequest` |
| `src/lib/payments.ts` | + `startPrintRequestCheckout`, aiguillage de `confirmPayment`, codes `PaymentError` |
| `src/lib/print-requests/service.ts` (plan 33) | corps réel de `paymentProbe.isPaymentInProgress` |
| `src/lib/print-requests/thread.ts` (plan 33) | `ThreadEventType` + `PAYMENT_UNMATCHED` et son texte |
| `src/lib/payment-history.ts` (nouveau) | `PAYMENT_HISTORY_SELECT`, `toPaymentHistoryItem` |
| `src/lib/payment-return.ts` | garde `purpose` sur `resolvePaymentReturn` ; + `resolvePrintPaymentReturn` |
| `src/lib/notifications/{messages,triggers}.ts` | `printRequestPaidMessage`, `printPaymentUnmatchedMessage`, `notifyPrintRequestPaid`, `notifyPrintPaymentUnmatched` |
| `src/components/admin/PaymentHistory.tsx` | colonne « Objet » (`label`) |
| `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout/route.ts` (nouveau) | `POST` |
| `src/app/api/platform/print/requests/[requestId]/mark-paid/route.ts` (plan 33) | notification `notifyPrintRequestPaid(…, { manual: true })` |
| `src/app/event/[eventId]/print/[requestId]/return/page.tsx` (nouveau) | retour FedaPay |
| `src/components/event/print/PrintPayButton.tsx` (nouveau, client) | bouton « Payer X FCFA » |
| `src/components/staff/print/RequestStatusActions.tsx` (plan 33) | message de `PAYMENT_IN_PROGRESS` sur « Marquer payée » |
| `src/lib/__tests__/helpers/print-requests.ts` (plan 33) | + `seedAcceptedPrintRequest` |
| pages du plan 33 (organisateur, staff), pages abonnement org et staff | historique |
| `docs/v4/features/paiements-fedapay.md`, `docs/v4/README.md` | documentation |

---

## Task 1 — Schéma `Payment` généralisé + lecteurs de `plan` sûrs

**Files :**
- Modify : `prisma/schema.prisma`, `src/test-setup.ts`, `src/lib/payments.ts`,
  `src/lib/payment-return.ts`, `src/lib/print-requests/service.ts` (plan 33 : corps de
  `paymentProbe.isPaymentInProgress`)
- Test : `src/lib/__tests__/payments.test.ts`, `src/lib/__tests__/payment-return.test.ts`,
  `src/lib/__tests__/print-requests-service.test.ts` (plan 33) (existants, compléter)

**Interfaces :**
- Produces :
  - `enum PaymentPurpose { SUBSCRIPTION PRINT_REQUEST }`
  - `Payment.purpose PaymentPurpose @default(SUBSCRIPTION)` — les lignes existantes prennent
    le défaut au `db push`.
  - `Payment.planId String?` / `plan Plan?` (relation inchangée sinon).
  - `Payment.printRequestId String?` / `printRequest PrintRequest? @relation(fields:
    [printRequestId], references: [id], onDelete: Cascade)` ; `@@index([printRequestId,
    status])` (sert `isPaymentInProgress` du plan 33) ; `PrintRequest.payments Payment[]`.
  - Règle applicative : `SUBSCRIPTION` ⇔ `planId` seul, `PRINT_REQUEST` ⇔ `printRequestId`
    seul. Garantie par construction (seuls les deux checkouts créent des `Payment`) et
    contrôlée à la confirmation.
  - `confirmPayment` : `Payment` incohérent (`SUBSCRIPTION` sans plan, `PRINT_REQUEST` sans
    demande) → `throw new Error("Paiement incohérent")` **avant** tout appel FedaPay.
  - `resolvePaymentReturn` : `purpose !== "SUBSCRIPTION"` → `NOT_FOUND` (la page abonnement
    ne confirme jamais un paiement d'impression).
  - `paymentProbe.isPaymentInProgress(requestId)` (plan 33, `service.ts`) : corps par
    défaut `async () => false` remplacé par `(await prisma.payment.count({ where: {
    printRequestId: requestId, status: "PENDING" } })) > 0`. Tout ce qui passe par
    `isPaymentInProgress` au plan 33 (réouverture, annulation, passage manuel, changement de
    template) devient effectif sans autre changement.

- [ ] **Step 1 : tests**
  - `print-requests-service.test.ts` : `"isPaymentInProgress vrai avec un Payment PENDING de la demande, faux avec APPROVED, EXPIRED ou le PENDING d'une autre demande"`
    (remplace le test « vaut false par défaut » du plan 33 ; les tests qui espionnent la
    sonde restent valides).
  - `payments.test.ts` : `"un Payment SUBSCRIPTION sans plan lève « Paiement incohérent » sans appeler fetch"`
    (`planId: null`, `fedapayTransactionId: 90` ; `expect(fetchMock).not.toHaveBeenCalled()`) ;
    `"startCheckout crée un Payment de purpose SUBSCRIPTION"` (ajout `purpose:
    "SUBSCRIPTION", printRequestId: null` au `toMatchObject` existant).
  - `payment-return.test.ts` : `"paiement PRINT_REQUEST de la même org → NOT_FOUND sans confirmPayment"`.
- [ ] **Step 2 : lancer** — attendu : FAIL (`purpose` inconnu).
- [ ] **Step 3 : implémenter** — schéma, `make db-push` ; `payment` purgé avant
  `printRequest` dans `src/test-setup.ts` (déplacer la ligne si le plan 33 l'a mise après) ;
  garde dans `confirmPayment` (`include` de `printRequest: { select: { id: true } }`), garde
  dans `resolvePaymentReturn` (`select` de `purpose`, `plan?.name`).
- [ ] **Step 4 : lancer** — attendu : PASS ; `make typecheck` signale les autres lecteurs de
  `plan.name` (pages d'historique) : les laisser à la Task 2 en lisant
  `plan?.name ?? "—"` provisoirement.
- [ ] **Step 5 : commit** — `feat(paiements): paiement generalise (abonnement ou impression)`.

## Task 2 — Historique des paiements : colonne « Objet »

**Files :**
- Create : `src/lib/payment-history.ts`
- Modify : `src/components/admin/PaymentHistory.tsx`,
  `src/app/org/[orgId]/subscription/page.tsx`,
  `src/app/platform/organizations/[orgId]/subscription/page.tsx`
- Test : `src/lib/__tests__/payment-history.test.ts`,
  `src/components/admin/__tests__/PaymentHistory.test.tsx` (existant, adapter)

**Interfaces :**
- Consumes : `Payment.printRequest` (Task 1), `PrintRequest.reference` (plan 33).
- Produces :
  - `PAYMENT_HISTORY_SELECT` (constante `select` Prisma : `id`, `createdAt`, `amount`,
    `status`, `fedapayReference`, `plan: { select: { name } }`,
    `printRequest: { select: { reference } }`).
  - `toPaymentHistoryItem(row: Prisma.PaymentGetPayload<{ select: typeof PAYMENT_HISTORY_SELECT }>): PaymentHistoryItem`
    — `label` = nom du plan, sinon `Impression <reference>`, sinon « — ».
  - `PaymentHistoryItem` : `planName` renommé `label` ; en-tête de colonne « Objet ».
  - Pages abonnement org et staff : elles listent **tous** les paiements de l'org (les deux
    usages), via `PAYMENT_HISTORY_SELECT` et `toPaymentHistoryItem`.

- [ ] **Step 1 : tests** — `toPaymentHistoryItem` : plan `pro` → `label "pro"` ; demande
  `IMP-2026-0042` → `"Impression IMP-2026-0042"` ; ni l'un ni l'autre → `"—"`.
  `PaymentHistory.test.tsx` : l'en-tête contient « Objet » et plus « Plan » ; une ligne
  `label: "Impression IMP-2026-0042"` est rendue.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** ; remplacer les `select`/`map` des deux pages.
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck && make test`.
- [ ] **Step 5 : commit** — `feat(paiements): historique avec objet du paiement`.

## Task 3 — `startPrintRequestCheckout` (un seul paiement en cours)

**Files :**
- Modify : `src/lib/payments.ts`, `src/lib/__tests__/helpers/print-requests.ts` (fixture du
  plan 33)
- Test : `src/lib/__tests__/payments-print-request.test.ts`

**Interfaces :**
- Consumes : `PrintRequest` (plan 33), client FedaPay (`createTransaction`,
  `createPaymentUrl`, `retrieveTransaction`, `getFedapayConfig`), `confirmPayment`.
- Produces :
  - `PaymentErrorCode` étendu : `REQUEST_NOT_FOUND` (404), `REQUEST_NOT_PAYABLE` (409),
    `PAYMENT_IN_PROGRESS` (409).
  - `startPrintRequestCheckout(input: { orgId: string; eventId: string; requestId: string; userId: string; req?: NextRequest }): Promise<{ paymentId: string; url: string }>`
  - Fonction privée commune aux deux checkouts, extraite de `startCheckout` sans changer
    son comportement : `openTransaction(paymentId: string, tx: { description: string; amount: number; callbackPath: string; userId: string; metadata: Record<string, string> }): Promise<string>`
    (crée la transaction, enregistre `fedapayTransactionId`/`fedapayReference`, renvoie
    l'URL ; en cas d'échec passe le `Payment` `CANCELED` et lève `PROVIDER_ERROR`).
  - Helper de test `seedAcceptedPrintRequest(over?: Partial<{ status: PrintRequestStatus; acceptedTotal: number | null }>): Promise<{ owner; manager; staffAdmin; org; event; request }>`
    — ajouté à la fixture du plan 33 et construit sur `seedPrintFixture` + `makeRequest`
    (évènement renommé « Salon Test »), demande `IMP-2026-0042`, `ACCEPTED`,
    `acceptedTotal: 150000`.

Algorithme (non déterminé par la signature) :
1. Demande introuvable, ou `eventId`/`orgId` différents → `REQUEST_NOT_FOUND`.
   `status !== "ACCEPTED"` ou `acceptedTotal` nul ou ≤ 0 → `REQUEST_NOT_PAYABLE`.
   FedaPay non configuré → `PAYMENTS_DISABLED`.
2. Dans une `prisma.$transaction` : `SELECT id FROM PrintRequest WHERE id = ? FOR UPDATE`,
   relire le statut (même contrôle qu'en 1), chercher le `Payment` `PENDING` de la demande :
   - aucun → créer `Payment { purpose: PRINT_REQUEST, printRequestId, planId: null, orgId,
     userId, amount: acceptedTotal, status: PENDING }` → étape 4 ;
   - sans `fedapayTransactionId` et créé il y a moins de 2 min (un autre checkout ouvre sa
     transaction) → `PAYMENT_IN_PROGRESS` ;
   - sans `fedapayTransactionId` et plus ancien (checkout interrompu) → le passer `CANCELED`
     et créer le nouveau → étape 4 ;
   - avec `fedapayTransactionId` → candidat à la réutilisation → étape 3.
3. Hors transaction : `retrieveTransaction(id)`. Statut `pending` → `createPaymentUrl(id)`,
   renvoyer **le même** `paymentId`. Sinon → `confirmPayment(id)` (applique ou refuse), puis
   recommencer à l'étape 1 **une seule fois** (si la demande est devenue `PAID`, l'étape 1
   lève `REQUEST_NOT_PAYABLE`). Erreur FedaPay 404 → candidat passé `CANCELED`
   (`PAYMENT_FAILED { reason: "REPLACED" }`) puis reprise ; autre erreur → `PROVIDER_ERROR`.
4. `openTransaction` : description `Impression <reference> — <titre de l'évènement>`,
   `callbackPath = /event/<eventId>/print/<requestId>/return`, `metadata: { paymentId,
   printRequestId }` ; puis `PAYMENT_INITIATED { paymentId, purpose: "PRINT_REQUEST",
   printRequestId, amount }`.

- [ ] **Step 1 : vérifier le contrat du plan 33** (signatures listées dans les contraintes
  globales) dans `src/lib/print-requests/service.ts` ; noter tout écart dans la colonne
  Notes de la progression.
- [ ] **Step 2 : écrire les tests** (`fetch` stubé, transaction FedaPay `id: 88`)

```ts
it("crée un Payment PRINT_REQUEST PENDING de 150 000 FCFA et renvoie l'URL FedaPay", async () => {
  // payment : { purpose: "PRINT_REQUEST", planId: null, printRequestId: request.id, amount: 150000,
  //   status: "PENDING", fedapayTransactionId: 88 } ; corps du POST /transactions :
  // description "Impression IMP-2026-0042 — Salon Test",
  // callback_url "https://badge.local/event/<eventId>/print/<requestId>/return",
  // custom_metadata { paymentId, printRequestId }
});
it("log PAYMENT_INITIATED avec purpose PRINT_REQUEST, printRequestId et amount 150000", async () => {});
it("demande QUOTED → REQUEST_NOT_PAYABLE (409), aucun Payment", async () => {});
it("acceptedTotal null → REQUEST_NOT_PAYABLE", async () => {});
it("demande d'un autre évènement → REQUEST_NOT_FOUND (404)", async () => {});
it("FedaPay non configuré → PAYMENTS_DISABLED, aucun Payment", async () => {});
it("erreur FedaPay à la création → Payment CANCELED, PROVIDER_ERROR", async () => {});
it("PENDING existant encore pending chez FedaPay → même paymentId, nouvelle URL, 1 seul Payment", async () => {
  // fetch : GET /transactions/88 (pending) puis POST /transactions/88/token
});
it("PENDING existant refusé chez FedaPay → ancien DECLINED, nouveau Payment PENDING", async () => {});
it("PENDING existant approuvé chez FedaPay → demande PAID, REQUEST_NOT_PAYABLE", async () => {});
it("PENDING existant introuvable chez FedaPay (404) → ancien CANCELED, nouveau Payment", async () => {});
it("PENDING sans transaction créé il y a 30 s → PAYMENT_IN_PROGRESS", async () => {});
it("PENDING sans transaction créé il y a 5 min → ancien CANCELED, nouveau Payment", async () => {});
it("deux checkouts concurrents (Promise.all) → un seul Payment avec transaction, l'autre PAYMENT_IN_PROGRESS", async () => {});
```

- [ ] **Step 3 : lancer** — attendu : FAIL.
- [ ] **Step 4 : implémenter** `openTransaction` (puis vérifier que les tests existants de
  `startCheckout` passent toujours), `startPrintRequestCheckout`, les trois codes.
- [ ] **Step 5 : lancer** — attendu : PASS.
- [ ] **Step 6 : commit** — `feat(impression): checkout fedapay d'un devis accepte`.

## Task 4 — `confirmPayment` aiguillé + notifications

**Files :**
- Modify : `src/lib/payments.ts`, `src/lib/notifications/messages.ts`,
  `src/lib/notifications/triggers.ts`, `src/lib/print-requests/thread.ts` (plan 33 :
  `ThreadEventType` et `describeThreadEvent`)
- Test : `src/lib/__tests__/payments-print-request.test.ts`, tests existants de
  `messages.ts` et `triggers.ts` (compléter)

**Interfaces :**
- Consumes : `markPaid`, `appendThreadEvent` (plan 33), `PRINT_REQUEST_STATUS_CHANGED`.
- Produces :
  - `confirmPayment` : signature et retour inchangés. Dans la transaction, après
    `count === 1` :
    - `SUBSCRIPTION` → code actuel ;
    - `PRINT_REQUEST` → `SELECT id FROM PrintRequest WHERE id = ? FOR UPDATE`, relecture ;
      si `status === "ACCEPTED"` **et** `acceptedTotal === payment.amount` →
      `markPaid(db, requestId, { paymentId })` (qui pose aussi `paidPaymentId`), issue
      `PAID` ; sinon (ou `markPaid` → `false`) → `appendThreadEvent(db, requestId,
      "PAYMENT_UNMATCHED", { paymentId, amount })`, issue `UNMATCHED`. `mode` reste nul. (Le
      plan 35 ajoute ici, après un `markPaid` à `true`, la dépense du crédit d'impression.)
    - Hors transaction : `PAYMENT_APPROVED { paymentId, purpose: "PRINT_REQUEST",
      printRequestId, unmatched: boolean }` ; `PAID` → `notifyPrintRequestPaid(requestId,
      payment.userId)` ; `UNMATCHED` → `notifyPrintPaymentUnmatched(requestId, paymentId)`.
      Retour `{ status: "APPROVED", applied: issue === "PAID" }`.
  - `failPayment` : pour `PRINT_REQUEST`, si `count === 1`, ajoute dans la même
    transaction `appendThreadEvent(db, requestId, "PAYMENT_FAILED", { amount: payment.amount,
    paymentId, reason })` (`reason` : `declined`, `canceled`, `MISMATCH`, `REPLACED`) ; la
    demande reste `ACCEPTED`. `PAYMENT_FAILED` loggé avec `purpose` et `printRequestId`.
  - Fil (`thread.ts` du plan 33) : `PAYMENT_FAILED` existe déjà (texte du plan 33
    « Paiement échoué : {montant} », inchangé) ; `ThreadEventType` gagne
    `PAYMENT_UNMATCHED` `{ paymentId, amount }` → « Paiement de 150 000 FCFA reçu alors que
    la demande n'attendait plus ce paiement : l'équipe Badge vérifie. » (montant de
    `details.amount`, formaté par `formatFcfa`).
  - `printRequestPaidMessage(a: { requestId: string; eventId: string; reference: string; eventTitle: string; amount: number; manual: boolean; audience: "event" | "platform" }): NotificationContent`
    — titre « Demande <reference> payée » ; corps « Le paiement de <montant> FCFA de la
    demande <reference> (<évènement>) est reçu. » ou, `manual`, « La demande <reference>
    (<évènement>) a été marquée payée par l'équipe Badge. » ; lien `event` →
    `/event/<eventId>/print/<requestId>`, `platform` → `/platform/print/requests/<requestId>` ;
    bouton « Voir la demande ».
  - `printPaymentUnmatchedMessage(a: { requestId: string; reference: string; amount: number }): NotificationContent`
    — titre « Paiement à vérifier : <reference> » ; corps « Un paiement de <montant> FCFA a
    été approuvé alors que la demande n'attendait plus ce paiement. » ; lien plateforme.
  - `notifyPrintRequestPaid(requestId: string, actorId: string | null, opts?: { manual?: boolean }): Promise<void>`
    — `PRINT_REQUEST_STATUS_CHANGED`, portée `EVENT` (`eventRoles: ["ADMIN"]`) + portée
    `PLATFORM` (`staffMinRole: "STAFF_ADMIN"`), sous `withNotificationGuard` (mêmes
    destinataires que la ligne 16-17 de la table du plan 33 ; remplace, pour le passage en
    `PAID`, `notifyPrintRequestStatusChanged`).
  - `notifyPrintPaymentUnmatched(requestId: string, paymentId: string): Promise<void>` —
    même type, `PLATFORM` / `STAFF_ADMIN` uniquement.

- [ ] **Step 1 : écrire les tests**

```ts
it("approved → Payment APPROVED, demande PAID avec paidAt et paidPaymentId = payment.id, entrée « Paiement reçu »", async () => {});
it("approved → aucune Subscription créée ni modifiée", async () => {});
it("approved → PAYMENT_APPROVED { purpose: 'PRINT_REQUEST', unmatched: false } et notifications admin évènement + STAFF_ADMIN", async () => {});
it("deux confirmPayment concurrents → un seul PAID, une seule entrée du fil, un seul PAYMENT_APPROVED", async () => {});
it("montant FedaPay 149 000 → DECLINED, entrée PAYMENT_FAILED reason MISMATCH, demande ACCEPTED", async () => {});
it("declined → DECLINED, entrée PAYMENT_FAILED reason declined, demande ACCEPTED et repayable", async () => {
  // puis startPrintRequestCheckout crée un nouveau Payment
});
it("EXPIRED approuvé alors que la demande est QUOTED → APPROVED, applied false, demande QUOTED, entrée PAYMENT_UNMATCHED, notification staff seule", async () => {});
it("approuvé, demande ACCEPTED mais acceptedTotal 160 000 ≠ 150 000 → UNMATCHED, demande ACCEPTED", async () => {});
it("approuvé alors que la demande est déjà PAID → UNMATCHED", async () => {});
// messages.test.ts
it("printRequestPaidMessage : titre « Demande IMP-2026-0042 payée », corps « … 150 000 FCFA … », lien event", () => {});
it("printRequestPaidMessage manual : « … a été marquée payée par l'équipe Badge. »", () => {});
it("printPaymentUnmatchedMessage : titre « Paiement à vérifier : IMP-2026-0042 »", () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** l'aiguillage, `failPayment`, messages, déclencheurs,
  libellés du fil.
- [ ] **Step 4 : lancer** — attendu : PASS ; `make test` (tests abonnement inchangés).
- [ ] **Step 5 : commit** — `feat(impression): confirmation du paiement d'un devis`.

## Task 5 — Route de checkout (OWNER seul)

**Files :**
- Create : `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout/route.ts`
- Test : `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout/__tests__/route.test.ts`

**Interfaces :**
- Consumes : `withEventAuth` (`src/lib/with-event-auth.ts`), `assertOwner` (plan 33),
  `startPrintRequestCheckout` (Task 3).
- Produces : `POST` sans corps, `withEventAuth({ permission: "print.request",
  allowArchived: true }, …)` (un devis accepté reste payable si l'évènement est archivé) ;
  `requestId` lu dans `extra.params` ; `session.user.isStaff` → 403
  `{ error: "STAFF_FORBIDDEN" }` **avant tout** (même code que l'acceptation au plan 33) ;
  `assertOwner` en échec → `PrintRequestError` traduite par `printRequestErrorResponse`
  (403 `OWNER_REQUIRED`) ; succès → 200 `{ url }` ; `PaymentError` → `{ error: code }` avec
  `httpStatus`. Le droit
  d'abonnement `MANAGE_ONGOING_EVENTS` s'applique déjà (écriture via `withEventAuth`).

- [ ] **Step 1 : tests** — 401 sans session ; 403 `STAFF_FORBIDDEN` pour un `STAFF_ADMIN` ;
  403 `OWNER_REQUIRED` pour le MANAGER ; 403 pour un membre `VIEWER` de l'évènement ;
  404 évènement d'une autre org ; 200 `{ url: "https://pay.fedapay.com/t" }` pour l'OWNER ;
  409 `REQUEST_NOT_PAYABLE` sur une demande `QUOTED`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): route de paiement d'un devis`.

## Task 6 — Webhook et tâche horaire : non-régression des deux usages

**Files :**
- Test : `src/app/api/webhooks/fedapay/__tests__/route.test.ts`,
  `src/lib/jobs/__tests__/subscription-sweep.test.ts` (existants, compléter)

**Interfaces :** aucune nouvelle ; on prouve que `POST /api/webhooks/fedapay` et
`runSubscriptionSweep` couvrent les paiements d'impression **sans modification de code**.

- [ ] **Step 1 : tests**
  - webhook : `"transaction.approved d'un paiement d'impression → demande PAID, 200"` ;
    `"rejoué → 200, une seule entrée « Paiement reçu »"` ;
  - sweep : `"PENDING d'impression de 20 min approuvé chez FedaPay → demande PAID, reconciled 1"` ;
    `"PENDING d'impression de 25 h → EXPIRED, la demande reste ACCEPTED"`.
- [ ] **Step 2 : lancer** — attendu : PASS directement. Un FAIL révèle un trou des Tasks 1-4 :
  le corriger là, pas dans le webhook ni la tâche.
- [ ] **Step 3 : commit** — `test(impression): webhook et reprise des paiements d'impression`.

## Task 7 — Page de retour d'un paiement d'impression

**Files :**
- Modify : `src/lib/payment-return.ts`
- Create : `src/app/event/[eventId]/print/[requestId]/return/page.tsx`
- Test : `src/lib/__tests__/payment-return.test.ts` (compléter)

**Interfaces :**
- Consumes : `confirmPayment` (Task 4), `hasEventPermission` (`src/lib/auth-helpers.ts`).
- Produces :
  - `type PrintPaymentReturn = { outcome: "PAID" | "UNMATCHED" | "PENDING" | "FAILED" | "NOT_FOUND"; reference: string; amount: number }`
  - `resolvePrintPaymentReturn(requestId: string, rawId: string | undefined): Promise<PrintPaymentReturn>`
    — même méthode que `resolvePaymentReturn` : id entier, `Payment` `PRINT_REQUEST` dont
    `printRequestId === requestId` **avant** tout appel FedaPay, sinon `NOT_FOUND` ;
    erreur FedaPay → `PENDING` ; `PENDING`/`EXPIRED` → `PENDING` ; `DECLINED`/`CANCELED` →
    `FAILED` ; `APPROVED` → `PAID` si `request.paidPaymentId === payment.id` (champ posé par
    `markPaid`, plan 33 : ce paiement a soldé la demande, qui a pu avancer depuis vers
    `IN_PRODUCTION`…), sinon `UNMATCHED`.
  - Page (Server Component) : session, `loadUserContext`, évènement, redirection vers
    `/event/<eventId>` sans `hasEventPermission(ctx, eventId, orgId, "print.request")`.
    Textes : `PAID` « Paiement confirmé. La demande <reference> est payée ; l'équipe Badge
    lance la production. » ; `UNMATCHED` « Paiement reçu. L'équipe Badge vérifie votre
    demande et revient vers vous. » ; `PENDING` « Paiement en cours de confirmation. Cette
    page se met à jour dès que FedaPay confirme. » + « Actualiser » ; `FAILED` « Le paiement
    n'a pas abouti. Votre devis reste accepté : vous pouvez réessayer. » ; `NOT_FOUND`
    « Paiement introuvable. ». Toujours « Retour à la demande ».

- [ ] **Step 1 : tests** — approuvé → `PAID`, `reference "IMP-2026-0042"`, `amount 150000` ;
  approuvé tardivement sur demande `QUOTED` → `UNMATCHED` ; approuvé sur une demande
  `PAID` à la main (`paidPaymentId` nul) → `UNMATCHED` ; `declined` → `FAILED` ;
  `pending` → `PENDING` ; `retrieveTransaction` en erreur → `PENDING` ; paiement d'une autre
  demande → `NOT_FOUND` sans `confirmPayment` ; paiement `SUBSCRIPTION` → `NOT_FOUND` ;
  `id` absent ou `"abc"` → `NOT_FOUND`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** la fonction et la page (modèle :
  `src/app/org/[orgId]/subscription/return/page.tsx`).
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck`.
- [ ] **Step 5 : commit** — `feat(impression): page de retour du paiement d'un devis`.

## Task 8 — Passage manuel du plan 33 : notification de paiement

Le service `markPaidManually` (`src/lib/print-requests/quote.ts`), la route
`POST /api/platform/print/requests/[requestId]/mark-paid` (`STAFF_ADMIN`, motif 3–500,
`PRINT_REQUEST_MARKED_PAID`, réponse `{ request }`, erreurs `PrintRequestError` : 404
`NOT_FOUND`, 400 `VALIDATION`, 409 `INVALID_TRANSITION`, 409 `PAYMENT_IN_PROGRESS`) et le
bouton « Marquer payée » existent depuis le plan 33. Ce plan n'en crée **aucun autre** ; il
vérifie le refus pendant un paiement réel et remplace la notification.

**Files :**
- Modify : `src/app/api/platform/print/requests/[requestId]/mark-paid/route.ts` (plan 33)
- Test : `src/lib/__tests__/api-platform-print-requests.test.ts` (plan 33, compléter)

**Interfaces :**
- Consumes : `markPaidManually` (plan 33), sonde branchée (Task 1), `notifyPrintRequestPaid`
  (Task 4).
- Produces : la route appelle, après la transaction, `notifyPrintRequestPaid(requestId,
  userId, { manual: true })` **à la place de** `notifyPrintRequestStatusChanged` ; le reste
  de la route est inchangé.

- [ ] **Step 1 : tests** — un `Payment` `PRINT_REQUEST` `PENDING` réel (sans espion de la
  sonde) → 409 `PAYMENT_IN_PROGRESS`, demande inchangée ; sans paiement en cours → 200,
  notification « La demande … a été marquée payée par l'équipe Badge. » aux admins de
  l'évènement et au staff `STAFF_ADMIN`, `paidPaymentId` nul.
- [ ] **Step 2 : lancer** — attendu : FAIL (ancienne notification).
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck && make test`.
- [ ] **Step 5 : commit** — `feat(impression): notification du passage manuel en payee`.

## Task 9 — Écran organisateur : « Payer », historique

**Files :**
- Create : `src/components/event/print/PrintPayButton.tsx` (`"use client"`)
- Modify : `src/app/event/[eventId]/print/[requestId]/page.tsx` (plan 33)

**Interfaces :**
- Consumes : route de checkout (Task 5), `PaymentHistory`, `PAYMENT_HISTORY_SELECT`,
  `toPaymentHistoryItem` (Task 2).
- Produces :
  - `PrintPayButton({ orgId, eventId, requestId, amount, canPay, pending })` — `canPay`
    (OWNER hors mode staff) : bouton « Payer 150 000 FCFA » → `POST …/checkout`, puis
    `window.location.assign(url)` ; désactivé pendant la requête (`useAsyncAction`) ;
    erreurs : `PAYMENT_IN_PROGRESS` → « Un paiement est déjà en cours d'ouverture.
    Réessayez dans un instant. », `PAYMENTS_DISABLED` → « Le paiement en ligne n'est pas
    disponible pour le moment. », `REQUEST_NOT_PAYABLE` → « Ce devis n'est plus payable.
    Rechargez la page. », autre → « Le paiement n'a pas pu démarrer. Réessayez. ».
    `pending` → mention « Un paiement est en cours. Vous pouvez le reprendre. » au-dessus
    du bouton. `canPay` faux → « Seul le propriétaire de l'organisation peut payer ce
    devis. », sans bouton.
  - Page : le bloc d'actions affiche `PrintPayButton` quand `status === "ACCEPTED"` ; carte
    « Paiements » (`PaymentHistory`, paiements de la demande) dès qu'il en existe un.

- [ ] **Step 1 : implémenter.**
- [ ] **Step 2 : navigateur** (`make db-seed`, demande `ACCEPTED` créée par le seed du plan
  33 ou en BDD) à 375 px et 1280 px : OWNER voit « Payer … FCFA » et est redirigé vers la
  page sandbox FedaPay ; MANAGER voit la mention ; staff (mode staff) voit la mention.
- [ ] **Step 3 : `make lint && make typecheck`.**
- [ ] **Step 4 : commit** — `feat(impression): bouton de paiement du devis`.

## Task 10 — Écran staff : historique des paiements

**Files :**
- Modify : `src/app/platform/print/requests/[requestId]/page.tsx`,
  `src/components/staff/print/RequestStatusActions.tsx` (plan 33)

**Interfaces :**
- Consumes : route `…/mark-paid` (plan 33, Task 8 ci-dessus), `PaymentHistory`,
  `PAYMENT_HISTORY_SELECT`, `toPaymentHistoryItem` (Task 2).
- Produces :
  - Page : carte « Paiements » (`PaymentHistory`, paiements de la demande) dès qu'il en
    existe un.
  - « Marquer payée » du plan 33 (inchangé sinon) : rappel « À utiliser pour un paiement
    reçu hors FedaPay (virement, espèces). » dans son `Dialog`, et erreur
    `PAYMENT_IN_PROGRESS` → « Un paiement FedaPay est en cours sur cette demande. ».

- [ ] **Step 1 : implémenter.**
- [ ] **Step 2 : navigateur** en `STAFF_ADMIN`, 375 et 1280 px : une demande avec un
  paiement `PENDING` → « Marquer payée » refusé avec le message ; historique visible.
- [ ] **Step 3 : `make lint && make typecheck`.**
- [ ] **Step 4 : commit** — `feat(impression): historique des paiements cote staff`.

## Task 11 — E2E et documentation

**Files :**
- Create : `e2e/event/print-payment-return.spec.ts` (page de retour)
- Modify : `e2e/event/print-request.spec.ts` et `e2e/platform/print-request-detail.spec.ts`
  (plan 33 : un fichier par page), `e2e/helpers/db.ts` (demande `ACCEPTED`, `Payment`
  d'impression), `docs/v4/features/paiements-fedapay.md`, `docs/v4/README.md`

**Interfaces :**
- Consumes : tout ce qui précède. Règles e2e : un fichier par page, jamais `page.request`
  dans une spec UI, helpers de `e2e/helpers/`. FedaPay n'est pas appelé en e2e : la page de
  retour est testée sur un `Payment` déjà `APPROVED` (aucune relecture FedaPay).

- [ ] **Step 1 : `print-request.spec.ts`** (détail organisateur) — OWNER : bouton « Payer
  150 000 FCFA » visible ; MANAGER : mention « Seul le propriétaire de l'organisation peut
  payer ce devis. ». **`print-payment-return.spec.ts`** — page de retour d'un paiement
  `APPROVED` ayant soldé la demande (`paidPaymentId`) : « Paiement confirmé » ; `id`
  inconnu : « Paiement introuvable. ».
- [ ] **Step 2 : `print-request-detail.spec.ts`** (détail staff) — carte « Paiements » avec
  un paiement d'impression ; « Marquer payée » refusé avec le message de paiement en cours
  quand un `Payment` `PENDING` existe (le marquage nominal est déjà couvert au plan 33).
- [ ] **Step 3 : lancer les e2e** — attendu : PASS (ainsi que
  `e2e/platform/subscription-flow.spec.ts` et `organization-subscription.spec.ts`, colonne
  « Objet »).
- [ ] **Step 4 : documentation** — `paiements-fedapay.md` : section « Paiement d'un devis
  d'impression » (parcours, `purpose`, un seul paiement en cours, cas du paiement hors
  contexte, marquage manuel, URL de retour) ; ligne dans `docs/v4/README.md`.
- [ ] **Step 5 : commit** — `docs(impression): paiement des devis`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` (couverture 100 %).
- [ ] E2E des deux nouvelles specs et des specs abonnement existantes.
- [ ] **Sandbox FedaPay de bout en bout** : OWNER paie un devis de démo avec un numéro de
  test approuvé → page de retour « Paiement confirmé », demande `PAID`, entrée du fil,
  notification dans Mailpit ; numéro de test d'échec → demande `ACCEPTED`, « Payer » de
  nouveau proposé ; second clic sur « Payer » sans payer → même transaction FedaPay
  (vérifier que `POST /transactions/{id}/token` sur une transaction existante est accepté).
- [ ] Un paiement d'abonnement en sandbox fonctionne toujours (retour, limites).

---

## Auto-relecture

- **Couverture de la spec 34** : `purpose`/`planId` nullable/`printRequestId` (T1) ;
  aiguillage, transition unique, fil, notifications (T4) ; webhook et tâche horaire sans
  changement (T6) ; `resolvePaymentReturn` et `PaymentHistory` adaptés (T1, T2) ; parcours
  checkout → retour (T3, T5, T7) ; paiement intégral de `acceptedTotal` (T3) ; OWNER seul,
  staff 403 (T5) ; un seul `PENDING`, réutilisation, ancien `CANCELED` (T3) ; refus de la
  réouverture pendant un `PENDING` : porté par `isPaymentInProgress` du plan 33, dont le
  corps réel est branché en T1 sur l'index de T1 ;
  paiement tardif hors contexte (T4) ; historique côté organisateur et staff (T9, T10) ;
  marquage manuel audité (plan 33 ; notification et refus pendant un paiement en T8) ;
  `MISMATCH` (T4) ; abonnements inchangés (contrainte globale, T6, vérification finale).
- **Contrat partagé** : signatures consommées du plan 33 listées une fois, vérifiées en
  T3 step 1 ; produits annoncés au plan 33 (`Payment.printRequestId`, index
  `[printRequestId, status]`, corps de `paymentProbe`) en T1.
- **Cohérence des noms** : `startPrintRequestCheckout`, `resolvePrintPaymentReturn`,
  `notifyPrintRequestPaid`, `notifyPrintPaymentUnmatched`, codes `REQUEST_NOT_FOUND` /
  `REQUEST_NOT_PAYABLE` / `PAYMENT_IN_PROGRESS` (`PaymentError`), `STAFF_FORBIDDEN` /
  `OWNER_REQUIRED` (`PrintRequestError` du plan 33), entrées du fil `PAYMENT_FAILED` (plan
  33) / `PAYMENT_UNMATCHED` (ajoutée ici) : identiques dans toutes les tasks.
- **Paiement qui a soldé la demande** : `PrintRequest.paidPaymentId`, posé par `markPaid`
  (plan 33), fonde la règle `PAID` / `UNMATCHED` de la page de retour (T7).
