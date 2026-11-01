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
`ACTIVE` dont les dates sont calculees par `computeSubscriptionDates(plan.period)`, soit `endDate = startDate + 30 jours`
(periode `MONTHLY`). Sans abonnement, l'espace de l'organisation serait bloque (`NO_SUBSCRIPTION`)
jusqu'a ce que le staff en attribue un. Le staff peut ensuite changer de plan comme d'habitude.

`free` est un **mois d'essai, une seule fois** (spec
[`2026-11-01-30`](../specs/2026-11-01-30-v4-abonnement-essai-droits.md), qui remplace la decision 1 de la spec FedaPay) :

- La creation est journalisee `SUBSCRIPTION_CREATED` (`details.auto = true`).
- Si le plan `free` n'existe pas ou est archive, l'organisation est creee **sans abonnement**
  (comportement precedent) et un avertissement est ecrit dans les logs serveur.
- Les organisations deja creees ne sont pas modifiees.
- L'abonnement `free` a une echeance de 30 jours et **ne se renouvelle pas**. Il n'y a plus de repli
  automatique : relancer l'essai n'est pas possible.
- A l'echeance, un abonnement `ACTIVE` passe a **`EXPIRED`** (le plan reste inchange), sauf si un
  changement est programme (downgrade) : c'est alors ce plan qui s'active. La transition est reglee sans
  delai : `resolveOrgLimits` appelle `settleSubscription` a la lecture (via `expiryTransition`), et la
  tache horaire du worker le fait aussi. `active` est de toute facon faux des que `endDate` est depasse.
- Un abonnement passe a la main en `EXPIRED` ou `CANCELLED` par le staff reste inactif.
- **Production** : les abonnements deja echus mais restes `ACTIVE` passeront a `EXPIRED` au premier
  passage de la tache horaire. Aucune migration de donnees n'est necessaire.
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

`src/lib/subscription.ts` :

- `resolveOrgLimits(orgId)` -> `{ maxEvents, maxParticipantsPerEvent, active }`.
- `assertCanCreateEvent(orgId)` : throw si inactif ou quota events atteint.
- `assertCanRegister(eventId)` : throw si inactif ou plafond **par evenement**
  atteint (comptage PENDING+APPROVED par event — corrige l'ancien scope org).

Les quotas du plan restent appliques en plus des droits ci-dessous. Le staff garde un bypass audite
(`staffActor`, `QUOTA_BYPASS`).

### Droits selon l'abonnement

Ce que peut faire une organisation depend de l'etat de son abonnement (actif / inactif) et d'une
matrice de droits reglable par le staff. Module pur `src/lib/subscription-rights.ts` : `SUBSCRIPTION_RIGHTS`,
`DEFAULT_RIGHTS`, `parseRights`, `isEventOngoing`, et la decision `can(access, right, event?)`.

| Droit | Portee | Actif (defaut) | Inactif (defaut) |
|---|---|---|---|
| `CREATE_EVENT` | creer un evenement | oui | non |
| `RECEIVE_REGISTRATIONS` | inscriptions et re-soumissions | oui | oui (evenement en cours) |
| `MANAGE_ONGOING_EVENTS` | actions d'ecriture de l'espace `/event` | oui | oui (evenement en cours) |
| `ACCESS_ORG_SPACE` | pages `/org` (membres, reglages, modeles...) | oui | non |

- **En cours** : `isEventOngoing` = non archive et fin (`endDate ?? date`) non depassee, jusqu'a la fin de
  ce jour (UTC). Les deux droits « evenement » ne valent, a l'etat inactif, que pour un evenement en cours.
  Un evenement a venir deja cree est donc concerne ; un evenement termine ne l'est plus.
- **Toujours accessibles**, hors reglage : l'onglet Abonnement et la liste des evenements
  `/org/[orgId]/events` (`isAlwaysAllowedOrgPath`, `src/lib/subscription-path.ts`).
- **Un seul lecteur** : `getOrgAccess(orgId)` (`src/lib/org-access.ts`, mis en cache par requete avec
  `cache()` de React) appelle `loadOrgAccess` (`src/lib/subscription-access.ts`), qui lit en parallele les
  limites (`resolveOrgLimits`) et les droits. Layout et page d'une meme requete partagent la lecture.
- **Stockage** : colonne JSON `PlatformSettings.subscriptionRights`
  (`{ [droit]: { active: boolean, inactive: boolean } }`). Cle absente -> defaut ; cle inconnue ou valeur
  non booleenne -> ignoree.
- **Reglage** : `/platform/settings?tab=subscriptions` (onglet « Abonnements »), composant `SubscriptionRightsForm` (une case par droit et par etat),
  enregistre via `PATCH /api/platform/settings` (champ `subscriptionRights`, relu par `GET`). Rien ne
  force la coherence : un « inactif » plus permissif que « actif » reste possible et releve du staff.

Application des droits :

- **Creation d'evenement** (`CREATE_EVENT`) : bouton « Creer un evenement » desactive, la page
  `/org/[orgId]/events/new` redirige vers `/org/[orgId]/events`, l'API refuse (`SUBSCRIPTION_INACTIVE`).
- **Inscriptions** (`RECEIVE_REGISTRATIONS`) : inscription publique et re-soumission refusees si le droit
  manque pour l'etat courant et l'evenement.
- **Espace `/event`** (`MANAGE_ONGOING_EVENTS`) : toutes les routes d'ecriture passent par `withEventAuth` ;
  un garde unique y refuse les methodes d'ecriture (hors `GET`/`HEAD`/`OPTIONS`) sans le droit. Le staff
  n'est pas concerne et les pages restent consultables. Consequence assumee : une organisation inactive ne
  peut plus imprimer en lot ni scanner pour un evenement termine.
- **Espace `/org`** (`ACCESS_ORG_SPACE`) : voir « Blocage de l'espace org ».

## Changements de plan (paiement)

Regles dans `planChangeFor` (`src/lib/subscription-changes.ts`) :

- **Meme plan** (renouvellement) : `endDate` prolongee d'une periode a partir de la fin de
  la periode en cours (mode `EXTENSION`).
- **Plan plus cher**, ou abonnement non en cours / (cas historique : sans echeance) : bascule
  **immediate**, nouvelle periode a partir du paiement, sans prorata (mode `IMMEDIATE`).
- **Plan moins cher** : changement **programme** a l'echeance (`scheduledPlanId`, mode
  `SCHEDULED`). Un seul changement programme a la fois.

## Rappels d'echeance

La tache horaire du worker envoie un rappel par email et notification `SUBSCRIPTION_EXPIRING`
a J-7 et J-1 avant `endDate` (abonnement `ACTIVE`, sans changement programme). Un seul
envoi par (abonnement, echeance, rappel) : table `SubscriptionReminder`. A l'echeance,
`SUBSCRIPTION_CHANGED` previent de l'expiration ou de l'activation du plan programme.

## Blocage de l'espace org

Le layout `src/app/org/[orgId]/layout.tsx` lit `getOrgAccess(orgId)`. Sans le droit `ACCESS_ORG_SPACE`
pour l'etat courant de l'abonnement (par defaut : abonnement inactif), il remplace le contenu par
`SubscriptionBlockedNotice` (titre « Abonnement inactif », texte « Votre abonnement est inactif. Pour le
renouveler, rendez-vous dans l'onglet Abonnement. En cas de difficulte, contactez le
support. », avec les boutons « Contacter le support » en `mailto:contact@badge.app`
et « Voir mon abonnement ») pour toutes les pages du segment, **sauf** celles de
`isAlwaysAllowedOrgPath` : `/org/[orgId]/subscription` (son alerte « abonnement non actif » indique que la creation
d'evenements et l'acces a certaines pages sont limites, que les evenements en cours restent ouverts, et
propose de renouveler) et la liste `/org/[orgId]/events`.
Un abonnement echu (`EXPIRED`) ou absent est inactif ; un abonnement `ACTIVE` echu l'est aussi des que
`endDate` est depasse, sans attendre la tache horaire. Le layout ne
calcule que `canAccessOrgSpace` (`can(access, "ACCESS_ORG_SPACE")`). Le composant client
`OrgAccessGate` (`src/components/admin/OrgAccessGate.tsx`, `usePathname`) decide d'apres le
pathname courant d'afficher la page ou `SubscriptionBlockedNotice`, ce qui fonctionne aussi en
navigation douce (le layout serveur n'est pas re-rendu). Il laisse passer l'onglet Abonnement, la
liste des evenements et `/events/new` (qui redirige lui-meme si `CREATE_EVENT` est refuse).

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
- Plateforme : l'onglet « Abonnements » de `/platform/settings` porte la matrice des droits (voir « Droits selon l'abonnement »).
- Plateforme : le prix du plan se saisit dans le CRUD des plans ; l'historique des paiements
  d'une org est visible sur sa page abonnement.
- Creation d'org : le **slug est genere en direct depuis le nom et en lecture
  seule** (`slugify()` isomorphe, `src/lib/slugify.ts`) ; le serveur reste seul
  juge de l'unicite (suffixe `-2`, `-3`...).

## Migration

Retrait destructif des colonnes `quota*`, puis ajout du paiement (`Plan.price`,
`Subscription.scheduledPlanId`, `Payment`, `SubscriptionReminder`) et de la colonne
`PlatformSettings.subscriptionRights`. Aucune migration de donnees. Les abonnements de production
deja echus mais restes `ACTIVE` passent a `EXPIRED` au premier passage de la tache horaire.
En dev via `make db-push` ; **migration Prisma versionnee requise avant deploiement prod**
(schema partage avec v1).
