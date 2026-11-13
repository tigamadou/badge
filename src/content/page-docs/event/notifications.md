---
route: /event/[eventId]/notifications
title: Notifications
audience: staff
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/notifications/page.tsx
  - src/components/notifications/MarkAllReadButton.tsx
  - src/components/notifications/NotificationsView.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:1618cffe2cd49e37ed759e0782b1b561becf5e6c23948e767e32772f5889c54b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les notifications qui vous concernent dans cet évènement, des plus récentes aux plus anciennes.

## Filtrer

Deux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».

## Une notification

Chaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.

## Tout marquer comme lu

Le bouton **Tout marquer comme lu** marque comme lues les notifications de cet évènement.

## Parcourir l'historique

Si d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.
