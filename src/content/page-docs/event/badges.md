---
route: /event/[eventId]/badges
title: Badges
audience: staff
access: badge.print
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/badges/page.tsx
  - src/components/event/BadgeListTable.tsx
  - src/components/ui/BatchBar.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
  - src/components/ui/Toolbar.tsx
sourceHash: sha256:4715a96cfd1afe27cc931d201c937943a7acd1b796b8b2369b8fc427273503fc
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les badges des inscriptions approuvées de l'évènement, pour les consulter, les prévisualiser en lot et les marquer comme imprimés.

## Les filtres

- La zone de recherche (« Rechercher un nom ou un identifiant… ») filtre la liste une fois la saisie terminée.
- Le sélecteur **Filtrer les badges** propose **Non imprimés** (valeur par défaut), **Imprimés**, **All-access** et **Tous**.
- Le filtre, la recherche, la page et la taille de page sont conservés dans l'adresse de la page : un rechargement ou un lien partagé retrouve le même affichage.

Changer de filtre ou de recherche abandonne la sélection en cours (message « La sélection a été réinitialisée. »).

## Sélectionner des badges

Cochez des lignes, ou cliquez sur **Tout sélectionner (n)** : cela sélectionne tous les badges correspondant au filtre en cours, pas seulement ceux de la page affichée. Le bouton devient **Tout désélectionner** quand tout est déjà sélectionné.

Dès qu'au moins un badge est sélectionné, une barre d'actions apparaît :
- **Aperçu PDF** : ouvre dans un nouvel onglet la page d'impression par lot avec votre sélection (voir « Impression par lot »).
- **Marquer imprimés** : marque tous les badges sélectionnés comme imprimés (« n badge(s) marqué(s) imprimé(s). »). L'impression elle-même n'est pas lancée : le marquage enregistre seulement qu'ils l'ont été.

## Le tableau

Colonnes : une case de sélection, **Nom**, **Catégorie** (numéro et nom ; colonne masquée sur petit écran) et **Badge**. La colonne Badge indique **Imprimé** ou « Non imprimé », avec l'étiquette **ALL ACCESS** si l'accès à toutes les zones a été accordé. Le lien **Voir** ouvre la fiche du badge. S'il n'y a rien à afficher, l'écran indique « Aucun badge. »

Sous le tableau, la pagination permet de changer de page et de choisir le nombre de lignes par page.
