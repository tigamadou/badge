# Spec v4 — Loader sur la planche en cours de génération (spec 38)

> **Statut** : implémentée — 2026-11-13 (branche `feat/roles-imprimeur-support`), validée — 2026-11-13
> **Type** : amélioration UI
> **Périmètre** : v4 — `/platform/print/sheets` (onglets « À traiter », « Générées », « Libre »)
> **Source** : `Todo.md` du 2026-11-12 (item 3)
> **Coordination** : [`2026-11-13-36-v4-chantier-roles-docs-coordination.md`](2026-11-13-36-v4-chantier-roles-docs-coordination.md) — lot 2a

## Contexte

Une génération de planches est asynchrone (`PrintSheetGeneration.status` :
`PENDING → RUNNING → DONE | FAILED`, exécutée par le worker). Dans
`OrderQueueTable`, le bouton « Générer » ouvre `GenerateOrderSheetDialog` ; à la
validation, la page est rafraîchie et rien n'indique, **sur la ligne**, que la planche est
en train d'être produite. L'onglet « Générées » affiche une pastille de statut et
rafraîchit toutes les 5 s, sans indicateur animé.

## Objectif

Montrer, sur la ligne concernée, qu'une planche est **en cours de génération**, jusqu'à ce
qu'elle soit prête ou en échec.

## Comportement

- Tant que la génération de la ligne est `PENDING` ou `RUNNING` :
  - la cellule de statut affiche un **spinner** et « Génération en cours… » (`PENDING` :
    « En attente… ») ;
  - les actions de la ligne (Générer, Regénérer, Aperçu, Télécharger) sont **désactivées** ;
  - la ligne reste visible dans l'onglet où l'action a été lancée (la commande ne quitte
    « À traiter » qu'une fois la planche `DONE`) *(arbitrage de l'agent : l'utilisateur
    voit l'issue sans changer d'onglet)* ;
  - le rafraîchissement automatique (5 s, onglet visible) tourne dans **les deux onglets**
    dès qu'une ligne est active.
- À `DONE` : la ligne passe à « Générée » avec un toast de succès (« Planche de
  {référence} prête ») ; dans « À traiter », elle disparaît au rafraîchissement suivant.
- À `FAILED` : pastille « Échec » avec le message d'erreur existant et un toast d'erreur ; le
  bouton « Regénérer » redevient actif.
- Même indicateur pour l'historique des générations **libres** (onglet « Libre »).
- Le bouton de validation du dialogue garde son loader pendant l'appel (règle existante,
  spec 28).

## Fichiers

`src/components/staff/print/sheets/OrderQueueTable.tsx`,
`src/components/staff/print/sheets/GenerateOrderSheetDialog.tsx`, l'historique des
générations libres, `src/lib/print-sheets/order-queue.ts` (garder en file les commandes dont
la génération est en cours), tests et e2e associés.

## Non-objectifs

Pas de barre de progression (le worker ne publie pas d'avancement), pas de notification
push.
