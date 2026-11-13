---
route: /platform/activity
title: Journal d'activité de la plateforme
audience: staff
access: activity.read
sources:
  - src/app/platform/activity/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:31db9289a547d2f1b4431d2dc0f989267a17a676845c89153a8a2c734f427a2f
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le journal d'activité garde la trace de toutes les actions de la plateforme, de la plus récente à la plus ancienne. La liste est paginée (10 entrées par page par défaut, modifiable en bas de page).

## Les filtres

Les filtres s'appliquent au clic sur **Filtrer** :
- **Type** : un type d'action précis (par exemple une création d'organisation ou une connexion). **Tous** par défaut.
- **Staff** : **Tous** (par défaut), **Oui** (actions effectuées par le staff de la plateforme) ou **Non**.
- **Du** et **Au** : bornes de dates.
- **Org ID** : identifiant d'une organisation, pour ne voir que ses actions.
- **User ID** : identifiant d'un utilisateur, pour ne voir que ses actions.

## Le tableau

Colonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature : création, modification, suppression, connexion, accès ou système), **Auteur** (adresse e-mail, « — » pour une action système ; colonne masquée sur petit écran), **Contexte** (organisation, évènement et cible concernés, lorsqu'ils existent ; colonne masquée sur petit écran) et une flèche (« Voir le détail ») qui ouvre la fiche de l'entrée.

S'il n'y a aucune entrée, l'écran affiche « Aucune entrée. »
