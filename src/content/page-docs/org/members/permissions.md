---
route: /org/[orgId]/members/[userId]/permissions
title: Permissions d'un membre
audience: organisateur
access: org.members.permissions.manage
sources:
  - src/app/org/[orgId]/members/[userId]/permissions/page.tsx
  - src/components/permissions/PermissionSpaces.tsx
  - src/components/permissions/UserPermissionsEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:7e2480f75a2e716f38eedcabd226ca3f63ba7429593ac9fd17c22e2d557d8e08
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran ajuste, pour un membre précis, les permissions héritées de son rôle. Les ajustements s'appliquent à l'organisation et à tous ses évènements. Le nom et l'adresse e-mail du membre figurent en en-tête, et le lien **Membres** ramène à la liste.

Vous ne pouvez pas ajuster vos propres permissions, ni celles d'un autre propriétaire (sauf droit plateforme) : vous êtes alors renvoyé à la liste des membres.

## Le rôle du membre

Le nom de l'organisation et le rôle du membre sont rappelés au-dessus des permissions.

## Les permissions

Les permissions sont présentées en un onglet par espace (organisation, évènement), chacun avec son nombre de permissions actives, puis en un tableau par domaine, répartis sur plusieurs colonnes selon la largeur de l'écran. Pour chaque permission, un interrupteur indique si la permission est active pour ce membre, compte tenu de son rôle et des ajustements. Activer une permission que le rôle n'accorde pas l'ajoute à ce membre ; désactiver une permission que le rôle accorde la lui retire ; remettre l'interrupteur dans la position du rôle supprime l'ajustement. Vous ne pouvez activer une permission que le rôle n'accorde pas que si vous la détenez vous-même : sinon l'interrupteur est grisé, avec l'indication « Vous ne détenez pas cette permission. ».

Le bouton **Enregistrer** applique les ajustements (« Permissions enregistrées. »).
