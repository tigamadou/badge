---
route: /org/[orgId]/roles
title: Rôles
audience: organisateur
access: org.roles.manage
sources:
  - src/app/org/[orgId]/roles/page.tsx
  - src/components/permissions/RoleTable.tsx
  - src/components/permissions/logic.ts
  - src/components/permissions/types.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/TabLinks.tsx
sourceHash: sha256:d6cf6a532652129d16f84fa2f7bb709bd292099a3a0ebc246e18fb241b903179
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les rôles système communs et les rôles personnalisés de votre organisation. Un rôle regroupe des permissions que vous attribuez ensuite aux membres.

## Les onglets

Deux onglets séparent les niveaux de rôles : **Organisation** (permissions de l'espace organisation) et **Évènement** (permissions à l'intérieur des évènements). Le bouton **Nouveau rôle** crée un rôle du niveau de l'onglet affiché.

## La liste

Pour chaque rôle : son nom (cliquable tant qu'il n'est pas archivé), l'étiquette **Système** pour les rôles fournis par la plateforme, l'étiquette **Archivé**, sa description, le nombre de permissions et, lorsqu'il est connu, le nombre de membres qui le portent.

Actions :
- **Dupliquer** : crée un nouveau rôle à partir de celui-ci (possible aussi pour un rôle système).
- **Modifier** : réservé aux rôles personnalisés non archivés.
- **Archiver** : archive un rôle personnalisé (« Rôle archivé. »).
- **Restaurer** : remet en service un rôle archivé (« Rôle restauré. »).

Les rôles système ne se modifient ni ne s'archivent.
