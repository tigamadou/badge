# Feature — Abonnements (items 2 + 3)

> **Statut : implemente.** Le code fait foi ; ce document decrit le design retenu.
> Le paiement en libre-service (FedaPay) est decrit dans [`paiements-fedapay.md`](paiements-fedapay.md).

## Objectif

Remplacer les quotas ad-hoc de `Organization` (`quotaMaxEvents`,
`quotaMaxRegistrations`, `quotaMaxStorageMB`) par un systeme d'abonnements.

## Modele

- `Plan` (catalogue) : `name`, `price?` (FCFA, entier, 100 a 10 000 000), `period` (`MONTHLY|ANNUAL`, defaut `MONTHLY`),
  `maxEvents?`, `maxParticipantsPerEvent?` (null = illimite), `archived`.
- `Subscription` (une par org) : `orgId` unique, `planId`, `status`
  (`ACTIVE|EXPIRED|CANCELLED`), `startDate`, `endDate?`, overrides
  (`overrideMaxEvents?`, `overrideMaxParticipantsPerEvent?`), `scheduledPlanId?`
  (plan programme a l'echeance). L'abonnement ne porte **pas de montant** : le prix
  est sur le plan (`Plan.price`, entier en FCFA, `null` = non vendu en libre-service) et
  les montants payes sont dans `Payment`. La periode n'est PAS sur l'abonnement : elle
  est heritee du plan choisi.
- Le staff peut toujours attribuer ou modifier un abonnement a la main ; un client peut
  aussi payer seul son plan (voir `paiements-fedapay.md`).

## Abonnement par defaut a la creation

Toute organisation creee par le staff (`POST /api/platform/organizations`) est rattachee, dans la
meme transaction, au plan **`free`** (`DEFAULT_PLAN_NAME`, cree par le seed ; ancien nom « Gratuit », renomme par le seed) : abonnement
`ACTIVE` dont les dates sont calculees par `subscriptionDatesForPlan` (`free` : `endDate = null` ;
autre plan : `computeSubscriptionDates`, 30 j pour un plan mensuel). Sans abonnement, l'espace de l'organisation serait bloque (`NO_SUBSCRIPTION`)
jusqu'a ce que le staff en attribue un. Le staff peut ensuite changer de plan comme d'habitude.

- La creation est journalisee `SUBSCRIPTION_CREATED` (`details.auto = true`).
- Si le plan `free` n'existe pas ou est archive, l'organisation est creee **sans abonnement**
  (comportement precedent) et un avertissement est ecrit dans les logs serveur.
- Les organisations deja creees ne sont pas modifiees.
- L'abonnement `free` **n'a pas d'echeance** (`endDate = null`) et n'expire jamais.
- Un plan payant non renouvele **redescend sur `free`** a l'echeance (au lieu de bloquer
  l'espace). Si un changement est programme (downgrade), c'est ce plan qui s'active a
  l'echeance. L'echeance est reglee sans delai : `resolveOrgLimits` appelle
  `settleSubscription` a la lecture, et la tache horaire du worker le fait aussi.
- Un abonnement passe a la main en `EXPIRED` ou `CANCELLED` par le staff reste bloque ;
  seul un abonnement `ACTIVE` arrive a echeance redescend sur `free`. Si le plan `free`
  n'existe pas, le comportement historique (blocage) s'applique.
- Les overrides (`overrideMax*`) sont conserves lors des changements automatiques.

## Periodicite

La **periode est portee par le `Plan`** (offres distinctes, ex. « Pro Mensuel » /
« Pro Annuel »). A chaque assignation d'un plan a une org, les dates de
l'abonnement en derivent : `startDate = maintenant` et
`endDate = startDate + PERIOD_DAYS[plan.period]` (`MONTHLY` = 30 j, `ANNUAL` =
365 j), calcules cote serveur par `computeSubscriptionDates(plan.period)`
(`src/lib/subscription.ts`). Le staff ne saisit ni periode ni dates dans le
formulaire d'abonnement (la periode y est affichee en lecture seule, d'apres le
plan) ; il choisit la periode a la **creation/edition du plan**. `endDate` reste
la source de verite de `active`.

Ecran staff (`/platform/organizations/[orgId]/subscription`) : sans abonnement,
le formulaire s'affiche directement ; des qu'un abonnement existe, la page
montre un **resume en lecture seule** (plan, statut, periode, fin, overrides) et
le formulaire n'apparait qu'au clic sur « Modifier ». Il se referme apres
enregistrement. Chaque enregistrement recalcule `startDate`/`endDate`.
- Catalogue **+ overrides par org** : override != null gagne, sinon valeur du plan.

## Resolution + enforcement

`src/lib/subscription.ts` (a creer) :

- `resolveOrgLimits(orgId)` -> `{ maxEvents, maxParticipantsPerEvent, active }`.
- `assertCanCreateEvent(orgId)` : throw si inactif ou quota events atteint.
- `assertCanRegister(eventId)` : throw si inactif ou plafond **par evenement**
  atteint (comptage PENDING+APPROVED par event — corrige l'ancien scope org).

Enforcement : bloquer les creations au-dela de la limite ou si l'abonnement est
echu ; l'existant reste consultable ; le staff garde un bypass audite
(`staffActor`, `QUOTA_BYPASS`).

## Changements de plan (paiement)

Regles dans `planChangeFor` (`src/lib/subscription-changes.ts`) :

- **Meme plan** (renouvellement) : `endDate` prolongee d'une periode a partir de la fin de
  la periode en cours (mode `EXTENSION`).
- **Plan plus cher**, ou abonnement non en cours / sans echeance (`free`) : bascule
  **immediate**, nouvelle periode a partir du paiement, sans prorata (mode `IMMEDIATE`).
- **Plan moins cher** : changement **programme** a l'echeance (`scheduledPlanId`, mode
  `SCHEDULED`). Un seul changement programme a la fois.

## Rappels d'echeance

La tache horaire du worker envoie un rappel par email et notification `SUBSCRIPTION_EXPIRING`
a J-7 et J-1 avant `endDate` (abonnement `ACTIVE`, sans changement programme). Un seul
envoi par (abonnement, echeance, rappel) : table `SubscriptionReminder`. A l'echeance,
`SUBSCRIPTION_CHANGED` previent du retour sur `free` ou de l'activation du plan programme.

## Blocage de l'espace org

Un abonnement `ACTIVE` echu ne bloque plus (retour sur `free`, voir plus haut). Le blocage
reste valable pour l'absence d'abonnement et les statuts manuels `EXPIRED` / `CANCELLED`.
Sans abonnement actif (`resolveOrgLimits(orgId).active === false`), le layout
`src/app/org/[orgId]/layout.tsx` remplace le contenu par
`SubscriptionBlockedNotice` (« Votre abonnement est inactif. Contactez le staff
Badge pour le reactiver. », avec un bouton « Contacter le support » en
`mailto:contact@badge.app`) pour **toutes** les pages du segment, **sauf**
`/org/[orgId]/subscription` qui reste consultable en lecture seule (son alerte « abonnement non actif » renvoie aussi
vers le support). Le layout lit
le pathname via le header `x-pathname` pose par `src/middleware.ts` (les Server
Components n'ont pas d'API native pour le pathname ; le middleware Edge n'a pas
acces a Prisma, le check reste donc dans le layout).

> Perimetre : ce blocage est au niveau des pages. Les mutations API non deja
> gardees (membres, parametres, modeles) restent atteignables par appel direct —
> durcissement a traiter separement si besoin.

## UI

- Plateforme : CRUD des plans (nom, **periode**, limites) + assignation d'un plan
  a une org (plan, statut, overrides ; la periode est affichee d'apres le plan et
  les dates sont calculees automatiquement).
- Org : vue de son abonnement (plan, statut, **periode du plan**, dates, limites effectives),
  catalogue des plans vendus avec l'action possible (« Passer à ce plan », « Renouveler »,
  « Programmer à l'échéance ») reservee a l'`OWNER`, et historique des paiements.
  `MANAGER` : lecture seule.
- Plateforme : le prix du plan se saisit dans le CRUD des plans ; l'historique des paiements
  d'une org est visible sur sa page abonnement.
- Creation d'org : le **slug est genere en direct depuis le nom et en lecture
  seule** (`slugify()` isomorphe, `src/lib/slugify.ts`) ; le serveur reste seul
  juge de l'unicite (suffixe `-2`, `-3`...).

## Migration

Retrait destructif des colonnes `quota*`, puis ajout du paiement (`Plan.price`,
`Subscription.scheduledPlanId`, `Payment`, `SubscriptionReminder`) et passage des abonnements `free` existants a `endDate = null` (seed ; en production, la migration
doit executer `UPDATE Subscription SET endDate = NULL` pour le plan `free`).
En dev via `make db-push` ; **migration Prisma versionnee requise avant deploiement prod**
(schema partage avec v1).
