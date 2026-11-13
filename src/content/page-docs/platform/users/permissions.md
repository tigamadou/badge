---
route: /platform/users/[userId]/permissions
title: Permissions d'un utilisateur
audience: staff
access: users.permissions.manage
sources:
  - src/app/platform/users/[userId]/permissions/page.tsx
  - src/components/permissions/UserPermissionsEditor.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
sourceHash: sha256:5043f5ec00794ce221bb2b830403b5ad698daf43f28f31810431c2c79fc2ab35
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran ajuste les permissions d'un compte par rapport à son rôle : vous pouvez en ajouter ou en retirer. Il n'est pas accessible sur votre propre compte : vous revenez alors à la fiche, comme si vous n'aviez pas le droit. Le lien en haut (le nom du compte) ramène à la fiche. Sous le titre « Permissions de … », l'écran rappelle que « Un retrait l'emporte sur un ajout. » et que vous ne pouvez ajouter que des permissions que vous détenez vous-même ; les permissions réservées aux rôles système ne sont pas ajustables.

## Un bloc par niveau

Un bloc **Plateforme** est suivi d'un bloc par organisation du compte ; chacun rappelle le rôle du compte à ce niveau. Les permissions sont regroupées par domaine. Pour chacune :
- l'état « Effectif » ou « Non effectif », qui tient compte du rôle et des ajustements ;
- un sélecteur **Hérité** (le rôle décide), **Ajouté** (accordée en plus ; indisponible, avec la mention « (non détenue) », si vous ne la détenez pas vous-même) ou **Retiré** (retirée même si le rôle l'accorde).

## Enregistrer

Chaque bloc a son propre bouton **Enregistrer** (« Permissions enregistrées. »).
