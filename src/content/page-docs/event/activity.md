---
route: /event/[eventId]/activity
title: Journal d'activité
audience: staff
access: event.activity.read
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/activity/page.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:e2127eadb45059903e86ad57f28d098fda39cfd50acb6275dad4a62402b1afb9
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le journal d'activité garde la trace des actions réalisées sur cet évènement, de la plus récente à la plus ancienne. La liste est paginée.

Si vous n'avez que le droit de voir votre historique de scans (sans le journal complet de l'évènement), la liste se limite à vos propres scans de badges.

## Le tableau

Colonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature), **Auteur** (adresse e-mail, « Système » pour une action automatique ; colonne masquée sur petit écran) et une flèche (« Voir le détail ») pour ouvrir l'entrée.

Une action marquée **staff** a été effectuée par le staff de la plateforme et non par un membre de l'évènement ou de l'organisation. S'il n'y a aucune entrée, l'écran affiche « Aucune activité. »
