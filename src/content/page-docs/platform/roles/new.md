---
route: /platform/roles/new
title: Nouveau rôle de la plateforme
audience: staff
access: platform.roles.manage
sources:
  - src/app/platform/roles/new/page.tsx
  - src/components/permissions/PermissionMatrix.tsx
  - src/components/permissions/PermissionSpaces.tsx
  - src/components/permissions/RoleEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:edc5e02c3d16c08165d13faa93e1b8d6f09f66e175ea7a829d7bbb683aa8e20d
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran crée un rôle personnalisé de la plateforme. Si vous arrivez par **Dupliquer**, le titre devient « Dupliquer un rôle » : les permissions sont reprises du rôle source et le nom proposé se termine par « (copie) ».

## Les champs

- **Nom du rôle** : obligatoire, de 2 à 60 caractères.
- **Description (facultative)** : 500 caractères au plus.

## Le tableau des permissions

Les permissions sont présentées en un onglet par espace (plateforme, organisation, évènement, selon le niveau du rôle), chacun avec son nombre de permissions actives, puis en un tableau par domaine, répartis sur plusieurs colonnes selon la largeur de l'écran ; chaque permission a son libellé, sa description et un interrupteur, et chaque domaine indique combien sont actives. Activez celles que le rôle doit accorder. Vous ne pouvez activer que des permissions que vous détenez vous-même ; les autres sont grisées avec l'indication « Vous ne détenez pas cette permission. ». Lors d'une duplication, seules les permissions que vous pouvez accorder sont reprises.

## Valider

**Créer le rôle** (ou **Créer la copie** pour une duplication) enregistre le rôle (« Rôle créé. ») et vous ramène à la liste. Il reste inactif tant que le nom fait moins de 2 caractères. **Annuler** revient à la liste sans rien enregistrer.
