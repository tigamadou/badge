---
route: /org/[orgId]/notifications
title: Notifications
audience: organisateur
sources:
  - src/app/org/[orgId]/notifications/page.tsx
  - src/components/notifications/MarkAllReadButton.tsx
  - src/components/notifications/NotificationsView.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:14f2e2e7575aa87d321c9caf41d8e597a3b9b317d4cf89026c17b95d23e9b5fc
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les notifications qui vous concernent dans cette organisation, des plus récentes aux plus anciennes.

## Filtrer

Deux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».

## Une notification

Chaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.

## Tout marquer comme lu

Le bouton **Tout marquer comme lu** marque comme lues les notifications de cette organisation.

## Parcourir l'historique

Si d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.
