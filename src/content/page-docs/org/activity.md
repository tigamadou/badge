---
route: /org/[orgId]/activity
title: Journal d'activité
audience: organisateur
access: org.activity.read
sources:
  - src/app/org/[orgId]/_lib/page-access.ts
  - src/app/org/[orgId]/activity/page.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:38b4ec02cb6675b4b672a4dc6a9c80292b96f3c93f7adb67f7d0dd01eb161ebf
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le journal d'activité garde la trace des actions effectuées dans votre organisation, de la plus récente à la plus ancienne. La liste est paginée.

## Le tableau

Colonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature, par exemple une suppression), **Auteur** (adresse e-mail, « — » pour une action système ; colonne masquée sur petit écran) et une flèche pour ouvrir le détail (« Voir le détail »).

Une action marquée **staff** a été effectuée par le staff de la plateforme et non par un membre de l'organisation. S'il n'y en a aucune, l'écran affiche « Aucune activité. »
