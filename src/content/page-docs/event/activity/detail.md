---
route: /event/[eventId]/activity/[logId]
title: Détail d'une entrée du journal
audience: staff
access: event.activity.read
sources:
  - src/app/event/[eventId]/_lib/page-access.ts
  - src/app/event/[eventId]/activity/[logId]/page.tsx
  - src/components/activity/JournalEntryActions.tsx
  - src/components/activity/JournalEntryDetail.tsx
  - src/components/ui/Button.tsx
  - src/components/ui/Card.tsx
  - src/components/ui/Icon.tsx
  - src/components/ui/JournalBlocks.tsx
  - src/components/ui/Labels.tsx
  - src/components/ui/PickCard.tsx
sourceHash: sha256:607652f0a4e27cc00bf9668c66e55e3940c373bcb771bd6180c34785ddce132b
updatedAt: 2026-11-13
---

## À quoi sert cet écran

Cette fiche en lecture seule détaille une entrée du journal d'activité de l'évènement. Le lien **Journal d'activité** en haut ramène à la liste. Une entrée qui n'appartient pas à cet évènement est introuvable ; sans le journal complet, seules vos propres entrées de scan de badge sont accessibles.

## L'en-tête

Le type de l'action, le numéro « ENTRÉE # », une description en clair et la date et l'heure. Deux boutons :
- **Copier l'ID** : copie l'identifiant de l'entrée (le bouton affiche « Copié » un instant).
- **Exporter JSON** : télécharge l'entrée au format JSON.

## Détails de l'action

**Type**, **Auteur** (adresse e-mail, ou « Système »), **Contexte** (l'évènement) et **Staff** (Oui si l'action vient du staff de la plateforme).

## Modification

Lorsque l'action a modifié des valeurs, le bloc **Modification** montre pour chaque champ la valeur avant et après.

## Charge utile brute

Les données techniques de l'évènement, telles qu'enregistrées.

## Colonne latérale

- **Auteur** : nom, rôle éventuel, e-mail et adresse IP lorsqu'elle est connue ; « Action système » s'il n'y a pas d'auteur.
- **Contexte** : l'organisation, l'évènement et la cible de l'action ; « Aucun contexte associé. » s'il n'y en a pas.
