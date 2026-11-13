---
route: /platform/roles/new
title: Nouveau rôle de la plateforme
audience: staff
access: platform.roles.manage
sources:
  - src/app/platform/roles/new/page.tsx
  - src/components/permissions/PermissionMatrix.tsx
  - src/components/permissions/RoleEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:8a0a9db12261f46d1645f844508ae311a5f8fe4ee2c0e209d64ceef76d4b8490
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran crée un rôle personnalisé de la plateforme. Si vous arrivez par **Dupliquer**, le titre devient « Dupliquer un rôle » : les permissions sont reprises du rôle source et le nom proposé se termine par « (copie) ».

## Les champs

- **Nom du rôle** : obligatoire, de 2 à 60 caractères.
- **Description (facultative)** : 500 caractères au plus.

## La matrice des permissions

Les permissions sont regroupées par domaine, chacune avec son libellé et sa description. Cochez celles que le rôle doit accorder. Vous ne pouvez cocher que des permissions que vous détenez vous-même ; les autres sont grisées avec l'indication « Vous ne détenez pas cette permission. ». Lors d'une duplication, seules les permissions que vous pouvez accorder sont reprises.

## Valider

**Créer le rôle** (ou **Créer la copie** pour une duplication) enregistre le rôle (« Rôle créé. ») et vous ramène à la liste. Il reste inactif tant que le nom fait moins de 2 caractères. **Annuler** revient à la liste sans rien enregistrer.
