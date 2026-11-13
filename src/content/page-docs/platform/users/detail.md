---
route: /platform/users/[userId]
title: Fiche d'un utilisateur
audience: staff
sources:
  - src/app/platform/users/[userId]/UserDetailActions.tsx
  - src/app/platform/users/[userId]/page.tsx
  - src/components/permissions/RoleSelect.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Timeline.tsx
sourceHash: sha256:e293a99401119accf38880a7fe57fbf55dce35b52beba1a208cc0a847547b6fe
updatedAt: 2026-11-13
---

## À quoi sert cet écran

La fiche présente un compte (staff ou client), ses appartenances et son activité récente, et propose quelques actions d'administration. Le lien **Utilisateurs** en haut ramène à la liste. Un compte inexistant est introuvable.

## L'en-tête

Initiales, nom, e-mail, rôle plateforme pour un compte staff, et mention « Archivé » le cas échéant.

:::permission users.permissions.manage
## Permissions

Le bouton **Permissions** ouvre l'écran d'ajustement des permissions du compte. Il n'est pas proposé sur votre propre compte.
:::

## Informations

**Type** (« Staff applicatif » ou « Client »), **Créé le** et **Statut** (Actif ou Archivé).

## Organisations et évènements

**Organisations (N)** : chaque organisation du compte (un clic ouvre sa fiche, avec la mention « (archivée) » le cas échéant) et son rôle. « Aucune appartenance organisation. » s'il n'y en a pas.
**Événements (N)** : chaque évènement du compte et son rôle. « Aucune appartenance événement. » s'il n'y en a pas.

## Actions

Le bloc **Actions** réunit les actions que vos droits permettent :

:::permission users.password.reset
- **Renvoyer un lien de configuration de mot de passe** (compte non archivé) : régénère le lien d'invitation (« Lien d'invitation régénéré. »).
:::

:::permission users.staff.assign_role
- **Rôle plateforme** et **Changer le rôle** (compte staff, autre que le vôtre) : choisissez un rôle parmi ceux que vous pouvez attribuer puis validez (« Rôle mis à jour. ») ; le bouton reste inactif tant que le rôle n'a pas changé.
:::

:::permission users.archive
- **Archiver l'utilisateur** (compte non archivé, autre que le vôtre) : archive le compte (« Utilisateur archivé. »).
:::

Sur votre propre compte, un message précise que vous ne pouvez ni l'archiver ni modifier votre propre rôle.

## Journal récent

Les 20 dernières actions réalisées par le compte ou le concernant ; celles du staff sont marquées « Staff · ». « Aucune activité. » s'il n'y en a pas.
