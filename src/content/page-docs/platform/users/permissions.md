---
route: /platform/users/[userId]/permissions
title: Permissions d'un utilisateur
audience: staff
access: users.permissions.manage
sources:
  - src/app/platform/users/[userId]/permissions/page.tsx
  - src/components/permissions/LevelSwitcher.tsx
  - src/components/permissions/PermissionSpaces.tsx
  - src/components/permissions/UserPermissionsEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Tabs.tsx
sourceHash: sha256:0c05f4ecd34ffd200ad113bc511a9fd9b3ea45efcdb60f5ae226f9391b9e8977
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran ajuste les permissions d'un compte par rapport à son rôle : vous pouvez en ajouter ou en retirer. Il n'est pas accessible sur votre propre compte : vous revenez alors à la fiche, comme si vous n'aviez pas le droit. Le lien en haut (le nom du compte) ramène à la fiche. Sous le titre « Permissions de … », l'écran rappelle que « Un retrait l'emporte sur un ajout. » et que vous ne pouvez ajouter que des permissions que vous détenez vous-même ; les permissions réservées aux rôles système ne sont pas ajustables.

## Un niveau à la fois

Si le compte appartient à des organisations, des onglets en tête permettent de passer du niveau **Plateforme** à chacune de ses organisations ; chaque niveau rappelle le rôle du compte à ce niveau. Les permissions y sont présentées en un onglet par espace (plateforme, organisation, évènement), chacun avec son nombre de permissions actives, puis en un tableau par domaine, répartis sur plusieurs colonnes selon la largeur de l'écran. Pour chaque permission, un interrupteur indique si la permission est active pour ce compte, compte tenu de son rôle et des ajustements. Activer une permission que le rôle n'accorde pas l'ajoute à ce compte ; désactiver une permission que le rôle accorde la lui retire ; remettre l'interrupteur dans la position du rôle supprime l'ajustement. Vous ne pouvez activer une permission que le rôle n'accorde pas que si vous la détenez vous-même : sinon l'interrupteur est grisé, avec l'indication « Vous ne détenez pas cette permission. ».

## Enregistrer

Chaque niveau a son propre bouton **Enregistrer** (« Permissions enregistrées. ») ; les changements d'un niveau sont conservés quand vous passez à un autre avant d'enregistrer.
