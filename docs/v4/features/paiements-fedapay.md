# Feature — Paiement des abonnements par FedaPay

> **Statut : implemente** (branche `feat/paiement-fedapay`, 2026-10-28), en attente de validation en sandbox FedaPay. Le code fait foi.
> Spec : [`specs/2026-10-28-29-v4-paiement-fedapay.md`](../specs/2026-10-28-29-v4-paiement-fedapay.md) · Plan : [`plans/2026-10-28-paiement-fedapay.md`](../plans/2026-10-28-paiement-fedapay.md) · Abonnements : [`abonnements.md`](abonnements.md)

## Objectif

Un `OWNER` choisit et paie seul un plan payant depuis `/org/[orgId]/subscription`. L'abonnement
s'active des que FedaPay confirme le paiement. **Pas de renouvellement automatique** : des
rappels email precedent l'echeance, l'organisateur revient payer.

## Parcours

1. `/org/[orgId]/subscription` : plans vendus (prix, periode, limites) et action possible.
2. `POST /api/org/[orgId]/subscription/checkout { planId }` (role org `OWNER`) cree un `Payment`
   `PENDING`, une transaction FedaPay (devise `XOF`, URL de retour
   `${NEXTAUTH_URL}/org/[orgId]/subscription/return`), puis renvoie `{ url }` : le navigateur
   est redirige vers la page de paiement FedaPay.
3. Apres paiement : FedaPay renvoie vers `/org/[orgId]/subscription/return?id=<transaction>` et
   appelle `POST /api/webhooks/fedapay`. La page de retour (role `MANAGER` minimum : redirection vers
   `/login` si non authentifie, vers `/org/<id>` si le role est insuffisant) verifie que le paiement appartient a l'org avant tout appel a FedaPay, puis
   appelle `confirmPayment`. Resultats affiches : « Paiement confirme. Votre abonnement <plan> est
   actif. » (ou « sera active le <date> » si le changement est programme) ; « Paiement en cours de
   confirmation » avec lien « Actualiser » (statut `PENDING` ou erreur FedaPay) ; « Le paiement n'a
   pas abouti. Votre abonnement n'a pas change. » (refuse, annule, expire) ; « Paiement introuvable. »
   (identifiant inconnu ou d'une autre org).
4. Approuve : abonnement mis a jour, `SUBSCRIPTION_CHANGED` notifie (OWNER + staff). Refuse ou
   annule : rien ne change.
5. Historique des paiements visible par l'org et par le staff
   (`/platform/organizations/[orgId]/subscription`).

Erreurs du checkout : `INVALID_BODY` (400), `PLAN_NOT_FOR_SALE` (400, plan archive ou sans
prix), `CHANGE_ALREADY_SCHEDULED` (409), `PAYMENTS_DISABLED` (503, FedaPay non configure),
`PROVIDER_ERROR` (502, le paiement passe `CANCELED`).

## Regles de calcul

Voir « Changements de plan » dans [`abonnements.md`](abonnements.md) : meme plan = prolongation,
plan plus cher = bascule immediate sans prorata, plan moins cher = programme a l'echeance.
Montants : entiers en FCFA (`Plan.price` de 100 a 10 000 000), devise `XOF` uniquement.

> **Decision 1 remplacee le 2026-11-01** : le plan `free` n'est plus sans echeance. C'est un essai de
> 30 jours, une seule fois ; a l'echeance l'abonnement passe a `EXPIRED` (plus de repli sur `free`), sauf
> plan programme. Voir [`abonnements.md`](abonnements.md) et la
> [spec du 2026-11-01](../specs/2026-11-01-30-v4-abonnement-essai-droits.md).

## Statuts d'un `Payment`

`PENDING` → `APPROVED` | `DECLINED` | `CANCELED` | `EXPIRED`. Une fois sorti de `PENDING`, un
paiement ne change plus, sauf `EXPIRED` : un paiement balaye apres 24 h mais approuve ensuite
par FedaPay est quand meme applique (`confirmPayment` traite `EXPIRED` comme `PENDING`). `mode` (`IMMEDIATE` / `EXTENSION` / `SCHEDULED`) est renseigne a
l'approbation.

## Confiance et idempotence

- Ni le webhook ni l'URL de retour ne sont crus : tous deux appellent
  `confirmPayment(transactionId)` (`src/lib/payments.ts`) qui **relit la transaction via l'API
  FedaPay** (`retrieveTransaction`). Statuts payes : `approved`, `transferred`.
- Montant different de celui du `Payment`, ou devise differente de `XOF` (comparee seulement si
  FedaPay renvoie `currency.iso`) : paiement `DECLINED` (`PAYMENT_FAILED`, raison `MISMATCH`), rien
  n'est active.
- Application unique : `updateMany where status=PENDING` puis test `count === 1`, dans la meme
  transaction Prisma que la mise a jour de l'abonnement. Webhook rejoue ou webhook + retour
  simultanes : un seul `PAYMENT_APPROVED`, une seule notification.
- Journal : `PAYMENT_INITIATED`, `PAYMENT_APPROVED`, `PAYMENT_FAILED`, plus `SUBSCRIPTION_UPDATED`
  (`details.source = "payment"`).

## Webhook

`POST ${NEXTAUTH_URL}/api/webhooks/fedapay`, hors session.

- En-tete `X-FEDAPAY-SIGNATURE` = `t=<unix>,s=<hex>` ; HMAC-SHA256 de `"<t>.<corps brut>"` avec le
  secret de webhook, comparaison en temps constant, tolerance 300 s. Calcule sur le corps brut
  avant tout `JSON.parse`.
- FedaPay non configure : `503`. Signature invalide ou absente : `400`.
- Signature valide : toujours `200` (FedaPay desactive un webhook qui echoue), y compris pour une
  transaction inconnue ou un corps JSON mal forme ; seuls les evenements `transaction.*` avec `entity.id` numerique declenchent
  `confirmPayment`. Une erreur de relecture est loguee et laisse le paiement `PENDING` (repris par
  la tache horaire).

## Configuration

Par **variables d'environnement** (decision utilisateur du 2026-10-28), lues a chaque appel par
`getFedapayConfig()` (`src/lib/fedapay.ts`) : `FEDAPAY_ENVIRONMENT` (`sandbox` | `live`, toute autre
valeur ou absence = sandbox), `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`. Les paiements sont
actifs quand les deux secrets sont non vides. Les secrets ne sont ni en base ni dans une reponse API.
URL du webhook a declarer dans FedaPay : `${NEXTAUTH_URL}/api/webhooks/fedapay`. Pas de SDK `fedapay`
(client `fetch` minimal dans `src/lib/fedapay.ts`). Base API : `sandbox-api.fedapay.com/v1` ou `api.fedapay.com/v1`.

## Tache horaire du worker

`runSubscriptionSweep` (`src/lib/jobs/subscription-sweep.ts`), toutes les heures
(`SUBSCRIPTION_SWEEP_INTERVAL_MS`) dans `worker-loop.ts`, a cote des purges :

1. regle les abonnements `ACTIVE` echus (plan programme, sinon passage a `EXPIRED`). Les abonnements de production deja echus mais restes `ACTIVE` passent a `EXPIRED` au premier passage ;
2. envoie les rappels J-7 et J-1 (un seul palier par passage, une seule fois par echeance) ;
3. relit aupres de FedaPay les paiements `PENDING` de plus de 15 min ;
4. passe en `EXPIRED` les paiements `PENDING` de plus de 24 h, sauf ceux dont la relecture FedaPay
   a echoue (ils restent `PENDING`, FedaPay les a peut-etre approuves). Exception : une erreur
   404 (transaction disparue, par ex. apres un changement d'environnement) n'empeche pas
   l'expiration. Un paiement `EXPIRED` reste confirmable si FedaPay l'approuve plus tard.

## Paiement d'un devis d'impression

Meme mecanique FedaPay que l'abonnement (plan 34, spec 34) ; `Payment.purpose` distingue les deux :
`SUBSCRIPTION` (`planId` seul, valeur par defaut) ou `PRINT_REQUEST` (`printRequestId` seul, `planId` nul).

1. Devis `ACCEPTED` : sur `/event/[eventId]/print/[requestId]`, l'`OWNER` voit « Payer X FCFA » ; un
   `MANAGER` lit « Seul le proprietaire de l'organisation peut payer ce devis. » ; le staff n'a pas le bouton.
2. `POST /api/org/[orgId]/events/[eventId]/print-requests/[requestId]/checkout` (`OWNER`, hors mode
   staff) cree un `Payment` `PENDING` du montant integral de `acceptedTotal` (devise `XOF`) et une
   transaction FedaPay dont le retour est `${NEXTAUTH_URL}/event/[eventId]/print/[requestId]/return`.
   Reponse `{ url }` : redirection vers la page FedaPay. Erreurs : `REQUEST_NOT_FOUND`,
   `REQUEST_NOT_PAYABLE` (demande plus `ACCEPTED`), `PAYMENT_IN_PROGRESS`, `PAYMENTS_DISABLED` (503).
   L'evenement archive reste payable (abonnement actif requis, comme l'acceptation du plan 33).
3. **Un seul paiement en cours par demande** : un second clic reprend le `PENDING` existant (meme
   transaction FedaPay, nouveau jeton) ; un candidat de montant different remplace l'ancien, passe
   `CANCELED` (raison `REPLACED`). Index `[printRequestId, status]`. Tant qu'un `PENDING` existe, la
   reouverture du devis et le marquage manuel sont refuses (`isPaymentInProgress`).
4. Page de retour `/event/[eventId]/print/[requestId]/return?id=<transaction>` : le paiement doit
   appartenir a la demande, a l'evenement et a l'organisation de la page avant tout appel FedaPay.
   Resultats : « Paiement confirme » (`PAID`, le paiement est `paidPaymentId` de la demande),
   « Paiement recu. L'equipe Badge verifie votre demande » (`UNMATCHED`), montant inattendu
   (`MISMATCH`), « Paiement en cours de confirmation » (lien « Actualiser »), « Le paiement n'a pas
   abouti. Votre devis reste accepte » (la demande reste `ACCEPTED`, « Payer » est propose de nouveau),
   « Paiement introuvable. ».
5. Approbation : `confirmPayment` aiguille sur `purpose` ; une transition unique `ACCEPTED` → `PAID`
   (`markPaid` du plan 33, verrou de la demande) ecrit l'entree du fil et notifie l'organisateur.
   Webhook et tache horaire sont inchanges.
6. **Paiement hors contexte** : approuve alors que la demande n'est plus `ACCEPTED` (annulee, deja
   soldee autrement, montant different, paiement remplace approuve tard) : l'argent est conserve,
   l'entree `PAYMENT_UNMATCHED` s'ajoute au fil et `STAFF_ADMIN` est alerte pour trancher.
7. **Marquage manuel** : `STAFF_ADMIN` marque encore payee une demande reglee hors FedaPay (virement,
   especes), avec motif, audite ; refuse avec « Un paiement FedaPay est en cours sur cette demande. »
   tant qu'un `Payment` `PENDING` existe.
8. Historique : carte « Paiements » du detail organisateur et du detail staff (objet « Impression
   <reference> »), et historique des abonnements inchange.

E2E : FedaPay n'etant pas joignable, `e2e/event/print-request-detail.spec.ts` (bouton OWNER, mention
MANAGER), `e2e/event/print-payment-return.spec.ts` (paiement `APPROVED` prepare en base par
`createTestPrintPayment`) et `e2e/platform/print-request-detail.spec.ts` (carte, refus pendant un
paiement) couvrent ce que l'interface montre sans appel reel. Le parcours complet se valide en sandbox.

## Procedure sandbox

1. Configurer FedaPay selon [`../installation.md`](../installation.md#paiements-fedapay-dev).
2. Payer `Standard` depuis `free` avec un numero de test approuve : retour sur la page de
   confirmation, limites `Standard` appliquees.
3. Numero de test en echec : aucun changement. Renouvellement : `endDate` + une periode.
4. Webhook : via tunnel, ou rejeu manuel depuis le tableau de bord FedaPay → `200`, aucun double effet.
5. Echeance : `endDate` dans le passe en BDD de dev → abonnement `EXPIRED` (ou plan programme active), espace org bloque hors onglet Abonnement et liste des evenements.
6. Rappel : `endDate` a +6 j, redemarrer `worker` → un email J-7 dans Mailpit.

## Validation sandbox (2026-10-28)

- `GET /transactions/{id}` renvoie `{"v1/transaction": {...}}` (enveloppe confirmee). La
  transaction n'a **pas** d'objet `currency`, seulement `currency_id` (`1`). `GET /currencies/1`
  renvoie `{"v1/currency": {"id": 1, "iso": "XOF", "name": "FCFA"}}`. Le client deduit donc la
  devise : `currency.iso` si present, sinon `currency_id` (`1` = XOF, tout autre identifiant =
  valeur jamais egale a XOF, donc `MISMATCH`).
- `POST /transactions/{id}/token` renvoie `{ token, url }` a la racine (sans enveloppe).
- Statuts vus : `pending`, `approved`, `declined` ; mode d'un paiement mobile money de test : `momo_test`.
- Apres paiement sur la page sandbox, le navigateur n'a **pas** ete redirige vers `callback_url` :
  la page de retour ne peut pas etre la seule voie de confirmation. Le webhook et la tache
  horaire du worker sont les filets de securite.
- Push mobile money direct : le SDK poste sur `/{mode}` (ex. `/moov`), pas sur
  `/transactions/{mode}` comme le dit la doc ; sur ce compte la reponse est 400 « Operation non
  autorisee » (fonction non activee). Badge ne l'utilise pas.
- Non valide : corps du webhook (`entity.id`).

## Points ouverts

- **Formes de reponse** : resolues en sandbox (voir « Validation sandbox »). Reste a valider le
  corps du webhook (`entity.id`) une fois l'URL de webhook de preprod disponible.
- **Migration Prisma versionnee** obligatoire avant tout deploiement de production (le plan ne
  deploie pas ; en dev `make db-push` + seed). Aucune migration de donnees : les abonnements `free`
  gardent leur echeance de 30 jours.
- **Ne pas changer `FEDAPAY_ENVIRONMENT` tant que des paiements sont `PENDING`** : leurs
  transactions n'existent pas dans l'autre environnement (relecture 404).

## Non-objectifs

Renouvellement automatique, prorata, remboursement, factures PDF, autre devise ou prestataire,
creation d'organisation en libre-service, page marketing `PricingCards` (prix en dur).
