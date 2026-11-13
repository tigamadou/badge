---
route: /platform/organizations/[orgId]/members
title: Membres d'une organisation
audience: staff
access: organizations.read
sources:
  - src/app/platform/organizations/[orgId]/members/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/permissions/RoleSelect.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/platform/PlatformOrgMemberInviteForm.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:e1f6da597ae57182033d37e3d646e1a17604d41e3598e790c3e70bf167674128
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **Membres** de la fiche d'une organisation liste ses membres, du plus ancien au plus récent. Le titre indique le nombre total. La liste est paginée.

:::permission organizations.members.manage
## Inviter un membre

Le bloc **Inviter un membre** ajoute un membre sans entrer dans l'organisation :
- **Nom complet** et **email@exemple.fr** (adresse e-mail) : obligatoires.
- **Rôle** : un rôle d'organisation que vous avez le droit d'attribuer ; il est proposé par défaut sur le rôle OWNER lorsqu'il est disponible.
- **Inviter** envoie l'invitation (« Invitation envoyée. ») ; le bouton reste inactif tant qu'aucun rôle n'est choisi. En cas d'échec : « Échec de l'invitation. »
:::

## Le tableau

Colonnes : **Nom**, **E-mail**, **Rôle** (nom du rôle de l'organisation ; « Propriétaire », « Gestionnaire » ou « Auditeur » pour les anciens rôles ; « — » sinon) et **Depuis** (date d'arrivée). S'il n'y a rien, l'écran affiche « Aucun membre. » Cet écran ne permet ni de changer le rôle d'un membre ni de le retirer.
