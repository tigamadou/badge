# Vague 2 · Lot 2b — Abonnement, paiements, tarifs — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2b feat/retours-client-v3` (le script crée `feat/retours-client-v3-2b`) ; branche du lot
> `feat/retours-client-v3-2b` (depuis `feat/retours-client-v3`, **après** la vague 1). Toutes les
> commandes `make` se lancent **dans le worktree**. Sous-skill :
> `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. En
> exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan, messages en français ASCII, style conventional commits, sans co-auteur IA ; sinon aucun
> commit sans demande explicite de l'utilisateur. Modèle des sous-agents : `sonnet`.
> Commande de test ciblé : `make test FILE=<chemin>` ; e2e ciblé : `make test-e2e FILE=<chemin>`.

**Objectif :** (volet 2) interdire le paiement d'un même plan tant que l'abonnement est actif
(sauf renouvellement dans les 7 derniers jours) et facturer la montée en gamme au prorata du
montant réellement payé ; (volet 3) un module Paiements en lecture seule pour le staff et les
organisations, avec reçu imprimable ; (volet 4) une page `/tarifs` alimentée par les plans de la
base.

**Architecture :** la règle de changement de plan reste `planChangeFor` (pure, signature
inchangée, appelée par `confirmPayment` sous verrou et indirectement par le sweep). Une couche
de **devis** pure s'ajoute dans `subscription-changes.ts` (`computeProrataCredit`, `quoteChange`,
`coversFor`) ; `startCheckout` calcule le devis sous un verrou d'organisation, fige
`listPrice` / `prorataCredit` / `amount` sur le `Payment` et réutilise un `Payment` PENDING
existant ; `confirmPayment` écrit `coversFrom` / `coversTo` à l'application. Le module Paiements
est un jeu de pages serveur qui lisent via `src/lib/payments-query.ts` (filtres dans l'URL,
pagination du socle) ; le reçu est un document HTML autonome servi par un route handler. `/tarifs`
et `PricingCards` lisent `Plan` via un helper `listPublicPlans()`.

**Tech Stack :** Next.js 16 (App Router), Prisma 6 / MySQL 8, Vitest 4, Playwright, Tailwind 4.

**Spec :** [`specs/2026-11-04-38-v4-retours-client.md`](../specs/2026-11-04-38-v4-retours-client.md)
— volets 2, 3, 4 et « Organisation du travail » (contrats du socle, fichiers par lot, table de
contrôle). Plan du socle : `2026-11-04-1-socle-retours-client.md` (il prime sur les hypothèses
ci-dessous en cas d'écart de signature : le signaler dans la progression).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|------|----------|--------|------|-------|
| 1 | Fabriques de lot + règles pures de devis (prorata, fenêtre 7 j, périodes couvertes) | [x] | 2026-11-04 |  |
| 2 | Extraire la résolution d'un paiement PENDING candidat (sans changement de comportement) | [x] | 2026-11-04 |  |
| 3 | `startCheckout` : devis, garde PENDING, montée en gamme malgré un plan programmé | [ ] | | |
| 4 | `confirmPayment` : montant figé, `coversFrom/To`, écart de crédit, paiement tardif | [ ] | | |
| 5 | Route checkout, page Abonnement, `PlanCatalog` (aperçu du prorata), `PaymentHistory` | [ ] | | |
| 6 | `payments-query` + `subscription-path` | [ ] | | |
| 7 | Module Paiements côté organisation (liste, fiche, reçu, menu) | [ ] | | |
| 8 | Module Paiements côté staff (liste, fiche, reçu, menu) | [ ] | | |
| 9 | Plans : champs publics (API, page et formulaire staff) | [ ] | | |
| 10 | `/tarifs` et `PricingCards` dynamiques, `ComparisonTable` | [ ] | | |
| 11 | Seed démo : plans visibles, paiements cohérents | [ ] | | |
| 12 | e2e, doc, vérification | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Après chaque task
validée : statut `[x]` + date ; en cas d'interruption : `[~]`, date et état précis (step en
cours, fichiers touchés).

## Fichiers du lot (exclusifs)

Source : spec, « Fichiers par lot — 2b ». Rien d'autre ne se modifie.

- Lib : `src/lib/subscription-changes.ts`, `src/lib/payments.ts`, `src/lib/payment-return.ts`,
  `src/lib/payment-history.ts`, `src/lib/subscription-path.ts`, `src/lib/payments-query.ts`
  [nouveau].
- API : `src/app/api/org/[orgId]/subscription/**`, `src/app/api/webhooks/fedapay/**`,
  `src/app/api/platform/plans/**`. (Pas de route API de paiements : les pages lisent
  `payments-query` côté serveur, comme la page Abonnement actuelle.)
- Pages : `src/app/org/[orgId]/subscription/**`, `src/app/org/[orgId]/payments/**` [nouveau],
  `src/app/platform/payments/**` [nouveau], `src/app/platform/plans/**`,
  `src/app/platform/organizations/[orgId]/subscription/**`, `src/app/(marketing)/tarifs/**`,
  `src/app/(marketing)/page.tsx` (usage de `PricingCards` seulement — aucune modification
  attendue).
- Composants : `src/components/admin/PlanCatalog.tsx`, `src/components/admin/PaymentHistory.tsx`
  (props existantes conservées), `src/components/admin/OrgShell.tsx`,
  `src/components/staff/StaffShell.tsx`, `src/components/staff/PlanManager.tsx`,
  `src/components/marketing/PricingCards.tsx`, `src/components/marketing/ComparisonTable.tsx`,
  `src/components/payments/**` [nouveau].
- Seed : `prisma/seed/demo/billing/**`.
- Tests / e2e : les tests de ces fichiers, `e2e/helpers/nav.ts`, `e2e/org/subscription.spec.ts`,
  `e2e/platform/subscription-flow.spec.ts`, `e2e/platform/organization-subscription.spec.ts`,
  `e2e/platform/plans.spec.ts`, `e2e/public/marketing.spec.ts`, `e2e/*/payments*.spec.ts`
  [nouveaux].
- Fichiers nouveaux **non listés par la spec mais autorisés par sa règle « fabriques / helpers
  par lot »** (socle, point 5) : `src/test/factories-billing.ts`, `e2e/helpers/billing.ts`.
  Nouveau fichier à ajouter à la liste du lot (à signaler à l'orchestrateur) :
  `src/lib/public-plans.ts` (+ son test) — helper de lecture des plans publics.
- Docs : `docs/v4/features/abonnements.md`, `docs/v4/features/paiements-fedapay.md`.

**Lecture seule (contrats du socle et fichiers des autres lots)** : `prisma/schema.prisma`,
`src/lib/image-dimensions.ts`, `src/lib/list-query.ts`, `src/lib/badge-list-query.ts`,
`src/components/ui/Pagination.tsx`, `src/lib/activity-labels.ts`, `src/test/factories.ts`,
`e2e/helpers/db.ts`, `prisma/seed/minimal.ts`, **`src/lib/jobs/subscription-sweep.ts`** (et son
test : on les exécute, on ne les modifie pas), `src/components/layout/AppShell.tsx`, tout fichier
de 2a / 2c. **Besoin d'y toucher → s'arrêter et le signaler** (ex. un champ Prisma manquant, un
`ActivityType` manquant, une signature du socle différente de celle de la spec).

## Contrats du socle consommés (tels qu'écrits dans la spec)

- `Payment` : `listPrice Int?`, `prorataCredit Int?`, `coversFrom DateTime?`, `coversTo DateTime?`.
- `Plan` : `publicVisible Boolean @default(false)`, `position Int @default(0)`,
  `description String? @db.Text`, `features Json?` (tableau de libellés),
  `highlighted Boolean @default(false)`.
- `src/lib/list-query.ts` : `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE = 20`,
  `parseListPage(params, opts?) → { page, pageSize, skip, take }`.
- `src/components/ui/Pagination.tsx` : `UrlPagination` (client ; met à jour `page`/`pageSize`
  dans l'URL). **Ses props ne sont pas fixées par la spec** : à la Task 7, lire la signature
  réelle livrée par le socle et l'utiliser telle quelle (hypothèse de ce plan :
  `<UrlPagination page={p} totalPages={tp} total={n} pageSize={s} />`).
- Pas de nouvel `ActivityType` ajouté par 2b : on réutilise `PAYMENT_INITIATED`, `PAYMENT_APPROVED`,
  `SUBSCRIPTION_UPDATED`, `PLAN_CREATED`, `PLAN_UPDATED`, ainsi que `PAYMENT_PRORATA_MISMATCH`
  (déjà ajouté par le socle) pour journaliser l'écart de prorata.

## Arbitrages de ce plan (écarts spec ↔ code relevés à la lecture)

1. **`planChangeFor` reçoit aujourd'hui `{ ...plan, price: payment.amount }`** (payments.ts,
   `confirmPayment`). Avec un prorata, `amount` < prix plein : la comparaison « plus cher / moins
   cher » serait faussée. On passe désormais `listPrice ?? amount`. La signature et la logique
   de `planChangeFor` ne changent pas (le sweep et le seed démo l'appellent / s'y fient).
2. **La fenêtre des 7 jours et le blocage « même plan » ne sont appliqués qu'à la création du
   paiement** (`quoteChange`). À la confirmation, l'argent est reçu : `planChangeFor` applique
   toujours EXTENSION pour le même plan (deux paiements concurrents ne perdent jamais d'argent).
3. **`startCheckout` bloque tout si un plan est programmé** (`CHANGE_ALREADY_SCHEDULED`) : la
   spec veut au contraire autoriser montée en gamme (qui annule le programmé) et renouvellement
   en fenêtre. Seul un nouveau changement de mode SCHEDULED reste refusé.
4. **Remplacement d'un PENDING d'abonnement** : aujourd'hui un paiement `CANCELED` d'abonnement
   n'est plus confirmable (`CONFIRMABLE` = PENDING/EXPIRED). Un PENDING remplacé puis payé chez
   FedaPay serait de l'argent sans trace. On rend `CANCELED` confirmable pour les paiements
   d'abonnement **uniquement si FedaPay les donne approuvés** (le code existant
   `payment.status === "CANCELED" && !isPaidStatus` couvre déjà le cas contraire). Le sweep ne
   rejoue que les paiements d'impression : le rattrapage des abonnements remplacés repose sur le
   webhook et la page de retour (à signaler).
5. **Réutilisation d'un PENDING** : le crédit varie à la milliseconde, donc le montant ne peut
   pas servir de clé. Règle : un PENDING d'abonnement avec transaction, **même plan**, créé il y a
   moins de 30 min et toujours `pending` chez FedaPay est réutilisé (montant figé inchangé) ;
   sinon il est remplacé. Un PENDING sans transaction de moins de 2 min → `PAYMENT_IN_PROGRESS`.
6. **Montant dû ≤ 0 après crédit** : FedaPay ne sait pas encaisser 0. La spec parle d'un
   « plancher 0 » sans dire quoi faire ensuite. Décision : erreur `NOTHING_TO_PAY` (409),
   message « Votre crédit couvre déjà ce plan : contactez le support ». À valider par
   l'utilisateur.
7. **Arrondi** : plancher appliqué **par paiement** puis somme (jamais de sur-crédit). Calcul en
   `BigInt` (10 000 000 XOF × 365 j en ms dépasse 2^53).
8. **Écart de crédit à la confirmation** (choix « [B] » de la spec) : le paiement est appliqué au
   montant figé et l'écart est tracé dans l'audit (`creditDrift`) ; pas de refus.
9. **Mode SCHEDULED** : `coversFrom` = ancienne échéance, `coversTo` = ancienne échéance + période
   du plan programmé (identique à ce qu'appliquera `settleSubscription`).
10. **Reçu** : route handler `…/receipt/route.ts` qui renvoie un document HTML complet (hors
    layout/menu, rendu par `renderToStaticMarkup`) ; aucune page n'a à masquer le menu à
    l'impression. Repli si l'import `react-dom/server` est refusé par Next : construire la chaîne
    HTML à la main avec un `escapeHtml` testé.
11. **Pages tarifs / accueil** : `PricingCards` devient asynchrone et appelle `noStore()` dans
    `listPublicPlans()` → les deux pages restent dynamiques sans toucher `(marketing)/page.tsx`
    (et sans requête base au `next build`).

## Global Constraints

Reprise de `CLAUDE.md` (« Règles de test » et règles d'écriture) — valables pour chaque task :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (`badge_<lot>_test` pour un agent),
  jamais sur la base de dev ; `make test` crée et met au schéma la base (`make test-db`).
- **Pas de mock de la base ni de Prisma** : MySQL réel (verrous `FOR UPDATE`, unicité,
  transactions). Seuls les services externes se mockent : **FedaPay** (`fetch` simulé comme dans
  `src/lib/__tests__/payments.test.ts`), SMTP, session NextAuth.
- **Fabriques** : données préparées avec `src/test/factories.ts` (lecture seule) et
  `src/test/factories-billing.ts` (Task 1) ; `@faker-js/faker`, graine fixée par fichier
  (`seedFactories`). Pas de `prisma.*.create` dupliqués dans les nouveaux tests. Les tests
  existants (`payments.test.ts`…) gardent leurs `seed()` inline.
- **Ne jamais modifier le code de production pour faire passer un test** ni atteindre la
  couverture : s'arrêter et demander.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (gate `vitest.config.ts`).
- **e2e** (Playwright) contre l'app en cours d'exécution, fixtures préfixées et nettoyées
  (`cleanupE2ETestData` ; les plans créés par un spec sont supprimés explicitement dans son
  `afterAll`, voir `e2e/platform/plans.spec.ts`).
- RBAC via `src/lib/auth.ts` / `with-org-auth` / `with-staff-auth` avant toute action ; toute
  action sensible loguée via `logActivity` ; ne jamais exposer secrets ni tokens.
- UI et messages en **français avec accents** ; code et identifiants en anglais ; commentaires de
  code en français, style du fichier ; montants en **FCFA** (`Intl.NumberFormat("fr-FR")`).
- Montants en XOF entiers. Dates serveur en UTC.
- Aucune action git destructive ; `make db-reset` interdit sans demande.

## Review Focus

Les cinq risques que les tests « nominaux » du volet ne couvrent pas, du plus probable au moins
probable ; chacun a son test dans la task indiquée.

1. **Concurrence checkout ↔ webhook ↔ checkout** (Tasks 3, 4) : deux `startCheckout` simultanés
   pour une même org créent **un seul** Payment PENDING ; un webhook qui approuve pendant qu'un
   second checkout remplace le PENDING ne perd pas l'argent (CANCELED approuvé ensuite →
   appliqué) ; deux confirmations concurrentes du même paiement n'appliquent qu'une fois ; deux
   paiements du même plan confirmés l'un après l'autre prolongent deux fois.
2. **Arrondis et débordements** (Task 1) : crédit en `BigInt` (prix 10 000 000 × 365 j), plancher
   par paiement, `credit ≤ listPrice` stocké de sorte que `listPrice − prorataCredit = amount`,
   crédit nul pour une période offerte (paiement sans `coversFrom/To`) et pour un paiement dont
   `coversTo ≤ now` ou `coversFrom > now` (période future non entamée = crédit entier).
3. **Fenêtre de 7 jours** (Tasks 1, 3, 5) : à J−7 pile (inclus) le renouvellement est permis,
   à J−7 + 1 ms il est bloqué avec la date `renewableFrom` ; abonnement sans échéance = bloqué ;
   abonnement échu mais encore ACTIVE (sweep pas encore passé) = paiement libre (IMMEDIATE) ;
   plan programmé + renouvellement en fenêtre = autorisé et le plan programmé est conservé ;
   plan programmé + montée en gamme = autorisée et le programmé est annulé.
4. **Écart entre devis et confirmation** (Task 4) : l'abonnement a changé entre la création du
   paiement et la confirmation (autre plan, extension) → appliqué au montant figé, `creditDrift`
   dans l'audit, jamais d'exception ; montant FedaPay ≠ `amount` figé → toujours refusé
   (MISMATCH), y compris pour un paiement avec prorata.
5. **Isolation des pages Paiements** (Tasks 6 à 8) : un manager d'une org A ne voit ni ne devine
   (`paymentId` direct) un paiement de l'org B (404, pas 403) ; un paiement d'impression n'a pas
   de bloc « plan » ni de prorata ; reçu refusé tant que le paiement n'est pas `APPROVED` ;
   filtres invalides ignorés (jamais d'erreur 500) ; les contenus saisis (nom d'org, libellé de
   fonctionnalité d'un plan) sont échappés dans le reçu et sur `/tarifs`.

## Interfaces de référence (utilisées par plusieurs tasks)

```ts
// src/lib/subscription-changes.ts (Task 1)
export const RENEWAL_WINDOW_DAYS = 7;
export type CoveredPayment = { amount: number; coversFrom: Date | null; coversTo: Date | null };
export function computeProrataCredit(payments: CoveredPayment[], now: Date): number;
export async function loadProrataCredit(
  db: Pick<Prisma.TransactionClient, "payment">, orgId: string, planId: string, now: Date,
): Promise<number>;
export type CheckoutQuote =
  | { allowed: true; mode: SubscriptionChangeMode; listPrice: number; credit: number;
      amount: number; daysLeft: number | null }
  | { allowed: false; reason: "ALREADY_ACTIVE"; activeUntil: Date | null; renewableFrom: Date | null };
export function quoteChange(
  current: SubscriptionState | null, target: PlanLite, now: Date, credit: number,
): CheckoutQuote;
export function coversFor(
  change: PlanChange, current: SubscriptionState | null, target: PlanLite,
): { coversFrom: Date; coversTo: Date };

// src/lib/payments.ts (Tasks 3-4) : PaymentErrorCode gagne
//   "ALREADY_ACTIVE" (409, porte renewableFrom/activeUntil) | "NOTHING_TO_PAY" (409)
// PaymentError gagne un champ optionnel readonly detail?: { activeUntil: Date | null; renewableFrom: Date | null }

// src/lib/payments-query.ts (Task 6)
export type PaymentFilters = {
  status?: PaymentStatus; purpose?: PaymentPurpose; orgId?: string;
  from?: Date; to?: Date; q?: string;
};
export function parsePaymentFilters(
  params: Record<string, string | string[] | undefined>, opts: { allowOrg: boolean },
): PaymentFilters;
export function paymentWhere(filters: PaymentFilters, scope: { orgId?: string }): Prisma.PaymentWhereInput;
export async function listPayments(
  filters: PaymentFilters, scope: { orgId?: string }, page: { skip: number; take: number },
): Promise<{ items: PaymentListItem[]; total: number }>;
export async function loadPayment(id: string, scope: { orgId?: string }): Promise<PaymentDetail | null>;

// src/lib/public-plans.ts (Task 10)
export type PublicPlan = { id: string; name: string; period: SubscriptionPeriod; price: number | null;
  maxEvents: number | null; maxParticipantsPerEvent: number | null; description: string | null;
  features: string[]; highlighted: boolean };
export async function listPublicPlans(): Promise<PublicPlan[]>;
```

---

### Task 1: Fabriques de lot + règles pures de devis

**Files:**
- Create: `src/test/factories-billing.ts`
- Modify: `src/lib/subscription-changes.ts` (ajouts ; `planChangeFor`, `isRunning`,
  `expiryTransition`, `settleSubscription` **inchangés**)
- Test: `src/lib/__tests__/subscription-changes.test.ts` (compléter ; garder les tests existants)
  et `src/lib/__tests__/subscription-quote.test.ts` [nouveau]

**Interfaces:**
- Consumes: `planChangeFor`, `isRunning`, `PERIOD_DAYS`, `computeSubscriptionDates` (existants),
  champs `Payment.listPrice/prorataCredit/coversFrom/coversTo` (socle).
- Produces: les signatures de « Interfaces de référence » (bloc `subscription-changes.ts`) et,
  dans `factories-billing.ts` : `makeBillingPlan(data?)`, `makeSubscription(orgId, planId, data?)`,
  `makeBillingPayment(input: { orgId; planId; amount; status?; userId?; coversFrom?; coversTo?;
  listPrice?; prorataCredit?; mode?; approvedAt?; fedapayTransactionId?; createdAt? })`,
  `makePrintPayment(input)` — toutes `async`, écrivent dans la base de test et renvoient la ligne.

- [ ] **Step 1: écrire `src/test/factories-billing.ts`** sur le modèle de `src/test/factories.ts`
  (même usage de `faker`, `seedFactories` importé, noms de plan uniques via `faker.string.alphanumeric`).
  `makeBillingPlan` / `makeBillingPayment` portent des noms distincts de `makePlan` / `makePayment(orgId, data)` du socle
  (`src/test/factories.ts`, défaut `PENDING`), qui restent inchangés ; `makeBillingPayment` pose `status: "APPROVED"` et `approvedAt` par défaut ; `fedapayTransactionId`
  aléatoire (plage 900 000 000+) quand non fourni et statut ≠ PENDING.

- [ ] **Step 2: écrire les tests purs (échouent)** dans `subscription-quote.test.ts`
  (`describe("computeProrataCredit")`) :
  - `it("sans période couverte ne donne aucun crédit")` : `[{amount: 30000, coversFrom: null, coversTo: null}]` → `0`.
  - `it("crédite le restant au prorata, plancher")` : `{amount: 30000, coversFrom: J0, coversTo: J0+30j}`, `now = J0+10j` → `20000` ; `now = J0 + 10j + 1ms` → `19999` (plancher).
  - `it("une période future entière est créditée en entier")` : `coversFrom = now+30j`, `coversTo = now+60j`, `amount: 30000` → `30000`.
  - `it("ignore une période échue")` : `coversTo = now` → `0` ; `coversTo < now` → `0`.
  - `it("somme les paiements (extension comprise)")` : deux périodes consécutives de 30 j, `now` au milieu de la première → `15000 + 30000 = 45000` pour 30 000 chacune.
  - `it("ne déborde pas sur de gros montants")` : `amount: 10_000_000`, période 365 j, `now = coversFrom + 1 j` → `Math.floor(10_000_000 * 364 / 365)` (= `9972602`).
  - `it("plancher par paiement")` : deux paiements qui valent chacun `x.5` → somme des planchers.

  `describe("quoteChange")` (états construits à la main, `now` fixe) :
  - même plan, `endDate = now+8j` → `{ allowed:false, reason:"ALREADY_ACTIVE", activeUntil: endDate, renewableFrom: endDate−7j }`.
  - même plan, `endDate = now+7j` exactement → `allowed:true, mode:"EXTENSION", credit:0, amount:listPrice` ; `now+7j+1ms` → bloqué.
  - même plan, `endDate = null` (ACTIVE) → `allowed:false`, `renewableFrom:null`, `activeUntil:null`.
  - plan moins cher → `mode:"SCHEDULED", credit:0, amount:listPrice`.
  - plan plus cher, `credit = 12000`, `listPrice = 30000` → `IMMEDIATE, amount:18000, credit:12000, daysLeft` = jours restants arrondis au supérieur.
  - plan plus cher, `credit = 50000` ≥ prix → `IMMEDIATE, credit:30000, amount:0` (crédit plafonné au prix : `listPrice − credit = amount`).
  - abonnement échu / EXPIRED / `null` → `IMMEDIATE, credit:0, amount:listPrice` même si `credit` non nul fourni.
  - comparaison de prix brute entre périodes : mensuel 30 000 → annuel 450 000 = IMMEDIATE ; annuel → mensuel = SCHEDULED.

  `describe("coversFor")` : IMMEDIATE → `[data.startDate, data.endDate]` ; EXTENSION →
  `[current.endDate, data.endDate]` ; SCHEDULED → `[current.endDate, current.endDate + PERIOD_DAYS[target.period]]`.

  `describe("loadProrataCredit")` (base réelle, fabriques) : ne retient que les paiements
  `SUBSCRIPTION`, `APPROVED`, de l'org, du **plan courant**, avec `coversTo > now` ; ignore
  `PENDING`, un autre plan, une autre org, un paiement d'impression ; un paiement sans
  `coversFrom/coversTo` compte 0.

- [ ] **Step 3: lancer et constater l'échec**
  Run: `make test FILE=src/lib/__tests__/subscription-quote.test.ts`
  Expected: FAIL (`computeProrataCredit is not a function` / import manquant).

- [ ] **Step 4: implémenter** dans `src/lib/subscription-changes.ts` les signatures de
  « Interfaces de référence ». Algorithme du crédit à fixer :
  par paiement avec `coversFrom`/`coversTo` non nuls et `coversTo > now`,
  `restant = coversTo − max(now, coversFrom)` (ms), `durée = coversTo − coversFrom`,
  `crédit_i = Number((BigInt(amount) * BigInt(restant)) / BigInt(durée))` (division entière =
  plancher), puis somme. `quoteChange` : (1) abonnement en cours (`isRunning`), même plan et
  `endDate === null` → bloqué ; (2) `change = planChangeFor(current, target, now)` ; (3) EXTENSION
  avec `endDate − now > RENEWAL_WINDOW_DAYS` jours → bloqué (`renewableFrom = endDate − 7 j`) ;
  (4) IMMEDIATE avec abonnement en cours → `credit = min(credit, listPrice)`, sinon `0` ;
  `amount = listPrice − credit` ; `listPrice = target.price ?? 0`. `loadProrataCredit` lit les
  paiements puis délègue à `computeProrataCredit`.

- [ ] **Step 5: relancer**
  Run: `make test FILE=src/lib/__tests__/subscription-quote.test.ts` puis
  `make test FILE=src/lib/__tests__/subscription-changes.test.ts`
  Expected: PASS (les tests existants de `planChangeFor`/`settleSubscription` restent verts).

- [ ] **Step 6: Commit** (exécution automatisée seulement)
  `git add src/test/factories-billing.ts src/lib/subscription-changes.ts src/lib/__tests__/subscription-quote.test.ts`
  `git commit -m "feat(abonnements): devis, prorata et fenetre de renouvellement"`

---

### Task 2: Extraire la résolution d'un PENDING candidat (refactor sans changement de comportement)

**Files:**
- Modify: `src/lib/payments.ts` (fonction privée extraite de `startPrintRequestCheckout`)
- Test: `src/lib/__tests__/payments-print-request.test.ts` (**inchangé** : il sert de filet)

**Interfaces:**
- Consumes: `retrieveTransaction`, `createPaymentUrl`, `failPayment`, `confirmPayment`,
  `providerError` (existants).
- Produces: `async function resolveCandidate(candidate: Candidate, attempt: number):
  Promise<{ url: string } | "RETRY">` — reprend à l'identique le bloc « Paiement PENDING déjà
  ouvert chez FedaPay » (statut relu ; `pending` → URL de paiement, avec un seul remplacement si
  le jeton est refusé ; transaction inconnue → `failPayment(stale, "CANCELED", "REPLACED")` ;
  autre statut → `confirmPayment`), `"RETRY"` signalant qu'il faut recréer/relire.

- [ ] **Step 1: lancer le filet avant refactor**
  Run: `make test FILE=src/lib/__tests__/payments-print-request.test.ts`
  Expected: PASS (référence).

- [ ] **Step 2: extraire** le bloc en `resolveCandidate` et faire appeler la fonction par la
  boucle d'impression (`if ("url" in r) return { paymentId: candidate.id, url: r.url }`). Aucun
  changement de message, d'ordre d'appel ni de code d'erreur.

- [ ] **Step 3: relancer le filet**
  Run: `make test FILE=src/lib/__tests__/payments-print-request.test.ts`
  Expected: PASS, mêmes tests, aucun test modifié.

- [ ] **Step 4: Commit** `git commit -am "refactor(paiements): extraire la resolution d'un paiement candidat"`

---

### Task 3: `startCheckout` — devis, garde PENDING, montée en gamme malgré un plan programmé

**Files:**
- Modify: `src/lib/payments.ts` (`PaymentErrorCode`, `HTTP_STATUS`, `PaymentError.detail`,
  `startCheckout`, nouveau `prepareSubscriptionCheckout`)
- Test: `src/lib/__tests__/payments.test.ts` (adapter les cas existants qui supposaient
  `CHANGE_ALREADY_SCHEDULED` systématique), `src/lib/__tests__/payments-checkout-quote.test.ts`
  [nouveau]

**Interfaces:**
- Consumes: `quoteChange`, `loadProrataCredit`, `isRunning` (Task 1), `resolveCandidate`
  (Task 2), `openTransaction`.
- Produces: `startCheckout(input)` renvoie toujours `{ paymentId: string; url: string }` ;
  nouvelles erreurs `ALREADY_ACTIVE` (409, `detail`), `NOTHING_TO_PAY` (409) ; le `Payment`
  créé porte `listPrice`, `prorataCredit`, `amount` (= `listPrice − prorataCredit`) ; constantes
  `CHECKOUT_REUSE_MS = 30 * 60 * 1000` (le `CHECKOUT_OPENING_MS` de 2 min existant est réutilisé).

- [ ] **Step 1: écrire les tests (échouent)**, FedaPay simulé par `fetch` comme dans
  `payments.test.ts` (`txBody`, `jsonResponse`), données via `factories-billing` :
  - `it("refuse le même plan hors fenêtre")` : abonnement ACTIVE plan `pro`, `endDate = now+20j`
    → rejette `PaymentError` code `ALREADY_ACTIVE` avec `detail.renewableFrom = endDate−7j` ;
    aucun `Payment` créé.
  - `it("accepte le renouvellement à J-7 et conserve un plan programmé")` : `endDate = now+6j`,
    `scheduledPlanId = basic.id` → `Payment` créé, `amount = pro.price`, `prorataCredit = 0`,
    `listPrice = pro.price` ; l'abonnement n'est pas modifié par le checkout.
  - `it("accepte la montée en gamme avec un plan programmé")` : plan courant `basic` (5 000, payé
    5 000 sur 30 j, `now` à mi-période), cible `pro` (15 000), `scheduledPlanId` renseigné →
    `Payment.listPrice = 15000`, `prorataCredit = 2500`, `amount = 12500` ; la transaction FedaPay
    est créée avec 12 500.
  - `it("refuse un second changement programmé")` : plan courant `pro`, cible `basic`, déjà un
    `scheduledPlanId` → `CHANGE_ALREADY_SCHEDULED`.
  - `it("période offerte par le staff : aucun crédit")` : paiement approuvé sans `coversFrom/To`
    → `prorataCredit = 0`.
  - `it("crédit supérieur au prix : NOTHING_TO_PAY")` : `amount` calculé ≤ 0 → erreur, aucun Payment.
  - `it("un seul PENDING par organisation")` : deux `startCheckout` lancés avec `Promise.all`
    → un seul `Payment` PENDING créé en base ; le second renvoie la même URL (candidat réutilisé)
    ou lève `PAYMENT_IN_PROGRESS` (jamais deux lignes).
  - `it("réutilise un PENDING du même plan de moins de 30 min")` : même `paymentId`, montant figé
    inchangé, aucun nouvel appel `createTransaction`.
  - `it("remplace un PENDING d'un autre plan ou de plus de 30 min")` : ancien passé `CANCELED`,
    nouveau PENDING, un seul PENDING restant.
  - `it("PENDING sans transaction de moins de 2 min : PAYMENT_IN_PROGRESS")`.
  - `it("journalise le prix plein et le crédit")` : `PAYMENT_INITIATED.details` contient
    `listPrice`, `prorataCredit`, `amount`, `planId`.
  - `it("abonnement échu mais ACTIVE : IMMEDIATE sans crédit")`.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/lib/__tests__/payments-checkout-quote.test.ts`
  Expected: FAIL (codes d'erreur et champs absents).

- [ ] **Step 3: implémenter** `startCheckout` :
  (a) valider le plan (`PLAN_NOT_FOR_SALE`) et la config FedaPay (`PAYMENTS_DISABLED`) comme
  aujourd'hui, **sans** le contrôle `scheduledPlanId` ;
  (b) `prepareSubscriptionCheckout` dans une `prisma.$transaction` : verrou
  `SELECT id FROM Organization WHERE id = ${orgId} FOR UPDATE` (ordre de verrous : Organization
  puis rien d'autre — `confirmPayment` ne verrouille que `Subscription`, pas de cycle), lecture
  de l'abonnement + plan courant (`PLAN_LITE_SELECT`), `credit = isRunning ? loadProrataCredit(db,
  orgId, current.planId, now) : 0`, `quote = quoteChange(...)` ; `!quote.allowed` → `PaymentError
  ("ALREADY_ACTIVE")` avec `detail` ; `quote.mode === "SCHEDULED" && scheduledPlanId` →
  `CHANGE_ALREADY_SCHEDULED` ; `quote.amount <= 0` → `NOTHING_TO_PAY` ; puis la logique PENDING
  de `prepareCheckout` (impression) adaptée : candidat réutilisable = même `planId`, transaction
  présente, âge < `CHECKOUT_REUSE_MS` ; sinon l'ancien PENDING passe `CANCELED` (log
  `PAYMENT_FAILED` inutile) et un `Payment` est créé avec `listPrice`, `prorataCredit =
  listPrice − amount`, `amount` ;
  (c) hors transaction, boucle de 2 tentatives comme `startPrintRequestCheckout`, avec
  `resolveCandidate` ; nouveau paiement → `openTransaction` (montant = `payment.amount`).
  L'erreur `ALREADY_ACTIVE` est levée **avant** tout appel FedaPay.
  Mettre à jour `HTTP_STATUS` (409 pour les deux nouveaux codes) et `PaymentError.detail`.

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/lib/__tests__/payments-checkout-quote.test.ts` puis
  `make test FILE=src/lib/__tests__/payments.test.ts`
  Expected: PASS ; les cas de `payments.test.ts` dont l'attente change (plan programmé) sont
  réécrits selon l'arbitrage 3, les autres inchangés.

- [ ] **Step 5: Commit** `git commit -am "feat(paiements): devis au checkout, garde PENDING, montee en gamme avec plan programme"`

---

### Task 4: `confirmPayment` — montant figé, périodes couvertes, écart de crédit, paiement tardif

**Files:**
- Modify: `src/lib/payments.ts` (`confirmPayment`, constante `CONFIRMABLE_SUBSCRIPTION`)
- Modify: `src/lib/payment-return.ts` (uniquement si un test montre une régression)
- Test: `src/lib/__tests__/payments.test.ts`, `src/lib/__tests__/payment-return.test.ts`,
  `src/app/api/webhooks/fedapay/__tests__/*.test.ts` (ajout d'un cas), et
  **exécution seule** de `src/lib/jobs/__tests__/subscription-sweep.test.ts`

**Interfaces:**
- Consumes: `planChangeFor`, `coversFor`, `loadProrataCredit` (Task 1).
- Produces: `confirmPayment(fedapayTransactionId)` garde sa signature ; sur un paiement
  d'abonnement approuvé : `planChangeFor(current, { ...plan, price: payment.listPrice ??
  payment.amount }, now)`, `Payment.coversFrom/coversTo = coversFor(change, current, planLite)`
  écrits dans la même transaction que `mode` ; `PAYMENT_APPROVED.details` et
  `SUBSCRIPTION_UPDATED.details` gagnent `listPrice`, `prorataCredit` et, si le crédit
  recalculé diffère du figé pour un IMMEDIATE, `creditDrift: { frozen: number; current: number }`.
  **Arbitrage (relecture croisée)** : l'écart est en plus journalisé par une ligne dédiée
  `logActivity({ type: "PAYMENT_PRORATA_MISMATCH", orgId, targetId: payment.id, details: creditDrift })`
  (type fourni par le socle) ; ajouter le test correspondant.

- [ ] **Step 1: écrire les tests (échouent)** :
  - `it("IMMEDIATE : écrit coversFrom/coversTo = nouvelle période")` ; `EXTENSION` :
    `[ancienne échéance, nouvelle échéance]` ; `SCHEDULED` : `[échéance, échéance + période]`.
  - `it("compare sur le prix plein, pas sur le montant payé")` : montée en gamme payée au
    prorata avec `amount < prix du plan courant` (ex. courant 30 000, cible 45 000, crédit
    20 000, `amount` figé 25 000 < 30 000) → mode `IMMEDIATE` (et non SCHEDULED, ce que
    donnerait la comparaison sur `amount`).
  - `it("applique au montant figé et trace creditDrift")` : entre création et confirmation, un
    autre paiement a modifié l'abonnement → statut APPROVED, `creditDrift` présent dans le
    journal `PAYMENT_APPROVED`, aucune exception.
  - `it("refuse un montant FedaPay différent du montant figé")` : tx.amount = `listPrice` alors
    que `amount` figé = prix − crédit → `DECLINED` (MISMATCH).
  - `it("un PENDING remplacé (CANCELED) puis payé chez FedaPay est appliqué")` ; et
    `it("un CANCELED non approuvé reste sans effet")`.
  - `it("deux confirmations concurrentes n'appliquent qu'une fois")` : `Promise.all([
    confirmPayment(id), confirmPayment(id) ])` → un seul `applied: true`, une seule ligne
    `SUBSCRIPTION_UPDATED`.
  - `it("deux paiements du même plan s'additionnent")` : deux PENDING distincts approuvés →
    échéance = départ + 2 périodes (garantie « jamais d'argent perdu », arbitrage 2).
  - `it("un plan programmé est annulé par une montée en gamme et conservé par une extension")`.
  - Webhook : événement `transaction.approved` sur un paiement CANCELED d'abonnement → appliqué.
  - `payment-return` : issue `APPROVED` / `SCHEDULED` inchangées avec prorata.
  - Sweep : `make test FILE=src/lib/jobs/__tests__/subscription-sweep.test.ts` doit rester vert
    **sans modification** (preuve que `planChangeFor`/`settleSubscription` sont compatibles).

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/lib/__tests__/payments.test.ts`
  Expected: FAIL sur les nouveaux cas.

- [ ] **Step 3: implémenter** : `CONFIRMABLE_SUBSCRIPTION = [...CONFIRMABLE, "CANCELED"]` utilisé
  pour la garde d'entrée (`payment.purpose`) et le `updateMany` de la transaction d'abonnement
  (pas pour `failPayment`, qui garde `CONFIRMABLE`) ; dans la transaction sous verrou, après
  `planChangeFor`, calculer `covers = coversFor(change, current, planLite)` et l'écrire avec
  `mode` ; pour `IMMEDIATE` avec abonnement en cours, recalculer
  `loadProrataCredit(db, orgId, current.planId, now)` **avant** d'appliquer et comparer à
  `payment.prorataCredit ?? 0` (borné par `listPrice`) pour renseigner `creditDrift`. Retourner
  de la transaction `{ mode, drift }` ; le journal reste hors transaction (déjà le cas).

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/lib/__tests__/payments.test.ts`, puis `make test FILE=src/lib/__tests__/payment-return.test.ts`,
  `make test FILE=src/app/api/webhooks/fedapay`, `make test FILE=src/lib/jobs/__tests__/subscription-sweep.test.ts`
  Expected: PASS partout.

- [ ] **Step 5: Commit** `git commit -am "feat(paiements): montant fige, periodes couvertes et ecart de credit a la confirmation"`

---

### Task 5: Route checkout, page Abonnement, `PlanCatalog`, `PaymentHistory`

**Files:**
- Modify: `src/app/api/org/[orgId]/subscription/checkout/route.ts`
- Modify: `src/app/org/[orgId]/subscription/page.tsx`
- Modify: `src/components/admin/PlanCatalog.tsx`, `src/components/admin/PaymentHistory.tsx`
- Modify: `src/app/platform/organizations/[orgId]/subscription/page.tsx` (lien vers la fiche
  paiement staff)
- Test: `src/app/api/org/[orgId]/subscription/checkout/__tests__/route.test.ts` (existe ? sinon
  créer à côté), `src/components/admin/__tests__/PaymentHistory.test.tsx`,
  `src/components/admin/__tests__/PlanCatalog.test.tsx` [nouveau]

**Interfaces:**
- Consumes: `startCheckout`, `PaymentError.detail` (Tasks 3), `quoteChange`,
  `loadProrataCredit` (Task 1).
- Produces:
  - route : `PaymentError` → `NextResponse.json({ error: code, ...(detail && { renewableFrom,
    activeUntil }) }, { status })` (dates en ISO) ;
  - `PaymentHistory({ payments, detailHref? })` : `detailHref?: (p: PaymentHistoryItem) => string`
    optionnelle ; **sans elle le rendu actuel est identique** (le lot 2c l'utilise sans) ;
  - `PlanCatalog` : nouvelles props `quotes: Record<string, QuoteView>` avec
    `type QuoteView = { allowed: true; mode: "IMMEDIATE"|"EXTENSION"|"SCHEDULED"; listPrice:
    number; credit: number; amount: number; daysLeft: number | null } | { allowed: false;
    activeUntil: string | null; renewableFrom: string | null }` ; la prop `currentPrice` est
    supprimée (la page est son seul consommateur).

- [ ] **Step 1: écrire les tests (échouent)** :
  - route : `ALREADY_ACTIVE` → 409 avec `renewableFrom` ISO ; `NOTHING_TO_PAY` → 409 ; OWNER
    seulement (MANAGER → 403) ; corps invalide → 400 (cas existants conservés).
  - `PlanCatalog.test.tsx` (React Testing Library, déjà utilisée dans `PaymentHistory.test.tsx`) :
    plan courant bloqué → bouton désactivé et texte « Votre abonnement est actif jusqu'au
    12/12/2026, renouvelable à partir du 05/12/2026 » (dates `fr-FR`) ; abonnement sans échéance
    → « Votre abonnement est actif sans échéance. » ; montée en gamme → libellé « Passer à ce
    plan » + ligne « Prix plein 45 000 FCFA − crédit 20 000 FCFA (12 jours restants) = 25 000
    FCFA à payer » ; moins cher → « Programmer à l'échéance » sans crédit ; renouvellement en
    fenêtre → « Renouveler » ; message d'erreur propre pour `ALREADY_ACTIVE`,
    `NOTHING_TO_PAY`, `PAYMENT_IN_PROGRESS`, `PLAN_NOT_FOR_SALE`.
  - `PaymentHistory` : avec `detailHref`, la ligne contient un lien ; sans, rendu identique.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/components/admin/__tests__/PlanCatalog.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: implémenter** : la page calcule `now`, charge le crédit une seule fois
  (`loadProrataCredit(prisma, orgId, sub.planId, now)` si l'abonnement tourne), construit
  `quotes[plan.id] = quoteChange(subscriptionState, planLite, now, credit)` pour chaque plan du
  catalogue (dates sérialisées en ISO), passe `detailHref={(p) => `/org/${orgId}/payments/${p.id}`}`
  et ajoute sous l'historique un lien « Voir tous les paiements » vers `/org/${orgId}/payments`
  (la page `payments` est livrée en Task 7 : lien posé en Task 7 si la page n'existe pas encore —
  vérifier avant de commiter). Le catalogue de la page reste `archived:false, price not null`.
  Mention sous l'aperçu : « Le montant exact est figé à la création du paiement. » Côté staff
  (`platform/organizations/[orgId]/subscription`), `detailHref` pointe vers
  `/platform/payments/${id}` (Task 8).

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/components/admin` puis `make test FILE=src/app/api/org/[orgId]/subscription`
  Expected: PASS.

- [ ] **Step 5: contrôle visuel** (UI) : `/org/{id}/subscription` à **375, 1024 et 1280 px**
  (menu latéral ~224 px dès `lg`) : cartes du catalogue en une colonne à 375, deux colonnes sans
  débordement horizontal dès 1024 ; texte d'aperçu lisible, boutons pleine largeur à 375.

- [ ] **Step 6: Commit** `git commit -am "feat(abonnements): apercu du prorata et blocage du renouvellement hors fenetre"`

---

### Task 6: `payments-query` + `subscription-path`

**Files:**
- Create: `src/lib/payments-query.ts`
- Modify: `src/lib/subscription-path.ts`
- Test: `src/lib/__tests__/payments-query.test.ts` [nouveau], `src/lib/__tests__/subscription-path.test.ts`

**Interfaces:**
- Consumes: `parseListPage` (socle) n'est **pas** appelé ici (les pages le font) ;
  `makeBillingPayment`/`makeBillingPlan` (Task 1).
- Produces: les signatures de « Interfaces de référence » (bloc `payments-query.ts`), avec
  `PaymentListItem = { id; createdAt; approvedAt; amount; currency; status; purpose; mode;
  fedapayReference; orgId; orgName; label: string; planId: string|null;
  printRequest: { id: string; reference: string; eventId: string } | null }` et `PaymentDetail =
  PaymentListItem & { listPrice; prorataCredit; coversFrom; coversTo; fedapayTransactionId;
  payerName: string|null; payerEmail: string|null; plan: { id; name; period } | null }` ;
  `isAlwaysAllowedOrgPath` accepte aussi `/org/{id}/payments` et ses sous-chemins.

- [ ] **Step 1: écrire les tests (échouent)** :
  - `parsePaymentFilters` : `status=APPROVED` → `status`; `status=nimporte` → ignoré ;
    `purpose` idem ; `from=2026-11-01&to=2026-11-30` → `from = 2026-11-01T00:00:00.000Z`,
    `to = 2026-11-30T23:59:59.999Z` ; date invalide ou `from > to` → ignorées ; `q` coupé à
    64 caractères et trimé ; `orgId` ignoré si `allowOrg:false` ; valeurs tableau → première.
  - `paymentWhere` : `scope.orgId` toujours imposé (un `filters.orgId` ne peut pas l'écraser) ;
    `q` cherche `fedapayReference` par `contains`.
  - `listPayments` (base réelle) : ordre `createdAt desc, id desc` stable ; `total` indépendant de
    la page ; filtres statut/type/période/référence ; scope org ne renvoie pas les paiements d'une
    autre org ; `label` = nom du plan, ou « Impression REF » ; `take`/`skip` respectés.
  - `loadPayment` : `null` pour un id inconnu **et** pour un id d'une autre org (scope).
  - `isAlwaysAllowedOrgPath("/org/o1/payments", "o1")`, `.../payments/p1`,
    `.../payments/p1/receipt` → `true` ; `/org/o1/paymentsX` et `/org/o2/payments` → `false`.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/lib/__tests__/payments-query.test.ts`
  Expected: FAIL (module absent).

- [ ] **Step 3: implémenter** les deux fichiers (sélections Prisma `PAYMENT_LIST_SELECT` /
  `PAYMENT_DETAIL_SELECT` avec `satisfies Prisma.PaymentSelect`, sur le modèle de
  `payment-history.ts`). `isSubscriptionPath` reste tel quel ; ajouter une branche dans
  `isAlwaysAllowedOrgPath`.

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/lib/__tests__/payments-query.test.ts` puis `make test FILE=src/lib/__tests__/subscription-path.test.ts` et `make test FILE=src/components/admin/__tests__/OrgAccessGate.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit** `git commit -am "feat(paiements): requetes du module Paiements et acces sans abonnement actif"`

---

### Task 7: Module Paiements côté organisation

**Files:**
- Create: `src/app/org/[orgId]/payments/page.tsx`, `src/app/org/[orgId]/payments/[paymentId]/page.tsx`,
  `src/app/org/[orgId]/payments/[paymentId]/receipt/route.ts`
- Create: `src/components/payments/PaymentFilters.tsx` (formulaire GET serveur, partagé),
  `src/components/payments/PaymentsTable.tsx`, `src/components/payments/PaymentDetailView.tsx`,
  `src/components/payments/Receipt.tsx`, `src/components/payments/status.ts` (libellés de statut /
  de type / de mode — dédupliquent `STATUS_LABELS` de `PaymentHistory` qui l'importe)
- Modify: `src/components/admin/OrgShell.tsx`
- Test: `src/components/payments/__tests__/*.test.tsx`, `src/components/admin/__tests__/OrgShell.test.tsx`
  (créer si absent), `e2e/org/payments.spec.ts` (Task 12)

**Interfaces:**
- Consumes: `listPayments`, `loadPayment`, `parsePaymentFilters` (Task 6), `parseListPage` et
  `UrlPagination` (socle), `hasOrgRole`, `loadUserContext`.
- Produces: `PaymentsTable({ items, detailHref, showOrg })`, `PaymentFilters({ values,
  showOrg, orgOptions? })`, `PaymentDetailView({ payment, showOrg, linkTo })`,
  `Receipt({ payment, issuedAt })` (composants réutilisés tels quels par la Task 8).

- [ ] **Step 1: écrire les tests (échouent)** (RTL, aucune base) :
  - `PaymentsTable` : lignes, montant en FCFA, statut en français, lien « Voir » vers `detailHref`,
    colonne Organisation seulement si `showOrg` ; état vide « Aucun paiement. ».
  - `PaymentDetailView` : abonnement avec prorata → « Prix plein », « Crédit déduit », « Montant
    payé », « Période couverte du … au … » ; sans prorata (renouvellement, ancien paiement) →
    pas de bloc crédit ; paiement d'impression → lien « Commande REF », pas de bloc plan ;
    `fedapayReference` et identifiant FedaPay affichés ; payeur.
  - `Receipt` : contient référence, montant, date d'approbation, organisation, objet ; une valeur
    `<script>alert(1)</script>` dans le nom d'organisation ressort échappée.
  - `OrgShell` : l'entrée « Paiements » (`/org/{id}/payments`) est visible pour MANAGER et OWNER,
    absente pour AUDITOR.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/components/payments`
  Expected: FAIL (composants absents).

- [ ] **Step 3: implémenter** :
  - `page.tsx` : garde identique à la page Abonnement (session → `/login?callbackUrl=…`,
    `loadUserContext`, `hasOrgRole(ctx, orgId, "MANAGER")` sinon `redirect(/org/{orgId})`) ;
    `searchParams` → `parsePaymentFilters(sp, {allowOrg:false})` + `parseListPage(sp)` ;
    `listPayments(filters, { orgId }, { skip, take })` ; rendu : titre « Paiements »,
    `PaymentFilters`, `PaymentsTable`, `UrlPagination` (signature réelle du socle). Filtres =
    `<form method="get">` (statut, type, du, au, référence FedaPay) + bouton « Filtrer » et lien
    « Réinitialiser » ; `pageSize` conservé en champ caché.
  - fiche : `loadPayment(id, { orgId })` → `notFound()` si `null` ; bouton « Imprimer le reçu »
    (lien vers `./receipt`, `target="_blank"`) seulement si `APPROVED` ; lien de retour vers la
    liste en conservant la query string d'origine n'est pas requis.
  - `receipt/route.ts` : `GET` ; session + MANAGER sinon 401/403 ; `loadPayment` scope org ;
    non `APPROVED` → 404 ; réponse `new Response(html, { headers: { "content-type":
    "text/html; charset=utf-8", "cache-control": "private, no-store" } })` avec le document
    complet (`<!doctype html>`, CSS inline, `@page { margin: 16mm }`, bouton « Imprimer »
    masqué à l'impression, `window.print()` sur clic). Pas de logo distant.
  - `OrgShell` : entrée `{ href: /org/${org.id}/payments, label: "Paiements", icon:
    "credit-card", minRole: "MANAGER" }` juste après « Abonnement » (si l'icône `credit-card`
    prête à confusion avec Abonnement, utiliser une autre icône **déjà exportée** par
    `src/components/ui/Icon.tsx` — ne pas modifier ce fichier).
  - Page Abonnement : poser le lien « Voir tous les paiements » (Task 5, Step 3) si absent.

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/components/payments` puis `make test FILE=src/components/admin`
  Expected: PASS.

- [ ] **Step 5: contrôle visuel** : `/org/{id}/payments`, fiche et reçu (impression : aperçu
  d'impression du navigateur) à **375, 1024 et 1280 px** : le tableau défile horizontalement dans
  son cadre (`TableFrame`) sans faire défiler la page ; filtres empilés à 375, en ligne dès 1024 ;
  pagination utilisable au doigt.

- [ ] **Step 6: Commit** `git commit -am "feat(paiements): module Paiements pour les organisations avec recu imprimable"`

---

### Task 8: Module Paiements côté staff

**Files:**
- Create: `src/app/platform/payments/page.tsx`, `src/app/platform/payments/[paymentId]/page.tsx`,
  `src/app/platform/payments/[paymentId]/receipt/route.ts`
- Modify: `src/components/staff/StaffShell.tsx`
- Test: `src/components/staff/__tests__/StaffShell.test.tsx` (créer si absent),
  `e2e/platform/payments.spec.ts` (Task 12)

**Interfaces:**
- Consumes: composants de la Task 7, `listPayments`/`loadPayment` sans scope, `requireStaff`
  (`src/lib/auth-guards`) pour le route handler du reçu.
- Produces: pages staff ; filtre organisation = champ texte « Organisation » (nom ou slug,
  recherche `contains` côté `payments-query` : ajouter dans `PaymentFilters.orgQuery`,
  `parsePaymentFilters(..., {allowOrg:true})` le renseigne ; test à ajouter à
  `payments-query.test.ts`) plutôt qu'une liste déroulante de toutes les organisations.

- [ ] **Step 1: écrire les tests (échouent)** : `StaffShell` contient « Paiements »
  (`/platform/payments`) pour tout rôle staff (lecture seule) ; `payments-query` : `orgQuery`
  filtre sur `org.name`/`org.slug`.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/lib/__tests__/payments-query.test.ts`
  Expected: FAIL sur le cas `orgQuery`.

- [ ] **Step 3: implémenter** : le layout `/platform` impose déjà `isStaff` ; pages sans scope
  d'organisation, colonne Organisation (lien vers `/platform/organizations/{orgId}`), fiche avec
  lien vers la commande `/platform/print/orders/{id}` ou le plan ; route handler du reçu avec
  `requireStaff(session.user.id, "STAFF_OBSERVER")` (404 si non approuvé). Entrée de menu
  « Paiements » (icône `credit-card`) après « Plans » dans `StaffShell`. Lien
  `detailHref` posé sur la page staff d'abonnement d'organisation (Task 5).

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/lib/__tests__/payments-query.test.ts` et `make test FILE=src/components/staff`
  Expected: PASS.

- [ ] **Step 5: contrôle visuel** à **375, 1024 et 1280 px** (mêmes critères que la Task 7 ;
  la colonne Organisation reste lisible : troncature avec `title`).

- [ ] **Step 6: Commit** `git commit -am "feat(paiements): module Paiements pour le staff"`

---

### Task 9: Plans — champs publics (API, page et formulaire staff)

**Files:**
- Modify: `src/app/api/platform/plans/route.ts`, `src/app/api/platform/plans/[planId]/route.ts`
- Modify: `src/app/platform/plans/page.tsx`, `src/components/staff/PlanManager.tsx`
- Test: `src/app/api/platform/plans/__tests__/*.test.ts`, `src/app/api/platform/plans/[planId]/__tests__/*.test.ts`
  (compléter l'existant), `src/components/staff/__tests__/PlanManager.test.tsx` [nouveau]

**Interfaces:**
- Consumes: champs `Plan` du socle.
- Produces: `POST`/`PATCH` acceptent `publicVisible: boolean`, `position: int 0..9999`,
  `description: string ≤ 300 | null`, `features: string[] (≤ 12 éléments, chacun 1..120 car.,
  trimés) | null`, `highlighted: boolean` ; `GET` renvoie ces champs ; `PLAN_CREATED` /
  `PLAN_UPDATED` ajoutent ces champs dans `details` ; `PlanRow` gagne les mêmes champs ;
  `GET` liste triée `position asc, createdAt asc`.

- [ ] **Step 1: écrire les tests (échouent)** : création avec tous les champs (201, base
  vérifiée) ; valeurs par défaut (`publicVisible=false`, `position=0`, `highlighted=false`,
  `features=null`) ; `features` avec 13 éléments → 400 `VALIDATION` ; élément vide → 400 ;
  `position=-1` → 400 ; `description` de 301 caractères → 400 ; `PATCH` partiel ne touche que le
  champ envoyé ; `features: null` efface ; `PLAN_UPDATED.details` contient les nouveaux champs ;
  STAFF_OBSERVER → 403 (cas existant conservé). `PlanManager` : cases « Visible sur /tarifs » et
  « Mis en avant » ; saisie des fonctionnalités une par ligne (`textarea`, lignes vides ignorées)
  → `PATCH` avec le tableau ; position numérique.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/app/api/platform/plans`
  Expected: FAIL.

- [ ] **Step 3: implémenter** : étendre les schémas zod (`.strict()` non requis, rester dans le
  style des schémas existants) ; dans `PlanManager`, ajouter une colonne « Public » (case +
  position) et un panneau d'édition « Fiche publique » (description, fonctionnalités, mis en
  avant) par ligne, sur le modèle de `PriceCell` (`useAsyncAction`, `router.refresh()`), et les
  champs correspondants au formulaire de création. La page lit `publicVisible`, `position`,
  `description`, `features` (`Json` → `string[]` défensif : tout non-tableau → `[]`) et trie par
  `position`.

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/app/api/platform/plans` et `make test FILE=src/components/staff/__tests__/PlanManager.test.tsx`
  Expected: PASS.

- [ ] **Step 5: contrôle visuel** de `/platform/plans` à **375, 1024 et 1280 px** (formulaire
  empilé à 375, tableau dans `TableFrame`, panneau d'édition sans débordement).

- [ ] **Step 6: Commit** `git commit -am "feat(plans): champs de la fiche publique editables par le staff"`

---

### Task 10: `/tarifs` et `PricingCards` dynamiques, `ComparisonTable`

**Files:**
- Create: `src/lib/public-plans.ts`, `src/components/payments/PricingGrid.tsx` (client : bascule
  mensuel / annuel)
- Modify: `src/components/marketing/PricingCards.tsx`, `src/components/marketing/ComparisonTable.tsx`,
  `src/app/(marketing)/tarifs/page.tsx`
- Test: `src/lib/__tests__/public-plans.test.ts` [nouveau], `src/components/payments/__tests__/PricingGrid.test.tsx`,
  `src/components/marketing/__tests__/ComparisonTable.test.tsx`

**Interfaces:**
- Consumes: `Plan` (socle), styles `displayFont`, `btnPrimaryLg`, `btnSecondaryLg`.
- Produces: `listPublicPlans()` (voir « Interfaces de référence ») : `where { publicVisible:
  true, archived: false }`, `orderBy [{ position: "asc" }, { price: "asc" }, { id: "asc" }]`,
  appelle `noStore()` (`next/cache`) en tête ; `features` normalisé (tableau de chaînes non
  vides, sinon `[]`). `PricingCards()` (async, **sans prop** : `showOffRows` disparaît, la page
  d'accueil l'appelle déjà sans prop) ; `PricingGrid({ plans: PublicPlan[] })` ;
  `ComparisonTable()` (async) ; la FAQ statique de la page reste (corriger la réponse sur le
  prorata : « la montée en gamme est facturée immédiatement au prorata du montant déjà payé ; le
  passage à une offre moins chère prend effet à l'échéance »).

- [ ] **Step 1: écrire les tests (échouent)** :
  - `listPublicPlans` (base réelle) : exclut archivés et non visibles ; tri par `position` puis
    prix ; `features` Json invalide (objet, nombres) → `[]` ; description null conservée.
  - `PricingGrid` : prix en FCFA (« 15 000 FCFA ») avec la période (« / mois », « / an ») ;
    limites « 10 événements », « Illimité » pour null ; plan sans prix → « Nous contacter »
    (lien `/contact`) ; bascule affichée **seulement** s'il existe des plans des deux périodes,
    mensuel sélectionné par défaut, clic sur « Annuel » ne montre que les annuels ; un plan
    `highlighted` porte le badge « Le plus choisi » ; liste de fonctionnalités avec libellé
    contenant `<b>x</b>` rendue en texte (échappée) ; aucun plan → état vide « Tarifs sur
    demande » + lien contact.
  - `ComparisonTable` : une colonne par plan visible (en-têtes = noms), lignes « Période »,
    « Prix », « Événements », « Participants / événement », puis une ligne par libellé de
    fonctionnalité (union) avec coche / tiret ; aucun plan → rien rendu (la page affiche l'état
    vide, pas de tableau vide).

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=src/lib/__tests__/public-plans.test.ts`
  Expected: FAIL (module absent).

- [ ] **Step 3: implémenter** ; supprimer le contenu en dur (`PLANS`, `SECTIONS`). La page
  `tarifs` n'affiche la section « Comparer les offres » que s'il y a au moins un plan visible ;
  le titre/lede (« Commencez gratuitement… ») est conservé seulement si cohérent avec le
  catalogue : le remplacer par un texte neutre (« Des offres simples, à l'usage. Changez d'offre
  à tout moment. »). Le bouton de chaque carte : plan payant → « Choisir ce plan » vers
  `/login` ; plan sans prix → « Nous contacter » vers `/contact`.

- [ ] **Step 4: relancer**
  Run: `make test FILE=src/lib/__tests__/public-plans.test.ts`, `make test FILE=src/components/payments`, `make test FILE=src/components/marketing`
  Expected: PASS.

- [ ] **Step 5: contrôle visuel** de `/tarifs` et de l'accueil (section tarifs) à **375, 1024 et
  1280 px** : 1 colonne à 375, grille 2-3 colonnes sans carte écrasée, tableau comparatif avec
  défilement horizontal interne, bascule centrée et utilisable au doigt ; état vide vérifié avec
  aucun plan visible.

- [ ] **Step 6: Commit** `git commit -am "feat(tarifs): page tarifs alimentee par les plans de la base"`

---

### Task 11: Seed démo — plans visibles, paiements cohérents

**Files:**
- Modify: `prisma/seed/demo/billing/plans.ts`, `prisma/seed/demo/billing/payments.ts`
  (+ `scenarios.ts` / `subscriptions.ts` seulement si la cohérence l'exige)
- Test: `prisma/seed/demo/billing/__tests__/plans.test.ts`, `.../payments.test.ts`

**Interfaces:**
- Consumes: `computeProrataCredit`, `coversFor`, `planChangeFor` (Task 1) — fonctions pures, le
  seed n'appelle **jamais** `confirmPayment`/`startCheckout`/`logActivity` ;
  `ensurePlans` / `seedSubscriptionPayments` gardent leurs signatures.
- Produces: plans `standard`, `pro`, `enterprise` avec `publicVisible: true`, `position`
  (10, 20, 30), `description`, `features`, `highlighted` (`pro`) ; `free`, `partner`, `legacy`
  non visibles ; chaque paiement APPROVED porte `listPrice`, `prorataCredit`, `coversFrom`,
  `coversTo` calculés par le rejeu `resolveModes` ; un scénario de montée en gamme existant
  (ou un ajouté) a un `prorataCredit > 0` et `amount = listPrice − prorataCredit`.

- [ ] **Step 1: écrire les tests (échouent)** : après `ensurePlans`, ≥ 3 plans `publicVisible`,
  positions distinctes, `features` tableau non vide, aucun plan archivé visible ; après
  `seedSubscriptionPayments` : pour chaque paiement APPROVED, `coversFrom < coversTo` et
  `coversTo` de la dernière période = échéance de l'abonnement ; invariant
  `listPrice − prorataCredit = amount` ; au moins un paiement avec `prorataCredit > 0` ; les
  PENDING/DECLINED n'ont pas de `coversFrom/To`.

- [ ] **Step 2: constater l'échec**
  Run: `make test FILE=prisma/seed/demo/billing`
  Expected: FAIL.

- [ ] **Step 3: implémenter** : dans `ensurePlans`, `update` ne touche toujours pas les valeurs
  existantes sauf `archived` **et** les champs d'affichage public du seed (sinon un plan
  `Standard` préexistant ne deviendrait jamais visible en démo) ; dans `resolveModes`, calculer
  pour chaque paiement APPROVED `covers = coversFor(change, state, plan)` et, pour IMMEDIATE avec
  état en cours, `credit = computeProrataCredit(<paiements déjà résolus du même plan>, p.at)`.

- [ ] **Step 4: relancer**
  Run: `make test FILE=prisma/seed/demo/billing`
  Expected: PASS.

- [ ] **Step 5: Commit** `git commit -am "feat(seed-demo): plans publics et paiements avec periodes couvertes"`

---

### Task 12: e2e, doc, vérification

**Files:**
- Create: `e2e/helpers/billing.ts` (helpers e2e : `createTestPlan`, `setSubscription`,
  `createTestSubscriptionPayment`, nettoyage des plans créés), `e2e/org/payments.spec.ts`,
  `e2e/platform/payments.spec.ts`
- Modify: `e2e/helpers/nav.ts` (si une entrée de menu est à ajouter à la navigation de test),
  `e2e/org/subscription.spec.ts`, `e2e/platform/subscription-flow.spec.ts`,
  `e2e/platform/organization-subscription.spec.ts`, `e2e/platform/plans.spec.ts`,
  `e2e/public/marketing.spec.ts`
- Modify: `docs/v4/features/abonnements.md`, `docs/v4/features/paiements-fedapay.md`

**Interfaces:** consomme `createTestOrgWithOwner`, `createTestOrgMember`, `createTestStaff`,
`cleanupE2ETestData`, `loginAs`, `loginAsStaff` (lecture seule) ; FedaPay n'est pas joignable
en e2e : le parcours d'achat s'arrête à la réponse de `POST …/checkout` (erreur
`PAYMENTS_DISABLED` ou 409 métier) — l'application du paiement est couverte par Vitest.

- [ ] **Step 1: écrire les e2e** (chaque `afterAll` : `cleanupE2ETestData`, suppression des plans
  créés, `disconnectDb`) :
  - `org/subscription.spec.ts` : (a) plan actif à > 7 j → texte « Votre abonnement est actif
    jusqu'au … , renouvelable à partir du … » et bouton « Renouveler » désactivé ; (b) échéance à
    < 7 j → « Renouveler » actif ; (c) aperçu du prorata d'une montée en gamme avec un paiement
    approuvé sans prorata fixé : texte « Prix plein … − crédit … = … à payer » aux montants
    calculés par la fixture ; (d) `POST /api/org/{id}/subscription/checkout` du même plan hors
    fenêtre → 409 `ALREADY_ACTIVE` ; (e) MANAGER voit les plans mais pas de bouton de paiement
    (cas existant adapté, le test « 100 % lecture seule » est mis à jour).
  - `org/payments.spec.ts` : MANAGER voit ses paiements, pas ceux d'une autre org ; AUDITOR est
    redirigé ; filtre statut dans l'URL (`?status=APPROVED`) conservé au rechargement ;
    `?pageSize=10` et pagination ; fiche d'un paiement avec prorata (montants) ; accès à
    `/org/{id}/payments` **avec abonnement expiré** (pas d'écran bloquant) ; `paymentId` d'une
    autre org → 404 ; reçu : 200 `text/html` pour un APPROVED, 404 pour un PENDING ; entrée de
    menu « Paiements » présente.
  - `platform/payments.spec.ts` : tous les paiements, filtre par organisation et référence FedaPay,
    fiche, reçu ; STAFF_OBSERVER y accède ; un utilisateur non staff est redirigé.
  - `platform/plans.spec.ts` : cocher « Visible sur /tarifs », saisir position, fonctionnalités,
    « Mis en avant » → API 200 et ligne mise à jour.
  - `public/marketing.spec.ts` : `/tarifs` affiche un plan visible créé par la fixture avec son
    prix en FCFA et ses fonctionnalités ; plan sans prix → « Nous contacter » ; plan archivé ou
    non visible absent ; bascule mensuel / annuel ; état vide « Tarifs sur demande » (le test
    ne peut garantir l'absence de plans visibles en base partagée : le vérifier par un test
    Vitest du composant, déjà couvert en Task 10, et ne pas l'asserter ici).
  - Contrôle de responsive : pour `/org/{id}/payments`, `/platform/payments`, `/tarifs` et la
    page Abonnement, `page.setViewportSize` à **375×812, 1024×768 et 1280×800** ; assertion
    `document.documentElement.scrollWidth <= window.innerWidth` (pas de défilement horizontal de
    page) et visibilité du menu / du tiroir selon le point de rupture.

- [ ] **Step 2: lancer les e2e du lot (un seul spec à la fois, jamais en parallèle sur la même stack)**
  Run: `make test-e2e FILE=e2e/org/subscription.spec.ts`, puis `e2e/org/payments.spec.ts`,
  `e2e/platform/payments.spec.ts`, `e2e/platform/plans.spec.ts`, `e2e/public/marketing.spec.ts`,
  `e2e/platform/subscription-flow.spec.ts`, `e2e/platform/organization-subscription.spec.ts`
  Expected: PASS pour chacun. En cas de 404 sur une route API dynamique existante : redémarrer
  le conteneur app (Turbopack a perdu la route) avant de chercher un bug.

- [ ] **Step 3: documentation** (sections attribuées à ce lot uniquement) :
  - `docs/v4/features/abonnements.md` : règle de renouvellement (blocage, fenêtre de 7 jours,
    abonnement sans échéance), montée en gamme au prorata (formule, `coversFrom/To`, plancher par
    paiement, `NOTHING_TO_PAY`), plan programmé, garde PENDING (30 min / 2 min), `ALREADY_ACTIVE`,
    champs publics des plans, page `/tarifs` (visibilité, tri, bascule, « Nous contacter », état
    vide), cache (dynamique via `noStore`).
  - `docs/v4/features/paiements-fedapay.md` : champs `listPrice/prorataCredit/coversFrom/coversTo`,
    montant figé et écart de crédit (`creditDrift` dans l'audit), paiement `CANCELED` d'abonnement
    approuvé tardivement, module Paiements (routes, filtres d'URL, droits MANAGER+ / staff,
    reçu), limite connue : le sweep ne rejoue pas les abonnements remplacés.
  - Mettre à jour la table « Progression » de ce plan.

- [ ] **Step 4: vérification complète**
  Run: `make lint && make typecheck && make test-coverage`
  Expected: 0 erreur, 0 warning de lint ; typecheck propre ; tous les tests passent ; gates de
  couverture 100 % `src/lib/**` et `src/app/api/**` respectés (aucun fichier du lot sous le
  seuil ; si `src/lib/payments.ts` ou `subscription-changes.ts` manque une branche, ajouter le
  test, ne pas retirer de code).

- [ ] **Step 5: contrôle visuel final** (golden path + cas limites, navigateur) : page
  Abonnement (bloqué / fenêtre / montée en gamme), Paiements org et staff, reçu à l'impression,
  Plans staff, `/tarifs` et accueil, à **375, 1024 et 1280 px**. Ne pas affirmer « ça marche »
  sans ce contrôle.

- [ ] **Step 6: Commit** `git commit -am "docs(abonnements): renouvellement, prorata, module Paiements et tarifs; e2e du lot 2b"`

---

## Auto-revue (couverture de la spec)

- Volet 2 : blocage même plan + fenêtre 7 j (T1, T3, T5) ; moins cher programmé (T1, T3) ; plus
  cher immédiat + prorata sur montant payé, périodes couvertes, figé à la création, `Payment`
  enregistré (T1, T3, T4) ; plan programmé annulé / conservé (T3, T4) ; garde PENDING (T3) ;
  aperçu avant paiement (T5) ; audit (T3, T4) ; changements staff non concernés (aucun fichier
  touché).
- Volet 3 : pages staff et org, filtres, recherche référence, fiche, prorata, reçu, menus,
  accès sans abonnement actif (T6 à T8, T12).
- Volet 4 : champs `Plan` éditables (T9), `/tarifs` dynamique, bascule, « Nous contacter »,
  FCFA, état vide, cache (T10), seed (T11).
- Hors tâches : pagination des listes de paiements par le socle (T7, T8) ; aucun changement du
  sweep (T4 l'exécute).
