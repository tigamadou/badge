---
route: /event/[eventId]
title: Tableau de bord
audience: organisateur
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/page.tsx
  - src/components/admin/SidebarNav.tsx
  - src/components/event/EventCover.tsx
  - src/components/event/EventImageAlert.tsx
  - src/components/event/EventInfoCard.tsx
  - src/components/event/PublicLinkCard.tsx
  - src/components/event/event-nav.ts
  - src/components/layout/sidebar-classes.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/StatCard.tsx
  - src/components/ui/StatusBadge.tsx
sourceHash: sha256:1b8f66d8ddd3ef47432639b6bacc1ada71512a33f65f498c3623983c853e1b48
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le tableau de bord est la page d'accueil de l'espace évènement. Son contenu dépend de vos droits : un rôle de lecture voit les chiffres de l'évènement, un opérateur de scan ou de poste sur place voit un tableau de bord réduit. Si votre rôle ne donne accès à aucun de ces contenus, vous êtes envoyé vers la première entrée de votre menu.

## L'en-tête

L'image de couverture de l'évènement, puis son titre et la mention « Tableau de bord de l'événement ».

## Informations de l'événement

La carte rappelle les dates, le lieu, la description et les catégories de l'évènement. L'étiquette **Inscriptions ouvertes** ou **Inscriptions fermées** indique l'état des inscriptions.

:::permission event.settings.update
## Images à recadrer

Le bandeau **Images à recadrer** apparaît tant que le logo ou la bannière ne respecte pas le cadre du modèle de badge : la génération des badges est alors bloquée. Il liste chaque image concernée, avec un lien **Recadrer dans les paramètres**.
:::

## Lien d'inscription public

La carte **Lien d'inscription public** montre l'adresse de la page d'inscription des participants. **Copier** la copie dans le presse-papiers (le bouton affiche « Copié » un instant) et **Ouvrir** l'ouvre dans un nouvel onglet. Quand les inscriptions sont fermées, la carte précise que la page affiche un message de fermeture.

:::permission scan.check-in
## Scanner

Le bloc affiche **Mes scans** (le nombre de badges que vous avez scannés sur cet évènement) et le bouton **Ouvrir le scanner**.
:::

:::permission event.read.aggregated
## Les chiffres

Une première rangée affiche **En attente**, **Approuvées**, **Rejetées** et **Badges imprimés**. Une seconde affiche **Scans aujourd'hui** et **Scans total** (tous les scans de l'évènement, pas seulement les vôtres).
:::

:::permission event.read.detailed
## Quota et dernières inscriptions

Avec les chiffres, la tuile **Quota inscriptions** compare le nombre d'inscriptions en attente ou approuvées au maximum de participants prévu par l'abonnement de l'organisation (« — » si aucune limite n'est connue). Au-delà de 80 %, l'alerte « Le quota d'inscriptions dépasse 80 %. » s'affiche.

La carte **Dernières inscriptions** liste les dix plus récentes (nom, e-mail, statut, date) ; cliquer sur une ligne ouvre l'inscription, et **Tout voir** ouvre la liste complète. Sans inscription : « Aucune inscription pour le moment ».
:::

## Tableau de bord opérateur

Si vous ne pouvez lire ni les chiffres agrégés ni les données détaillées, l'écran est réduit à l'image de couverture, au titre **Tableau de bord opérateur**, au bloc de scan (si vous pouvez contrôler l'accès) et, si vous tenez le poste d'impression sur place, à la carte **Poste sur place** avec le bouton **Ouvrir le poste d'impression sur place**.
