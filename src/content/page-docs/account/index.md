---
route: /account
title: Mes inscriptions
audience: participant
sources:
  - src/app/account/page.tsx
  - src/components/event/EventCover.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Pagination.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:be2ec5cabde819e8ef1471b34993bbe1aa24b2a33beeef9396e1bf0365c66b5b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran est votre page d'accueil de participant. Il vous salue (« Bonjour » suivi de votre nom du compte) et liste toutes vos inscriptions à des évènements, avec leur statut.

## Bandeau « Votre profil est incomplet »

Tant que votre profil n'est pas complété, un bandeau d'avertissement vous invite à fournir votre photo, votre pièce d'identité et votre structure, faute de quoi vous ne pouvez pas vous inscrire à un évènement. Le bouton **Compléter mon profil** ouvre le formulaire de complétion. Le bandeau disparaît dès que le profil est complété.

## Mes inscriptions

Les inscriptions sont classées de la plus récente à la plus ancienne. Chaque ligne affiche :

- la bannière de l'évènement, si elle existe (masquée sur petit écran) ;
- la date de l'évènement (jour et mois) ;
- le titre de l'évènement, son lieu et la catégorie choisie ;
- le statut de l'inscription : **En attente**, **Validé** ou **Rejeté** ;
- pour une inscription rejetée, le motif du rejet (« Motif : … ») lorsqu'il a été renseigné.

Cliquer sur une ligne ouvre le détail de l'inscription. Si vous n'avez encore aucune inscription, l'écran affiche « Aucune inscription ».

Lorsque la liste dépasse une page, la pagination en bas de liste permet de passer aux pages suivantes.

## Navigation de l'espace

Le bandeau du haut donne accès à **Mes inscriptions**, **Profil**, **Notifications** et **Documentation**, ainsi qu'à la cloche de notifications, au bouton « ? » (cette aide) et à **Se déconnecter**.
