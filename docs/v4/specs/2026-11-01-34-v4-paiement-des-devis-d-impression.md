# Spec v4 — Paiement des devis d'impression par FedaPay

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : extension d'une fonctionnalité existante
> **Périmètre** : v4 — `src/lib/payments.ts`, `src/lib/fedapay.ts`, webhook FedaPay, modèle `Payment`, page d'une demande d'impression, worker
> **Plan** : [`plans/2026-11-01-paiement-des-devis-d-impression.md`](../plans/2026-11-01-paiement-des-devis-d-impression.md)
> **Chantier** : service d'impression, spec 4 sur 5 — voir aussi les specs
> [31](2026-11-01-31-v4-gabarits-et-planches-d-impression.md),
> [32](2026-11-01-32-v4-catalogue-produits-d-impression.md),
> [33](2026-11-01-33-v4-demandes-d-impression-et-devis.md),
> [35](2026-11-01-35-v4-impression-pendant-l-evenement.md)
> **S'appuie sur** : [spec 29](2026-10-28-29-v4-paiement-fedapay.md) (paiement des abonnements, fusionné)

## Contexte

Le paiement FedaPay des abonnements est en place (`src/lib/fedapay.ts`,
`src/lib/payments.ts`, `POST /api/webhooks/fedapay`, tâche horaire `subscription-sweep`).
Seul le client `fedapay.ts` est générique : le modèle `Payment` exige un `planId`, et
`startCheckout` / `confirmPayment` appliquent toujours un changement d'abonnement.

Un devis d'impression accepté (spec 33) doit pouvoir être payé de la même façon.

## Objectif

L'organisateur paie en ligne, par FedaPay, le montant du devis qu'il a accepté. La demande
passe en `PAID` dès que FedaPay confirme, sans intervention du staff.

## Décisions (validées par l'utilisateur le 2026-11-01)

1. L'organisateur ne paie **qu'après validation** de la demande par l'admin et **acceptation**
   du devis.
2. Le paiement se fait **sur la plateforme**.
3. FedaPay est déjà en place et sert de base.
4. **C'est l'OWNER de l'organisation qui paie.**
5. Le paiement verrouille le template de l'évènement (spec 33).

## Choix de conception (arbitrages de l'agent, à relire)

### Généraliser `Payment` sans casser les abonnements

- `Payment.purpose` : `SUBSCRIPTION` \| `PRINT_REQUEST` (défaut `SUBSCRIPTION` pour les lignes
  existantes).
- `planId` devient **nullable** ; nouveau `printRequestId` nullable. Contrôle applicatif :
  exactement l'un des deux selon `purpose`.
- `confirmPayment(fedapayTransactionId)` garde la même mécanique (relecture de la transaction
  chez FedaPay, contrôle du montant et de la devise, transition idempotente
  `PENDING|EXPIRED → APPROVED`), puis **aiguille** selon `purpose` :
  - `SUBSCRIPTION` : comportement actuel, inchangé ;
  - `PRINT_REQUEST` : la demande passe `ACCEPTED → PAID` (transition conditionnelle, une seule
    fois), entrée « Paiement reçu » dans le fil, notifications.
- Le webhook et la tâche horaire de relecture des paiements orphelins couvrent les deux
  usages sans changement (ils passent par `confirmPayment`).
- **À adapter** : `resolvePaymentReturn` (`src/lib/payment-return.ts`) lit
  `payment.plan.name` sans contrôle de nul et vérifie l'organisation — il doit traiter les
  deux usages ; `PaymentHistory` affiche une colonne « plan » — elle devient « objet »
  (plan ou référence de la demande).
- Schéma : colonne `purpose` avec défaut `SUBSCRIPTION`, `planId` nullable,
  `printRequestId`. Le projet n'a pas de dossier `prisma/migrations` : le déploiement
  applique le schéma par `prisma db push` (conteneur `init`) ; les lignes existantes prennent
  le défaut, aucune donnée n'est perdue.

### Parcours

1. Sur `/event/[eventId]/print/[requestId]`, statut `ACCEPTED` : bouton **« Payer
   X FCFA »**.
2. `POST /api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout` : vérifie le
   statut `ACCEPTED`, crée un `Payment` `PENDING` de montant **`acceptedTotal`**, une
   transaction FedaPay (description « Impression IMP-2026-0042 — <évènement> », metadata
   `{ paymentId, printRequestId }`), et renvoie l'URL de paiement.
3. Retour sur `/event/[eventId]/print/[requestId]/return?id=…` qui confirme et affiche le
   résultat, comme pour les abonnements.
4. Approuvé : `PAID`, notification aux admins de l'évènement et au staff `STAFF_ADMIN`.
   Refusé ou abandonné : la demande reste `ACCEPTED`, l'organisateur peut réessayer ; le fil
   l'indique.

### Règles

- **Paiement intégral** du devis, en une fois. Pas d'acompte.
- **Qui paie : l'OWNER de l'organisation uniquement** (décision de l'utilisateur du
  2026-11-01, comme pour les abonnements). La route de checkout exige `OWNER` en plus de
  l'accès à l'évènement.
- Un seul paiement `PENDING` par demande à la fois : un second checkout réutilise la
  transaction en cours si elle est encore valable, sinon en crée une nouvelle et marque
  l'ancienne `CANCELED`.
- Si l'admin rouvre le devis (spec 33) pendant qu'un paiement est `PENDING`, la réouverture
  est **refusée** (`409 PAYMENT_IN_PROGRESS`) jusqu'à l'issue du paiement.
- Un paiement approuvé alors que la demande n'est plus `ACCEPTED` (cas limite : paiement
  passé `EXPIRED` puis approuvé tardivement) est enregistré `APPROVED` et signalé au staff
  par une notification et une entrée du fil ; aucune transition automatique, le staff règle
  le cas à la main.
- Le staff ne paie jamais à la place de l'organisateur : la route de checkout le refuse
  (403).
- Historique des paiements visible sur la page de la demande, côté organisateur et côté
  staff (réutiliser `PaymentHistory`).
- Montants entiers en FCFA (XOF), affichés avec `Intl.NumberFormat("fr-FR")` + « FCFA ».

## Non-objectifs

- Acompte, paiement en plusieurs fois.
- Remboursement, avoir (traité hors plateforme par le staff).
- Factures et reçus PDF.
- Paiement hors FedaPay (virement, espèces) — le staff peut, au besoin, passer une demande en
  `PAID` à la main avec un motif obligatoire, audité (`PRINT_REQUEST_MARKED_PAID`).

## Critères d'acceptation

- Un organisateur paie en sandbox un devis accepté ; la demande passe en `PAID`, le fil et
  les notifications le montrent, le staff la voit prête à produire.
- Un paiement refusé laisse la demande `ACCEPTED` et repayable.
- Webhook rejoué, ou webhook + page de retour : une seule transition.
- Montant reçu différent de `acceptedTotal` : paiement `DECLINED` (`MISMATCH`), demande
  inchangée.
- Les paiements d'abonnement continuent de fonctionner à l'identique (tests existants verts).
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**`.
