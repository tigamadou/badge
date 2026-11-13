---
route: /platform/roles/[roleId]
title: Détail d'un rôle de la plateforme
audience: staff
access: platform.roles.manage
sources:
  - src/app/platform/roles/[roleId]/page.tsx
  - src/components/permissions/PermissionMatrix.tsx
  - src/components/permissions/PermissionSpaces.tsx
  - src/components/permissions/RoleEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:cafafc64d715ec8d77423cd0e5bb1cc0984ea351608c95a92c5c90edd32cebd3
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran affiche le contenu d'un rôle et, pour un rôle personnalisé de la plateforme, permet de le modifier. Le lien **Rôles** en haut ramène à la liste. Le nom et la description du rôle figurent en en-tête.

## Rôle en lecture seule

Un rôle système (de n'importe quel niveau), un rôle archivé ou un rôle qui n'est pas de niveau plateforme s'affiche en lecture seule, avec le tableau des permissions dont les interrupteurs montrent celles qui sont actives. Un message l'explique pour un rôle système (« Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé. ») ou un rôle archivé (« Ce rôle est archivé : restaurez-le pour le modifier. »).

## Rôle personnalisé de la plateforme

- **Nom du rôle** (2 à 60 caractères) et **Description (facultative)** (500 caractères au plus).
- Les permissions, présentées en un onglet par espace (plateforme, organisation, évènement), chacun avec son nombre de permissions actives ; dans chaque onglet, un tableau par domaine, répartis sur plusieurs colonnes selon la largeur de l'écran : activez ou désactivez l'interrupteur de chaque ligne. Les permissions que vous ne détenez pas ne peuvent pas être activées (« Vous ne détenez pas cette permission. »), mais celles déjà portées par le rôle restent désactivables.
- **Enregistrer** applique les changements (« Rôle enregistré. ») et ramène à la liste ; **Annuler** revient sans enregistrer.

## Questions fréquentes

**Un rôle introuvable ?** Les rôles système de tous les niveaux et les rôles personnalisés de la plateforme sont accessibles ; tout autre identifiant mène à une page introuvable.
