---
route: /org/[orgId]/roles/[roleId]
title: Détail d'un rôle
audience: organisateur
access: org.roles.manage
sources:
  - src/app/org/[orgId]/roles/[roleId]/page.tsx
  - src/components/permissions/PermissionMatrix.tsx
  - src/components/permissions/RoleEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:5f8b1a1134f24319f406f0a476e3f1f41bbf847472d696891fb18b24135878d6
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran affiche le contenu d'un rôle et, pour un rôle personnalisé, permet de le modifier. Le lien **Rôles** en haut ramène à la liste, sur l'onglet correspondant. Le nom et la description du rôle figurent en en-tête.

## Rôle système ou archivé

Un rôle système, ou un rôle archivé, s'affiche en lecture seule : un message l'explique (« Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé. » ou « Ce rôle est archivé : restaurez-le pour le modifier. »), suivi de la matrice des permissions cochées, sans possibilité de changement.

## Rôle personnalisé

- **Nom du rôle** (2 à 60 caractères) et **Description (facultative)** (500 caractères au plus).
- La matrice des permissions, groupées par domaine : cochez ou décochez. Les permissions que vous ne détenez pas ne peuvent pas être ajoutées (« Vous ne détenez pas cette permission. »), mais celles déjà portées par le rôle restent décochables.
- **Enregistrer** applique les changements (« Rôle enregistré. ») et ramène à la liste ; **Annuler** revient sans enregistrer.

## Questions fréquentes

**Un rôle introuvable ?** Seuls les rôles système communs et les rôles personnalisés de votre organisation sont accessibles ; tout autre identifiant mène à une page introuvable.
