---
route: /org/[orgId]/templates
title: Modèles de catégories
audience: organisateur
access: org.templates.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/templates/TemplatesClient.tsx
  - src/app/org/[orgId]/templates/page.tsx
  - src/components/admin/CategoryTemplateForm.tsx
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/FormControls.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:689357a06def0648be4c79bbda1442741c49a869736819e3f0aa2bbeab7540d5
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran gère les catégories réutilisables de l'organisation, que vous pouvez reprendre lors de la création d'un évènement. Sans le droit de gestion, la liste est en lecture seule.

## Le tableau

Colonnes : **N°** (numéro de la catégorie), **Catégorie** (nom sur sa couleur) et **Options**. Les options possibles sont **Neutre** (badge neutre) et **Anonyme** ; « — » indique qu'aucune n'est activée. La liste est triée par numéro puis par nom, et paginée. S'il n'y a rien, l'écran affiche « Aucun modèle ».

:::permission org.templates.manage
## Ajouter, modifier, supprimer

Le bouton **Ajouter** ouvre la fenêtre « Nouveau modèle ». Le crayon (« Éditer ») ouvre « Modifier le modèle ». La corbeille (« Supprimer ») supprime le modèle après confirmation (« Supprimer ce modèle ? »).

Le formulaire contient :
- **Nom** (obligatoire) ;
- **Couleur** (bleu par défaut) ;
- **Numéro** (de 0 à 999, 0 par défaut) ;
- **Badge neutre** (désactivé par défaut) ;
- **Anonyme (pas de photo/nom sur badge)** (désactivé par défaut).

**Créer** (ou **Enregistrer** en modification) valide ; **Annuler** ferme la fenêtre.
:::
