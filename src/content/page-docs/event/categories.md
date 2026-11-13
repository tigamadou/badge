---
route: /event/[eventId]/categories
title: Catégories
audience: organisateur
access: event.read.detailed
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/categories/page.tsx
  - src/components/event/CategoryForm.tsx
  - src/components/event/CategoryImportTemplatesModal.tsx
  - src/components/event/CategoryReassignModal.tsx
  - src/components/event/CategoryTable.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:96f79b7b87aea7e792a6e219ecaa53cdefd5dbbc309810ad939d1c9b21990d37
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les catégories de participation de l'évènement (par exemple « Participant », « Intervenant »). Chaque inscription appartient à une catégorie, qui détermine l'apparence du badge. Sans le droit de gérer les catégories, la liste est en lecture seule.

## Le tableau

Colonnes : **N°** (numéro de la catégorie), **Catégorie** (nom et couleur), **Options**, **Inscriptions** (nombre d'inscriptions dans la catégorie) et une colonne d'actions. La colonne Options affiche **Neutre** et/ou **Anonyme** selon la catégorie, « — » si aucune. Sans catégorie, l'écran affiche « Aucune catégorie » et invite à créer la première. La liste est paginée.

:::permission event.categories.manage
## Ajouter, importer, modifier, supprimer

En haut de l'écran :
- **Ajouter** ouvre la fenêtre **Nouvelle catégorie** ;
- **Importer un modèle** ouvre **Importer des modèles de catégories** : cochez un ou plusieurs modèles de l'organisation, puis **Importer (n)** (« n modèle(s) importé(s). »). S'il n'y en a aucun : « Aucun modèle disponible pour cette organisation. »

Sur chaque ligne, le crayon (« Éditer ») ouvre **Modifier la catégorie** et la corbeille (« Supprimer ») supprime la catégorie.

Le formulaire de catégorie contient :
- **Nom** (obligatoire, unique dans l'évènement : « Le nom « … » est déjà utilisé dans cet événement. ») ;
- **Couleur** (bleu par défaut) ;
- **Numéro** (de 0 à 999, 0 par défaut, unique dans l'évènement : « Le numéro … est déjà utilisé dans cet événement. ») ;
- **Badge neutre (couleur grise sur le PDF)** : désactivé par défaut ;
- **Anonyme (pas de nom ni de photo sur le badge)** : désactivé par défaut. Dans les écrans de badges, l'identité de ces participants s'affiche « Identité masquée ».

Boutons **Créer** (« Catégorie créée. ») ou **Enregistrer** (« Catégorie modifiée. »), et **Annuler**.

**Supprimer** une catégorie vide demande confirmation (« Supprimer la catégorie « … » ? ») puis la supprime (« Catégorie supprimée. »). Si la catégorie contient des inscriptions, la fenêtre **Réaffecter les inscriptions de « … »** s'ouvre : choisissez la catégorie de destination dans **Vers :** puis **Réaffecter et supprimer** (« Inscriptions réaffectées, catégorie supprimée. »). Sans autre catégorie disponible, il faut d'abord en créer une.
:::
