# Feature — Abonnements (items 2 + 3)

> **Statut : a implementer** (Phase 6 du plan). Ce document capture le design
> valide ; le code fera foi une fois livre.

## Objectif

Remplacer les quotas ad-hoc de `Organization` (`quotaMaxEvents`,
`quotaMaxRegistrations`, `quotaMaxStorageMB`) par un systeme d'abonnements.

## Modele

- `Plan` (catalogue) : `name`, `maxEvents?`, `maxParticipantsPerEvent?` (null =
  illimite), `archived`.
- `Subscription` (une par org) : `orgId` unique, `planId`, `status`
  (`ACTIVE|EXPIRED|CANCELLED`), `startDate`, `endDate?`, overrides
  (`overrideMaxEvents?`, `overrideMaxParticipantsPerEvent?`). **Facturation
  manuelle** : statut + dates, **sans montant**.
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

## UI

- Plateforme : CRUD des plans + assignation d'abonnement a une org.
- Org : vue read-only de son abonnement (plan, statut, dates, limites effectives).

## Migration

Retrait destructif des colonnes `quota*`. En dev via `make db-push` ; migration
Prisma versionnee requise avant deploiement prod (schema partage avec v1).
