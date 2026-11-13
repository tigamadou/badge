---
route: /platform/organizations/[orgId]/activity
title: Journal d'une organisation
audience: staff
access: activity.read
sources:
  - src/app/platform/activity/page.tsx
  - src/app/platform/organizations/[orgId]/activity/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/TableFrame.tsx
sourceHash: sha256:14edce6e4ab4f192284cf01ef45d5b00599fe2937444f88844f977d9be42e36d
updatedAt: 2026-11-13
---

## À quoi sert cet écran

L'onglet **Journal** de la fiche d'une organisation liste, en lecture seule, les actions enregistrées pour cette organisation, de la plus récente à la plus ancienne. Le titre indique le nombre total d'entrées. La liste est paginée.

## Le tableau

Colonnes : **Horodatage**, **Action** (type de l'action, coloré selon sa nature), **Auteur** (adresse e-mail, « — » pour une action système ; la mention « (staff) » signale une action du staff de la plateforme) et **Contexte** (évènement et cible concernés). S'il n'y a rien, l'écran affiche « Aucune entrée. »

Pour le détail d'une entrée, ouvrez le journal de la plateforme.
