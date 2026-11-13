---
route: /event/[eventId]/print/new
title: Nouvelle commande d'impression
audience: organisateur
access: print.request
sources:
  - src/app/event/[eventId]/print/new/page.tsx
  - src/components/event/print/NewPrintRequestForm.tsx
  - src/components/event/print/guard.ts
  - src/components/event/print/onsite-option.ts
  - src/components/ui/Button.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/RadioCards.tsx
  - src/components/ui/Stepper.tsx
sourceHash: sha256:e3a0fdcc231adeb8c0dc7d3d0a36238984523df90d0bcf2c5b9dd6112a9b6c5d
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Première étape de l'assistant de commande : le choix du type de commande. Le lien **Impression** en haut ramène à la liste. L'écran n'est pas accessible pour un évènement archivé ni pour le staff en consultation : vous revenez alors à la liste des commandes.

## Type de commande

Deux choix :
- **En amont** : les badges sont imprimés avant l'évènement, pour les inscriptions choisies.
- **Pendant l'évènement** : impression sur place, pendant l'évènement.

L'option **Pendant l'évènement** est grisée tant que la disponibilité est en cours de vérification, et lorsque le modèle de badge de l'évènement n'est pas adapté à l'impression sur place. Dans ce cas, le message « Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place. » s'affiche avec le lien **Changer le modèle de badge** vers les paramètres du badge.

Le bouton **Continuer** (actif une fois un type choisi) crée un brouillon de commande et ouvre l'étape suivante de l'assistant (voir la documentation de la modification d'une commande).
