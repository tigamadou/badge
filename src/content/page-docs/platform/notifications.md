---
route: /platform/notifications
title: Notifications
audience: staff
access: platform.access
sources:
  - src/app/platform/notifications/page.tsx
  - src/app/platform/page-guard.ts
  - src/components/notifications/MarkAllReadButton.tsx
  - src/components/notifications/NotificationsView.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:7ddf0047d8f8d999a3ab3f563d1c6fac7e67c9671d6ec1779db6469dd22d2f28
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les notifications qui vous concernent sur la plateforme, des plus récentes aux plus anciennes.

## Filtrer

Deux filtres : **Toutes** et **Non lues seulement**. S'il n'y a rien à afficher, l'écran indique « Aucune notification » ou « Aucune notification non lue ».

## Une notification

Chaque notification affiche son titre, son ancienneté et, si vous ne l'avez pas lue, une pastille **Non lue** (le titre est alors en gras). Les liens du texte ou sous la notification mènent à la page concernée.

## Tout marquer comme lu

Le bouton **Tout marquer comme lu** marque comme lues vos notifications de la plateforme.

## Parcourir l'historique

Si d'autres notifications existent, le lien **Notifications plus anciennes** affiche la suite ; **Revenir aux plus récentes** ramène au début.
