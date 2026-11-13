---
route: /event/[eventId]/registrations/overview
title: Vue d'ensemble des inscriptions
audience: staff
access: event.read.aggregated
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/registrations/overview/page.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/StatCard.tsx
sourceHash: sha256:d47c6698a6615f015ea9e72b5891c0080f8bcf34c6ca229b26d5e015aa4cbe90
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cet écran donne la répartition des inscriptions de l'évènement sans aucune donnée nominative : seulement des chiffres. Il est destiné aux rôles qui peuvent lire les chiffres agrégés mais pas le détail des inscriptions.

## Les chiffres par statut

Trois tuiles : **En attente**, **Approuvées** et **Rejetées**.

## Répartition par catégorie

La carte liste chaque catégorie (numéro et nom) avec le nombre d'inscriptions qu'elle contient. Sans catégorie : « Aucune catégorie. »

## Total comptabilisé

Le nombre d'inscriptions en attente ou approuvées. Les rejets ne sont pas comptabilisés dans le quota d'inscriptions de l'abonnement.
