# Feature — Abonnements (items 2 + 3)

> **Statut : implemente.** Le code fait foi ; ce document decrit le design retenu.

## Objectif

Remplacer les quotas ad-hoc de `Organization` (`quotaMaxEvents`,
`quotaMaxRegistrations`, `quotaMaxStorageMB`) par un systeme d'abonnements.

## Modele

- `Plan` (catalogue) : `name`, `maxEvents?`, `maxParticipantsPerEvent?` (null =
  illimite), `archived`.
- `Subscription` (une par org) : `orgId` unique, `planId`, `status`
  (`ACTIVE|EXPIRED|CANCELLED`), `period?` (`MONTHLY|ANNUAL`), `startDate`,
  `endDate?`, overrides (`overrideMaxEvents?`,
  `overrideMaxParticipantsPerEvent?`). **Facturation manuelle** : statut +
  dates, **sans montant**.

## Periodicite

La **periode pilote les dates** : a chaque assignation, `startDate = maintenant`
et `endDate = startDate + PERIOD_DAYS[period]` (`MONTHLY` = 30 j, `ANNUAL` =
365 j), calcules cote serveur par `computeSubscriptionDates()`
(`src/lib/subscription.ts`). Le staff ne saisit plus de dates : le formulaire
expose un select **Periode**. `period` est nullable pour les abonnements
anterieurs a cette evolution ; `endDate` reste la source de verite de `active`.
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

## Blocage de l'espace org

Sans abonnement actif (`resolveOrgLimits(orgId).active === false`), le layout
`src/app/org/[orgId]/layout.tsx` remplace le contenu par
`SubscriptionBlockedNotice` (« Votre abonnement est inactif. Contactez le staff
Badge pour le reactiver. ») pour **toutes** les pages du segment, **sauf**
`/org/[orgId]/subscription` qui reste consultable en lecture seule. Le layout lit
le pathname via le header `x-pathname` pose par `src/middleware.ts` (les Server
Components n'ont pas d'API native pour le pathname ; le middleware Edge n'a pas
acces a Prisma, le check reste donc dans le layout).

> Perimetre : ce blocage est au niveau des pages. Les mutations API non deja
> gardees (membres, parametres, modeles) restent atteignables par appel direct —
> durcissement a traiter separement si besoin.

## UI

- Plateforme : CRUD des plans + assignation d'abonnement a une org (plan, statut,
  **periode**, overrides ; dates calculees automatiquement).
- Org : vue read-only de son abonnement (plan, statut, **periode**, dates,
  limites effectives).
- Creation d'org : le **slug est genere en direct depuis le nom et en lecture
  seule** (`slugify()` isomorphe, `src/lib/slugify.ts`) ; le serveur reste seul
  juge de l'unicite (suffixe `-2`, `-3`...).

## Migration

Retrait destructif des colonnes `quota*`. En dev via `make db-push` ; migration
Prisma versionnee requise avant deploiement prod (schema partage avec v1).
