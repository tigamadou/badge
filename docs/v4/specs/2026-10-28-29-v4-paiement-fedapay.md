# Spec v4 — Paiement des abonnements par FedaPay

> **Statut** : proposée — 2026-10-28 — en attente de relecture
> **Type** : nouvelle fonctionnalité
> **Périmètre** : v4 — espace `/org/[orgId]/subscription`, espace `/platform` (plans, paramètres, abonnement d'une org), worker
> **Plan** : [`plans/2026-10-28-paiement-fedapay.md`](../plans/2026-10-28-paiement-fedapay.md)
> **Feature existante** : [`features/abonnements.md`](../features/abonnements.md)

## Contexte

Les abonnements existent (`Plan`, `Subscription`, `src/lib/subscription.ts`) mais la
facturation est **manuelle** : un plan n'a pas de prix, seul le staff attribue ou renouvelle
un abonnement. Toute nouvelle organisation reçoit le plan `free` (1 évènement, 100
participants par évènement), qui **expire au bout de 30 jours** et bloque alors l'espace.

## Objectif (validé par l'utilisateur le 2026-10-28)

Un organisateur **choisit et paie seul**, depuis l'espace de son organisation, un plan payant
via **FedaPay**. L'abonnement s'active dès que FedaPay confirme le paiement, sans
intervention du staff. Il n'y a **pas de renouvellement automatique** : Badge envoie des
**rappels par email** avant l'échéance, l'organisateur revient payer pour renouveler.

## Décisions (validées par l'utilisateur le 2026-10-28)

> La décision 1 a été remplacée le 2026-11-01 ; les mentions de retour sur `free` plus bas relèvent
> de l'historique de cette décision.

1. ~~**Plan `free` sans échéance** : l'abonnement free n'expire jamais (`endDate = null`).
   Un plan payant non renouvelé **redescend sur `free`** à l'échéance au lieu de bloquer
   l'espace.~~ **Remplacée le 2026-11-01** : `free` est un essai de 30 jours, une seule fois, et
   l'échéance fait passer l'abonnement à `EXPIRED` (aucun repli sur `free`). Voir
   [`2026-11-01-30-v4-abonnement-essai-droits.md`](2026-11-01-30-v4-abonnement-essai-droits.md).
2. **Calcul de la période** : payer le **même plan** prolonge l'abonnement à partir de la fin
   de la période en cours ; payer un **autre plan** (supérieur) bascule **immédiatement**,
   nouvelle période à partir du jour du paiement, **sans prorata**.
3. **Downgrade à l'échéance seulement** : payer un plan **moins cher** que le plan courant
   programme le changement à la fin de la période en cours. Si l'organisation dépasse
   alors les nouvelles limites, l'existant reste consultable et les créations sont bloquées
   (comportement actuel de `assertCanCreateEvent` / `assertCanRegister`).
4. Pas de renouvellement automatique (FedaPay ne propose ni prélèvement récurrent ni
   carte enregistrée réutilisable — vérifié dans sa documentation le 2026-10-28).

## Choix de conception (arbitrages de l'agent, à relire)

- **Qui paie** : rôle org `OWNER` uniquement (le schéma réserve la facturation à
  l'OWNER). `MANAGER` voit la page en lecture seule, comme aujourd'hui.
- **Devise** : **XOF (FCFA)** uniquement, montants **entiers**. `Plan.price` (`Int?`) :
  `null` = plan non vendu en libre-service (c'est le cas de `free`).
- **Configuration FedaPay par variables d'environnement** (décision utilisateur du
  2026-10-28, qui remplace le stockage dans `PlatformSettings`) : `FEDAPAY_ENVIRONMENT`
  (`sandbox` | `live`, défaut sandbox), `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`.
  Les secrets ne sont jamais en base ni dans une API. URL du webhook à déclarer dans
  FedaPay : `${NEXTAUTH_URL}/api/webhooks/fedapay`. En dev : valeurs dans `.env`, puis
  redémarrer `app` et `worker`.
- **Pas de SDK** `fedapay` : un client minimal `fetch` (création de transaction, lien de
  paiement, lecture de transaction) et une vérification de signature HMAC reproduisant celle
  du SDK (en-tête `X-FEDAPAY-SIGNATURE` = `t=<unix>,s=<hex>`, HMAC-SHA256 de
  `"<t>.<corps brut>"`, tolérance 300 s). Le SDK tire `axios@0.28` et n'apporte rien de plus.
- **Confiance** : ni le webhook ni l'URL de retour ne sont crus sur parole. Les deux
  déclenchent `confirmPayment(transactionId)`, qui **relit la transaction auprès de l'API
  FedaPay**, vérifie montant et devise, puis applique le changement **une seule fois**
  (transition conditionnelle `PENDING → APPROVED`). Le montant est toujours comparé ; la
  devise l'est aussi, via `currency.iso` ou, à défaut, `currency_id` (`1` = XOF ; tout autre
  identifiant est refusé), forme constatée en sandbox le 2026-10-28.
- **Un seul changement programmé à la fois** : tant qu'un downgrade est programmé, un
  nouveau paiement est refusé (`409 CHANGE_ALREADY_SCHEDULED`).
- **Overrides staff** (`overrideMax*`) conservés lors des changements automatiques.
- **Statuts manuels du staff** : un abonnement que le staff a passé en `EXPIRED` ou
  `CANCELLED` reste bloqué comme aujourd'hui ; ~~seul un abonnement `ACTIVE` arrivé à échéance
  redescend sur `free`~~ (remplacé le 2026-11-01, voir spec 30) : un abonnement `ACTIVE` arrivé à échéance passe à `EXPIRED`.
- **Échéance appliquée sans délai** : `resolveOrgLimits` règle l'abonnement échu à la
  lecture (`settleSubscription`), le worker le fait aussi en tâche périodique ; l'espace
  n'est jamais bloqué entre deux passages (remplacé le 2026-11-01, voir spec 30).
- **Rappels** : J-7 et J-1 avant `endDate`, pour un abonnement `ACTIVE` avec échéance et
  sans changement programmé ; un email au plus par (abonnement, échéance, rappel). À
  l'échéance, la notification `SUBSCRIPTION_CHANGED` existante prévient ~~du retour sur `free`~~ (remplacé le 2026-11-01, voir spec 30)
  de l'expiration (ou de l'activation du plan programmé).
- **Paiements orphelins** : le worker relit auprès de FedaPay les paiements `PENDING` de
  plus de 15 min (webhook manqué) et passe en `EXPIRED` ceux de plus de 24 h, sauf ceux dont
  la relecture a échoué (hors 404 : transaction disparue). Un paiement `EXPIRED` reste
  confirmable : approuvé ensuite par FedaPay, il est quand même appliqué.
- **Tâche périodique** : ajoutée à la boucle du worker existant (`worker-loop.ts`), toutes
  les heures, à côté des purges. Pas de cron.

## Parcours

1. `/org/[orgId]/subscription` : l'OWNER voit les plans vendus (prix, période, limites) et
   l'action possible pour chacun (« Passer à ce plan », « Renouveler », « Programmer à
   l'échéance »).
2. Il clique : `POST /api/org/[orgId]/subscription/checkout { planId }` crée un `Payment`
   `PENDING`, une transaction FedaPay, et renvoie l'URL de paiement FedaPay. Le navigateur y
   est redirigé.
3. Après paiement, FedaPay renvoie vers `/org/[orgId]/subscription/return?id=…` (qui
   confirme et affiche le résultat) et appelle `POST /api/webhooks/fedapay`.
4. Paiement approuvé : abonnement mis à jour, `SUBSCRIPTION_CHANGED` notifié (OWNER +
   staff). Refusé ou annulé : rien ne change, le paiement est marqué comme tel.
5. L'historique des paiements est visible par l'org et par le staff
   (`/platform/organizations/[orgId]/subscription`).

## Non-objectifs

- Renouvellement automatique, prélèvement récurrent, carte enregistrée.
- Prorata, remboursement, avoirs, factures PDF.
- Autre devise que XOF, autre prestataire que FedaPay.
- Création d'organisation en libre-service (reste une action staff).
- Mise à jour de la page marketing `PricingCards` (prix codés en dur).
- Migration de la base de production (les plans ne déploient pas) : ~~le passage des
  abonnements `free` existants à `endDate = null` est fait par le seed en dev~~ (remplacé le 2026-11-01, voir spec 30) ;
  une migration versionnée sera nécessaire avant déploiement.

## Critères d'acceptation

- Un OWNER paie un plan en sandbox FedaPay et voit ses nouvelles limites sans action staff.
- Un paiement refusé ou abandonné ne change rien.
- Un webhook rejoué, ou webhook + page de retour, n'applique le paiement qu'une fois.
- Un webhook à signature invalide est rejeté (400) ; une transaction inconnue répond 200.
- ~~Une org dont le plan payant arrive à échéance repasse sur `free` et n'est pas bloquée.~~ (remplacé le 2026-11-01, voir spec 30) :
  à l'échéance d'un plan payant non renouvelé, l'abonnement passe à `EXPIRED` ; la création d'évènement
  est bloquée, l'espace org est restreint (hors onglet Abonnement et liste des évènements) et les
  évènements en cours restent exploitables.
- Les rappels J-7 / J-1 partent une seule fois chacun.
- Aucune réponse API n'expose la clé secrète ni le secret de webhook FedaPay.
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**`.
