---
route: /platform/organizations
title: Organisations
audience: staff
access: organizations.read
sources:
  - src/app/platform/organizations/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/staff/OrganizationsTable.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/PickCard.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:c49bb6a3c1838f979c443f73187177588556dbfd7747e0a7d8fd853ca78d2f44
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les organisations de la plateforme. La liste est paginée.

## Rechercher et filtrer

- **Rechercher une organisation…** : recherche sur le nom ou le slug.
- **Afficher les archivées** : par défaut, seules les organisations actives sont listées ; cochez la case pour ne voir que les organisations archivées.

Les filtres s'appliquent au clic sur **Filtrer**.

## Le tableau

Colonnes : **Organisation** (logo, nom cliquable et mention « Archivée » le cas échéant), **Slug**, **Membres** et **Événements** (ces trois dernières masquées sur petit écran) et une flèche qui ouvre la fiche. S'il n'y a rien, l'écran affiche « Aucune organisation. »

:::permission organizations.create
## Créer une organisation

Le bouton **Créer une organisation** en haut à droite ouvre le formulaire de création.
:::
