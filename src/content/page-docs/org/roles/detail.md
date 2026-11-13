---
route: /org/[orgId]/roles/[roleId]
title: Détail d'un rôle
audience: organisateur
access: org.roles.manage
sources:
  - src/app/org/[orgId]/roles/[roleId]/page.tsx
  - src/components/permissions/PermissionMatrix.tsx
  - src/components/permissions/PermissionSpaces.tsx
  - src/components/permissions/RoleEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
sourceHash: sha256:15c4110912c803b80cbb3eda8049f764224b179e12a502cbd9764d7bb4429fb7
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran affiche le contenu d'un rôle et, pour un rôle personnalisé, permet de le modifier. Le lien **Rôles** en haut ramène à la liste, sur l'onglet correspondant. Le nom et la description du rôle figurent en en-tête.

## Rôle système ou archivé

Un rôle système, ou un rôle archivé, s'affiche en lecture seule : un message l'explique (« Rôle système : son contenu est fixé par le code. Vous pouvez le dupliquer pour créer un rôle personnalisé. » ou « Ce rôle est archivé : restaurez-le pour le modifier. »), suivi du tableau des permissions, dont les interrupteurs montrent celles qui sont actives, sans possibilité de changement.

## Rôle personnalisé

- **Nom du rôle** (2 à 60 caractères) et **Description (facultative)** (500 caractères au plus).
- Les permissions, présentées en un onglet par espace (plateforme, organisation, évènement), chacun avec son nombre de permissions actives ; dans chaque onglet, un tableau par domaine, répartis sur plusieurs colonnes selon la largeur de l'écran : activez ou désactivez l'interrupteur de chaque ligne. Les permissions que vous ne détenez pas ne peuvent pas être activées (« Vous ne détenez pas cette permission. »), mais celles déjà portées par le rôle restent désactivables.
- **Enregistrer** applique les changements (« Rôle enregistré. ») et ramène à la liste ; **Annuler** revient sans enregistrer.

## Questions fréquentes

**Un rôle introuvable ?** Seuls les rôles système communs et les rôles personnalisés de votre organisation sont accessibles ; tout autre identifiant mène à une page introuvable.
