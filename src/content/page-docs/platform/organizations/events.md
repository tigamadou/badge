---
route: /platform/organizations/[orgId]/events
title: Événements d'une organisation
audience: staff
access: organizations.read
sources:
  - src/app/platform/organizations/[orgId]/events/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:6a3e1eaa24b023a93a8bd676b531c0b3aaf159104ef619bbdf76f6fd81dd9652
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **Événements** de la fiche d'une organisation liste, en lecture seule, ses évènements, du plus récent au plus ancien. Le titre indique le nombre total. La liste est paginée.

## Le tableau

Colonnes : **Événement** (titre, avec la mention « archivé » le cas échéant), **Date**, **Inscriptions** (**Ouvertes** ou **Fermées** : l'état des inscriptions, et non leur nombre) et **Inscriptions comptables** (le nombre d'inscriptions qui comptent dans le quota de l'abonnement). S'il n'y a rien, l'écran affiche « Aucun événement. »
