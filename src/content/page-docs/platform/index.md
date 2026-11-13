---
route: /platform
title: Tableau de bord de la plateforme
audience: staff
access: platform.access
sources:
  - src/app/platform/_components/PrintDashboardBlock.tsx
  - src/app/platform/page-guard.ts
  - src/app/platform/page.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Feedback.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/PickCard.tsx
  - src/components/ui/StatCard.tsx
  - src/components/ui/Timeline.tsx
sourceHash: sha256:24100d41e429881984ba697f5e35ffafe28a009ad8885125728c348e2a85a2be
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Le tableau de bord donne une vue d'ensemble de la plateforme. Les blocs affichés dépendent de vos droits : un bloc dont vous n'avez pas le droit n'apparaît pas.

## Chiffres clés

Visibles avec le droit de consulter les organisations : **Organisations actives**, **Organisations archivées**, **Événements actifs** et **Inscriptions cumulées**.

## Top organisations

Visible avec le droit de consulter les organisations. Classe, sous « Par inscriptions ce mois-ci », les cinq organisations qui ont reçu le plus d'inscriptions depuis le début du mois, avec une barre proportionnelle et le nombre d'inscriptions. Un clic sur le nom ouvre la fiche de l'organisation ; **Tout voir** ouvre la liste des organisations. S'il n'y a aucune inscription ce mois-ci, l'écran l'indique.

## Activité récente

Visible avec le droit de consulter le journal plateforme. Liste les dix dernières actions ; celles du staff sont marquées « Staff · ». **Tout voir** ouvre le journal d'activité. S'il n'y a rien, l'écran affiche « Aucune activité récente ».

## Impression

Ce bloc remplace la vue d'ensemble pour un profil qui ne peut pas consulter les organisations mais peut lire les commandes ou les planches d'impression (l'équipe de production). Il affiche, selon vos droits, **Commandes à traiter** et **Planches à générer**, avec les liens **Ouvrir les commandes** et **Ouvrir les planches**.
