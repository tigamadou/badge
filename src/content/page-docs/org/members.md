---
route: /org/[orgId]/members
title: Membres
audience: organisateur
access: org.members.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/members/MembersClient.tsx
  - src/app/org/[orgId]/members/page.tsx
  - src/components/admin/OrgMemberForm.tsx
  - src/components/permissions/RoleSelect.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/ActionButton.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Input.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:96d7c5f038b633753c2ca3cec7c1aaab06f817869bb65bc7293be5e588bdc7ca
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les membres de votre organisation avec leur rôle. Sans le droit de gestion des membres, la liste est en lecture seule.

:::permission org.members.manage
## Inviter un membre

La carte **Inviter un membre** envoie un e-mail d'invitation. Renseignez le nom complet, l'adresse e-mail et choisissez le rôle (par défaut Manager lorsqu'il est attribuable), puis cliquez sur **Inviter**. Le sélecteur sépare les rôles système et les rôles personnalisés ; un rôle que vous ne pouvez pas attribuer est grisé avec sa raison. Le message « Invitation envoyée. » confirme l'envoi.
:::

## Le tableau

Colonnes : **Membre** (nom et e-mail), **Rôle** et **Invité le**.

:::permission org.members.manage
Dans la colonne Rôle, le sélecteur permet de changer le rôle d'un membre (« Rôle mis à jour. »). Vous ne pouvez pas modifier votre propre rôle, ni celui d'un autre propriétaire (sauf droit plateforme) : le rôle s'affiche alors en simple étiquette.

Le bouton **Retirer** exclut un membre après confirmation (« Retirer ce membre ? »). Le dernier propriétaire (OWNER) ne peut ni changer de rôle ni être retiré : la mention « Dernier OWNER » le signale.
:::

:::permission org.members.permissions.manage
Le lien **Permissions** ouvre l'ajustement des permissions du membre. Il n'est pas proposé pour votre propre ligne, ni pour un autre propriétaire (sauf droit plateforme).
:::
