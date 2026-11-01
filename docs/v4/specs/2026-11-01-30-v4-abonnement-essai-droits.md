# Spec v4 — Plan gratuit d'un mois et droits selon l'abonnement

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : changement du modèle d'abonnement
> **Périmètre** : v4 — `src/lib/subscription*.ts`, espace `/org`, espace `/event`, API d'inscription, `/platform/settings`, worker
> **Plan** : [`plans/2026-11-01-abonnement-essai-droits.md`](../plans/2026-11-01-abonnement-essai-droits.md)
> **Feature existante** : [`features/abonnements.md`](../features/abonnements.md)
> **Modifie** : la décision 1 de [`2026-10-28-29-v4-paiement-fedapay.md`](2026-10-28-29-v4-paiement-fedapay.md)
> (free sans échéance, repli sur free).

## Contexte

La branche `feat/paiement-fedapay` (non fusionnée, non déployée) a rendu le plan `free`
illimité et fait retomber sur `free` tout plan payant non renouvelé : une organisation pouvait
utiliser Badge indéfiniment sans payer. Sur `development` et en production, `free` dure 30 jours,
mais un abonnement échu bloque tout l'espace `/org`, y compris pour un évènement en cours, et
son statut reste `ACTIVE` en base.

Ce changement est livré **sur la branche FedaPay, avant sa fusion** : l'état « free illimité »
n'atteint jamais la production, et aucune migration de données n'est nécessaire (les abonnements
`free` de production ont déjà une échéance).

## Décisions (validées par l'utilisateur le 2026-11-01)

1. **`free` = un mois d'essai, une seule fois.** Attribué à la création de l'organisation avec
   `endDate = startDate + 30 jours` (période `MONTHLY`), il ne se renouvelle pas. Plus de repli
   sur `free`.
2. **À l'échéance, l'abonnement passe à `EXPIRED`**, sauf si un plan est programmé : celui-ci
   s'active. `resolveOrgLimits` et la tâche horaire du worker appliquent la transition ; `active`
   est de toute façon faux dès que `endDate` est dépassé. Les abonnements de production déjà échus
   (restés `ACTIVE`) passeront à `EXPIRED` au premier passage de la tâche horaire.
3. **Sans abonnement actif, on ne peut plus créer d'évènement** : bouton « Créer un
   évènement » désactivé, `/org/[orgId]/events/new` redirige vers `/org/[orgId]/events`,
   l'API refuse (`SUBSCRIPTION_INACTIVE` ; le staff garde son bypass audité).
4. **Un évènement en cours reste exploitable** après expiration : inscriptions et gestion.
   « En cours » = non archivé et fin (`endDate ?? date`) non dépassée, jusqu'à la fin de ce jour
   (UTC). Les évènements à venir déjà créés sont concernés ; un évènement terminé ne l'est plus.
5. **Droits configurables** dans `/platform/settings`, par droit et par état de l'abonnement
   (actif / inactif). Les quotas du plan restent appliqués en plus. Droits et valeurs par défaut :

   | Droit | Portée | Actif | Inactif |
   |---|---|---|---|
   | `CREATE_EVENT` | créer un évènement | oui | **non** |
   | `RECEIVE_REGISTRATIONS` | inscriptions et re-soumissions | oui | oui (évènement en cours) |
   | `MANAGE_ONGOING_EVENTS` | actions d'écriture de l'espace `/event` | oui | oui (évènement en cours) |
   | `ACCESS_ORG_SPACE` | pages `/org` (membres, réglages, modèles…) | oui | **non** |

   Toujours accessibles, hors réglage : l'onglet Abonnement et la liste des évènements
   `/org/[orgId]/events`. Les deux droits « évènement » ne valent, à l'état inactif, que pour un
   évènement en cours.

## Choix de conception

- **Stockage** : colonne JSON `PlatformSettings.subscriptionRights`
  (`{ [droit]: { active: boolean, inactive: boolean } }`). Clé absente → défaut ; clé inconnue ou
  valeur non booléenne → ignorée.
- **Un seul lecteur** : `getOrgAccess(orgId)` (mis en cache par requête avec `cache()` de React)
  lit en parallèle les limites et les droits ; la décision est une fonction pure
  `can(access, right, event?)`. Layout et page d'une même requête partagent la lecture.
- **Espace `/event`** : les 24 routes d'écriture passent toutes par `withEventAuth` ; un garde
  unique y refuse les méthodes d'écriture (hors `GET`/`HEAD`/`OPTIONS`) sans
  `MANAGE_ONGOING_EVENTS`. Le staff n'est pas concerné. Les pages restent consultables.
  Conséquence assumée : une organisation inactive ne peut plus imprimer en lot ni scanner pour un
  évènement terminé.
- **Hors périmètre** : `free` vendable (il n'a pas de prix) ; durcissement des mutations API de
  l'espace org (déjà noté dans `features/abonnements.md`).

## Alternatives écartées

- Colonne « inactif » seule (un abonnement actif autorise tout) : plus simple, mais l'utilisateur
  veut pouvoir régler aussi l'état actif. Les combinaisons incohérentes (inactif plus permissif
  qu'actif) restent possibles et relèvent de la responsabilité du staff.
- Trois interrupteurs fixes : moins flexible que la liste de droits demandée.
- Repli sur `free` une seule fois : permet de relancer l'essai pour éviter de payer.
- Migration SQL en production : inutile, voir Contexte.
