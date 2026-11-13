---
route: /platform/roles
title: Rôles de la plateforme
audience: staff
access: platform.roles.manage
sources:
  - src/app/platform/roles/page.tsx
  - src/components/permissions/RoleTable.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/TabLinks.tsx
sourceHash: sha256:f9e4844f654491cc919ab1928456a2851bc42045c87787a80b68e30d38184b41
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les rôles système et les rôles personnalisés. Un rôle regroupe des permissions que vous attribuez ensuite aux comptes. Il est réservé aux profils qui peuvent gérer les rôles de la plateforme : les autres sont renvoyés au tableau de bord.

## Les onglets

Trois onglets séparent les niveaux de rôles : **Plateforme**, **Organisation** et **Évènement**. Seul l'onglet **Plateforme** permet de créer et de gérer des rôles : les deux autres sont consultables, avec le message « Les rôles de ce niveau sont consultables ici. Les rôles personnalisés d'une organisation sont gérés par l'organisation elle-même. »

Sur l'onglet **Plateforme**, le bouton **Nouveau rôle** ouvre le formulaire de création.

## La liste

Pour chaque rôle : son nom (cliquable tant qu'il n'est pas archivé), l'étiquette **Système** pour les rôles fournis par la plateforme, l'étiquette **Archivé**, sa description, le nombre de permissions et, lorsqu'il est connu, le nombre de membres qui le portent.

Actions (onglet **Plateforme** seulement) :
- **Dupliquer** : crée un nouveau rôle à partir de celui-ci (possible aussi pour un rôle système).
- **Modifier** : réservé aux rôles personnalisés non archivés.
- **Archiver** : archive un rôle personnalisé (« Rôle archivé. »).
- **Restaurer** : remet en service un rôle archivé (« Rôle restauré. »).

Les rôles système ne se modifient ni ne s'archivent.
