---
route: /platform/plans
title: Plans
audience: staff
access: plans.read
sources:
  - src/app/platform/page-guard.ts
  - src/app/platform/plans/page.tsx
  - src/components/staff/PlanManager.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Dialog.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:09eb9472f2b8f0b96572eb0c7219541e795c662fdf9ada6717720c2825e31b4b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran présente le catalogue des plans d'abonnement : les limites d'évènements et de participants par évènement, le prix et la fiche publique de chaque plan. La liste est paginée. Sans le droit de gérer les plans, vous la consultez seulement.

## Le tableau

Colonnes :
- **Nom** et **Période** (Annuel ou Mensuel).
- **Max events** et **Max participants/event** : « Illimité » quand il n'y a pas de plafond.
- **Prix** : montant en FCFA, ou « Non vendu en ligne » lorsqu'aucun prix n'est fixé. Le lien **Modifier le prix** ouvre un champ « Prix (FCFA) » (minimum 100 ; vide = non vendu en ligne) avec **Enregistrer** (« Prix mis à jour. ») et **Annuler**. L'enregistrement n'aboutit qu'avec le droit de gérer les plans.
- **Public** : « Visible » ou « Masqué », suivi de la position et de « mis en avant » le cas échéant.
- **Abonnements** : nombre d'abonnements qui utilisent ce plan.

S'il n'y a aucun plan, l'écran affiche « Aucun plan. »

:::permission plans.manage
## Créer un plan

Le bouton **Nouveau plan** ouvre la fenêtre « Nouveau plan » :
- **Nom** : obligatoire ; « Ce nom de plan existe déjà. » si le nom est pris.
- **Période** : **Mensuel (30 jours)** par défaut, ou **Annuel (365 jours)**.
- **Max events (vide = illimité)** et **Max participants/event** : plafonds ; vide = illimité.
- **Prix (FCFA) (vide = non vendu en ligne)** : minimum 100.
- La fiche publique (voir ci-dessous).

**Créer le plan** valide (« Plan créé. ») ; **Annuler** ferme la fenêtre.

## La fiche publique

Le lien **Fiche publique** de chaque ligne ouvre un panneau, aussi présent à la création :
- **Visible sur /tarifs** : affiche le plan sur la page publique des tarifs. Non coché par défaut.
- **Mis en avant** : met le plan en valeur sur cette page.
- **Position (ordre d'affichage)** : de 0 à 9999, 0 par défaut.
- **Description courte (300 caractères max)** : vide = effacée.
- **Fonctionnalités (une par ligne, 12 max)** : les lignes vides sont ignorées.

**Enregistrer** valide (« Fiche publique mise à jour. »).

## Archiver et restaurer

**Archiver** retire un plan du catalogue (« Plan archivé. ») ; **Restaurer** le remet (« Plan restauré. »). Un plan archivé n'est plus proposé lors de l'attribution d'un abonnement.
:::
