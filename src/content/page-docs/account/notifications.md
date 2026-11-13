---
route: /account/notifications
title: Notifications
audience: participant
sources:
  - src/app/account/notifications/page.tsx
  - src/components/notifications/MarkAllReadButton.tsx
  - src/components/notifications/NotificationsView.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
sourceHash: sha256:cc8483b1e961d8a372bf661dc98c16687913b030391851711957f7ffd4b63d9d
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran liste les notifications de votre espace participant. La cloche du bandeau du haut en affiche un aperçu ; cette page présente l'historique complet.

## Filtre

Deux onglets permettent de choisir ce qui est affiché :

- **Toutes** : toutes vos notifications ;
- **Non lues seulement** : uniquement celles que vous n'avez pas encore lues. S'il n'y en a aucune, l'écran affiche « Aucune notification non lue » ; sans aucune notification, « Aucune notification ».

## Liste des notifications

Chaque notification affiche son titre, sa date relative et son message. Une notification non lue est signalée par la pastille **Non lue** et un titre en gras. Quand une notification contient un lien (par exemple vers une inscription), le titre ou un mot du message est cliquable ; d'autres liens peuvent apparaître sous le message.

## Tout marquer comme lu

Le bouton **Tout marquer comme lu**, en haut à droite, marque d'un coup toutes les notifications de votre espace comme lues.

## Parcourir les plus anciennes

Les notifications sont chargées par lots. **Notifications plus anciennes** affiche le lot suivant ; **Revenir aux plus récentes** ramène au début de la liste. Le filtre choisi est conservé.
